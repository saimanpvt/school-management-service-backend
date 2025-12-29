const mongoose = require('mongoose');

const leaveConfigSchema = new mongoose.Schema({
  academicYear: { type: String, required: true, unique: true }, // "2025-2026"
  
  // Feature Toggles
  teacherAutoApprove: { type: Boolean, default: false }, 
  
  // Default Quotas (Applied when a new teacher joins or year starts)
  defaultQuotas: [
    {
      leaveType: { type: String, required: true }, // e.g. "Casual"
      count: { type: Number, required: true },     // e.g. 12
      isPaid: { type: Boolean, default: true }
    }
  ],

  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('LeaveConfig', leaveConfigSchema);