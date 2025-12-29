const mongoose = require('mongoose');

const teacherLeaveSchema = new mongoose.Schema({
  // The Teacher
  teacherId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Teacher', 
    required: true 
  },
  
  // Who applied? (Usually the Teacher themselves)
  applicantId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },

  // Details
  leaveType: {
    type: String,
    enum: ['Casual', 'Sick', 'Earned', 'Unpaid', 'Maternity', 'Other'],
    required: true
  },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  daysCount: { type: Number, required: true },
  reason: { type: String, required: true },

  // HRMS Specifics
  isLossOfPay: { type: Boolean, default: false }, // If quota exceeded

  // Approval Workflow
  status: {
    type: String,
    enum: ['Pending-Admin', 'Approved', 'Rejected'],
    default: 'Pending-Admin'
  },
  
  // Admin who approved
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  adminRemarks: { type: String }

}, { timestamps: true });

teacherLeaveSchema.index({ teacherId: 1, startDate: 1, endDate: 1 });

module.exports = mongoose.model('TeacherLeave', teacherLeaveSchema);