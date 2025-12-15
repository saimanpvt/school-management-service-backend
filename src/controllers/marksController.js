const Marks = require('../models/Marks');
const Exam = require('../models/Exam');
const Course = require('../models/Course');
const Student = require('../models/Student');
const Class = require('../models/Class');
const Parent = require('../models/Parent');
const { USER_ROLES } = require('../config/constants');
const asyncHandler = require('express-async-handler');

// @desc    Add or Update Marks (Supports Single Object or Bulk Array)
// @route   POST /api/marks/save
// @access  Teacher (Own Course), Admin
exports.saveMarks = asyncHandler(async (req, res) => {
  const loggedInUser = req.user;
  const { examId, marks } = req.body;

  // 1. Input Normalization & Validation
  if (!examId || !marks) {
    return sendErrorResponse(res, HTTP_STATUS.BAD_REQUEST, 'Missing examId or marks data');
  }

  const marksList = Array.isArray(marks) ? marks : [marks];

  if (marksList.length === 0) {
    return sendErrorResponse(res, HTTP_STATUS.BAD_REQUEST, 'Marks data is empty');
  }

  // 2. Fetch Exam & Verify Ownership
  const exam = await Exam.findById(examId).populate('course');
  if (!exam) {
    return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, 'Exam not found');
  }

  // Authorization: Teacher must own the course
  if (loggedInUser.role === USER_ROLES.TEACHER) {
    if (!exam.course || exam.course.teacherId.toString() !== loggedInUser._id.toString()) {
      return sendErrorResponse(res, HTTP_STATUS.FORBIDDEN, 'You do not own this course');
    }
  }

  // 3. Prepare Bulk Operations
  const bulkOps = [];
  const errors = [];

  marksList.forEach((entry, index) => {
    // Basic Data Check
    if (!entry.studentId || entry.marks === undefined) {
      errors.push(`Entry #${index + 1}: Missing studentId or marks`);
      return;
    }

    // Logic Check: Total Marks
    if (entry.marks > exam.totalMarks) {
      errors.push(`Student ${entry.studentId}: Marks (${entry.marks}) cannot exceed Total (${exam.totalMarks})`);
      return;
    }

    // Logic Check: Negative Marks
    if (entry.marks < 0) {
      errors.push(`Student ${entry.studentId}: Marks cannot be negative`);
      return;
    }

    // Push Operation
    bulkOps.push({
      updateOne: {
        filter: { examId: examId, studentId: entry.studentId },
        update: { 
          $set: { 
            marks: entry.marks, 
            remarks: entry.remarks || '' 
          } 
        },
        upsert: true
      }
    });
  });

  // If there were validation errors in the data
  if (errors.length > 0) {
    return sendErrorResponse(res, HTTP_STATUS.BAD_REQUEST, 'Validation failed for some entries', errors);
  }

  // 4. Execute Bulk Write
  if (bulkOps.length > 0) {
    const result = await Marks.bulkWrite(bulkOps);
    
    return sendSuccessResponse(res, HTTP_STATUS.OK, 'Marks saved successfully', {
      matchedCount: result.matchedCount, // Records found
      modifiedCount: result.modifiedCount, // Records updated
      upsertedCount: result.upsertedCount, // New records created
      totalProcessed: bulkOps.length
    });
  } else {
    return sendErrorResponse(res, HTTP_STATUS.BAD_REQUEST, 'No valid operations to perform');
  }
});

// @desc    Delete a mark entry
// @route   DELETE /api/marks/:examId/:studentId
// @access  Teacher (Own Course), Admin
exports.deleteMark = asyncHandler(async (req, res) => {
  const { examId, studentId } = req.params;
  const loggedInUser = req.user;

  // 1. Fetch Exam & Verify Ownership
  const exam = await Exam.findById(examId).populate('course');
  if (!exam) {
    return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, 'Exam not found');
  }

  if (loggedInUser.role === USER_ROLES.TEACHER) {
    if (!exam.course || exam.course.teacherId.toString() !== loggedInUser._id.toString()) {
      return sendErrorResponse(res, HTTP_STATUS.FORBIDDEN, 'You do not own this course');
    }
  }

  // 2. Delete
  const deleted = await Marks.findOneAndDelete({ examId: examId, studentId: studentId });

  if (!deleted) {
    return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, 'Mark record not found');
  }

  return sendSuccessResponse(res, HTTP_STATUS.OK, 'Mark deleted successfully');
});


// @desc    Get all marks for a specific exam
// @route   GET /api/marks/:examId
// @access  Teacher, Admin, (Student/Parent - Restricted)
exports.getMarksByExam = asyncHandler(async (req, res) => {
  const { examId } = req.params;
  const loggedInUser = req.user;

  const exam = await Exam.findById(examId).populate('course');
  if (!exam) return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, 'Exam not found');

  // Authorization Check
  if (loggedInUser.role === USER_ROLES.TEACHER) {
    if (exam.course.teacherId.toString() !== loggedInUser._id.toString()) {
      return sendErrorResponse(res, HTTP_STATUS.FORBIDDEN, 'Access Denied');
    }
  } 
  else if (loggedInUser.role === USER_ROLES.STUDENT || loggedInUser.role === USER_ROLES.PARENT) {
     return sendErrorResponse(res, HTTP_STATUS.FORBIDDEN, 'Access Denied: Use Student view to see personal result');
  }

  // Fetch Marks
  const marksList = await Marks.find({ examId })
    .populate('studentId', 'studentId userId')
    .populate({
        path: 'studentId',
        populate: { path: 'userId', select: 'firstName lastName userID' } 
    })
    .lean();

  // Format Response
  const formattedData = marksList.map(m => ({
    markId: m._id,
    studentId: m.studentId?.studentId,
    studentName: m.studentId?.userId ? `${m.studentId.userId.firstName} ${m.studentId.userId.lastName}` : 'Unknown',
    obtainedMarks: m.marks,
    totalMarks: exam.totalMarks,
    percentage: ((m.marks / exam.totalMarks) * 100).toFixed(2),
    passStatus: m.marks >= exam.passingMarks ? 'Pass' : 'Fail',
    remarks: m.remarks
  }));

  return sendSuccessResponse(res, HTTP_STATUS.OK, 'Marks retrieved', formattedData);
});