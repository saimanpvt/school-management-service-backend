const mongoose = require('mongoose');
const { USER_ROLES } = require('../config/constants');

const teacherSchema = new mongoose.Schema({
 userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true, 
    unique: true 
  },
  employeeId: { 
    type: String, 
    required: true, 
    unique: true, 
    trim: true 
  },
  experience: { 
    type: Number, // in months
    default: 0,
    min: 0
  },
  DOJ: { 
    type: Date, 
    required: true 
  },
  resignationDate: { 
    type: Date 
  },
  bio: {
    type: String,
    maxlength: [500, 'Bio cannot exceed 500 characters']
  }, 
  emergencyContact: { 
    type: String, 
    trim: true, 
    match: [/^\+?[\d\s\-\(\)]+$/, 'Please enter a valid phone number'] 
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for efficient queries
teacherSchema.index({ employeeId: 1 });
teacherSchema.index({ userId: 1 });

// Ensure employeeId is unique
teacherSchema.post('save', function(error, doc, next) {
  if (error.name === 'MongoError' && error.code === 11000) {
    next(new Error('Employee ID already exists'));
  } else {
    next();
  }
});

teacherSchema.virtual('fullName').get(function() {
  if (this.userId && this.userId.firstName && this.userId.lastName) {
    return `${this.userId.firstName} ${this.userId.lastName}`;
  }
  return '';
});


module.exports = mongoose.model('Teacher', teacherSchema);
