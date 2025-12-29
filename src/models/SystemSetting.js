const mongoose = require('mongoose');

const systemSettingSchema = new mongoose.Schema({
  // ======================================================
  // 1. SCHOOL IDENTITY 
  // ======================================================
  identity: {
    schoolName: { type: String, default: 'My Digital School', required: true },
    address: { type: String, default: '' },
    contactEmail: { type: String, default: '' },
    contactPhone: { type: String, default: '' },
    website: { type: String, default: '' },
    logoUrl: { type: String, default: '' }, 
    currencySymbol: { type: String, default: '₹' }, 
    timezone: { type: String, default: 'Asia/Kolkata' }
  },

  // ======================================================
  // 2. ACADEMIC DEFAULTS
  // ======================================================
  academic: {
    currentAcademicYear: { type: String, default: '2025-2026' }, 
    
    // ID Generation Prefixes 
    studentIdPrefix: { type: String, default: 'ST' }, // e.g. ST-001
    teacherIdPrefix: { type: String, default: 'EMP' }, // e.g. EMP-001
    
    allowOnlineAdmission: { type: Boolean, default: false }
  },

  // ======================================================
  // 3. ATTENDANCE SETTINGS
  // ======================================================
  attendance: {
    // Cron Job Time: When to send "Your child was absent" emails
    dailyAbsenceEmailTime: { 
      type: String, 
      default: "16:00", 
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Time must be in HH:MM format']
    },

    // Teacher Logic
    teacherCheckInStartTime: { type: String, default: "08:00" },
    teacherLateCutoffTime: { type: String, default: "09:15" }, 
    
    // Student Logic
    defaultAttendanceStatus: { 
      type: String, 
      enum: ['Present', 'Absent'], 
      default: 'Absent' 
    },
    
    // Lock retrospective updates after X days 
    lockAttendanceAfterDays: { type: Number, default: 7 } 
  },

  // ======================================================
  // 4. LEAVE SETTINGS
  // ======================================================
  leave: {
    // Master switch to allow auto-approval logic defined in LeaveConfig
    enableTeacherAutoApproval: { type: Boolean, default: false },
    
    // Notification switch
    notifyTeacherOnStudentLeave: { type: Boolean, default: true }
  },

  // ======================================================
  // 5. FEE SETTINGS
  // ======================================================
  finance: {
    dueGracePeriodDays: { type: Number, default: 5 },
    
    enableLateFines: { type: Boolean, default: true },
    defaultFinePerDay: { type: Number, default: 10 },
    
    taxName: { type: String, default: 'GST' },
    taxPercentage: { type: Number, default: 0 }
  },

  // ======================================================
  // 6. NOTIFICATION TOGGLES 
  // ======================================================
  notifications: {
    enableEmail: { type: Boolean, default: true },
    enableSMS: { type: Boolean, default: false }, 
    enablePush: { type: Boolean, default: true },

    triggers: {
      onStudentAbsent: { type: Boolean, default: true },
      onFeePaymentSuccess: { type: Boolean, default: true }, 
      onLeaveStatusChange: { type: Boolean, default: true },
      onExamResultPublish: { type: Boolean, default: true }
    }
  },

  // ======================================================
  // 7. MAINTENANCE
  // ======================================================
  maintenanceMode: { type: Boolean, default: false }, 
  allowedIPs: [String] 

}, { timestamps: true });

module.exports = mongoose.model('SystemSetting', systemSettingSchema);