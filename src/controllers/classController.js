const Class = require('../models/Class');
const Student = require('../models/Student');
const Course = require('../models/Course');
const Exam = require('../models/Exam');
const { USER_ROLES } = require('../config/constants');
const { asyncHandler } = require('../middlewares/asyncHandler');

// Generate unique 10 digit Class ID
const generateClassID = () => {
  return Math.floor(1000000000 + Math.random() * 9000000000).toString();
};

exports.addClass = async (req, res) => {
  try {
    if (req.user.role !== USER_ROLES.ADMIN) {
      return res.status(403).json({ message: "Only admins can create classes" });
    }
    const { className, classCode, description, year, classType } = req.body;
    const classID = generateClassID();
    const newClass = await Class.create({
      classID,
      className,
      classCode,
      classType,
      description,
      year
    });

    return res.status(201).json({
      success: true,
      class: newClass
    });

  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.updateClass = async (req, res) => {
  try {
    if (req.user.role !== USER_ROLES.ADMIN) {
      return res.status(403).json({ message: "Only admins can update classes" });
    }
    const classId = req.params.id;
    const updated = await Class.findOneAndUpdate({classId:classId}, req.body, {
      new: true,
      runValidators: true
    });

    if (!updated) {
      return res.status(404).json({ message: "Class not found" });
    }
    return res.json({
      success: true,
      class: updated
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.deleteClass = async (req, res) => {
  try {
    if (req.user.role !== USER_ROLES.ADMIN) {
      return res.status(403).json({ message: "Only admins can delete classes" });
    }
    const deleted = await Class.findByIdAndUpdate(req.params.id, {classStatus: "inActive"}, {
      new: true,
      runValidators: true
    });
    if (!deleted) {
      return res.status(404).json({ message: "Class not found" });
    }

    return res.json({
      success: true,
      message: "Class deleted successfully"
    });

  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.getAllClasses = async (req, res) => {
  try {
    if (req.user.role !== USER_ROLES.ADMIN) {
      return res.status(403).json({ message: "Only admins can view class list" });
    }
    const OngClasses = await Class.find({ classStatus: "Active" });
    const CompClasses = await Class.find({ classStatus: "Completed" });
    const InactiveClasses = await Class.find({ classStatus: "Inactive" });
    
    return res.json({
      success: true,
      ongoing : OngClasses,
      inactive : InactiveClasses,
      completed : CompClasses
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

//Get Student Classes
exports.getStudentClasses = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // 1. Find student details
  const student = await Student.findOne({ userId })
    .select('classId');

  if (!student) {
    return res.status(404).json({ success: false, message: "Student not found" });
  }

  // 2. Fetch class (current or past)
  const classData = await Class.findById(student.classId).lean();

  if (!classData) {
    return res.status(404).json({ success: false, message: "Class not found" });
  }

  // 3. Fetch all courses assigned to this class
  const courses = await Course.find({ classId: classData._id })
    .populate('teacherId', 'firstName lastName email')
    .lean();

  // 4. For each course, fetch exams belonging to that course
  const formattedCourses = await Promise.all(
    courses.map(async (course) => {
      const courseExams = await Exam.find({ course: course._id })
        .populate('course', 'courseName courseCode')
        .lean();

      return {
        Id: course._id,
        courseCode: course.courseCode,
        courseName: course.courseName,
        description: course.description,
        duration: course.duration,
        academicYear: course.academicYear,
        teacher: course.teacherId,
        courseId: course.courseId,
        isActive: course.isActive,

       exams: courseExams.map(e => ({
          examId: e._id,
          examName: e.examName,
          examType: e.examType,
          course: e.course,                 
          classId: e.classId,              
          academicYear: e.academicYear,
          totalMarks: e.totalMarks,
          passingMarks: e.passingMarks,
          examDate: e.examDate,
          startTime: e.startTime,
          endTime: e.endTime,
          duration: e.duration,             
          venue: e.venue,
          instructions: e.instructions,

          // Status/flags
          isActive: e.isActive,
          isCompleted: e.isCompleted,
          resultsPublished: e.resultsPublished,

          // Additional computed fields (if present in DB)
          durationInHours: e.durationInHours, 
        }))
      };
    })
  );

  // 5. Final Response Object
  const response = {
    success: true,
    class: {
      classId: classData._id,
      classID: classData.classID,
      className: classData.className,
      classCode: classData.classCode,
      classType: classData.classType,
      year: classData.year,
      currentStatus: student.leavingDate ? 'Past' : 'Current',

      courses: formattedCourses
    }
  };

  res.json(response);
});

exports.getClassDetails = asyncHandler(async (req, res) => {
  const classId = req.params.id;

  // 1. Fetch class details
  const cls = await Class.findById(classId).lean();
  if (!cls) {
    return res.status(404).json({
      success: false,
      message: "Class not found"
    });
  }

  // 2. Fetch courses associated with this class
  const courses = await Course.find({ classId })
    .populate('teacherId', 'firstName lastName email')
    .lean();

  // 3. Fetch exams
  const formattedCourses = await Promise.all(
    courses.map(async (course) => {
      const exams = await Exam.find({ course: course._id })
        .populate('course', 'courseName courseCode')
        .lean();

      return {
        courseId: course._id,
        courseCode: course.courseCode,
        courseName: course.courseName,
        description: course.description,
        duration: course.duration,
        academicYear: course.academicYear,
        isActive: course.isActive,
        teacher: {
          teacherId: course.teacherId?._id,
          firstName: course.teacherId?.firstName,
          lastName: course.teacherId?.lastName,
          email: course.teacherId?.email
        },

        // FIX: Changed 'exam' to 'e' in the argument, or change 'e' to 'exam' inside
        exams: exams.map((e) => ({
          examId: e._id,
          examName: e.examName,
          examType: e.examType,
          course: e.course,                 
          classId: e.classId,              
          academicYear: e.academicYear,
          totalMarks: e.totalMarks,
          passingMarks: e.passingMarks,
          examDate: e.examDate,
          startTime: e.startTime,
          endTime: e.endTime,
          duration: e.duration,             
          venue: e.venue,
          instructions: e.instructions,
          isActive: e.isActive,
          isCompleted: e.isCompleted,
          resultsPublished: e.resultsPublished,
          durationInHours: e.durationInHours, 
        }))
      };
    })
  );

  // 4. Final API Response
  return res.json({
    success: true,
    class: {
      classId: cls._id,
      classID: cls.classID,
      className: cls.className,
      classCode: cls.classCode,
      classType: cls.classType,
      classStatus: cls.classStatus,
      year: cls.year,
      description: cls.description,
      createdAt: cls.createdAt,
      updatedAt: cls.updatedAt,
      courses: formattedCourses 
    }
  });
});

exports.enrollStudent = asyncHandler(async (studentId, classId) => {

  if (!studentId || !classId) {
    return {
      success: false,
      message: 'Please provide both Student ID and Class ID'
    };
  }

  // 1. Verify the Class exists and is Active
  const classDoc = await Class.findOne({classId: classId});

  if (!classDoc) {
    return {
      success: false,
      message: 'Class not found'
    };
  }

  // Based on your Enum: ['Ongoing', 'Completed', 'Inactive']
  if (classDoc.classStatus !== 'Active') {
    return {
      success: false,
      message: `Cannot enroll student. Class status is '${classDoc.classStatus}'`
    };
  }

  // 2. Verify the Student exists
  const studentDoc = await Student.findById({studentId: studentId});
  if (!studentDoc) {
    return {
      success: false,
      message: 'Student not found'
    };
  }

  // 3. Enroll Student (Using $addToSet to prevent duplicates)
  // We update the Student document because that is where the relationship is stored.
  const updatedStudent = await Student.findOneAndUpdate(
    studentId,
    { 
      $addToSet: { classId: classId } 
    },
    { 
      new: true,
      runValidators: true 
    }
  ).populate('classId', 'className classCode'); 

  return {
    success: true,
    message: 'Student enrolled successfully',
    data: {
      studentId: updatedStudent.studentId,
      name: updatedStudent.userId,
      enrolledClasses: updatedStudent.classId
    }
  }
});

exports.studentAdmission = asyncHandler(async (req, res) => {
  const { studentId, classId } = req.query; 
  const result = await exports.enrollStudent(studentId, classId);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: result.message
    });
  }
  if (result.success) {
    return res.status(200).json({
      success: true,
      message: result.message,
      data: result.data
    });
  } 
});