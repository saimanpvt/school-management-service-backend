const router = require('express').Router();
const studentLeaveController = require('../controllers/studentLeaveController');
const teacherLeaveController = require('../controllers/teacherLeaveController');
const { allowRoles } = require('../middlewares/roleMiddleware');
const { USER_ROLES } = require('../config/constants');
const authMiddleware = require('../middlewares/authMiddleware');

router.use(authMiddleware);

// ==============================================================================
// 1. STUDENT LEAVES (Parent Approval)
// ==============================================================================

// Apply for Leave
// If Student applies -> Pending-Parent. If Parent applies -> Auto-Approved.
router.post('/student/apply', 
  allowRoles([USER_ROLES.STUDENT, USER_ROLES.PARENT]), 
  studentLeaveController.applyLeave
);

// Approve/Reject Leave
// Only Parent can approve student leaves
router.put('/student/:id/status', 
  allowRoles([USER_ROLES.PARENT]), 
  studentLeaveController.approveLeave
);

// View Leave History (Smart Filters)
// Query: ?month=10&year=2025 OR ?courseId=...
router.get('/student/history', 
  allowRoles([USER_ROLES.ADMIN, USER_ROLES.TEACHER, USER_ROLES.PARENT, USER_ROLES.STUDENT]), 
  studentLeaveController.getStudentLeaveHistory
);


// ==============================================================================
// 2. TEACHER LEAVES (HRMS / Admin Approval)
// ==============================================================================

// Check Balance (Before applying)
// Returns quotas (CL/SL) so UI can warn about Loss of Pay
router.get('/teacher/balance', 
  allowRoles([USER_ROLES.TEACHER, USER_ROLES.ADMIN]), 
  teacherLeaveController.getMyLeaveBalance
);

// Apply for Leave
// Checks balance, marks as LOP if needed, handles Auto-Approve if enabled
router.post('/teacher/apply', 
  allowRoles([USER_ROLES.TEACHER]), 
  teacherLeaveController.applyLeave
);

// Approve/Reject (Admin Only)
// Deducts balance upon approval
router.put('/teacher/:id/status', 
  allowRoles([USER_ROLES.ADMIN]), 
  teacherLeaveController.updateLeaveStatus
);

// View History
// Teachers see own, Admins see all
router.get('/teacher/history', 
  allowRoles([USER_ROLES.ADMIN, USER_ROLES.TEACHER]), 
  teacherLeaveController.getLeaveHistory
);

module.exports = router;