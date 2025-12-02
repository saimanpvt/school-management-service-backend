const express = require('express');
const router = express.Router();

const courseController = require('../controllers/courseController');
const { allowRoles } = require('../middlewares/roleMiddleware');
const { HTTP_STATUS, USER_ROLES } = require('../config/constants');
const { asyncHandler } = require('../middlewares/asyncHandler');

// ADMIN -> add course
router.post(
  '/add',
  allowRoles([USER_ROLES.ADMIN]),
  courseController.addCourse
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
  courseController.viewCourses
);

// VIEW single course
router.get(
  '/:courseId',
  allowRoles([USER_ROLES.ADMIN, USER_ROLES.TEACHER, USER_ROLES.STUDENT, USER_ROLES.PARENT]),
  courseController.viewCourseById
);

module.exports = router;
