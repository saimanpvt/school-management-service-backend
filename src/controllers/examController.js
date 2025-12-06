const Exam = require('../models/Exam');
const Course = require('../models/Course');
const Student = require('../models/Student');
const { USER_ROLES } = require('../config/constants');
const asyncHandler = require('express-async-handler'); // Recommended wrapper

// ---------------------------------------------------
// GET Exam List - role-based
// ---------------------------------------------------
exports.getExamRecordList = asyncHandler(async (req, res) => {
  const user = req.user;

  // 1. ADMIN → All active exams
  if (user.role === USER_ROLES.ADMIN) {
    const allExams = await Exam.find()
      .populate('course', 'courseName courseCode')
      .sort({ examDate: 1 });
    return res.json({ success: true, exams: allExams });
  }

  // 2. TEACHER → Exams for their specific courses
  if (user.role === USER_ROLES.TEACHER) {
    // Find courses taught by this teacher
    const teacherCourses = await Course.find({ teacherId: user._id }).distinct('_id');

    const exams = await Exam.find({
      course: { $in: teacherCourses }, // Match exams belonging to those courses
      isActive: true
    })
    .populate('course', 'courseName courseCode')
    .sort({ examDate: 1 });

    return res.json({ success: true, exams });
  }

  // 3. STUDENT → Exams for courses in their class(es)
  if (user.role === USER_ROLES.STUDENT) {
    const student = await Student.findOne({ userId: user._id });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student record not found' });
    }

    // A. Find all courses assigned to the student's class(es)
    // Note: student.classId is an Array now
    const studentCourses = await Course.find({ 
      classId: { $in: student.classId } 
    }).distinct('_id');

    // B. Find exams for those courses
    const exams = await Exam.find({
      course: { $in: studentCourses },
      isActive: true
    })
    .populate('course', 'courseName courseCode')
    .sort({ examDate: 1 });

    return res.json({ success: true, exams });
  }

  // 4. PARENT → Exams for their children's classes
  if (user.role === USER_ROLES.PARENT) {
    // Find all children
    const children = await Student.find({ parentId: user._id });
    if (!children.length) {
      return res.status(404).json({ success: false, message: "No children found" });
    }

    // Collect all unique Class IDs from all children
    // Flatten array of arrays if children have multiple classes
    const allClassIds = children.flatMap(child => child.classId);

    // A. Find courses for these classes
    const childCourses = await Course.find({ 
      classId: { $in: allClassIds } 
    }).distinct('_id');

    // B. Find exams
    const exams = await Exam.find({ 
      course: { $in: childCourses }, 
      isActive: true 
    })
    .populate('course', 'courseName courseCode')
    .sort({ examDate: 1 });

    return res.json({ success: true, exams });
  }

  return res.status(403).json({ success: false, message: "Forbidden" });
});

// ---------------------------------------------------
// GET single exam - role-protected
// ---------------------------------------------------
exports.getExamRecord = asyncHandler(async (req, res) => {
  const user = req.user;
  
  // Populate course immediately to access classId/teacherId logic
  const exam = await Exam.findById(req.params.id).populate('course');

  if (!exam) return res.status(404).json({ message: 'Exam not found' });

  // 1. ADMIN
  if (user.role === USER_ROLES.ADMIN) {
    return res.json({ success: true, exam });
  }

  // 2. TEACHER
  if (user.role === USER_ROLES.TEACHER) {
    // Check if teacher owns the course
    if (!exam.course || exam.course.teacherId.toString() !== user._id.toString()) {
      return res.status(403).json({ message: "You don't own the course for this exam" });
    }
    return res.json({ success: true, exam });
  }

  // 3. STUDENT
  if (user.role === USER_ROLES.STUDENT) {
    const student = await Student.findOne({ userId: user._id });
    
    // Check if the exam's course belongs to one of the student's classes
    // exam.course.classId vs student.classId (Array)
    const isClassMatch = student.classId.some(
      (cid) => cid.toString() === exam.course.classId.toString()
    );

    if (!student || !isClassMatch) {
      return res.status(403).json({ message: "Not allowed to view this exam" });
    }
    return res.json({ success: true, exam });
  }

  // 4. PARENT
  if (user.role === USER_ROLES.PARENT) {
    // Find if ANY child belongs to the class of this exam
    const child = await Student.findOne({ 
      parentId: user._id, 
      classId: exam.course.classId // Match the class of the course
    });

    if (!child) return res.status(403).json({ message: "Not allowed" });
    return res.json({ success: true, exam });
  }

  return res.status(403).json({ message: "Forbidden" });
});

// ---------------------------------------------------
// ADD exam - Teacher only (Admin can be added if needed)
// ---------------------------------------------------
exports.addExamRecord = asyncHandler(async (req, res) => {
  const teacherId = req.user._id;
  const userRole = req.user.role;
  const { 
    examName, examType, courseId, totalMarks, 
    passingMarks, examDate, startTime, duration, venue, instructions 
  } = req.body;

  // 1. Check Course
  const courseDoc = await Course.findById(courseId);
  if (!courseDoc) return res.status(404).json({ message: "Course not found" });

  // 2. Verify Ownership (If Teacher)
  if (userRole === USER_ROLES.TEACHER) {
    if (courseDoc.teacherId.toString() !== teacherId.toString()) {
      return res.status(403).json({ message: "You don't own this course" });
    }
  } else if (userRole !== USER_ROLES.ADMIN) {
     return res.status(403).json({ message: "Forbidden" });
  }

  // 3. Create Exam
  // We DO NOT save classId or academicYear (they are in Course)
  const exam = await Exam.create({
    examName,
    examType,
    course: courseId, // Map incoming ID to schema field
    totalMarks,
    passingMarks,
    examDate,
    startTime,
    duration,
    venue,
    instructions,
    isActive: true
  });

  return res.status(201).json({ success: true, exam });
});

// ---------------------------------------------------
// UPDATE exam - Teacher / Admin
// ---------------------------------------------------
exports.updateExamRecord = asyncHandler(async (req, res) => {
  const teacherId = req.user._id;
  const userRole = req.user.role;
  
  // Find exam and populate course to check ownership
  let exam = await Exam.findById(req.params.id).populate('course');
  if (!exam) return res.status(404).json({ message: "Exam not found" });

  // 1. Verify Ownership
  if (userRole === USER_ROLES.TEACHER) {
    if (!exam.course || exam.course.teacherId.toString() !== teacherId.toString()) {
      return res.status(403).json({ message: "You don't own this course" });
    }
  } else if (userRole !== USER_ROLES.ADMIN) {
     return res.status(403).json({ message: "Forbidden" });
  }

  // 2. Handle specific fields
  const updates = req.body;
  const allowedUpdates = [
    'examName', 'examType', 'totalMarks', 'passingMarks', 
    'examDate', 'startTime', 'duration', 'venue', 'instructions', 
    'isActive', 'resultsPublished'
  ];

  allowedUpdates.forEach((field) => {
    if (updates[field] !== undefined) {
      exam[field] = updates[field];
    }
  });

  // Handle Course Change (Optional - usually unusual for an existing exam)
  if (updates.courseId) {
     // Validate new course ownership logic here if needed
     exam.course = updates.courseId;
  }

  await exam.save();
  res.json({ success: true, exam });
});

// ---------------------------------------------------
// DELETE exam - Teacher / Admin
// ---------------------------------------------------
exports.deleteExamRecord = asyncHandler(async (req, res) => {
  const teacherId = req.user._id;
  const userRole = req.user.role;

  const exam = await Exam.findById(req.params.id).populate('course');
  if (!exam) return res.status(404).json({ message: "Exam not found" });

  // 1. Verify Ownership
  if (userRole === USER_ROLES.TEACHER) {
    if (!exam.course || exam.course.teacherId.toString() !== teacherId.toString()) {
      return res.status(403).json({ message: "You don't own this course" });
    }
  } else if (userRole !== USER_ROLES.ADMIN) {
     return res.status(403).json({ message: "Forbidden" });
  }

  await exam.deleteOne();
  res.json({ success: true, message: "Exam deleted" });
});