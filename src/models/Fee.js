const mongoose = require('mongoose');

// 1. FEE TYPE (Master Data)
const feeTypeSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, 'Fee type name is required'], 
    unique: true, 
    trim: true,
    uppercase: true 
  },
  description: { 
    type: String, 
    trim: true 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  }
}, { timestamps: true });


// 2. FEE STRUCTURE (Rules for a Class)
const feeStructureSchema = new mongoose.Schema({
  classId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Class', 
    required: true 
  },
  feeTypeId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'FeeType', 
    required: true 
  },
  title: { 
    type: String, 
    required: true, 
    trim: true 
  }, 
  description: { type: String, trim: true },
  
  amount: { 
    type: Number, 
    required: true, 
    min: [0, 'Fee amount cannot be negative'] 
  },
  
  dueDate: { 
    type: Date, 
    required: true 
  },
  
  isActive: { 
    type: Boolean, 
    default: true 
  }
}, { timestamps: true });

// Prevent duplicate fee rules for the same class+type+year
feeStructureSchema.index({ classId: 1, feeTypeId: 1, academicYear: 1 }, { unique: false });


// 3. STUDENT FEE (The Ledger / Status Tracker)
const studentFeeSchema = new mongoose.Schema({
  studentId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Student', 
    required: true 
  },
  classId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Class', 
    required: true 
  },
  feeStructureId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'FeeStructure', 
    required: true 
  },
  
  // -- Financial Breakdown --
  baseAmount: { 
    type: Number, 
    required: true 
  },
  discountAmount: { 
    type: Number, 
    default: 0 
  },
  fineAmount: { 
    type: Number, 
    default: 0 
  },
  totalPayable: { 
    type: Number, 
    required: true 
  }, 
  
  paidAmount: { 
    type: Number, 
    default: 0 
  },
  dueAmount: { 
    type: Number, 
    required: true 
  }, 
  
  // -- Status --
  status: { 
    type: String, 
    enum: ['Paid', 'Unpaid', 'Partial', 'Overdue'], 
    default: 'Unpaid',
    index: true
  },
  
  dueDate: { type: Date, required: true },
  academicYear: { type: String, required: true },
  remarks: String

}, { timestamps: true });

// --- AUTOMATIC CALCULATION LOGIC ---
studentFeeSchema.pre('save', function(next) {
  // 1. Calculate Total Payable
  this.totalPayable = (this.baseAmount + (this.fineAmount || 0)) - (this.discountAmount || 0);

  // 2. Calculate Due Amount
  this.dueAmount = this.totalPayable - (this.paidAmount || 0);

  // 3. Determine Status
  const now = new Date();

  if (this.dueAmount <= 0) {
    this.status = 'Paid';
    this.dueAmount = 0; // Prevent negative due amount in DB
  } else if (now > this.dueDate) {
    this.status = 'Overdue';
  } else if (this.paidAmount > 0) {
    this.status = 'Partial';
  } else {
    this.status = 'Unpaid';
  }

  next();
});

// Indexes
studentFeeSchema.index({ studentId: 1, status: 1 });
studentFeeSchema.index({ classId: 1, status: 1 });
studentFeeSchema.index({ studentId: 1, feeStructureId: 1 }, { unique: true }); 


// 4. FEE TRANSACTION (The Receipt)
const feeTransactionSchema = new mongoose.Schema({
  transactionId: { 
    type: String, 
    required: true, 
    unique: true 
  }, 
  
  studentFeeId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'StudentFee', 
    required: false
  },
  studentId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Student', 
    required: true 
  },
  
  amount: { 
    type: Number, 
    required: true, 
    min: [1, 'Payment amount must be positive'] 
  },
  
  paymentMethod: { 
    type: String, 
    enum: ['Cash', 'Card', 'UPI', 'Bank Transfer', 'Cheque'], 
    required: true 
  },
  
  paymentDate: { 
    type: Date, 
    default: Date.now 
  },
  
  status: { 
    type: String, 
    enum: ['Success', 'Failed', 'Pending'], 
    default: 'Success' 
  },
  
  collectedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }, 
  
  remarks: String

}, { timestamps: true });

feeTransactionSchema.index({ paymentDate: 1 });
feeTransactionSchema.index({ studentId: 1 });


// EXPORTS
module.exports = {
  FeeType: mongoose.model('FeeType', feeTypeSchema),
  FeeStructure: mongoose.model('FeeStructure', feeStructureSchema),
  StudentFee: mongoose.model('StudentFee', studentFeeSchema),
  FeeTransaction: mongoose.model('FeeTransaction', feeTransactionSchema)
};