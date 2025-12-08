const express = require('express');
const router = express.Router();

const courseController = require('../controllers/courseController');
const { allowRoles } = require('../middlewares/roleMiddleware');
const {USER_ROLES } = require('../config/constants');
const { asyncHandler } = require('../middlewares/asyncHandler');
const authMiddleware = require('../middlewares/authMiddleware');
// Apply authentication to all routes
router.use(authMiddleware);

// ADMIN -> add course
router.post(
  '/add',
  allowRoles([USER_ROLES.ADMIN]),
  asyncHandler(courseController.addCourse)
);

// TEACHER, ADMIN -> update own course
router.put(
  '/:courseId',
  allowRoles([USER_ROLES.TEACHER, USER_ROLES.ADMIN]),
  courseController.updateCourse
);

// ADMIN -> delete course
router.delete(
  '/:courseId',
  allowRoles([USER_ROLES.ADMIN]),
  courseController.deleteCourse
);

// VIEW courses (list) - Admin, Teacher, Student, Parent
router.get(
  '/',
  allowRoles([USER_ROLES.ADMIN, USER_ROLES.TEACHER, USER_ROLES.STUDENT, USER_ROLES.PARENT]),
  courseController.getCourseList
);

// VIEW single course
router.get(
  '/:courseId',
  allowRoles([USER_ROLES.ADMIN, USER_ROLES.TEACHER, USER_ROLES.STUDENT, USER_ROLES.PARENT]),
  courseController.viewCourseById
);

// VIEW courses (list) - Admin, Teacher, Student, Parent
router.get(
  '/teacher/:teacherId',
  allowRoles([USER_ROLES.TEACHER]),
  courseController.getCoursesByTeacher
);

// VIEW courses (list) - Admin, Teacher, Student, Parent
router.get(
  '/student/:studentId',
  allowRoles([USER_ROLES.STUDENT, USER_ROLES.PARENT]),
  courseController.getCoursesByStudent
);

// VIEW courses (list) - Admin, Teacher, Student, Parent
router.get(
  '/class/:classId',
  allowRoles([USER_ROLES.STUDENT, USER_ROLES.PARENT]),
  courseController.getCoursesByClass
);

module.exports = router;
