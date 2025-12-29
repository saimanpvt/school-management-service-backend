const TeacherLeave = require('../models/Leave/TeacherLeave');
const TeacherLeaveBalance = require('../models/Leave/TeacherLeaveBalance');
const LeaveConfig = require('../models/Leave/LeaveConfig');
const Teacher = require('../models/Teacher');
const { USER_ROLES, HTTP_STATUS } = require('../config/constants');
const { sendSuccessResponse, sendErrorResponse } = require('../utils/response');
const asyncHandler = require('express-async-handler');

// @desc    Get Balance (For UI Warning)
exports.getMyLeaveBalance = asyncHandler(async (req, res) => {
  const user = req.user;
  const teacher = await Teacher.findOne({ userId: user._id });
  const currentYear = "2025-2026"; // Dynamic logic needed

  const balance = await TeacherLeaveBalance.findOne({ teacherId: teacher._id, academicYear: currentYear });
  return sendSuccessResponse(res, HTTP_STATUS.OK, 'Balance', balance || {});
});

// @desc    Apply Leave (HRMS Check)
exports.applyLeave = asyncHandler(async (req, res) => {
  const { startDate, endDate, leaveType, reason } = req.body;
  const user = req.user;
  const days = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1;

  const teacher = await Teacher.findOne({ userId: user._id });
  const currentYear = "2025-2026";

  // 1. Check Config (Auto Approve?)
  const config = await LeaveConfig.findOne({ academicYear: currentYear });
  const isAuto = config?.teacherAutoApprove || false;

  // 2. Check Balance
  const balance = await TeacherLeaveBalance.findOne({ teacherId: teacher._id, academicYear: currentYear });
  
  // Mapping logic: Casual -> casualLeave
  const map = { 'Casual': 'casualLeave', 'Sick': 'sickLeave' };
  const field = map[leaveType];
  
  let isLossOfPay = false;
  if (balance && field) {
    const remaining = balance[field].total - balance[field].used;
    if (remaining < days) isLossOfPay = true;
  }

  // 3. Determine Status
  let status = 'Pending-Admin';
  // Auto-approve ONLY if quota exists (No LOP)
  if (isAuto && !isLossOfPay) status = 'Approved';

  const leave = await TeacherLeave.create({
    applicantId: user._id, teacherId: teacher._id,
    startDate, endDate, leaveType, reason, daysCount: days,
    isLossOfPay, status,
    approvedBy: status === 'Approved' ? user._id : null // System
  });

  // 4. Deduct immediately if Auto-Approved
  if (status === 'Approved') {
    if (field) balance[field].used += days;
    await balance.save();
  }

  return sendSuccessResponse(res, HTTP_STATUS.CREATED, 'Applied', leave);
});

// @desc    Admin Approve/Reject
exports.updateLeaveStatus = asyncHandler(async (req, res) => {
  const { status, adminRemarks } = req.body;
  const leave = await TeacherLeave.findById(req.params.id);
  
  if (leave.status !== 'Pending-Admin') return sendErrorResponse(res, HTTP_STATUS.BAD_REQUEST, 'Already processed');

  leave.status = status;
  leave.approvedBy = req.user._id;
  leave.adminRemarks = adminRemarks;

  // DEDUCT BALANCE
  if (status === 'Approved') {
    const balance = await TeacherLeaveBalance.findOne({ teacherId: leave.teacherId }); // Add year check
    
    if (leave.isLossOfPay) {
      balance.unpaidLeaveUsed += leave.daysCount;
    } else {
      const map = { 'Casual': 'casualLeave', 'Sick': 'sickLeave' };
      const field = map[leave.leaveType];
      if (field) balance[field].used += leave.daysCount;
    }
    await balance.save();
  }

  await leave.save();
  return sendSuccessResponse(res, HTTP_STATUS.OK, `Leave ${status}`);
});