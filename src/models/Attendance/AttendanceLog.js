const mongoose = require('mongoose');

const attendanceLogSchema = new mongoose.Schema({
  // Link to the main document being modified
  attendanceSheetId: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true,
    refPath: 'sheetModel' 
  },
  
  // To distinguish if ID refers to StudentAttendance or TeacherAttendance
  sheetModel: {
    type: String,
    enum: ['StudentAttendance', 'TeacherAttendance'],
    default: 'StudentAttendance'
  },

  dateOfAttendance: { 
    type: Date, 
    required: true 
  },

  // The Person whose attendance was changed
  targetId: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true 
  },
  targetRole: { 
    type: String, 
    enum: ['Student', 'Teacher'], 
    required: true 
  },

  // The Change Details
  oldStatus: { type: String }, // e.g. "Absent"
  newStatus: { type: String, required: true }, // e.g. "Present"
  
  // The Actor (Who made the change?)
  modifiedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  
  reason: { 
    type: String, 
    default: 'Correction' 
  },
  
  ipAddress: { type: String } // Optional: For security tracking

}, { timestamps: true });

module.exports = mongoose.model('AttendanceLog', attendanceLogSchema);