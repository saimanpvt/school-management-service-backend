const mongoose = require('mongoose');
const StudentAttendance = require('../models/Attendance/StudentAttendance');
const StudentLeave = require('../models/Leave/StudentLeave');
const Course = require('../models/Course');
const Student = require('../models/Student');
const Class = require('../models/Class');
const { HTTP_STATUS, USER_ROLES } = require('../config/constants');
const { sendSuccessResponse, sendErrorResponse } = require('../utils/response');
const asyncHandler = require('express-async-handler');

// @desc    Get Daily Sheet (Pre-fills Approved Leaves & Locks them)
// @route   GET /api/attendance/student/sheet
exports.getDailySheet = asyncHandler(async (req, res) => {
  const { type, courseId, examId, date } = req.query;
  const targetDate = new Date(date);
  targetDate.setHours(0,0,0,0);

  // 1. Identify Context & Fetch Students
  let contextQuery = {};
  let students = [];

  if (type === 'Course') {
    const course = await Course.findById(courseId);
    if (!course) return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, 'Course not found');
    students = await Student.find({ classId: course.classId }).lean();
    contextQuery = { courseId, date: targetDate, type: 'Course' };
  } 
  else if (type === 'Exam') {
    // Logic: Exam -> Course -> Class -> Students
    // (Assuming you have an Exam model logic implemented similar to course)
    // For now, placeholder for Exam logic
    contextQuery = { examId, type: 'Exam' }; 
  }

  // 2. Fetch APPROVED Leaves for this date
  const approvedLeaves = await StudentLeave.find({
    status: 'Approved',
    startDate: { $lte: targetDate },
    endDate: { $gte: targetDate },
    studentId: { $in: students.map(s => s._id) }
  });

  const leaveMap = {};
  approvedLeaves.forEach(l => {
    leaveMap[l.studentId.toString()] = { type: l.leaveType };
  });

  // 3. Check for Existing Saved Sheet
  const existingSheet = await StudentAttendance.findOne(contextQuery).lean();

  // 4. Construct the View
  const records = students.map(std => {
    const stdId = std._id.toString();
    const hasLeave = !!leaveMap[stdId];
    
    let status = 'Absent'; // Default
    let remarks = '';
    let isLocked = false;

    // Priority 1: Approved Leave (System Override)
    if (hasLeave) {
      status = 'Leave';
      remarks = `Approved: ${leaveMap[stdId].type}`;
      isLocked = true; // Frontend: Disable editing
    }
    // Priority 2: Existing Saved Record
    else if (existingSheet) {
      const savedRec = existingSheet.records.find(r => r.studentId.toString() === stdId);
      if (savedRec) {
        status = savedRec.status;
        remarks = savedRec.remarks;
      }
    }

    return {
      studentId: std.studentId, // Custom ID
      name: `Student Name Placeholder`, // Ideally populate this via User lookup
      _id: std._id,
      status,
      remarks,
      isLocked
    };
  });

  // Populate Names manually or via another query if Student schema doesn't have it direct
  // (Omitted for brevity, assumed handled by frontend or separate population)

  return sendSuccessResponse(res, HTTP_STATUS.OK, 'Sheet retrieved', { date: targetDate, records });
});

// @desc    Mark/Update Attendance
// @route   POST /api/attendance/student
exports.markStudentAttendance = asyncHandler(async (req, res) => {
  const { type, courseId, examId, date, records } = req.body;
  const targetDate = new Date(date);
  targetDate.setHours(0,0,0,0);

  // 1. Security Check: Re-verify Leaves (Prevent hacking)
  const studentIds = records.map(r => r.studentId);
  const approvedLeaves = await StudentLeave.find({
    status: 'Approved',
    startDate: { $lte: targetDate },
    endDate: { $gte: targetDate },
    studentId: { $in: studentIds }
  });

  const leaveMap = {};
  approvedLeaves.forEach(l => leaveMap[l.studentId.toString()] = true);

  // 2. Sanitize Input
  const sanitizedRecords = records.map(rec => {
    if (leaveMap[rec.studentId]) {
      return {
        studentId: rec.studentId,
        status: 'Leave', // Force Leave
        remarks: 'System Override: Approved Leave'
      };
    }
    return rec;
  });

  // 3. Prepare Update Data
  let filter = { date: targetDate, type };
  let updateData = { date: targetDate, type, takenBy: req.user._id, records: sanitizedRecords };

  if (type === 'Course') {
    filter.courseId = courseId;
    updateData.courseId = courseId;
  } else {
    filter.examId = examId;
    updateData.examId = examId;
  }

  // 4. Upsert
  const result = await StudentAttendance.findOneAndUpdate(
    filter, updateData, 
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  return sendSuccessResponse(res, HTTP_STATUS.OK, 'Attendance marked', result);
});

// @desc    Consolidated Report (Auto-calculated Dates)
// @route   GET /api/attendance/student/report/consolidated
exports.getConsolidatedReport = asyncHandler(async (req, res) => {
  const { courseId, classId, academicYear } = req.query;
  const matchStage = {};

  // Scenario A: By Course
  if (courseId) {
    const course = await Course.findById(courseId);
    if (!course) return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, 'Course not found');
    
    // Auto-Calculate Date Range
    matchStage.type = 'Course';
    matchStage.courseId = new mongoose.Types.ObjectId(courseId);
    matchStage.date = { 
      $gte: course.createdAt, // Or course.startDate if you have it
      $lte: new Date() 
    };
  }
  
  // Scenario B: By Class (Full Year)
  else if (classId) {
    const cls = await Class.findById(classId);
    // Assuming academicYear format "2025-2026"
    const startYear = parseInt(cls.academicYear.split('-')[0]);
    const startDate = new Date(`${startYear}-04-01`); // April 1st
    const endDate = new Date(`${startYear + 1}-03-31`); // March 31st next year

    const courses = await Course.find({ classId }).select('_id');
    
    matchStage.type = 'Course';
    matchStage.courseId = { $in: courses.map(c => c._id) };
    matchStage.date = { $gte: startDate, $lte: endDate };
  }

  // Standard Aggregation
  const pipeline = [
    { $match: matchStage },
    { $unwind: '$records' },
    {
      $group: {
        _id: '$records.studentId',
        totalSessions: { $sum: 1 },
        present: { $sum: { $cond: [{ $in: ['$records.status', ['Present', 'Late']] }, 1, 0] } },
        absent: { $sum: { $cond: [{ $eq: ['$records.status', 'Absent'] }, 1, 0] } },
        leave: { $sum: { $cond: [{ $eq: ['$records.status', 'Leave'] }, 1, 0] } }
      }
    },
    {
      $lookup: {
        from: 'students',
        localField: '_id',
        foreignField: '_id',
        as: 'studentInfo'
      }
    },
    { $unwind: '$studentInfo' },
    {
      $lookup: {
        from: 'users',
        localField: 'studentInfo.userId',
        foreignField: '_id',
        as: 'userInfo'
      }
    },
    { $unwind: '$userInfo' },
    {
      $project: {
        studentId: '$studentInfo.studentId',
        name: { $concat: ['$userInfo.firstName', ' ', '$userInfo.lastName'] },
        totalSessions: 1,
        present: 1,
        absent: 1,
        leave: 1,
        percentage: { $multiply: [{ $divide: ['$present', '$totalSessions'] }, 100] }
      }
    }
  ];

  const report = await StudentAttendance.aggregate(pipeline);
  return sendSuccessResponse(res, HTTP_STATUS.OK, 'Consolidated report generated', report);
});

// @desc    Standard Report (Date Range & Context)
// @route   GET /api/attendance/student/report
exports.getStudentReport = asyncHandler(async (req, res) => {
  const { 
    startDate, endDate, 
    classId, courseId, examId, 
    studentId 
  } = req.query;

  // 1. Build Match Stage
  const matchStage = {};

  // A. Date Filter (Required for Standard Report)
  // If not provided, you might default to current month, but here we strictly respect inputs
  if (startDate && endDate) {
    matchStage.date = {
      $gte: new Date(new Date(startDate).setHours(0,0,0,0)),
      $lte: new Date(new Date(endDate).setHours(23,59,59,999))
    };
  }

  // B. Context Filter
  if (examId) {
    matchStage.type = 'Exam';
    matchStage.examId = new mongoose.Types.ObjectId(examId);
  } 
  else if (courseId) {
    matchStage.type = 'Course';
    matchStage.courseId = new mongoose.Types.ObjectId(courseId);
  } 
  else if (classId) {
    // Logic: If filtering by Class, get all courses for that class first
    const courses = await Course.find({ classId }).select('_id');
    const courseIds = courses.map(c => c._id);
    
    matchStage.type = 'Course';
    matchStage.courseId = { $in: courseIds };
  }

  // 2. Aggregation Pipeline
  const pipeline = [
    // Step 1: Filter Attendance Sheets
    { $match: matchStage },
    
    // Step 2: Unwind records to process individual student data
    { $unwind: '$records' },

    // Step 3: Filter Specific Student (Optimization: Filter early)
    ...(studentId ? [{ $match: { 'records.studentId': new mongoose.Types.ObjectId(studentId) } }] : []),

    // Step 4: Group by Student
    {
      $group: {
        _id: '$records.studentId',
        
        // Count Total Sessions (How many sheets they were part of)
        totalSessions: { $sum: 1 },
        
        // Count Statuses
        present: { 
          $sum: { $cond: [{ $in: ['$records.status', ['Present', 'Late']] }, 1, 0] } 
        },
        absent: { 
          $sum: { $cond: [{ $eq: ['$records.status', 'Absent'] }, 1, 0] } 
        },
        leave: { 
          $sum: { $cond: [{ $in: ['$records.status', ['Leave', 'Excused']] }, 1, 0] } 
        }
      }
    },

    // Step 5: Lookup Student Info (for Roll No / Custom ID)
    {
      $lookup: {
        from: 'students',
        localField: '_id',
        foreignField: '_id',
        as: 'studentInfo'
      }
    },
    { $unwind: '$studentInfo' },

    // Step 6: Lookup User Info (for Name)
    {
      $lookup: {
        from: 'users',
        localField: 'studentInfo.userId',
        foreignField: '_id',
        as: 'userInfo'
      }
    },
    { $unwind: '$userInfo' },

    // Step 7: Final Projection
    {
      $project: {
        studentId: '$studentInfo.studentId', // Custom ID (e.g. ST-2025)
        name: { $concat: ['$userInfo.firstName', ' ', '$userInfo.lastName'] },
        totalWorkingDays: '$totalSessions', // Renaming for clarity
        present: 1,
        absent: 1,
        leave: 1,
        percentage: { 
          $multiply: [
            { $divide: ['$present', '$totalSessions'] }, 
            100
          ] 
        }
      }
    },
    
    // Step 8: Sort Alphabetically
    { $sort: { name: 1 } }
  ];

  const report = await StudentAttendance.aggregate(pipeline);

  return sendSuccessResponse(res, HTTP_STATUS.OK, 'Student attendance report generated', report);
});
