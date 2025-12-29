const mongoose = require('mongoose');

const leaveBalanceSchema = new mongoose.Schema({
  teacherId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Teacher', 
    required: true 
  },
  academicYear: { type: String, required: true }, // e.g., "2025-2026"

  // Standard HRMS Buckets
  casualLeave: {
    total: { type: Number, default: 12 },
    used: { type: Number, default: 0 }
  },
  sickLeave: {
    total: { type: Number, default: 10 },
    used: { type: Number, default: 0 }
  },
  earnedLeave: {
    total: { type: Number, default: 0 },
    used: { type: Number, default: 0 }
  },
  
  // Counter for LOP days
  unpaidLeaveUsed: { type: Number, default: 0 }

}, { timestamps: true });

// Ensure one balance record per teacher per year
leaveBalanceSchema.index({ teacherId: 1, academicYear: 1 }, { unique: true });

module.exports = mongoose.model('TeacherLeaveBalance', leaveBalanceSchema);