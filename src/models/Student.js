const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true, 
    unique: true 
  },
  classId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Class', 
    required: true 
  },
  parentId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Parent' 
  }, 
  admissionDate: { 
    type: Date,
    required: true
  },
  leavingDate: { 
    type: Date 
  }, 
  emergencyContact: { 
    type: String, 
    trim: true, 
    match: [/^\+?[\d\s\-\(\)]+$/, 'Please enter a valid phone number'] 
  },
  studentId: { 
    type: String, 
    required: true,
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for efficient queries
studentSchema.index({ userId: 1 });
studentSchema.index({ parentId: 1 });
studentSchema.index({ classId: 1 });
studentSchema.index({ studentId: 1 });
studentSchema.index({ classId: 1 });

// Ensure studentId is unique
studentSchema.post('save', function(error, doc, next) {
  if (error.name === 'MongoError' && error.code === 11000) {
    next(new Error('Student ID already exists'));
  } else {
    next();
  }
});

module.exports = mongoose.model('Student', studentSchema);
