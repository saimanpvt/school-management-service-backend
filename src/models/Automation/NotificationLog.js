const mongoose = require('mongoose');

const notificationLogSchema = new mongoose.Schema({
  recipientId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  recipientEmail: { type: String, required: true },
  
  role: { 
    type: String, 
    enum: ['Parent', 'Teacher', 'Admin', 'Student'],
    required: true
  },
  
  // Notification Type
  channel: { 
    type: String, 
    enum: ['Email', 'SMS', 'Push', 'In-App'], 
    default: 'Email' 
  },
  
  triggerEvent: { 
    type: String, 
    enum: ['Absent_Alert', 'Leave_Request', 'Leave_Status', 'Fee_Due', 'System'],
    required: true
  },

  // Content
  subject: { type: String },
  message: { type: String, required: true }, 
  
  // Status
  status: { 
    type: String, 
    enum: ['Sent', 'Failed', 'Queued'], 
    default: 'Sent' 
  },
  errorDetails: { type: String },

  // Context (Optional link to what caused this)
  relatedId: { type: mongoose.Schema.Types.ObjectId }, // e.g. LeaveId or StudentFeeId
  
  sentAt: { type: Date, default: Date.now }

}, { timestamps: true });

module.exports = mongoose.model('NotificationLog', notificationLogSchema);