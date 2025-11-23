const express = require('express');
const router = express.Router();
const teacherController = require('../controllers/teacherController');
const authMiddleware = require('../middlewares/authMiddleware');
const { requireAdmin } = require('../middlewares/roleMiddleware');

// All routes require authentication
router.use(authMiddleware);

// Admin only routes
router.get('/', requireAdmin, teacherController.getTeacherList);
router.get('/:id', requireAdmin, teacherController.getTeacher);
router.put('/:id', requireAdmin, teacherController.updateTeacher);
router.delete('/:id', requireAdmin, teacherController.deleteTeacher);

module.exports = router;
