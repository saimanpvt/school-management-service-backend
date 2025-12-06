const express = require('express');
const router = express.Router();
const marksController = require('../controllers/marksController');
const authMiddleware = require('../middlewares/authMiddleware');
const { allowRoles } = require('../middlewares/roleMiddleware');
const { USER_ROLES } = require('../config/constants');

// All routes require authentication
router.use(authMiddleware);

// ------------------
// TEACHER ONLY: Add/Update/Delete Marks
// ------------------
router.post('/', allowRoles([USER_ROLES.TEACHER]), marksController.addMarks);
router.put('/:id', allowRoles([USER_ROLES.TEACHER]), marksController.updateMarks);
router.delete('/:id', allowRoles([USER_ROLES.TEACHER]), marksController.deleteMarks);


// MARKS ROUTES
// Admin + Teacher: class → course → students → marks
router.get('/marks/list', allowRoles([USER_ROLES.ADMIN, USER_ROLES.TEACHER]), marksController.getAdminTeacherReport);

// Student + Parent: subject → examType → marks
router.get('/marks/student/:studentId', allowRoles([USER_ROLES.STUDENT, USER_ROLES.PARENT]), marksController.getStudentParentReport);

//Reports routes
router.get('/admin', allowRoles([USER_ROLES.ADMIN]), marksController.getAdminReport);
router.get('/student/:studentId', allowRoles([USER_ROLES.STUDENT, USER_ROLES.PARENT]), marksController.getStudentParentReport);

module.exports = router;
