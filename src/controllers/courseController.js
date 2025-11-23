// controllers/courseController.js
const Course = require('../models/Course');
const Student = require('../models/Student');
const Parent = require('../models/Parent');
const Teacher = require('../models/Teacher');
const ClassModel = require('../models/Class');

const { sendSuccessResponse, sendErrorResponse } = require('../utils/response');
const { HTTP_STATUS, USER_ROLES } = require('../config/constants');
const { asyncHandler } = require('../middlewares/asyncHandler');

/**
 * Admin - assign course to teacher OR create a course assigned to teacher+class
 * If courseId provided -> update teacherId/classId of existing course
 * Else -> create new course with teacherId & classId
 */
exports.assignCourse = asyncHandler(async (req, res) => {
  const {
    courseId,
    courseCode,
    courseName,
    description,
    duration,
    teacherId,
    classId,
    academicYear,
    isActive
  } = req.body;

  if (courseId) {
    // Update existing course assignment
    const course = await Course.findById(courseId);
    if (!course) {
      return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, 'Course not found');
    }

    if (teacherId) {
      // verify teacher exists
      const teacherRecord = await Teacher.findOne({ userId: teacherId });
      if (!teacherRecord) {
        return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, 'Teacher not found');
      }
      course.teacherId = teacherId;
    }

    if (classId) {
      const cls = await ClassModel.findById(classId);
      if (!cls) {
        return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, 'Class not found');
      }
      course.classId = classId;
    }

    if (courseCode !== undefined) course.courseCode = courseCode;
    else return sendErrorResponse(res, HTTP_STATUS.BAD_REQUEST, 'courseCode not found');
    if (courseName !== undefined) course.courseName = courseName;
    else return sendErrorResponse(res, HTTP_STATUS.BAD_REQUEST, 'courseName not found');
    if (description !== undefined) course.description = description;
    if (duration !== undefined) course.duration = duration;
    if (academicYear !== undefined) course.academicYear = academicYear;
    if (isActive !== undefined) course.isActive = isActive;

    await course.save();
    return sendSuccessResponse(res, HTTP_STATUS.OK, 'Course updated (assigned) successfully', course);
  } else {
    // Create new course assigned to teacher
    if (!courseCode || !courseName || !duration || !teacherId || !classId || !academicYear) {
      return sendErrorResponse(res, HTTP_STATUS.BAD_REQUEST, 'Missing required fields');
    }

    // verify teacher & class exist
    const teacherRecord = await Teacher.findOne({ userId: teacherId });
    if (!teacherRecord) {
      return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, 'Teacher not found');
    }
    const cls = await ClassModel.findById(classId);
    if (!cls) {
      return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, 'Class not found');
    }

    const newCourse = await Course.create({
      courseCode,
      courseName,
      description,
      duration,
      teacherId,
      classId,
      academicYear,
      isActive: isActive !== undefined ? isActive : true
    });

    return sendSuccessResponse(res, HTTP_STATUS.CREATED, 'Course assigned successfully', newCourse);
  }
});

exports.updateCourse = asyncHandler(async (req, res) => {
  const courseId = req.params.id;
  const updates = req.body;
  const userRole = req.user.role;
  const userId = req.user._id;

  const course = await Course.findById(courseId);
  if (!course) {
    return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, 'Course not found');
  }

  // TEACHER UPDATE RESTRICTIONS
  if (userRole === USER_ROLES.TEACHER) {
    // Teacher can update ONLY their own course
    if (course.teacherId.toString() !== userId.toString()) {
      return sendErrorResponse(res, HTTP_STATUS.FORBIDDEN,
        'You can update only your assigned courses'
      );
    }

    // Block restricted fields for teachers
    const restrictedFields = ["classId", "teacherId", "courseCode", "courseName"];
    for (const field of restrictedFields) {
      if (updates[field] !== undefined) {
        return sendErrorResponse(
          res,
          HTTP_STATUS.FORBIDDEN,
          `Teachers are not allowed to update field: ${field}`
        );
      }
    }
  }

  // ADMIN UPDATE RULE
  if (userRole === USER_ROLES.ADMIN) {
    const adminEditableFields = ["classId", "teacherId", "courseCode", "courseName"];

    // Check if admin is modifying restricted assignment fields
    const adminTouchingRestrictedFields = adminEditableFields.some(f => updates[f] !== undefined);

    if (adminTouchingRestrictedFields) {
      // Ensure all required fields are present
      for (const f of adminEditableFields) {
        if (!updates[f]) {
          return sendErrorResponse(
            res,
            HTTP_STATUS.BAD_REQUEST,
            `Missing required field for course assignment update: ${f}`
          );
        }
      }
    }
  }

  // Apply updates
  Object.assign(course, updates);
  await course.save();

  return sendSuccessResponse(res, HTTP_STATUS.OK, 'Course updated successfully', course);
});

/**
 * Teacher - delete own course
 */
exports.deleteCourse = asyncHandler(async (req, res) => {
  const { courseId } = req.params;
  const loggedInUser = req.user;

  const course = await Course.findById(courseId);
  if (!course) return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, 'Course not found');

  if (loggedInUser.role == USER_ROLES.ADMIN) {
    return sendErrorResponse(res, HTTP_STATUS.FORBIDDEN, 'Access forbidden: not course owner');
  }

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
exports.viewCourses = asyncHandler(async (req, res) => {
  const loggedInUser = req.user;
  let courses = [];

  switch (loggedInUser.role) {
    case USER_ROLES.ADMIN:
      courses = await Course.find().populate('teacherId classId');
      break;

    case USER_ROLES.TEACHER:
      courses = await Course.find({ teacherId: loggedInUser._id }).populate('teacherId classId');
      break;

    case USER_ROLES.STUDENT: {
      const student = await Student.findOne({ userId: loggedInUser._id });
      if (!student) return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, 'Student record not found');

      courses = await Course.find({ classId: student.classId }).populate('teacherId classId');
      break;
    }

    case USER_ROLES.PARENT: {
      const parent = await Parent.findOne({ userId: loggedInUser._id }).populate('childrenId');
      if (!parent) return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, 'Parent record not found');

      const classIds = parent.childrenId.map((c) => c.classId).filter(Boolean);
      if (classIds.length === 0) {
        courses = [];
      } else {
        courses = await Course.find({ classId: { $in: classIds } }).populate('teacherId classId');
      }
      break;
    }

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