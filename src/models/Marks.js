const mongoose = require('mongoose');

const markSchema = new mongoose.Schema({
  examId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exam',
    required: true
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  marks: {
    type: Number,
    required: true,
    min: 0,
  },
  remarks: {
    type: String,
    maxlength: 200
  }
}, {
  timestamps: true
});

markSchema.index({ examId: 1, studentId: 1 }, { unique: true });

module.exports = mongoose.model('Mark', markSchema);
