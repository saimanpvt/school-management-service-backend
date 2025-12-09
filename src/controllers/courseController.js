// controllers/courseController.js
const Course = require('../models/Course');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const Class = require('../models/Class');
const User = require('../models/User');

const mongoose = require('mongoose');

const { sendSuccessResponse, sendErrorResponse } = require('../utils/response');
const { HTTP_STATUS, USER_ROLES } = require('../config/constants');
const { asyncHandler } = require('../middlewares/asyncHandler');
const { validateRequiredFields } = require('../utils/validation');


const groupCoursesByStatus = (courses, userRole) => {
  const grouped = {
    Active: [],
    Inactive: [],
    Completed: []
  };

  // 1. Group courses
  courses.forEach(course => {
    if (grouped[course.status]) {
      grouped[course.status].push(course);
    }
  });

  // 2. Security Filter: Hide 'Inactive' for Students and Parents
  if (userRole === USER_ROLES.STUDENT || userRole === USER_ROLES.PARENT) {
    delete grouped.Inactive;
  }

  delete grouped.Deleted;

  return grouped;
};

// Helper to check if a string is a valid MongoDB ObjectId
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// @desc    Add a new Course
// @route   POST /api/courses
// @access  Admin
exports.addCourse = asyncHandler(async (req, res) => {
  const {
    courseCode,
    courseName,
    description,
    duration,
    teacherId,
    classId,
    status
  } = req.body;

  // 1. Validate Required Fields
  const requiredFields = ['courseCode', 'courseName', 'duration', 'classId'];
  const fieldValidation = validateRequiredFields(req.body, requiredFields);

  console.log('Field Validation:', fieldValidation);
  if (!fieldValidation.isValid) {
    return sendErrorResponse(res, HTTP_STATUS.BAD_REQUEST, fieldValidation.message);
  }
  console.log('Field Validation 2 :', fieldValidation);
  // 2. Verify Class Exists
  const cls = await Class.findOne({classID : classId});
  console.log('Class Lookup:', cls);
  if (!cls) {
    return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, 'Class not found');
  }

  // 3. Determine Teacher & Status Logic
  let finalTeacherId = null;
  
  // Default status is 'Active' (as per schema), unless user overrides it.
  // We will force it to 'Inactive' below if teacher is missing.
  let finalStatus = status || 'Active';

  // VALIDATION LOGIC:
  if (teacherId) {
    // Check if a User exists with this ID and is actually a Teacher
    const validTeacher = await User.findOne({ userId : teacherId, role: USER_ROLES.TEACHER });
    console.log('Teacher Lookup:', validTeacher);
    if (validTeacher) {
      finalTeacherId = validTeacher._id;
    } else {
      // REQUIREMENT: If teacherId provided but not found/invalid -> Force Inactive
      // We do NOT throw an error, we just create it as 'Inactive' without a teacher.
      console.warn(`Invalid Teacher ID provided: ${teacherId}. Creating course as Inactive.`);
      finalTeacherId = null;
      finalStatus = 'Inactive';
    }
  } else {
    // REQUIREMENT: No teacherId provided -> Force Inactive
    finalStatus = 'Inactive';
  }

  // 4. Create the Course
  const newCourse = await Course.create({
    courseCode,
    courseName,
    description,
    duration,
    teacherId: finalTeacherId,
    classId : cls._id,
    status: finalStatus
  });

  return sendSuccessResponse(res, HTTP_STATUS.CREATED, 'Course added successfully', newCourse);
});


// @desc    Update Course Details
// @route   PUT /api/courses/:id (Accepts MongoID OR Custom CourseCode)
// @access  Teacher (Own), Admin
exports.updateCourse = asyncHandler(async (req, res) => {
  const inputId = req.params.id;
  const updates = req.body;
  const userRole = req.user.role;
  const userId = req.user._id;

  // 1. Fetch the course (Support MongoID or Custom CourseCode)
  let query = isValidObjectId(inputId) ? { _id: inputId } : { courseCode: inputId };
  const course = await Course.findOne(query);

  if (!course) {
    return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, 'Course not found');
  }

  // LOGIC FOR TEACHERS
  if (userRole === USER_ROLES.TEACHER) {
    // Check Ownership
    if (!course.teacherId || course.teacherId.toString() !== userId.toString()) {
      return sendErrorResponse(res, HTTP_STATUS.FORBIDDEN, 'You can update only your assigned courses');
    }

    // Attempting to update restricted fields
    const restrictedFields = ["classId", "teacherId", "courseCode", "courseName"];
    for (const field of restrictedFields) {
      if (updates[field] !== undefined) {
        return sendErrorResponse(res, HTTP_STATUS.FORBIDDEN, `Teachers are not allowed to update field: ${field}`);
      }
    }

    // Apply Allowed Updates
    // Teacher can change description, duration, academicYear, and status
    if (updates.description !== undefined) course.description = updates.description;
    if (updates.duration !== undefined) course.duration = updates.duration;
    
    // Status Logic for Teacher
    if (updates.status !== undefined) {
      if (['Active', 'Inactive', 'Completed'].includes(updates.status)) {
        course.status = updates.status;
      } else {
        return sendErrorResponse(res, HTTP_STATUS.BAD_REQUEST, 'Invalid status value');
      }
    }
  }

  // LOGIC FOR ADMINS
  if (userRole === USER_ROLES.ADMIN) {
    // 1. Validate Class ID if changed
    if (updates.classId) {
      const cls = await Class.findOne({classID : updates.classId});
      if (!cls) return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, 'Class not found');
      course.classId = updates.classId;
    }

    // 2. Validate Teacher ID if changed
    if (updates.teacherId) {
      const teacherRecord = await Teacher.findOne({ userId: updates.teacherId });
      if (!teacherRecord) {
        return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, 'Teacher profile not found');
      }
      course.teacherId = updates.teacherId;
    } 
    // Handle explicit unassignment
    else if (updates.teacherId === null) {
      course.teacherId = null;
    }

    // 3. Update other fields
    if (updates.courseCode !== undefined) course.courseCode = updates.courseCode;
    if (updates.courseName !== undefined) course.courseName = updates.courseName;
    if (updates.description !== undefined) course.description = updates.description;
    if (updates.duration !== undefined) course.duration = updates.duration;
    
    if (updates.status !== undefined) {
        course.status = updates.status;
    }
  }

  // FINAL CONSISTENCY CHECK
  // Rule: If there is no teacher assigned, the course cannot be Active
  if (!course.teacherId && course.status === 'Active') {
    course.status = 'Inactive';
  }

  await course.save();
  return sendSuccessResponse(res, HTTP_STATUS.OK, 'Course updated successfully', course);
});

// @desc    Soft Delete Course (Set status to 'Deleted')
// @route   DELETE /api/courses/:id
// @access  Admin Only
exports.deleteCourse = asyncHandler(async (req, res) => {
  const inputId = req.params.id;
  const loggedInUser = req.user;

  // 1. Strict Authorization Check
  // Only Admins are allowed to delete courses. 
  // Teachers, Students, and Parents are blocked here.
  if (loggedInUser.role !== USER_ROLES.ADMIN) {
    return sendErrorResponse(
      res, 
      HTTP_STATUS.FORBIDDEN, 
      'Access forbidden: Only Administrators can delete courses'
    );
  }

  // 2. Find Course (Support MongoID or Custom CourseCode)
  let query = isValidObjectId(inputId) ? { _id: inputId } : { courseCode: inputId };
  const course = await Course.findOne(query);

  if (!course) {
    return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, 'Course not found');
  }

  // 3. Soft Delete
  course.status = 'Deleted';
  await course.save();

  return sendSuccessResponse(res, HTTP_STATUS.OK, 'Course deleted successfully (Soft Delete)');
});

// @desc    View Single Course
// @route   GET /api/courses/:id
// @access  All Roles (Scoped)
exports.viewCourseById = asyncHandler(async (req, res) => {
  const inputId = req.params.id;
  const loggedInUser = req.user;

  // 1. Find Course and Populate
  let query = isValidObjectId(inputId) ? { _id: inputId } : { courseCode: inputId };
  
  const course = await Course.findOne(query)
    .populate('teacherId', 'firstName lastName email')
    .populate('classId', 'className classCode classID');

  if (!course) {
    return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, 'Course not found');
  }

  // 2. Role Based Access Check

  // ADMIN: Full Access
  if (loggedInUser.role === USER_ROLES.ADMIN) {
    return sendSuccessResponse(res, HTTP_STATUS.OK, 'Course retrieved', course);
  }

  // TEACHER: Must own the course
  if (loggedInUser.role === USER_ROLES.TEACHER) {
    if (!course.teacherId || course.teacherId._id.toString() !== loggedInUser._id.toString()) {
      return sendErrorResponse(res, HTTP_STATUS.FORBIDDEN, 'Access forbidden: You do not own this course');
    }
    return sendSuccessResponse(res, HTTP_STATUS.OK, 'Course retrieved', course);
  }

  if (course.status === 'Deleted' || course.status === 'Inactive') {
        return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, 'Course not available');
    }

  // STUDENT: Course's class must match one of Student's enrolled classes
  if (loggedInUser.role === USER_ROLES.STUDENT) {
    const student = await Student.findOne({ userId: loggedInUser._id });
    if (!student) return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, 'Student record not found');

    // Check if course.classId is in student.classId Array
    // course.classId._id is the ObjectId because we populated it above
    const isEnrolled = student.classId.some(
      (cid) => cid.toString() === course.classId._id.toString()
    );

    if (!isEnrolled) {
      return sendErrorResponse(res, HTTP_STATUS.FORBIDDEN, 'Access forbidden: You are not enrolled in this class');
    }
    return sendSuccessResponse(res, HTTP_STATUS.OK, 'Course retrieved', course);
  }

  // PARENT: Course's class must match one of their Children's classes
  if (loggedInUser.role === USER_ROLES.PARENT) {
    // Find all children for this parent
    const children = await Student.find({ parentId: loggedInUser._id });
    if (!children || children.length === 0) {
      return sendErrorResponse(res, HTTP_STATUS.FORBIDDEN, 'No children found linked to your account');
    }

    // Collect all class IDs from all children
    // Flatten array: [ [id1], [id2, id3] ] -> [id1, id2, id3]
    const allChildClassIds = children.flatMap(child => child.classId.map(id => id.toString()));

    const courseClassId = course.classId._id.toString();

    if (!allChildClassIds.includes(courseClassId)) {
      return sendErrorResponse(res, HTTP_STATUS.FORBIDDEN, 'Access forbidden: None of your children are in this course');
    }
    return sendSuccessResponse(res, HTTP_STATUS.OK, 'Course retrieved', course);
  }

  return sendErrorResponse(res, HTTP_STATUS.FORBIDDEN, 'Access forbidden');
});

// @desc    1. Get courses list by Teacher ID (Grouped by Status)
// @route   GET /api/courses/teacher/:teacherId
exports.getCoursesByTeacher = asyncHandler(async (req, res) => {
  const { teacherId } = req.params; // Expecting Mongo _id

  const courses = await Course.find({ teacherId })
    .populate('classId', 'className classCode')
    .sort({ createdAt: -1 });

  const data = groupCoursesByStatus(courses, req.user.role);

  return res.status(200).json({
    success: true,
    data
  });
});

// @desc    2. Get courses list by Class ID (Grouped by Status)
// @route   GET /api/courses/class/:classId
exports.getCoursesByClass = asyncHandler(async (req, res) => {
  const { classId } = req.params;

  const courses = await Course.find({ classId })
    .populate('teacherId', 'firstName lastName email userID')
    .sort({ createdAt: -1 });

  const data = groupCoursesByStatus(courses, req.user.role);

  return res.status(200).json({
    success: true,
    data
  });
});

// @desc    3. Get All Courses for Admin (Grouped by Status)
// @route   GET /api/courses/all
// @access  Admin only
exports.getAllCourses = asyncHandler(async (req, res) => {
  // Optional: Safety check
  if (req.user.role !== USER_ROLES.ADMIN) {
    return res.status(403).json({ success: false, message: 'Access Denied' });
  }

  const courses = await Course.find({})
    .populate('teacherId', 'firstName lastName userID')
    .populate('classId', 'className classCode')
    .sort({ createdAt: -1 });

  const data = groupCoursesByStatus(courses, req.user.role);

  return res.status(200).json({
    success: true,
    data
  });
});