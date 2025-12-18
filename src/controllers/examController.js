const Exam = require("../models/Exam");
const Course = require("../models/Course");
const Student = require("../models/Student");
const { USER_ROLES } = require("../config/constants");
const { asyncHandler } = require("../middlewares/asyncHandler");

// Helper to check ID validity
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// GET Exam List - role-based
exports.getExamRecordList = asyncHandler(async (req, res) => {
  const user = req.user;

  // 1. ADMIN → All active exams
  if (user.role === USER_ROLES.ADMIN) {
    const allExams = await Exam.find()
      .populate("course", "courseName courseCode")
      .sort({ examDate: 1 });
    return res.json({ success: true, exams: allExams });
  }

  // 2. TEACHER → Exams for their specific courses
  if (user.role === USER_ROLES.TEACHER) {
    // Find courses taught by this teacher
    const teacherCourses = await Course.find({ teacherId: user._id }).distinct(
      "_id"
    );

    const exams = await Exam.find({
      course: { $in: teacherCourses }, // Match exams belonging to those courses
      isActive: true,
    })
      .populate("course", "courseName courseCode")
      .sort({ examDate: 1 });

    return res.json({ success: true, exams });
  }

  // 3. STUDENT → Exams for courses in their class(es)
  if (user.role === USER_ROLES.STUDENT) {
    const student = await Student.findOne({ userId: user._id });
    if (!student) {
      return res
        .status(404)
        .json({ success: false, message: "Student record not found" });
    }

    // A. Find all courses assigned to the student's class(es)
    // Note: student.classId is an Array now
    const studentCourses = await Course.find({
      classId: { $in: student.classId },
    }).distinct("_id");

    // B. Find exams for those courses
    const exams = await Exam.find({
      course: { $in: studentCourses },
      isActive: true,
    })
      .populate("course", "courseName courseCode")
      .sort({ examDate: 1 });

    return res.json({ success: true, exams });
  }

  // 4. PARENT → Exams for their children's classes
  if (user.role === USER_ROLES.PARENT) {
    // Find all children
    const children = await Student.find({ parentId: user._id });
    if (!children.length) {
      return res
        .status(404)
        .json({ success: false, message: "No children found" });
    }

    // Collect all unique Class IDs from all children
    // Flatten array of arrays if children have multiple classes
    const allClassIds = children.flatMap((child) => child.classId);

    // A. Find courses for these classes
    const childCourses = await Course.find({
      classId: { $in: allClassIds },
    }).distinct("_id");

    // B. Find exams
    const exams = await Exam.find({
      course: { $in: childCourses },
      isActive: true,
    })
      .populate("course", "courseName courseCode")
      .sort({ examDate: 1 });

    return res.json({ success: true, exams });
  }

  return res.status(403).json({ success: false, message: "Forbidden" });
});

// GET single exam - role-protected
exports.getExamRecord = asyncHandler(async (req, res) => {
  const user = req.user;

  // 1. Fetch Exam with Deep Population
  // We need Course -> Class to verify permissions and format data
  const exam = await Exam.findById(req.params.id).populate({
    path: "course",
    select: "courseName courseCode teacherId classId",
    populate: [
      { path: "classId", select: "className classCode classID" }, // Get Class Details
      { path: "teacherId", select: "firstName lastName email" }, // Get Teacher Details
    ],
  });

  if (!exam)
    return res.status(404).json({ success: false, message: "Exam not found" });

  const course = exam.course;
  const classDetails = course ? course.classId : null;

  // AUTHORIZATION CHECKS

  // 1. ADMIN
  if (user.role === USER_ROLES.ADMIN) {
    // Allowed
  }

  // 2. TEACHER
  else if (user.role === USER_ROLES.TEACHER) {
    // Check if teacher owns the course
    // Access nested teacherId._id because we populated it
    if (
      !course ||
      !course.teacherId ||
      course.teacherId._id.toString() !== user._id.toString()
    ) {
      return res
        .status(403)
        .json({
          success: false,
          message: "You don't own the course for this exam",
        });
    }
  }

  // 3. STUDENT
  else if (user.role === USER_ROLES.STUDENT) {
    const student = await Student.findOne({ userId: user._id });
    if (!student)
      return res
        .status(403)
        .json({ success: false, message: "Student record not found" });

    // Check if the exam's class (from course) is in the Student's class list
    // classDetails._id is the MongoID of the class
    const isClassMatch = student.classId.some(
      (cid) => cid.toString() === classDetails._id.toString()
    );

    if (!isClassMatch) {
      return res
        .status(403)
        .json({ success: false, message: "Not allowed to view this exam" });
    }
  }

  // 4. PARENT
  else if (user.role === USER_ROLES.PARENT) {
    // Find if ANY child belongs to the class of this exam
    // Mongoose allows querying an Array field with a single value (it acts as 'contains')
    const child = await Student.findOne({
      parentId: user._id,
      classId: classDetails._id,
    });

    if (!child)
      return res
        .status(403)
        .json({
          success: false,
          message: "Not allowed or No child in this class.",
        });
  } else {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }

  // DATA FORMATTING
  const formattedExam = {
    // Basic Info
    examId: exam._id,
    examName: exam.examName,
    examType: exam.examType,
    status: exam.status,

    // Timing
    examDate: exam.examDate,
    duration: exam.duration,

    // Venue & Instructions
    venue: exam.venue,
    instructions: exam.instructions || "",

    // Marks
    totalMarks: exam.totalMarks,
    passingMarks: exam.passingMarks,

    // Course Info
    course: course
      ? {
          courseId: course._id,
          courseName: course.courseName,
          courseCode: course.courseCode,
          academicYear: course.academicYear,
          teacherName: course.teacherId
            ? `${course.teacherId.firstName} ${course.teacherId.lastName}`
            : "N/A",
        }
      : null,

    // Class Info
    classDetails: classDetails
      ? {
          classId: classDetails._id,
          classID: classDetails.classID,
          className: classDetails.className,
          classCode: classDetails.classCode,
        }
      : null,

    // Meta
    isActive: exam.isActive,
    resultsPublished: exam.resultsPublished,
  };

  return res.json({
    success: true,
    data: formattedExam,
  });
});

// ADD exam - Teacher only (Admin can be added if needed)
exports.addExamRecord = asyncHandler(async (req, res) => {
  const teacherId = req.user._id;
  const userRole = req.user.role;
  const {
    examName,
    examType,
    courseCode,
    totalMarks,
    passingMarks,
    examDate,
    duration,
    endTime,
    venue,
    instructions,
  } = req.body;

  // 1. Check Course
  const courseDoc = await Course.findOne({ courseCode: courseCode });
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
    course: courseDoc._id,
    totalMarks,
    passingMarks,
    examDate,
    duration,
    venue,
    instructions,
  });

  return res.status(201).json({ success: true, exam });
});

// UPDATE exam - Teacher / Admin
exports.updateExamRecord = asyncHandler(async (req, res) => {
  const teacherId = req.user._id;
  const userRole = req.user.role;

  // Find exam and populate course to check ownership
  let exam = await Exam.findById(req.params.id).populate("course");
  if (!exam) return res.status(404).json({ message: "Exam not found" });

  // 1. Verify Ownership
  if (userRole === USER_ROLES.TEACHER) {
    if (
      !exam.course ||
      exam.course.teacherId.toString() !== teacherId.toString()
    ) {
      return res.status(403).json({ message: "You don't own this course" });
    }
  } else if (userRole !== USER_ROLES.ADMIN) {
    return res.status(403).json({ message: "Forbidden" });
  }

  // 2. Handle specific fields
  const updates = req.body;
  const allowedUpdates = [
    "examName",
    "examType",
    "totalMarks",
    "passingMarks",
    "examDate",
    "duration",
    "venue",
    "instructions",
    "isActive",
    "resultsPublished",
  ];

  allowedUpdates.forEach((field) => {
    if (updates[field] !== undefined) {
      exam[field] = updates[field];
    }
  });

  // Handle Course Change (Optional - usually unusual for an existing exam)
  if (userRole == USER_ROLES.ADMIN && updates.courseId) {
    exam.course = updates.courseId;
  }

  await exam.save();
  res.json({ success: true, exam });
});

// DELETE exam - Teacher / Admin
exports.deleteExamRecord = asyncHandler(async (req, res) => {
  const teacherId = req.user._id;
  const userRole = req.user.role;

  const exam = await Exam.findById(req.params.id).populate("course");
  if (!exam) return res.status(404).json({ message: "Exam not found" });

  // 1. Verify Ownership
  if (userRole === USER_ROLES.TEACHER) {
    if (
      !exam.course ||
      exam.course.teacherId.toString() !== teacherId.toString()
    ) {
      return res.status(403).json({ message: "You don't own this course" });
    }
  } else if (userRole !== USER_ROLES.ADMIN) {
    return res.status(403).json({ message: "Forbidden" });
  }

  await exam.deleteOne();
  res.json({ success: true, message: "Exam deleted" });
});

exports.getExamsByCourse = asyncHandler(async (req, res) => {
  const { courseId } = req.params;
  const user = req.user;

  let courseQuery = isValidObjectId(courseId)
    ? { _id: courseId }
    : { courseCode: courseId };
  const courseDoc = await Course.findOne(courseQuery);

  if (!courseDoc) {
    return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, "Course not found");
  }

  // 2. AUTHORIZATION (RBAC)

  // ADMIN: Allowed
  if (user.role === USER_ROLES.ADMIN) {
    // Pass
  }

  // TEACHER: Must own the course
  else if (user.role === USER_ROLES.TEACHER) {
    if (
      !courseDoc.teacherId ||
      courseDoc.teacherId.toString() !== user._id.toString()
    ) {
      return sendErrorResponse(
        res,
        HTTP_STATUS.FORBIDDEN,
        "Access forbidden: You do not teach this course"
      );
    }
  }

  // STUDENT: Must be enrolled in the Class linked to this Course
  else if (user.role === USER_ROLES.STUDENT) {
    const student = await Student.findOne({ userId: user._id });
    if (!student)
      return sendErrorResponse(
        res,
        HTTP_STATUS.NOT_FOUND,
        "Student record not found"
      );

    const isEnrolled = student.classId.some(
      (cid) => cid.toString() === courseDoc.classId.toString()
    );

    if (!isEnrolled) {
      return sendErrorResponse(
        res,
        HTTP_STATUS.FORBIDDEN,
        "Access forbidden: You are not enrolled in this course"
      );
    }
  }

  // PARENT: Child must be enrolled in the Class linked to this Course
  else if (user.role === USER_ROLES.PARENT) {
    const children = await Student.find({ parentId: user._id });
    if (!children.length)
      return sendErrorResponse(res, HTTP_STATUS.FORBIDDEN, "No children found");

    // Collect all class IDs from all children
    const allChildClassIds = children.flatMap((child) =>
      child.classId.map((id) => id.toString())
    );

    if (!allChildClassIds.includes(courseDoc.classId.toString())) {
      return sendErrorResponse(
        res,
        HTTP_STATUS.FORBIDDEN,
        "Access forbidden: No child enrolled in this course"
      );
    }
  } else {
    return sendErrorResponse(res, HTTP_STATUS.FORBIDDEN, "Access forbidden");
  }

  // 3. FETCH EXAMS

  const examFilter = { course: courseDoc._id };

  // Filter: Hide "Inactive" exams for Students/Parents
  if (user.role === USER_ROLES.STUDENT || user.role === USER_ROLES.PARENT) {
    examFilter.isActive = true;
  }

  // Fetch from Exam table ONLY (No populate)
  const exams = await Exam.find(examFilter).sort({ examDate: 1, startTime: 1 }); // Sorted chronologically

  // 4. FORMAT RESPONSE
  const formattedExams = exams.map((e) => ({
    _id: e._id,
    examName: e.examName,
    examType: e.examType,
    status: e.status,

    date: e.examDate,
    duration: e.duration,

    venue: e.venue,
    totalMarks: e.totalMarks,
    passingMarks: e.passingMarks,

    isActive: e.isActive,
    resultsPublished: e.resultsPublished,
  }));

  return sendSuccessResponse(
    res,
    HTTP_STATUS.OK,
    "Exams retrieved successfully",
    formattedExams
  );
});
