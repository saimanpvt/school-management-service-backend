const Mark = require('../models/Marks');
const Exam = require('../models/Exam');
const Course = require('../models/Course');
const Student = require('../models/Student');
const Class = require('../models/Class');
const Parent = require('../models/Parent');
const { USER_ROLES } = require('../config/constants');
const asyncHandler = require('express-async-handler');

// ----------------------------
// ADD MARKS (single or bulk)
// ----------------------------
exports.addMarks = asyncHandler(async (req, res) => {
  const loggedInUser = req.user;
  let marksToInsert = [];

  if (Array.isArray(req.body.marks)) {
    // BULK
    marksToInsert = req.body.marks.map(m => ({
      examId: req.body.examId,
      studentId: m.studentId,
      marks: m.marks,
      remarks: m.remarks
    }));
  } else {
    // SINGLE
    marksToInsert.push({
      examId: req.body.examId,
      studentId: req.body.studentId,
      marks: req.body.marks,
      remarks: req.body.remarks
    });
  }

  // Verify that teacher owns the course
  const examIds = marksToInsert.map(m => m.examId);
  const exams = await Exam.find({ _id: { $in: examIds } });
  for (const exam of exams) {
    const course = await Course.findById(exam.course);
    if (course.teacherId.toString() !== loggedInUser._id.toString()) {
      return res.status(403).json({ message: 'You can only add marks for your own courses' });
    }
  }

  const createdMarks = await Mark.insertMany(marksToInsert, { ordered: false });

  res.status(201).json({ success: true, message: 'Marks added successfully', data: createdMarks });
});

// ----------------------------
// UPDATE MARKS
// ----------------------------
exports.updateMarks = asyncHandler(async (req, res) => {
  const loggedInUser = req.user;
  const markId = req.params.id;

  const mark = await Mark.findById(markId);
  if (!mark) return res.status(404).json({ message: 'Mark not found' });

  const exam = await Exam.findById(mark.examId);
  const course = await Course.findById(exam.course);

  if (course.teacherId.toString() !== loggedInUser._id.toString()) {
    return res.status(403).json({ message: 'You can only update marks for your own courses' });
  }

  mark.marks = req.body.marks !== undefined ? req.body.marks : mark.marks;
  mark.remarks = req.body.remarks !== undefined ? req.body.remarks : mark.remarks;
  await mark.save();

  res.json({ success: true, message: 'Marks updated', data: mark });
});

// ----------------------------
// DELETE MARKS
// ----------------------------
exports.deleteMarks = asyncHandler(async (req, res) => {
  const loggedInUser = req.user;
  const markId = req.params.id;

  const mark = await Mark.findById(markId);
  if (!mark) return res.status(404).json({ message: 'Mark not found' });

  const exam = await Exam.findById(mark.examId);
  const course = await Course.findById(exam.course);

  if (course.teacherId.toString() !== loggedInUser._id.toString()) {
    return res.status(403).json({ message: 'You can only delete marks for your own courses' });
  }

  await mark.remove();
  res.json({ success: true, message: 'Marks deleted successfully' });
});

// ----------------------------
// ADMIN + TEACHER REPORT: class → course → students → marks
// ----------------------------
exports.getAdminTeacherReport = asyncHandler(async (req, res) => {
  const loggedInUser = req.user;

  // Filter courses
  let courses;
  if (loggedInUser.role === USER_ROLES.ADMIN) {
    courses = await Course.find().populate('classId').lean();
  } else {
    courses = await Course.find({ teacherId: loggedInUser._id }).populate('classId').lean();
  }

  const response = {};

  for (const course of courses) {
    const marks = await Mark.find({ examId: { $in: (await Exam.find({ course: course._id })).map(e => e._id) } })
      .populate('studentId', 'firstName lastName userID')
      .populate('examId', 'examName examType')
      .lean();

    const className = course.classId.className;

    if (!response[className]) response[className] = {};
    if (!response[className][course.courseName]) response[className][course.courseName] = {};

    marks.forEach(m => {
      response[className][course.courseName][m.studentId.userID] = {
        studentName: `${m.studentId.firstName} ${m.studentId.lastName}`,
        marks: m.marks,
        exam: m.examId.examName,
        examType: m.examId.examType
      };
    });
  }

  res.json(response);
});

// ----------------------------
// STUDENT + PARENT REPORT: subject → examType → marks
// ----------------------------
exports.getStudentParentReport = asyncHandler(async (req, res) => {
  const loggedInUser = req.user;
  let studentId = req.params.studentId;

  // Parent can only fetch their child's report
  if (loggedInUser.role === USER_ROLES.PARENT) {
    const parent = await Parent.findOne({ userId: loggedInUser._id }).populate('childrenId');
    const child = parent.childrenId.find(c => c._id.toString() === studentId);
    if (!child) return res.status(403).json({ message: 'Access denied for this student' });
    studentId = child._id;
  } else if (loggedInUser.role === USER_ROLES.STUDENT) {
    if (studentId !== loggedInUser._id.toString()) {
      return res.status(403).json({ message: 'Students can only access their own report' });
    }
  }

  const marks = await Mark.find({ studentId })
    .populate('examId', 'examName examType course')
    .lean();

  const courseIds = [...new Set(marks.map(m => m.examId.course.toString()))];
  const courses = await Course.find({ _id: { $in: courseIds } });

  const courseMap = {};
  courses.forEach(c => (courseMap[c._id.toString()] = c.courseName));

  const response = {};

  marks.forEach(m => {
    const courseName = courseMap[m.examId.course.toString()] || 'Unknown Subject';
    if (!response[courseName]) response[courseName] = {};
    response[courseName][m.examId.examType] = {
      examName: m.examId.examName,
      marks: m.marks
    };
  });

  res.json(response);
});

exports.getAdminReport = asyncHandler(async (req, res) => {
  const { classId, academicYear } = req.query;

  if (!classId || !academicYear) {
    return res.status(400).json({ message: 'classId and academicYear are required' });
  }

  // Get courses for class and year
  const courses = await Course.find({ classId, academicYear }).lean();
  const courseIds = courses.map(c => c._id);

  // Get exams for these courses
  const exams = await Exam.find({ course: { $in: courseIds } }).lean();
  const examIds = exams.map(e => e._id);

  // Get all marks for these exams
  const marks = await Mark.find({ examId: { $in: examIds } })
    .populate('studentId', 'firstName lastName userID')
    .populate('examId', 'examName examType course')
    .lean();

  // Build response: class → course → student → {examType: marks}
  const classData = {};
  const classObj = await Class.findById(classId);
  classData[classObj.className] = {};

  for (const course of courses) {
    classData[classObj.className][course.courseName] = {};

    const courseExams = exams.filter(e => e.course.toString() === course._id.toString());

    const courseMarks = marks.filter(m => m.examId.course.toString() === course._id.toString());

    courseMarks.forEach(m => {
      const studentId = m.studentId.userID;
      if (!classData[classObj.className][course.courseName][studentId]) {
        classData[classObj.className][course.courseName][studentId] = {
          studentName: `${m.studentId.firstName} ${m.studentId.lastName}`,
          marks: {}
        };
      }

      classData[classObj.className][course.courseName][studentId].marks[m.examId.examType] = {
        examName: m.examId.examName,
        marks: m.marks
      };
    });
  }

  res.json(classData);
});

// ----------------------------
// STUDENT + PARENT REPORT: classId required
// ----------------------------
exports.getStudentParentReport = asyncHandler(async (req, res) => {
  const loggedInUser = req.user;
  let studentId = req.params.studentId;
  const { classId } = req.query;

  if (!classId) return res.status(400).json({ message: 'classId is required' });

  // Parent: verify student belongs to parent
  if (loggedInUser.role === USER_ROLES.PARENT) {
    const parent = await Parent.findOne({ userId: loggedInUser._id }).populate('childrenId');
    const child = parent.childrenId.find(c => c._id.toString() === studentId);
    if (!child) return res.status(403).json({ message: 'Access denied for this student' });
    studentId = child._id;
  }

  // Student: can only access own report
  if (loggedInUser.role === USER_ROLES.STUDENT) {
    if (studentId !== loggedInUser._id.toString()) {
      return res.status(403).json({ message: 'Students can only access their own report' });
    }
  }

  // Get courses in the class
  const courses = await Course.find({ classId }).lean();
  const courseIds = courses.map(c => c._id);

  // Get exams for these courses
  const exams = await Exam.find({ course: { $in: courseIds } }).lean();
  const examIds = exams.map(e => e._id);

  // Get marks for student
  const marks = await Mark.find({ examId: { $in: examIds }, studentId })
    .populate('examId', 'examName examType course')
    .lean();

  // Build response: subject → examType → marks
  const response = {};

  for (const m of marks) {
    const course = courses.find(c => c._id.toString() === m.examId.course.toString());
    const courseName = course ? course.courseName : 'Unknown Subject';

    if (!response[courseName]) response[courseName] = {};
    response[courseName][m.examId.examType] = {
      examName: m.examId.examName,
      marks: m.marks
    };
  }

  res.json(response);
});