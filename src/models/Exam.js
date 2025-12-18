const mongoose = require('mongoose');

const examSchema = new mongoose.Schema({
  examName: {
    type: String,
    required: [true, 'Exam name is required'],
    trim: true,
    maxlength: [100, 'Exam name cannot exceed 100 characters']
  },
  examType: {
    type: String,
    required: [true, 'Exam type is required'],
    enum: ['Quiz', 'Midterm', 'Final', 'Assignment', 'Project', 'Presentation', 'Lab', 'Practical']
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: [true, 'Course reference is required']
  },
  totalMarks: {
    type: Number,
    required: [true, 'Total marks is required'],
    min: [1, 'Total marks must be at least 1']
  },
  passingMarks: {
    type: Number,
    required: [true, 'Passing marks is required'],
    min: [0, 'Passing marks cannot be negative'],
    validate: {
      validator: function(value) {
        return value <= this.totalMarks;
      },
      message: 'Passing marks cannot exceed total marks'
    }
  },
  examDate: {
    type: Date,
    required: [true, 'Exam date is required']
  },
  duration: {
    type: Number,
    required: [true, 'Duration is required'],
    min: [1, 'Duration must be at least 1 minute']
  },
  venue: {
    type: String,
    required: [true, 'Venue is required'],
    trim: true
  },
  instructions: {
    type: String,
    maxlength: [1000, 'Instructions cannot exceed 1000 characters']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isCompleted: {
    type: Boolean,
    default: false
  },
  resultsPublished: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for exam status
examSchema.virtual('status').get(function() {
  const now = new Date();
  const examDateTime = new Date(`${this.examDate.toDateString()} ${this.startTime}`);
  
  if (!this.isActive) return 'Cancelled';
  if (this.isCompleted) return 'Completed';
  if (now < examDateTime) return 'Scheduled';
  if (now >= examDateTime && now <= new Date(`${this.examDate.toDateString()} ${this.endTime}`)) {
    return 'In Progress';
  }
  return 'Completed';
});

// Virtual for exam duration in hours
examSchema.virtual('durationInHours').get(function() {
  return (this.duration / 60).toFixed(2);
});

// Indexes for efficient queries
examSchema.index({ course: 1 });
examSchema.index({ classId: 1 });
examSchema.index({ academicYear: 1 });
examSchema.index({ examDate: 1 });
examSchema.index({ examType: 1 });
examSchema.index({ isActive: 1 });


module.exports = mongoose.model('Exam', examSchema);