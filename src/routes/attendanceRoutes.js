const router = require('express').Router();
const studentAttController = require('../controllers/studentAttendanceController');
const teacherAttController = require('../controllers/teacherAttendanceController');
const { allowRoles } = require('../middlewares/roleMiddleware');
const { USER_ROLES } = require('../config/constants');
const authMiddleware = require('../middlewares/authMiddleware');

router.use(authMiddleware);

// ==============================================================================
// 1. STUDENT ATTENDANCE (Course & Exam Context)
// ==============================================================================

// Mark Attendance (Bulk or Single Update)
// Payload: { type: 'Course'|'Exam', courseId, date, records: [...] }
router.post('/student', 
  allowRoles([USER_ROLES.ADMIN, USER_ROLES.TEACHER]), 
  studentAttController.markStudentAttendance
);

// Get Daily Sheet (View specific day data before marking)
// Used by Teachers to see the list and existing statuses (pre-filled leaves)
router.get('/student/sheet', 
  allowRoles([USER_ROLES.ADMIN, USER_ROLES.TEACHER]), 
  studentAttController.getDailySheet
);

// Standard Report (Aggregated Stats)
// Query: ?startDate=...&endDate=...&classId=...
router.get('/student/report', 
  allowRoles([USER_ROLES.ADMIN, USER_ROLES.TEACHER, USER_ROLES.PARENT, USER_ROLES.STUDENT]), 
  studentAttController.getStudentReport
);

// Consolidated Report (Smart Date Calculation)
// Query: ?courseId=... (Calculates from Start->Now) OR ?classId=... (Whole Academic Year)
router.get('/student/report/consolidated', 
  allowRoles([USER_ROLES.ADMIN, USER_ROLES.TEACHER, USER_ROLES.PARENT, USER_ROLES.STUDENT]), 
  studentAttController.getConsolidatedReport
);


// ==============================================================================
// 2. TEACHER ATTENDANCE (Daily Context)
// ==============================================================================

// Self Check-in/Check-out (Teacher) OR Manual Entry (Admin)
router.post('/teacher/checkin', 
  allowRoles([USER_ROLES.ADMIN, USER_ROLES.TEACHER]), 
  teacherAttController.teacherCheckIn
);

router.post('/teacher/checkout', 
  allowRoles([USER_ROLES.ADMIN, USER_ROLES.TEACHER]), 
  teacherAttController.teacherCheckOut
);

// Bulk Marking (Admin Only) - e.g. marking holidays for all staff
router.post('/teacher', 
  allowRoles([USER_ROLES.ADMIN]), 
  teacherAttController.markTeacherAttendance
);

// Admin Correction (Updates Scrutiny Log)
// Updates a specific record for a past date
router.put('/teacher/update', 
  allowRoles([USER_ROLES.ADMIN]), 
  teacherAttController.correctTeacherAttendance
);

// Teacher Report (Monthly/Range)
router.get('/teacher/report', 
  allowRoles([USER_ROLES.ADMIN]), 
  teacherAttController.getTeacherReport
);

module.exports = router;