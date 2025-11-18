const { USER_ROLES, HTTP_STATUS, MESSAGES } = require('../config/constants');

/**
 * Middleware to check if user has required roles
 * Uses ONLY direct role comparison (no hierarchy)
 */
const allowRoles = (allowedRoles = []) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: MESSAGES.UNAUTHORIZED + ': User not authenticated'
        });
      }

      const userRole = req.user.role;

      // Direct role validation — no hierarchy
      if (!allowedRoles.includes(userRole)) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: MESSAGES.FORBIDDEN + ': Insufficient permissions'
        });
      }

      next();
    } catch (error) {
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: MESSAGES.SERVER_ERROR
      });
    }
  };
};

/**
 * Admin only access
 */
const requireAdmin = allowRoles([USER_ROLES.ADMIN]);

/**
 * Admin + Teacher
 */
const requireTeacherOrAdmin = allowRoles([
  USER_ROLES.ADMIN,
  USER_ROLES.TEACHER
]);

/**
 * Admin + Teacher + Student
 */
const requireStudentTeacherOrAdmin = allowRoles([
  USER_ROLES.ADMIN,
  USER_ROLES.TEACHER,
  USER_ROLES.STUDENT
]);

/**
 * Parent-only or self-access for student
 */
const canAccessStudentData = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: MESSAGES.UNAUTHORIZED + ': User not authenticated'
      });
    }

    const userRole = req.user.role;
    const studentId = req.params.id || req.params.studentId;

    // Admin + teacher bypass checks — full access
    if (userRole === USER_ROLES.ADMIN || userRole === USER_ROLES.TEACHER) {
      return next();
    }

    // Parent: must match child's parentId
    if (userRole === USER_ROLES.PARENT) {
      if (!studentId) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Student ID is required'
        });
      }

      const Student = require('../models/Student');

      const student = await Student.findOne({
        _id: studentId,
        parent: req.user._id,
        isActive: true
      });

      if (!student) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: MESSAGES.FORBIDDEN + ': You can access only your child\'s data'
        });
      }

      return next();
    }

    // Student can only view self
    if (userRole === USER_ROLES.STUDENT) {
      if (studentId && studentId !== req.user._id.toString()) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: MESSAGES.FORBIDDEN + ': You can access only your own data'
        });
      }
      return next();
    }

    // No one else allowed
    return res.status(HTTP_STATUS.FORBIDDEN).json({
      success: false,
      message: MESSAGES.FORBIDDEN + ': Insufficient permissions'
    });

  } catch (error) {
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: MESSAGES.SERVER_ERROR
    });
  }
};

module.exports = {
  allowRoles,
  requireAdmin,
  requireTeacherOrAdmin,
  requireStudentTeacherOrAdmin,
  canAccessStudentData
};
