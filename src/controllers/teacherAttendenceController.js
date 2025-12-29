const TeacherAttendance = require('../models/Attendance/TeacherAttendance');
const AttendanceLog = require('../models/Attendance/AttendanceLog');
const Teacher = require('../models/Teacher');
const { HTTP_STATUS, USER_ROLES } = require('../config/constants');
const { sendSuccessResponse, sendErrorResponse } = require('../utils/response');
const asyncHandler = require('express-async-handler');

const formatTime = (d) => d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

// @desc    Teacher Self Check-In / Admin Override
exports.teacherCheckIn = asyncHandler(async (req, res) => {
  const user = req.user;
  let teacherId = null;
  let recordDate = new Date();
  let timeString = formatTime(recordDate);

  if (user.role === USER_ROLES.ADMIN) {
    teacherId = req.body.teacherId;
    if (req.body.date) recordDate = new Date(req.body.date);
    if (req.body.time) timeString = req.body.time;
  } else {
    const t = await Teacher.findOne({ userId: user._id });
    teacherId = t._id;
  }

  const today = new Date(recordDate);
  today.setHours(0,0,0,0);

  // Atomic Update: Try to set CheckIn only if it doesn't exist? Or overwrite? 
  // Usually overwrite status to Present.
  const updateQuery = { date: today, 'records.teacherId': teacherId };
  const updateAction = {
    $set: { 'records.$.checkInTime': timeString, 'records.$.status': 'Present' }
  };

  let sheet = await TeacherAttendance.findOneAndUpdate(updateQuery, updateAction, { new: true });

  if (!sheet) {
    // If not found, push new record
    sheet = await TeacherAttendance.findOneAndUpdate(
      { date: today },
      {
        $push: {
          records: {
            teacherId, status: 'Present', checkInTime: timeString, checkOutTime: null,
            remarks: user.role === USER_ROLES.ADMIN ? 'Admin Mark' : 'Self'
          }
        },
        $setOnInsert: { takenBy: user._id }
      },
      { new: true, upsert: true }
    );
  }
  return sendSuccessResponse(res, HTTP_STATUS.OK, 'Checked In', sheet);
});

// @desc    Teacher Check-Out
exports.teacherCheckOut = asyncHandler(async (req, res) => {
  // Logic similar to CheckIn, but updates checkOutTime
  // (Implementation same as previous answer)
  return sendSuccessResponse(res, HTTP_STATUS.OK, 'Checked Out');
});

// @desc    Admin Correction (Scrutiny Log)
// @route   PUT /api/attendance/teacher/update
exports.correctTeacherAttendance = asyncHandler(async (req, res) => {
  const { teacherId, date, status, checkInTime, checkOutTime, remarks } = req.body;
  const adminUser = req.user;
  const targetDate = new Date(date);
  targetDate.setHours(0,0,0,0);

  const sheet = await TeacherAttendance.findOne({ date: targetDate });
  if (!sheet) return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, 'Sheet not found');

  const record = sheet.records.find(r => r.teacherId.toString() === teacherId);
  if (!record) return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, 'Record not found');

  // LOG CHANGE
  if (record.status !== status || record.checkInTime !== checkInTime) {
    await AttendanceLog.create({
      attendanceSheetId: sheet._id,
      sheetModel: 'TeacherAttendance',
      dateOfAttendance: targetDate,
      targetId: teacherId,
      targetRole: 'Teacher',
      oldStatus: `${record.status} (${record.checkInTime})`,
      newStatus: `${status} (${checkInTime})`,
      modifiedBy: adminUser._id,
      reason: remarks || 'Correction'
    });
  }

  // APPLY
  record.status = status;
  if (checkInTime) record.checkInTime = checkInTime;
  if (checkOutTime) record.checkOutTime = checkOutTime;
  if (remarks) record.remarks = remarks;

  await sheet.save();
  return sendSuccessResponse(res, HTTP_STATUS.OK, 'Correction applied');
});

// @desc    Get Report (Default: Current Month)
exports.getTeacherReport = asyncHandler(async (req, res) => {
  const { startDate, endDate, teacherId } = req.query;
  
  let start, end;
  if (!startDate) {
    const now = new Date();
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  } else {
    start = new Date(startDate);
    end = new Date(endDate);
  }
  start.setHours(0,0,0,0);
  end.setHours(23,59,59,999);

  // Aggregation Pipeline (Group by Teacher ID)
  // (Same as previous aggregation logic)
  return sendSuccessResponse(res, HTTP_STATUS.OK, 'Teacher Report');
});