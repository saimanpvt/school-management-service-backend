const express = require('express');
const router = express.Router();
const marksController = require('../controllers/marksController');
const authMiddleware = require('../middlewares/authMiddleware');
const { allowRoles } = require('../middlewares/roleMiddleware');
const { USER_ROLES } = require('../config/constants');

// All routes require authentication
router.use(authMiddleware);

router.post('/add', allowRoles([USER_ROLES.TEACHER, USER_ROLES.ADMIN]), marksController.saveMarks);
router.put('/update', allowRoles([USER_ROLES.TEACHER, USER_ROLES.ADMIN]), marksController.saveMarks);
router.delete('delete/:id', allowRoles([USER_ROLES.TEACHER, USER_ROLES.ADMIN]), marksController.deleteMark);
router.get('/marks/list', marksController.getMarksByExam);

module.exports = router;
