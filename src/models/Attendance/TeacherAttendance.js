const mongoose = require('mongoose');

const teacherRecordSchema = new mongoose.Schema({
  teacherId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Teacher', 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['Present', 'Absent', 'Late', 'Leave', 'HalfDay'], 
    default: 'Present',
    required: true
  },
  checkInTime: { type: String },
  checkOutTime: { type: String },
  remarks: { type: String }
}, { _id: false });

const teacherAttendanceSchema = new mongoose.Schema({
  date: { 
    type: Date, 
    required: true, 
    unique: true
  },
  
  // If Admin bulk-marked it, their ID goes here.
  takenBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }, 
  
  records: [teacherRecordSchema]

}, { timestamps: true });

module.exports = mongoose.model('TeacherAttendance', teacherAttendanceSchema);