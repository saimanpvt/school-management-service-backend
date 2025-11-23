const Exam = require('../models/Exam');
const Course = require('../models/Course');
const Student = require('../models/Student');
const { USER_ROLES } = require('../config/constants');

// ---------------------------------------------------
// GET Exam List - role-based
// ---------------------------------------------------
exports.getExamRecordList = async (req, res) => {
  try {
    const user = req.user;

    // ADMIN → All exams
    if (user.role === USER_ROLES.ADMIN) {
      const allExams = await Exam.find({ isActive: true });
      return res.json({ success: true, exams: allExams });
    }

    // TEACHER → exams of their courses
    if (user.role === USER_ROLES.TEACHER) {
      const teacherCourses = await Course.find({ teacherId: user._id }).select('_id');

      const exams = await Exam.find({
        course: { $in: teacherCourses.map(c => c._id) },
        isActive: true
      });

      return res.json({ success: true, exams });
    }

    // STUDENT → exams of student's class
    if (user.role === USER_ROLES.STUDENT) {
      const student = await Student.findOne({ userId: user._id }).select('classId');
      if (!student)
        return res.status(404).json({ success: false, message: 'Student record not found' });

      const exams = await Exam.find({ classId: student.classId, isActive: true });
      return res.json({ success: true, exams });
    }

    // PARENT → exams of child’s class
    if (user.role === USER_ROLES.PARENT) {
      const children = await Student.find({ parentId: user._id }).select('classId');
      if (children.length === 0)
        return res.status(404).json({ success: false, message: "No children found" });

      const classIds = children.map(c => c.classId);
      const exams = await Exam.find({ classId: { $in: classIds }, isActive: true });
      return res.json({ success: true, exams });
    }

    return res.status(403).json({ success: false, message: "Forbidden" });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------------------------------------------------
// GET single exam - role-protected
// ---------------------------------------------------
exports.getExamRecord = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ message: 'Exam not found' });

    const user = req.user;

    if (user.role === USER_ROLES.ADMIN) return res.json({ success: true, exam });

    if (user.role === USER_ROLES.TEACHER) {
      const course = await Course.findById(exam.course);
      if (!course || course.teacherId.toString() !== user._id.toString())
        return res.status(403).json({ message: "You don't own this course" });
      return res.json({ success: true, exam });
    }

    if (user.role === USER_ROLES.STUDENT) {
      const student = await Student.findOne({ userId: user._id });
      if (!student || student.classId.toString() !== exam.classId.toString())
        return res.status(403).json({ message: "Not allowed" });
      return res.json({ success: true, exam });
    }

    if (user.role === USER_ROLES.PARENT) {
      const child = await Student.findOne({ parentId: user._id, classId: exam.classId });
      if (!child) return res.status(403).json({ message: "Not allowed" });
      return res.json({ success: true, exam });
    }

    return res.status(403).json({ message: "Forbidden" });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ---------------------------------------------------
// ADD exam - Teacher only
// ---------------------------------------------------
exports.addExamRecord = async (req, res) => {
  try {
    const teacherId = req.user._id;
    const { course } = req.body;

    const courseDoc = await Course.findById(course);
    if (!courseDoc) return res.status(404).json({ message: "Course not found" });

    if (courseDoc.teacherId.toString() !== teacherId.toString())
      return res.status(403).json({ message: "You don't own this course" });

    // Auto-fill dependencies
    req.body.classId = courseDoc.classId;
    req.body.academicYear = courseDoc.academicYear;

    const exam = await Exam.create(req.body);
    return res.status(201).json({ success: true, exam });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ---------------------------------------------------
// UPDATE exam - Teacher only
// ---------------------------------------------------
exports.updateExamRecord = async (req, res) => {
  try {
    const teacherId = req.user._id;
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ message: "Exam not found" });

    const course = await Course.findById(exam.course);
    if (!course || course.teacherId.toString() !== teacherId.toString())
      return res.status(403).json({ message: "You don't own this course" });

    const updated = await Exam.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, exam: updated });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ---------------------------------------------------
// DELETE exam - Teacher only
// ---------------------------------------------------
exports.deleteExamRecord = async (req, res) => {
  try {
    const teacherId = req.user._id;
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ message: "Exam not found" });

    const course = await Course.findById(exam.course);
    if (!course || course.teacherId.toString() !== teacherId.toString())
      return res.status(403).json({ message: "You don't own this course" });

    await Exam.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Exam deleted" });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};