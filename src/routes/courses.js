const router = require('express').Router();
const courseController = require('../controllers/courseController');
const { allowRoles } = require('../middlewares/roleMiddleware');
const { USER_ROLES } = require('../config/constants');
const authMiddleware = require('../middlewares/authMiddleware');

router.use(authMiddleware);

// Specific Routes
router.post('/add', allowRoles([USER_ROLES.ADMIN]), courseController.addCourse); // Add new course
router.get('/', allowRoles([USER_ROLES.ADMIN]), courseController.getAllCourses); // Admin view all
router.get('/teacher/:teacherId', allowRoles([USER_ROLES.ADMIN, USER_ROLES.TEACHER]), courseController.getCoursesByTeacher); // Filter by Teacher
router.get('/class/:classId', allowRoles([USER_ROLES.ADMIN, USER_ROLES.TEACHER, USER_ROLES.STUDENT, USER_ROLES.PARENT]), courseController.getCoursesByClass); // Filter by Class

// Dynamic ID Routes (/:id)
router.get('/:id', allowRoles([USER_ROLES.ADMIN, USER_ROLES.TEACHER, USER_ROLES.STUDENT, USER_ROLES.PARENT]), courseController.viewCourseById); // View single details
router.put('/:id', allowRoles([USER_ROLES.ADMIN, USER_ROLES.TEACHER]), courseController.updateCourse); // Update course
router.delete('/:id', allowRoles([USER_ROLES.ADMIN]), courseController.deleteCourse); // Delete course

module.exports = router;