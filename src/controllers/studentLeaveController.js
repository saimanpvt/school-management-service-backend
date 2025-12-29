const StudentLeave = require('../models/Leave/StudentLeave');
const Student = require('../models/Student');
const { USER_ROLES, HTTP_STATUS } = require('../config/constants');
const { sendSuccessResponse, sendErrorResponse } = require('../utils/response');
const asyncHandler = require('express-async-handler');

// Helper
const getDays = (s, e) => Math.ceil((new Date(e) - new Date(s)) / (1000 * 60 * 60 * 24)) + 1;

// @desc    Apply Leave (Auto-Approve if Parent)
exports.applyLeave = asyncHandler(async (req, res) => {
  const { studentId, startDate, endDate, leaveType, reason } = req.body;
  const user = req.user;
  const days = getDays(startDate, endDate);

  let status = 'Pending-Parent';
  let approvedBy = null;

  // 1. Identify Student
  let targetStudentId = studentId;
  if (user.role === USER_ROLES.STUDENT) {
    const s = await Student.findOne({ userId: user._id });
    targetStudentId = s._id;
  } 
  else if (user.role === USER_ROLES.PARENT) {
    // If Parent applies -> Auto Approved
    status = 'Approved';
    approvedBy = user._id;
    // Verify child ownership logic here...
  }

  const leave = await StudentLeave.create({
    applicantId: user._id,
    studentId: targetStudentId,
    startDate, endDate, leaveType, reason, daysCount: days,
    status, approvedBy
  });

  return sendSuccessResponse(res, HTTP_STATUS.CREATED, `Leave ${status}`, leave);
});

// @desc    Approve/Reject (Parent Only)
exports.approveLeave = asyncHandler(async (req, res) => {
  const { status, rejectionReason } = req.body;
  const leave = await StudentLeave.findById(req.params.id);
  
  // Verify User is Parent of this Student
  const student = await Student.findById(leave.studentId);
  if (student.parentId.toString() !== req.user._id.toString()) {
    return sendErrorResponse(res, HTTP_STATUS.FORBIDDEN, 'Not your child');
  }

  leave.status = status;
  leave.approvedBy = req.user._id;
  if (rejectionReason) leave.rejectionReason = rejectionReason;
  
  await leave.save();
  return sendSuccessResponse(res, HTTP_STATUS.OK, 'Updated');
});

// @desc    History (Smart Filter)
exports.getStudentLeaveHistory = asyncHandler(async (req, res) => {
  const { month, year, courseId, studentId } = req.query;
  const match = {};

  if (studentId) match.studentId = studentId;

  // Month Filter
  if (month && year) {
    const s = new Date(year, month - 1, 1);
    const e = new Date(year, month, 0, 23, 59, 59);
    match.$or = [{ startDate: { $gte: s, $lte: e } }, { endDate: { $gte: s, $lte: e } }];
  }

  const leaves = await StudentLeave.find(match).sort({ startDate: -1 });
  return sendSuccessResponse(res, HTTP_STATUS.OK, 'Leaves', leaves);
});