const router = require('express').Router();
const feeController = require('../controllers/feeController');
const { allowRoles } = require('../middlewares/roleMiddleware');
const { USER_ROLES } = require('../config/constants');
const authMiddleware = require('../middlewares/authMiddleware');

router.use(authMiddleware);

// 1. Fee Types (Master)
// Only Admin can manage or view fee types
router.post('/types', allowRoles([USER_ROLES.ADMIN]), feeController.addFeeType);
router.get('/types', allowRoles([USER_ROLES.ADMIN]), feeController.getAllFeeTypes);
router.put('/types/:id', allowRoles([USER_ROLES.ADMIN]), feeController.updateFeeType);
router.delete('/types/:id', allowRoles([USER_ROLES.ADMIN]), feeController.deleteFeeType);

// 2. Fee Structure (Rules)
// Only Admin creates rules
router.post('/structures', allowRoles([USER_ROLES.ADMIN]), feeController.createFeeStructure);
router.get('/structures/class/:classId', allowRoles([USER_ROLES.ADMIN]), feeController.getStructureByClass);
router.put('/structures/:id', allowRoles([USER_ROLES.ADMIN]), feeController.updateFeeStructure);
router.delete('/structures/:id', allowRoles([USER_ROLES.ADMIN]), feeController.deleteFeeStructure);

// 3. Student Fees (Assignment)
// Only Admin assigns fees
router.post('/assign/bulk', allowRoles([USER_ROLES.ADMIN]), feeController.assignFeeToClass);
router.get('/dues/class/:classId', allowRoles([USER_ROLES.ADMIN]), feeController.getClassDuesList);
router.put('/dues/adjust/:studentFeeId', allowRoles([USER_ROLES.ADMIN]), feeController.applyDiscountOrFine);

// Student/Parent View Bills (Strictly their own)
router.get('/dues/student/:studentId', 
  allowRoles([USER_ROLES.ADMIN, USER_ROLES.STUDENT, USER_ROLES.PARENT]), 
  feeController.getStudentFeeDetails
);

// 4. Transactions (Payment)
// Only Admin collects money
router.post('/pay', allowRoles([USER_ROLES.ADMIN]), feeController.collectFee); 

// View History
router.get('/history/:studentId', 
  allowRoles([USER_ROLES.ADMIN, USER_ROLES.STUDENT, USER_ROLES.PARENT]), 
  feeController.getPaymentHistory
);

// View Receipt
router.get('/receipt/:transactionId', 
  allowRoles([USER_ROLES.ADMIN, USER_ROLES.STUDENT, USER_ROLES.PARENT]), 
  feeController.getTransactionReceipt
);

// 5. Reports
// Only Admin sees financial reports
router.get('/reports/daily', allowRoles([USER_ROLES.ADMIN]), feeController.getDailyCollection);
router.get('/reports/pending', allowRoles([USER_ROLES.ADMIN]), feeController.getPendingFeeReport);;

module.exports = router;