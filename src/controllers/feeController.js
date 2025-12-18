const mongoose = require('mongoose');
const { FeeType, FeeStructure, StudentFee, FeeTransaction } = require('../models/Fee');
const Class = require('../models/Class');
const Student = require('../models/Student');
const User = require('../models/User');

const { sendSuccessResponse, sendErrorResponse } = require('../utils/response');
const { HTTP_STATUS, USER_ROLES } = require('../config/constants');
const { asyncHandler } = require('../middlewares/asyncHandler');
const { validateRequiredFields } = require('../utils/validation');

// 1. FEE TYPE MANAGEMENT (Master Data)

// @desc    Add Fee Type
// @route   POST /api/fees/types
exports.addFeeType = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  if (!name) return sendErrorResponse(res, HTTP_STATUS.BAD_REQUEST, 'Name is required');

  const exists = await FeeType.findOne({ name: name.toUpperCase() });
  if (exists) return sendErrorResponse(res, HTTP_STATUS.CONFLICT, 'Fee type already exists');

  const feeType = await FeeType.create({ name, description });
  return sendSuccessResponse(res, HTTP_STATUS.CREATED, 'Fee Type added', feeType);
});

// @desc    Get All Fee Types
// @route   GET /api/fees/types
exports.getAllFeeTypes = asyncHandler(async (req, res) => {
  const types = await FeeType.find().sort({ name: 1 });
  return sendSuccessResponse(res, HTTP_STATUS.OK, 'Fee Types retrieved', types);
});

// @desc    Update Fee Type
// @route   PUT /api/fees/types/:id
exports.updateFeeType = asyncHandler(async (req, res) => {
  const { name, description, isActive } = req.body;
  const type = await FeeType.findById(req.params.id);
  
  if (!type) return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, 'Fee Type not found');

  if (name) type.name = name.toUpperCase();
  if (description !== undefined) type.description = description;
  if (isActive !== undefined) type.isActive = isActive;

  await type.save();
  return sendSuccessResponse(res, HTTP_STATUS.OK, 'Fee Type updated', type);
});

// @desc    Delete Fee Type (Soft Delete via isActive or Hard Delete check)
// @route   DELETE /api/fees/types/:id
exports.deleteFeeType = asyncHandler(async (req, res) => {
  // Check dependency before delete
  const used = await FeeStructure.findOne({ feeTypeId: req.params.id });
  if (used) return sendErrorResponse(res, HTTP_STATUS.BAD_REQUEST, 'Cannot delete: This Fee Type is used in Fee Structures');

  await FeeType.findByIdAndDelete(req.params.id);
  return sendSuccessResponse(res, HTTP_STATUS.OK, 'Fee Type deleted');
});


// 2. FEE STRUCTURE MANAGEMENT (Rules)

// @desc    Create Fee Structure for a Class
// @route   POST /api/fees/structures
exports.createFeeStructure = asyncHandler(async (req, res) => {
  // Removed academicYear from body
  const { 
    classId, 
    feeTypeId, 
    amount, 
    dueDate, 
    description
  } = req.body;

  const required = ['classId', 'feeTypeId', 'amount', 'dueDate'];
  const validation = validateRequiredFields(req.body, required);
  if (!validation.isValid) return sendErrorResponse(res, HTTP_STATUS.BAD_REQUEST, validation.message);

  // 1. Fetch Class to get Year & Name
  const cls = await Class.findById(classId);
  if (!cls) return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, 'Class not found');
  
  // 2. Fetch Fee Type
  const type = await FeeType.findById(feeTypeId);
  if (!type) return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, 'Fee Type not found');

  // 3. Auto-Generate Title
  // Using cls.year (from Class model)
  let finalTitle = `${type.name} - ${cls.className} (${cls.year})`;

  // 4. Check Duplicate (Removed academicYear from check)
  const exists = await FeeStructure.findOne({ classId, feeTypeId, title: finalTitle });
  if (exists) return sendErrorResponse(res, HTTP_STATUS.CONFLICT, 'Structure already exists for this Class/Type');

  const structure = await FeeStructure.create({
    classId, 
    feeTypeId, 
    title: finalTitle, 
    amount, 
    dueDate, 
    description
  });

  return sendSuccessResponse(res, HTTP_STATUS.CREATED, 'Fee Structure created', structure);
});

// @desc    Get Structure by Class
// @route   GET /api/fees/structures/class/:classId
exports.getStructureByClass = asyncHandler(async (req, res) => {
  const structures = await FeeStructure.find({ classId: req.params.classId })
    .populate('feeTypeId', 'name')
    .sort({ dueDate: 1 });
  
  return sendSuccessResponse(res, HTTP_STATUS.OK, 'Structures retrieved', structures);
});

// @desc    Update Fee Structure (With Propagation to Students)
// @route   PUT /api/fees/structures/:id
exports.updateFeeStructure = asyncHandler(async (req, res) => {
  const { amount, dueDate, title, isActive } = req.body;

  // 1. Basic Validation
  if (!amount && !dueDate && !title && isActive === undefined) {
    return sendErrorResponse(res, HTTP_STATUS.BAD_REQUEST, 'Update failed: Provide at least one field');
  }

  // 2. Fetch Structure
  const structure = await FeeStructure.findById(req.params.id);
  if (!structure) return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, 'Structure not found');

  // LOGIC: AMOUNT CHANGE PROPAGATION
  if (amount && amount !== structure.amount) {
    const oldAmount = structure.amount;
    const newBaseAmount = amount;

    // Fetch all student fee records linked to this structure
    const assignedFees = await StudentFee.find({ feeStructureId: structure._id });

    if (assignedFees.length > 0) {
      const studentFeeOps = []; // For updating StudentFee table
      const studentSurplusOps = []; // For updating Student table (Wallet)

      assignedFees.forEach(record => {
        // 1. Calculate New Financials
        // Formula: NewTotal = NewBase + Fine - Discount
        const newTotalPayable = (newBaseAmount + record.fineAmount) - record.discountAmount;
        
        let newPaidAmount = record.paidAmount;
        let newStatus = record.status;
        let surplusToAdd = 0;

        // 2. Scenario: Fee Decreased (Potential Surplus)
        // Example: Paid 500, New Total is 400. Surplus = 100.
        if (record.paidAmount > newTotalPayable) {
          surplusToAdd = record.paidAmount - newTotalPayable;
          
          // Cap the paid amount at the total payable (Since we moved rest to wallet)
          newPaidAmount = newTotalPayable; 
          newStatus = 'Paid';
        } 
        // 3. Scenario: Fee Increased or Same (Just Update Balance)
        // Example: Paid 300, New Total 600. Balance becomes 300.
        else {
          // If paid matches total, it's paid. If less, Partial/Unpaid.
          if (newPaidAmount === newTotalPayable) newStatus = 'Paid';
          else if (newPaidAmount > 0) newStatus = 'Partial';
          else newStatus = 'Unpaid';
        }

        // 4. Prepare StudentFee Update
        studentFeeOps.push({
          updateOne: {
            filter: { _id: record._id },
            update: {
              $set: {
                baseAmount: newBaseAmount,
                totalPayable: newTotalPayable,
                dueAmount: Math.max(0, newTotalPayable - newPaidAmount),
                paidAmount: newPaidAmount,
                status: newStatus,
                // Add a remark so we trace history
                remarks: record.remarks 
                  ? `${record.remarks} | Fee Adj: ${oldAmount}->${newBaseAmount}` 
                  : `Fee Adjusted: ${oldAmount}->${newBaseAmount}`
              }
            }
          }
        });

        // 5. Prepare Student Surplus Update (If applicable)
        if (surplusToAdd > 0) {
          studentSurplusOps.push({
            updateOne: {
              filter: { _id: record.studentId },
              update: { $inc: { surplus: surplusToAdd } }
            }
          });
        }
      });

      // 6. Execute Bulk Operations
      if (studentFeeOps.length > 0) await StudentFee.bulkWrite(studentFeeOps);
      if (studentSurplusOps.length > 0) await Student.bulkWrite(studentSurplusOps);
    }
  }

  // APPLY UPDATES TO STRUCTURE
  if (title) structure.title = title;
  if (amount) structure.amount = amount;
  if (dueDate) structure.dueDate = dueDate;
  if (isActive !== undefined) structure.isActive = isActive;

  await structure.save();

  return sendSuccessResponse(res, HTTP_STATUS.OK, 'Structure updated and changes propagated to students', structure);
});

// @desc    Delete Fee Structure (Cascade Delete & Refund to Surplus)
// @route   DELETE /api/fees/structures/:id
exports.deleteFeeStructure = asyncHandler(async (req, res) => {
  const structureId = req.params.id;

  // 1. Check Existence
  const structure = await FeeStructure.findById(structureId);
  if (!structure) {
    return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, 'Structure not found');
  }

  // 2. Find Assigned Student Fees
  const assignedFees = await StudentFee.find({ feeStructureId: structureId });

  if (assignedFees.length > 0) {
    const studentSurplusOps = [];
    const studentFeeIds = [];

    assignedFees.forEach(fee => {
      studentFeeIds.push(fee._id);

      // 3. Logic: If paid, move to Surplus
      if (fee.paidAmount > 0) {
        studentSurplusOps.push({
          updateOne: {
            filter: { _id: fee.studentId },
            update: { $inc: { surplus: fee.paidAmount } }
          }
        });
      }
    });

    // 4. Execute Bulk Surplus Updates
    if (studentSurplusOps.length > 0) {
      await Student.bulkWrite(studentSurplusOps);
      
      // 5. Unlink Transactions
      // We don't delete transactions (audit trail), but we unlink them from the deleted fee
      await FeeTransaction.updateMany(
        { studentFeeId: { $in: studentFeeIds } },
        { 
          $set: { 
            studentFeeId: null, // <--- Safe now because schema allowed false
            // We can't set it to null if the schema requires ObjectId, 
            // but usually for soft-deletion/unlinking we might make the field optional 
            // or we keep it but acknowledge the fee record is gone. 
            // Since we are hard deleting the StudentFee, let's strictly update remarks.
            // If your schema requires studentFeeId, we might have to keep the IDs 
            // or you should change the schema to required: false.
            
            // Assuming we allow null or we accept broken link for now, 
            // typically we set remarks to explain why the link is broken.
            remarks: `Structure Deleted. Amount credited to Surplus.` 
          } 
        }
      );
    }

    // 6. Delete the Student Fees
    await StudentFee.deleteMany({ feeStructureId: structureId });
  }

  // 7. Delete the Structure itself
  await FeeStructure.findByIdAndDelete(structureId);

  return sendSuccessResponse(res, HTTP_STATUS.OK, 'Fee Structure deleted. Any collected amounts have been moved to student surplus.');
});

// 3. STUDENT FEE ASSIGNMENT (Ledger)

// @desc    Bulk Assign Fee to Class (Auto-deduct Surplus & Create Transactions)
// @route   POST /api/fees/assign/bulk
exports.assignFeeToClass = asyncHandler(async (req, res) => {
  const { classId, feeStructureId } = req.body;
  
  // 1. Validate Structure
  const structure = await FeeStructure.findById(feeStructureId).populate('classId');
  if (!structure) return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, 'Fee Structure not found');
  if (structure.classId._id.toString() !== classId) return sendErrorResponse(res, HTTP_STATUS.BAD_REQUEST, 'Class mismatch');

  // 2. Fetch Students
  const students = await Student.find({ classId: classId });
  if (!students.length) return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, 'No students found');

  const existingRecords = await StudentFee.find({ feeStructureId }).select('studentId');
  const existingStudentIds = existingRecords.map(r => r.studentId.toString());

  const feesToInsert = [];
  const studentUpdates = [];      // For Student (Wallet deduction)
  const transactionsToInsert = []; // For FeeTransaction (Receipts)

  // 3. Loop Students & Check Surplus
  students.forEach(std => {
    if (!existingStudentIds.includes(std._id.toString())) {
      
      let initialPaid = 0;
      let amountToDeduct = 0;
      
      // We generate the ID manually so we can link the Transaction to it immediately
      const newFeeId = new mongoose.Types.ObjectId(); 

      // --- SURPLUS LOGIC START ---
      if (std.surplus > 0) {
        // Calculate max possible deduction
        amountToDeduct = Math.min(std.surplus, structure.amount);
        initialPaid = amountToDeduct;

        // A. Prepare Wallet Update
        studentUpdates.push({
          updateOne: {
            filter: { _id: std._id },
            update: { $inc: { surplus: -amountToDeduct } } 
          }
        });

        // B. Prepare Transaction Record (So it shows in history)
        transactionsToInsert.push({
          transactionId: `TXN-AUTO-${Date.now()}-${Math.floor(Math.random()*1000)}`,
          studentFeeId: newFeeId, // Link to the fee we are about to create
          studentId: std._id,
          amount: amountToDeduct,
          paymentMethod: 'Cash', // Or add 'Wallet' to your Enum
          paymentDate: new Date(),
          status: 'Success',
          collectedBy: req.user._id, // The Admin running this bulk job
          remarks: 'Auto-deducted from Student Surplus (Wallet)'
        });
      }
      // --- SURPLUS LOGIC END ---

      // C. Prepare Fee Ledger
      feesToInsert.push({
        _id: newFeeId, // Use the pre-generated ID
        studentId: std._id,
        classId: classId,
        feeStructureId: feeStructureId,
        baseAmount: structure.amount,
        totalPayable: structure.amount,
        dueAmount: structure.amount - initialPaid,
        paidAmount: initialPaid,
        dueDate: structure.dueDate,
        academicYear: structure.classId.year, // Using Year from Class Model
        status: initialPaid >= structure.amount ? 'Paid' : (initialPaid > 0 ? 'Partial' : 'Unpaid'),
        remarks: initialPaid > 0 ? `Auto-paid ${initialPaid} from Surplus` : ''
      });
    }
  });

  if (feesToInsert.length === 0) {
    return sendSuccessResponse(res, HTTP_STATUS.OK, 'No new students to assign');
  }

  // 4. Perform Bulk Operations
  
  // A. Deduct form Wallets
  if (studentUpdates.length > 0) {
    await Student.bulkWrite(studentUpdates);
  }

  // B. Create Fee Records
  await StudentFee.insertMany(feesToInsert);

  // C. Create Transaction Records (If any surplus was used)
  if (transactionsToInsert.length > 0) {
    await FeeTransaction.insertMany(transactionsToInsert);
  }

  return sendSuccessResponse(res, HTTP_STATUS.CREATED, `Fee assigned to ${feesToInsert.length} students. Surplus applied for ${transactionsToInsert.length} students.`);
});

// @desc    Get Student Fee Details (The Bill)
// @route   GET /api/fees/dues/student/:studentId
exports.getStudentFeeDetails = asyncHandler(async (req, res) => {
  const { studentId } = req.params;
  const user = req.user;

  // 1. AUTHORIZATION LOGIC
  
  // ADMIN: Allowed (Explicit check)
  if (user.role === USER_ROLES.ADMIN) {
    // Pass
  }
  // STUDENT: Check ownership
  else if (user.role === USER_ROLES.STUDENT) {
    const me = await Student.findOne({ userId: user._id });
    if (!me || me._id.toString() !== studentId) {
      return sendErrorResponse(res, HTTP_STATUS.FORBIDDEN, 'Access Denied: You can only view your own fees');
    }
  }
  // PARENT: Check child ownership
  else if (user.role === USER_ROLES.PARENT) {
    const child = await Student.findOne({ _id: studentId, parentId: user._id });
    if (!child) {
      return sendErrorResponse(res, HTTP_STATUS.FORBIDDEN, 'Access Denied: Not your child');
    }
  }
  // TEACHER / OTHERS: Block them explicitly
  else {
    return sendErrorResponse(res, HTTP_STATUS.FORBIDDEN, 'Access Denied: Teachers cannot view financial records');
  }

  // 2. FETCH DATA
  const fees = await StudentFee.find({ studentId })
    .populate({ 
      path: 'feeStructureId', 
      select: 'title feeTypeId', 
      populate: { path: 'feeTypeId', select: 'name' } 
    })
    .sort({ dueDate: 1 });

  return sendSuccessResponse(res, HTTP_STATUS.OK, 'Student fees retrieved', fees);
});

// @desc    Get Class Dues List
// @route   GET /api/fees/dues/class/:classId
exports.getClassDuesList = asyncHandler(async (req, res) => {
  const fees = await StudentFee.find({ classId: req.params.classId })
    .populate('studentId', 'studentId')
    .populate({ path: 'studentId', populate: { path: 'userId', select: 'firstName lastName' } })
    .populate({ path: 'feeStructureId', select: 'title' });

  return sendSuccessResponse(res, HTTP_STATUS.OK, 'Class dues list', fees);
});

// @desc    Apply Discount or Fine (Adjust)
// @route   PUT /api/fees/dues/adjust/:studentFeeId
exports.applyDiscountOrFine = asyncHandler(async (req, res) => {
  const { discountAmount, fineAmount, remarks } = req.body;
  const feeRecord = await StudentFee.findById(req.params.studentFeeId);
  
  if (!feeRecord) return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, 'Record not found');

  if (discountAmount !== undefined) feeRecord.discountAmount = discountAmount;
  if (fineAmount !== undefined) feeRecord.fineAmount = fineAmount;
  if (remarks) feeRecord.remarks = remarks;

  await feeRecord.save(); // Pre-save hook will recalculate totals/status
  return sendSuccessResponse(res, HTTP_STATUS.OK, 'Fee adjusted successfully', feeRecord);
});

// @desc    Unassign Fee & Move Payments to Surplus
// @route   DELETE /api/fees/assign/:studentFeeId
exports.unassignFee = asyncHandler(async (req, res) => {
  const { studentFeeId } = req.params;

  // 1. Fetch the Fee Record
  const feeRecord = await StudentFee.findById(studentFeeId);
  if (!feeRecord) {
    return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, 'Student Fee record not found');
  }

  // 2. Handle Money Logic
  let message = 'Fee unassigned successfully.';
  
  if (feeRecord.paidAmount > 0) {
    // A. MOVE TO SURPLUS
    await Student.findByIdAndUpdate(
      feeRecord.studentId, 
      { $inc: { surplus: feeRecord.paidAmount } } 
    );

    // B. UNLINK TRANSACTIONS
    // FIX: Added '$set' operator which is required for updateMany
    await FeeTransaction.updateMany(
      { studentFeeId: studentFeeId }, 
      { 
        $set: { 
          studentFeeId: null, // Unlink (Schema must allow required: false)
          // FIX: Generic remark to avoid confusion on individual transaction rows
          remarks: `Fee Structure Unassigned. Amount credited to Student Surplus.` 
        }
      }
    );

    message = `Fee unassigned. ${feeRecord.paidAmount} moved to Student Surplus.`;
  }

  // 3. Delete the Fee Record
  await StudentFee.findByIdAndDelete(studentFeeId);

  return sendSuccessResponse(res, HTTP_STATUS.OK, message);
});

// 4. FEE TRANSACTION (Payment)

// @desc    Collect Fee (Pay) - Handles Surplus
// @route   POST /api/fees/pay
exports.collectFee = asyncHandler(async (req, res) => {
  const { studentFeeId, amount, paymentMethod, remarks } = req.body;
  
  // 1. Basic Validation
  if (!amount || amount <= 0) {
    return sendErrorResponse(res, HTTP_STATUS.BAD_REQUEST, 'Invalid amount');
  }

  // 2. Fetch Ledger
  const ledger = await StudentFee.findById(studentFeeId);
  if (!ledger) {
    return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, 'Fee record not found');
  }

  if (ledger.status === 'Paid') {
    return sendErrorResponse(res, HTTP_STATUS.BAD_REQUEST, 'Fee is already fully paid');
  }

  // 3. Handle Overpayment (Move Excess to Surplus)
  let paymentForFee = amount;
  let paymentForSurplus = 0;
  let finalRemarks = remarks || '';

  if (amount > ledger.dueAmount) {
    paymentForFee = ledger.dueAmount;       // Only pay what is due
    paymentForSurplus = amount - ledger.dueAmount; // The rest goes to wallet
    
    finalRemarks = remarks 
      ? `${remarks} (Paid: ${paymentForFee}, To Wallet: ${paymentForSurplus})` 
      : `Split Payment: ${paymentForFee} to Fee, ${paymentForSurplus} to Surplus`;
  }

  // 4. Create Transaction (Record the FULL amount received)
  const transaction = await FeeTransaction.create({
    transactionId: `TXN-${Date.now()}-${Math.floor(Math.random()*1000)}`,
    studentFeeId: ledger._id,
    studentId: ledger.studentId,
    amount: amount, // Record full amount received
    paymentMethod,
    collectedBy: req.user._id,
    remarks: finalRemarks
  });

  // 5. Update Student Ledger (Fee Status)
  ledger.paidAmount += paymentForFee;
  await ledger.save(); // Pre-save hook updates 'status' to Paid/Partial

  // 6. Update Student Surplus (If overpaid)
  if (paymentForSurplus > 0) {
    await Student.findByIdAndUpdate(ledger.studentId, {
      $inc: { surplus: paymentForSurplus }
    });
  }

  return sendSuccessResponse(res, HTTP_STATUS.CREATED, 'Payment successful', { 
    transaction, 
    updatedLedger: ledger,
    addedToSurplus: paymentForSurplus 
  });
});

// @desc    Get Payment History
// @route   GET /api/fees/history/:studentId
exports.getPaymentHistory = asyncHandler(async (req, res) => {
  const { studentId } = req.params;
  const user = req.user;

  // 1. SECURITY: Role-Based Access Control
  // ADMIN: Pass
  if (user.role === USER_ROLES.ADMIN) {
    // Pass
  }
  // STUDENT: Can only view own history
  else if (user.role === USER_ROLES.STUDENT) {
    const me = await Student.findOne({ userId: user._id });
    if (!me || me._id.toString() !== studentId) {
      return sendErrorResponse(res, HTTP_STATUS.FORBIDDEN, 'Access Denied');
    }
  }
  // PARENT: Can only view child's history
  else if (user.role === USER_ROLES.PARENT) {
    const child = await Student.findOne({ _id: studentId, parentId: user._id });
    if (!child) {
      return sendErrorResponse(res, HTTP_STATUS.FORBIDDEN, 'Access Denied: Not your child');
    }
  }
  else {
    return sendErrorResponse(res, HTTP_STATUS.FORBIDDEN, 'Forbidden');
  }

  // 2. Fetch Data
  const transactions = await FeeTransaction.find({ studentId })
    // FIX: Corrected populate path. StudentFee doesn't have title, FeeStructure does.
    .populate({ 
      path: 'studentFeeId', 
      select: 'totalPayable status', // Select fields from StudentFee
      populate: { 
        path: 'feeStructureId', 
        select: 'title academicYear' // Select Title from Structure
      } 
    }) 
    .sort({ paymentDate: -1 });

  return sendSuccessResponse(res, HTTP_STATUS.OK, 'History retrieved', transactions);
});

// @desc    Get Receipt Details
// @route   GET /api/fees/receipt/:transactionId
exports.getTransactionReceipt = asyncHandler(async (req, res) => {
  const { transactionId } = req.params;
  const user = req.user;

  // 1. Fetch Transaction first (needed for ownership check)
  const txn = await FeeTransaction.findOne({ transactionId })
    .populate({ 
      path: 'studentId', 
      select: 'studentId parentId', // Need parentId for checking
      populate: { path: 'userId', select: 'firstName lastName userID' } 
    })
    .populate({ 
      path: 'studentFeeId', 
      populate: { path: 'feeStructureId', select: 'title academicYear' } 
    });

  if (!txn) return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, 'Transaction not found');

  // 2. SECURITY: Check Ownership
  if (user.role === USER_ROLES.ADMIN) {
    // Pass
  }
  else if (user.role === USER_ROLES.STUDENT) {
    // Check if the transaction belongs to the logged-in student's student record
    // txn.studentId is the Student Object (populated above)
    // We check against the Student Record associated with the User
    const me = await Student.findOne({ userId: user._id });
    if (!me || txn.studentId._id.toString() !== me._id.toString()) {
      return sendErrorResponse(res, HTTP_STATUS.FORBIDDEN, 'Access Denied');
    }
  }
  else if (user.role === USER_ROLES.PARENT) {
    // Check if the transaction's student belongs to this parent
    if (txn.studentId.parentId.toString() !== user._id.toString()) {
      return sendErrorResponse(res, HTTP_STATUS.FORBIDDEN, 'Access Denied');
    }
  }
  else {
    return sendErrorResponse(res, HTTP_STATUS.FORBIDDEN, 'Forbidden');
  }

  return sendSuccessResponse(res, HTTP_STATUS.OK, 'Receipt retrieved', txn);
});


// 5. REPORTS

// @desc    Daily Collection Report (Cash/Online received today)
// @route   GET /api/fees/reports/daily
exports.getDailyCollection = asyncHandler(async (req, res) => {
  const { date } = req.query; // Format: YYYY-MM-DD
  
  // 1. Safe Date Range Calculation
  // We clone the date to avoid mutation side-effects
  const targetDate = date ? new Date(date) : new Date();
  
  const start = new Date(targetDate);
  start.setHours(0, 0, 0, 0); // Start of day (Local Server Time)

  const end = new Date(targetDate);
  end.setHours(23, 59, 59, 999); // End of day

  // 2. Fetch Transactions (Using .lean() for speed)
  const txns = await FeeTransaction.find({
    paymentDate: { $gte: start, $lte: end }
  })
  .populate({ 
    path: 'studentId', 
    select: 'studentId', // Get readable Student ID (e.g. ST-2024)
    populate: { path: 'userId', select: 'firstName lastName' } // Get Name
  })
  .populate({
    path: 'studentFeeId', // Populate to show what this payment was FOR
    populate: { path: 'feeStructureId', select: 'title' }
  })
  .sort({ paymentDate: -1 })
  .lean();

  // 3. Calculate Summary Stats
  const stats = {
    totalCollection: 0,
    cashTotal: 0,
    onlineTotal: 0
  };

  txns.forEach(t => {
    stats.totalCollection += t.amount;
    if (t.paymentMethod === 'Cash') stats.cashTotal += t.amount;
    else stats.onlineTotal += t.amount;
  });

  return sendSuccessResponse(res, HTTP_STATUS.OK, 'Daily collection report', { 
    date: start.toDateString(), 
    stats,
    count: txns.length,
    transactions: txns 
  });
});

// @desc    Pending Fees Report (All Outstanding Dues)
// @route   GET /api/fees/reports/pending
exports.getPendingFeeReport = asyncHandler(async (req, res) => {
  // 1. Fetch all records where money is owed
  // We filter by status: Unpaid, Partial, or Overdue
  const pendingFees = await StudentFee.find({ 
    status: { $in: ['Unpaid', 'Partial', 'Overdue'] } 
  })
  .populate({ 
    path: 'studentId', 
    select: 'studentId', 
    populate: { path: 'userId', select: 'firstName lastName userID email' } // Contact info is useful for reminders
  })
  .populate('classId', 'className classCode') // Group by class
  .populate({
    path: 'feeStructureId',
    select: 'title amount'
  })
  .sort({ classId: 1, studentId: 1 }) // Organized sorting
  .lean();

  // 2. Calculate Total Outstanding Amount
  const totalOutstanding = pendingFees.reduce((sum, fee) => sum + fee.dueAmount, 0);

  return sendSuccessResponse(res, HTTP_STATUS.OK, 'Pending fees report', {
    totalOutstanding,
    count: pendingFees.length,
    records: pendingFees
  });
});