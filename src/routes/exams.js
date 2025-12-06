const express = require('express');
const router = express.Router();
const examController = require('../controllers/examController');
const authMiddleware = require('../middlewares/authMiddleware');
const { allowRoles } = require('../middlewares/roleMiddleware');
const { USER_ROLES } = require('../config/constants');

// All routes require authentication
router.use(authMiddleware);

// Common routes (accessible by all authenticated users)
router.get('/', examController.getExamRecordList);
router.get('/:id', examController.getExamRecord);

// Student + Teacher routes
router.post('/', allowRoles([USER_ROLES.TEACHER]), examController.addExamRecord);
router.put('/:id', allowRoles([USER_ROLES.TEACHER]), examController.updateExamRecord);

module.exports = router;
