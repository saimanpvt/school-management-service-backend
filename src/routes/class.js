const express = require('express');
const router = express.Router();
const classController = require('../controllers/classController');
const authMiddleware = require('../middlewares/authMiddleware');
const { allowRoles } = require('../middlewares/roleMiddleware');
const { USER_ROLES } = require('../config/constants');

router.use(authMiddleware);

// CREATE class
router.post('/', allowRoles([USER_ROLES.ADMIN]), classController.addClass);

// UPDATE class
router.put('/:id', allowRoles([USER_ROLES.ADMIN]), classController.updateClass);

// DELETE class
router.delete('/:id', allowRoles([USER_ROLES.ADMIN]), classController.deleteClass);

// LIST all classes
router.get('/', allowRoles([USER_ROLES.ADMIN]), classController.getAllClasses);

// GET class details with students + courses
router.get('/:id', allowRoles([USER_ROLES.ADMIN]), classController.getClassDetails);

router.get('/enroll', allowRoles([USER_ROLES.ADMIN]), classController.studentAdmission);

module.exports = router;