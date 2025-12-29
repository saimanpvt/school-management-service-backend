const mongoose = require('mongoose');

const studentRecordSchema = new mongoose.Schema({
  studentId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Student', 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['Present', 'Absent', 'Late', 'Leave', 'Excused'], 
    default: 'Absent',
    required: true
  },
  remarks: { 
    type: String, 
    trim: true 
  }
}, { _id: false });

const studentAttendanceSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['Course', 'Exam'], 
    required: true
  },
  
  // Context: Links to the specific Course or Exam
  courseId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Course' 
  },
  examId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Exam' 
  },
  
  // The Date of the Session (Time stripped usually)
  date: { 
    type: Date, 
    required: true 
  },

  // Who marked/created this sheet? (Teacher or Admin)
  takenBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true
  },

  // The actual attendance list
  records: [studentRecordSchema]

}, { timestamps: true });

// INDEXES: Prevent duplicate sheets for the same context/date
// 1. One sheet per Course per Date
studentAttendanceSchema.index(
  { courseId: 1, date: 1 }, 
  { unique: true, partialFilterExpression: { type: 'Course' } }
);

// 2. One sheet per Exam
studentAttendanceSchema.index(
  { examId: 1 }, 
  { unique: true, partialFilterExpression: { type: 'Exam' } }
);

module.exports = mongoose.model('StudentAttendance', studentAttendanceSchema);