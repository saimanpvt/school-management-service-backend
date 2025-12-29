const mongoose = require('mongoose');

const studentLeaveSchema = new mongoose.Schema({
  // The Student
  studentId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Student', 
    required: true 
  },
  
  // Who applied? (Student or Parent)
  applicantId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },

  // Leave Details
  leaveType: {
    type: String,
    enum: ['Medical', 'Family', 'Event', 'Other'],
    required: true
  },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  daysCount: { type: Number, required: true }, // Calculated logic in controller
  reason: { type: String, required: true, trim: true },

  // Approval Workflow
  status: {
    type: String,
    enum: ['Pending-Parent', 'Approved', 'Rejected'],
    default: 'Pending-Parent'
  },
  
  // Parent who approved/rejected
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rejectionReason: { type: String }

}, { timestamps: true });

// Index for checking overlapping dates
studentLeaveSchema.index({ studentId: 1, startDate: 1, endDate: 1 });
studentLeaveSchema.index({ status: 1 });

module.exports = mongoose.model('StudentLeave', studentLeaveSchema);