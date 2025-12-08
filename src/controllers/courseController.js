// controllers/courseController.js
const Course = require('../models/Course');
const Student = require('../models/Student');
const Parent = require('../models/Parent');
const Teacher = require('../models/Teacher');
const Class = require('../models/Class');

const { sendSuccessResponse, sendErrorResponse } = require('../utils/response');
const { HTTP_STATUS, USER_ROLES } = require('../config/constants');
const { asyncHandler } = require('../middlewares/asyncHandler');
const { validateRequiredFields } = require('../utils/validation');

exports.addCourse = asyncHandler(async (req, res) => {
  const {
    courseCode,
    courseName,
    description,
    duration,
    teacherId,
    classId,
    academicYear,
    isActive
  } = req.body;

  // 1. Validate Required Fields (Excluding teacherId)
  const requiredFields = ['courseCode', 'courseName', 'duration', 'classId', 'academicYear'];
  const fieldValidation = validateRequiredFields(req.body, requiredFields);
  if (!fieldValidation.isValid) {
    return sendErrorResponse(res, HTTP_STATUS.BAD_REQUEST, fieldValidation.message);
  }
  // 2. Verify Class Exists
  const cls = await Class.findOne({classId: classId});
  if (!cls) {
    return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, 'Class not found');
  }

  // 3. Verify Teacher Exists (Only if teacherId is provided)
  if (teacherId) {
    const teacherRecord = await Teacher.findOne({ teacherId: teacherId });
    if (!teacherRecord) {
      return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, 'Teacher not found');
    }
  }

  // 4. Determine Active Status Logic
  // Logic: Use user input (or default true), BUT if teacherId is missing, FORCE false.
  let finalIsActive = isActive !== undefined ? isActive : true;
  if (!teacherId) {
    finalIsActive = false;
  }

  // 5. Create the Course
  const newCourse = await Course.create({
    courseCode,
    courseName,
    description,
    duration,
    teacherId: teacherId || null,
    classId,
    academicYear,
    isActive: finalIsActive
  });

  return sendSuccessResponse(res, HTTP_STATUS.CREATED, 'Course added successfully', newCourse);
});

exports.updateCourse = asyncHandler(async (req, res) => {
  const courseId = req.params.id;
  const updates = req.body;
  const userRole = req.user.role;
  const userId = req.user._id;

  // 1. Fetch the course
  const course = await Course.findOne({courseId: courseId});
  if (!course) {
    return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, 'Course not found');
  }

  // ======================================================
  // LOGIC FOR TEACHERS
  // ======================================================
  if (userRole === USER_ROLES.TEACHER) {
    // Check Ownership: Ensure course has a teacher and it matches current user
    if (!course.teacherId || course.teacherId.toString() !== userId.toString()) {
      return sendErrorResponse(res, HTTP_STATUS.FORBIDDEN, 'You can update only your assigned courses');
    }

    // List of fields a Teacher is ALLOWED to change
    const allowedTeacherFields = ['description', 'academicYear', 'isActive', 'duration'];
    
    // Check for attempted updates to restricted fields
    const restrictedFields = ["classId", "teacherId", "courseCode", "courseName"];
    for (const field of restrictedFields) {
      if (updates[field] !== undefined) {
        return sendErrorResponse(res, HTTP_STATUS.FORBIDDEN, `Teachers are not allowed to update field: ${field}`);
      }
    }

    // Apply allowed updates
    allowedTeacherFields.forEach((field) => {
      if (updates[field] !== undefined) {
        course[field] = updates[field];
      }
    });
  }

  // ======================================================
  // LOGIC FOR ADMINS
  // ======================================================
  if (userRole === USER_ROLES.ADMIN) {
    // 1. Validate Class ID if it is being changed
    if (updates.classId) {
      const cls = await ClassModel.findOne({classId : updates.classId});
      if (!cls) {
        return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, 'Class not found');
      }
      course.classId = updates.classId;
    }

    // 2. Validate Teacher ID if it is being changed
    if (updates.teacherId) {
      const teacher = await Teacher.findOne({ userId: updates.teacherId }); // Assuming Teacher model uses userId
      if (!teacher) {
        return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, 'Teacher not found');
      }
      course.teacherId = updates.teacherId;
    } 
    // Handle explicit unassignment
    else if (updates.teacherId === null) {
      course.teacherId = null;
    }

    // 3. Update other fields (Partial Update)
    if (updates.courseCode !== undefined) course.courseCode = updates.courseCode;
    if (updates.courseName !== undefined) course.courseName = updates.courseName;
    if (updates.description !== undefined) course.description = updates.description;
    if (updates.duration !== undefined) course.duration = updates.duration;
    if (updates.academicYear !== undefined) course.academicYear = updates.academicYear;
    if (updates.isActive !== undefined) course.isActive = updates.isActive;
  }

  // ======================================================
  // FINAL CONSISTENCY CHECK & SAVE
  // ======================================================
  
  // Rule: If there is no teacher assigned, the course cannot be Active
  if (!course.teacherId) {
    course.isActive = false;
  }

  await course.save();

  return sendSuccessResponse(res, HTTP_STATUS.OK, 'Course updated successfully', course);
});

/**
 * Teacher - delete own course
 */
exports.deleteCourse = asyncHandler(async (req, res) => {
  const { courseId } = req.params;
  const loggedInUser = req.user;
  if (loggedInUser.role == USER_ROLES.ADMIN) {
    return sendErrorResponse(res, HTTP_STATUS.FORBIDDEN, 'Access forbidden: not course owner');
  }
  const course = await Course.findOne({courseId : courseId});
  if (!course) return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, 'Course not found');
  await Course.findByIdAndDelete(courseId);

  return sendSuccessResponse(res, HTTP_STATUS.OK, 'Course deleted successfully');
});

/**
 * View courses (list) - role aware
 * Admin -> all courses
 * Teacher -> own courses
 * Student -> courses where classId === student.classId
 * Parent -> courses where classId is any of their childrens' classId
 */
exports.getCourseList = asyncHandler(async (req, res) => {
  const loggedInUser = req.user;
  let courses = [];

  switch (loggedInUser.role) {
    case USER_ROLES.ADMIN:
      courses = await Course.find().populate('teacherId classId');
      break;
    default:
      return sendErrorResponse(res, HTTP_STATUS.FORBIDDEN, 'Access forbidden');
  }

  return sendSuccessResponse(res, HTTP_STATUS.OK, 'Courses retrieved successfully', courses);
});

/**
 * View single course by id - role aware
 */
exports.viewCourseById = asyncHandler(async (req, res) => {
  const { courseId } = req.params;
  const loggedInUser = req.user;

  const course = await Course.findById(courseId).populate('teacherId classId');
  if (!course) return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, 'Course not found');

  if (loggedInUser.role === USER_ROLES.ADMIN) {
    return sendSuccessResponse(res, HTTP_STATUS.OK, 'Course retrieved', course);
  }

  if (loggedInUser.role === USER_ROLES.TEACHER) {
    if (String(course.teacherId._id) !== String(loggedInUser._id)) {
      return sendErrorResponse(res, HTTP_STATUS.FORBIDDEN, 'Access forbidden');
    }
    return sendSuccessResponse(res, HTTP_STATUS.OK, 'Course retrieved', course);
  }

  if (loggedInUser.role === USER_ROLES.STUDENT) {
    const student = await Student.findOne({ userId: loggedInUser._id });
    if (!student) return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, 'Student record not found');

    if (String(student.classId) !== String(course.classId._id)) {
      return sendErrorResponse(res, HTTP_STATUS.FORBIDDEN, 'Access forbidden');
    }
    return sendSuccessResponse(res, HTTP_STATUS.OK, 'Course retrieved', course);
  }

  if (loggedInUser.role === USER_ROLES.PARENT) {
    const parent = await Parent.findOne({ userId: loggedInUser._id }).populate('childrenId');
    if (!parent) return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, 'Parent record not found');

    const childClassIds = parent.childrenId.map((c) => String(c.classId));
    if (!childClassIds.includes(String(course.classId._id))) {
      return sendErrorResponse(res, HTTP_STATUS.FORBIDDEN, 'Access forbidden');
    }
    return sendSuccessResponse(res, HTTP_STATUS.OK, 'Course retrieved', course);
  }

  return sendErrorResponse(res, HTTP_STATUS.FORBIDDEN, 'Access forbidden');
});

// @desc    1. Get courses list by Class ID
// @route   GET /api/courses/class/:classId
exports.getCoursesByClass = asyncHandler(async (req, res) => {
  const { classId } = req.params;

  // Find all active courses for this class
  const courses = await Course.find({ 
    classId: classId,
    isActive: true 
  })
  .populate('teacherId', 'firstName lastName email userID') // Show teacher details
  .populate('classId', 'className classCode classID')       // Show class details
  .sort({ courseName: 1 });

  if (!courses.length) {
    return res.status(404).json({
      success: false,
      message: 'No active courses found for this class',
      data: []
    });
  }

  return res.status(200).json({
    success: true,
    count: courses.length,
    data: courses
  });
});

// @desc    2. Get courses list by Teacher ID
// @route   GET /api/courses/teacher/:teacherId
// @access  Private
exports.getCoursesByTeacher = asyncHandler(async (req, res) => {
  const { employeeId } = req.params; 

  const courses = await Course.find({ 
    teacherId: employeeId,
    isActive: true 
  })
  .populate('classId', 'className classCode classID') // Vital to see which class this course belongs to
  .sort({ academicYear: -1, courseName: 1 });

  if (!courses.length) {
    return res.status(404).json({
      success: false,
      message: 'No active courses found for this teacher',
      data: []
    });
  }

  return res.status(200).json({
    success: true,
    count: courses.length,
    data: courses
  });
});

// @desc    3. Get courses by Student ID (Current Courses)
// @route   GET /api/courses/student/:studentId
// @access  Private
exports.getCoursesByStudent = asyncHandler(async (req, res) => {
  const { studentId } = req.params; 

  const student = await Student.findOne({ studentId: studentId });

  if (!student) {
    return res.status(404).json({
      success: false,
      message: 'Student record not found'
    });
  }

  if (!student.classId || student.classId.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Student is not enrolled in any class'
    });
  }

  // B. Find courses that match ANY of the student's Class IDs
  // We use the $in operator because classId is an array in the Student schema
  const courses = await Course.find({
    classId: { $in: student.classId },
    isActive: true
  })
  .populate('teacherId', 'firstName lastName email')
  .populate('classId', 'className classCode')
  .sort({ courseName: 1 });

  return res.status(200).json({
    success: true,
    count: courses.length,
    studentClassIds: student.classId,
    data: courses
  });
});