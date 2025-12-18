const express = require('express');
const router = express.Router();
const examController = require('../controllers/examController');
const authMiddleware = require('../middlewares/authMiddleware');
const { allowRoles } = require('../middlewares/roleMiddleware');
const { USER_ROLES } = require('../config/constants');

// All routes require authentication
router.use(authMiddleware);

router.get('/', examController.getExamRecordList);
router.get('/:id', examController.getExamRecord);
router.post('/', allowRoles([USER_ROLES.TEACHER, USER_ROLES.ADMIN]), examController.addExamRecord);
router.put('/update/:id', allowRoles([USER_ROLES.TEACHER, USER_ROLES.ADMIN]), examController.updateExamRecord);
router.delete('/:id', allowRoles([USER_ROLES.TEACHER, USER_ROLES.ADMIN]), examController.deleteExamRecord);
router.get('/course/:courseId', allowRoles([USER_ROLES.TEACHER, USER_ROLES.ADMIN]), examController.getExamsByCourse);

module.exports = router;