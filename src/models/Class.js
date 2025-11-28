const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
  classID: {
    type: String,
    required: [true, 'Class ID is required'],
    unique: true,
    trim: true,
    uppercase: true
  },

  className: { 
    type: String, 
    required: [true, 'Class name is required'], 
    trim: true, 
    maxlength: [50, 'Class name cannot exceed 50 characters']
  },

  classCode: {
    type: String,
    required: [true, 'Class Code is required'],
    unique: true,
    trim: true,
    uppercase: true,
    maxlength: [20, 'Class code cannot exceed 20 characters']
  },

  description: {
    type: String,
    trim: true,
    maxlength: [300, 'Description cannot exceed 300 characters']
  },

  year: { 
    type: Number 
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual: students in the class
classSchema.virtual('students', {
  ref: 'Student',
  localField: '_id',
  foreignField: 'classId',
});

// Virtual: courses assigned to the class
classSchema.virtual('courses', {
  ref: 'Course',
  localField: '_id',
  foreignField: 'classId',
});

// Indexes
classSchema.index({ classID: 1 });
classSchema.index({ classCode: 1 });
classSchema.index({ className: 1, year: 1 });

module.exports = mongoose.model('Class', classSchema);