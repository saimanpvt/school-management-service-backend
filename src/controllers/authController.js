const User = require('../models/User');
const { asyncHandler } = require('../middlewares/asyncHandler');
const { sendSuccessResponse, sendErrorResponse } = require('../utils/response');
const { HTTP_STATUS, USER_ROLES, ROLE_NAMES } = require('../config/constants');
const { validateRequiredFields, isValidEmail, validatePassword, sanitizeString } = require('../utils/validation');
const {enrollStudent} = require('./classController');
const Parent = require('../models/Parent');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const Course = require('../models/Course');
const jwt = require('jsonwebtoken');

// Helper to calculate "Time with Us"
const calculateTimeWithUs = (date) => {
  if (!date) return 'N/A';
  const start = new Date(date);
  const now = new Date();
  
  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();

  if (months < 0) {
    years--;
    months += 12;
  }
  return `${years} year(s), ${months} month(s)`;
};


// Register a new user
const register = asyncHandler(async (req, res) => {
  const loggedInUser = req.user;
  if (!loggedInUser || loggedInUser.role !== USER_ROLES.ADMIN) {
    return sendErrorResponse(
      res,
      HTTP_STATUS.FORBIDDEN,
      'Only admins can create new users'
    );
  }

  const {
    email,
    password,
    firstName,
    lastName,
    role,
    phone,
    address,
    dob,
    gender,
    bloodGroup,
    profileImage,
    userID,
    classId
  } = req.body;

  // Required validations
  if (!isValidEmail(email)) {
    return sendErrorResponse(res, HTTP_STATUS.BAD_REQUEST, 'Invalid email');
  }
  const passwordValidation = validatePassword(password, 'register');
  if (!passwordValidation.isValid) {
    return sendErrorResponse(
      res,
      HTTP_STATUS.BAD_REQUEST,
      'Password validation failed',
      passwordValidation.errors
    );
  }
  // Convert string role → number for DB
  const roleNumber = USER_ROLES[role?.toUpperCase()];
  if (!roleNumber) {
    return sendErrorResponse(res, HTTP_STATUS.BAD_REQUEST, 'Invalid role provided');
  }
  const requiredFields = ['email', 'userID', 'password', 'firstName', 'lastName', 'role'];
  if (roleNumber === USER_ROLES.TEACHER) {
    requiredFields.push('employeeId');
    requiredFields.push('experience');
    requiredFields.push('DOJ');
  }
  if(roleNumber === USER_ROLES.STUDENT) {
    requiredFields.push('admissionDate');
    requiredFields.push('studentId');
    requiredFields.push('classId');
  }
  if(roleNumber === USER_ROLES.PARENT) {
    requiredFields.push('childrenId');
    const existingUser = await User.findOne({ userID: req.body.childrenId });
  }
  const fieldValidation = validateRequiredFields(req.body, requiredFields);
  if (!fieldValidation.isValid) {
    return sendErrorResponse(
      res,
      HTTP_STATUS.BAD_REQUEST,
      'Validation failed, Some mandatory fields missing',
      fieldValidation.errors
    );
  }
  // Check user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return sendErrorResponse(
      res,
      HTTP_STATUS.CONFLICT,
      'User already exists with this email'
    );
  }
  // Create the user
  const addedUser = await User.create({
    email,
    userID: userID ? sanitizeString(userID) : undefined,
    password,
    firstName: sanitizeString(firstName),
    lastName: sanitizeString(lastName),
    role: roleNumber, // store number
    phone: phone ? sanitizeString(phone) : undefined,
    address: address || undefined,
    dob: dob || undefined,
    gender: gender || undefined,
    bloodGroup: bloodGroup || undefined,
    profileImage: profileImage || undefined
  });

  console.log("New User Created:", addedUser);

  //if user is teacher
  if (roleNumber === USER_ROLES.TEACHER) {
    await Teacher.create({
      userId: addedUser._id,
      employeeId: sanitizeString(req.body.employeeId),
      experience: req.body.experience,
      DOJ: req.body.DOJ
    })
  }
   //if user is student
   let enrolmentDeatils = {};
  if (roleNumber === USER_ROLES.STUDENT) {
    await Student.create({
      userId: addedUser._id,
      admissionDate: req.body.admissionDate,
      studentId: sanitizeString(req.body.studentId),
    })
    enrolmentDeatils = enrollStudent(req.body.classId, addedUser._id);
  }
  // Response
  sendSuccessResponse(res, HTTP_STATUS.CREATED, 'User registered successfully', {
    _id: addedUser._id,
    email: addedUser.email,
    userID: addedUser.userID,
    firstName: addedUser.firstName,
    lastName: addedUser.lastName,
    role: ROLE_NAMES[addedUser.role],
    phone: addedUser.phone,
    address: addedUser.address,
    dob: addedUser.dob,
    gender: addedUser.gender,
    bloodGroup: addedUser.bloodGroup,
    profileImage: addedUser.profileImage
  });
});

// Login user
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Required field validation
  const fieldValidation = validateRequiredFields(req.body, ['email', 'password']);
  if (!fieldValidation.isValid) {
    return sendErrorResponse(
      res,
      HTTP_STATUS.BAD_REQUEST,
      'Validation failed',
      fieldValidation.errors
    );
  }

  if (!isValidEmail(email)) {
    return sendErrorResponse(res, HTTP_STATUS.BAD_REQUEST, 'Invalid email');
  }

  // Fetch user
  const user = await User.findOne({ email }).select('+password');
  if (!user || !user.isActive) {
    return sendErrorResponse(
      res,
      HTTP_STATUS.UNAUTHORIZED,
      'Invalid credentials or account inactive'
    );
  }

  // Password match check
  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    return sendErrorResponse(res, HTTP_STATUS.UNAUTHORIZED, 'Invalid credentials');
  }

  // Update last login
  user.lastLogin = new Date();
  await user.save();

  // Token will contain _id + numeric role
  const token = jwt.sign(
    {
      _id: user._id,
      role: user.role // number
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  // Store token in cookie
  res.cookie('token', token, {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  });

  // Response
  sendSuccessResponse(res, HTTP_STATUS.OK, 'Login successful', {
    _id: user._id,
    email: user.email,
    userID: user.userID,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    address: user.address,
    dob: user.dob,
    gender: user.gender,
    bloodGroup: user.bloodGroup,
    role: ROLE_NAMES[user.role],
    profileImage: user.profileImage,
    token
  });
});

// Logout user
const logout = asyncHandler(async (req, res) => {
  res.cookie('token', '', { expires: new Date(0), httpOnly: true });
  sendSuccessResponse(res, HTTP_STATUS.OK, 'Logout successful');
});

// Get user profile
const getProfile = asyncHandler(async (req, res) => {
  const loggedInUser = req.user;
  const { email } = req.body;

  let targetUser;

  if (loggedInUser.role === USER_ROLES.ADMIN) {
    if (!email) {
      return sendErrorResponse(res, HTTP_STATUS.BAD_REQUEST, 'Mandatory parameter missing');
    }
    targetUser = await User.findOne({ email }).select('-password -__v -createdAt -updatedAt');
    if (!targetUser) {
      return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, 'User not found');
    }
  }else if (loggedInUser.role === USER_ROLES.PARENT) {
    if (!email || email === loggedInUser.email) {
      targetUser = loggedInUser;
    } else {
      const studentRecord = await Student.find({ parentId: loggedInUser._id }).populate('userId');
      if (!studentRecord) {
        return sendErrorResponse(res, HTTP_STATUS.FORBIDDEN, 'Access denied to this profile');
      }else {
        let userRecord = await User.findOne({ email});
        studentRecord[studentUser] = userRecord;
      }
      sendSuccessResponse(res, HTTP_STATUS.OK, 'Profile retrieved successfully', {
        studentRecord
      });
    }
  }else if (loggedInUser.role === USER_ROLES.TEACHER) {
    targetUser = loggedInUser; // Only own profile for now
  }else if (loggedInUser.role === USER_ROLES.STUDENT) {
    targetUser = loggedInUser;
  }else {
    return sendErrorResponse(res, HTTP_STATUS.FORBIDDEN, 'Access denied');
  }
  // Convert numeric role → string for response
  sendSuccessResponse(res, HTTP_STATUS.OK, 'Profile retrieved successfully', {
    email: targetUser.email,
    userID: targetUser.userID,
    firstName: targetUser.firstName,
    lastName: targetUser.lastName,
    phone: targetUser.phone,
    address: targetUser.address,
    dob: targetUser.dob,
    gender: targetUser.gender,
    bloodGroup: targetUser.bloodGroup,
    role: ROLE_NAMES[targetUser.role],
    profileImage: targetUser.profileImage,
  });
});

// Change password
const changePassword = asyncHandler(async (req, res) => {
  const { targetEmail, currentPassword, newPassword } = req.body;
  const loggedInUser = req.user;

  const requiredFields =
    loggedInUser.role === USER_ROLES.ADMIN
      ? ['targetEmail', 'newPassword']
      : ['currentPassword', 'newPassword'];

  const fieldValidation = validateRequiredFields(req.body, requiredFields);
  if (!fieldValidation.isValid) {
    return sendErrorResponse(res, HTTP_STATUS.BAD_REQUEST, 'Validation failed', fieldValidation.errors);
  }

  const passwordValidation = validatePassword(newPassword, "register");
  if (!passwordValidation.isValid) {
    return sendErrorResponse(res, HTTP_STATUS.BAD_REQUEST, 'New password validation failed', passwordValidation.errors);
  }

  let userToUpdate;

  // --- ADMIN ---
  if (loggedInUser.role === USER_ROLES.ADMIN) {
    userToUpdate = await User.findOne({ email: targetEmail }).select('+password');
    if (!userToUpdate) {
      return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, 'Target user not found');
    }
  }

  // --- NON-ADMIN ---
  else {
    userToUpdate = await User.findOne({ email: loggedInUser.email }).select('+password');

    const isCurrentPasswordValid = await userToUpdate.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return sendErrorResponse(res, HTTP_STATUS.BAD_REQUEST, 'Current password is incorrect');
    }
  }

  // Set new password
  userToUpdate.password = newPassword;
  await userToUpdate.save();

  sendSuccessResponse(res, HTTP_STATUS.OK, 'Password changed successfully');
});

// DELETE USER (Admin Only)
const deleteUser = asyncHandler(async (req, res) => {
  const admin = req.user;
  const userIdToDelete = req.params.userId;

  // Only admin can delete any user
  if (admin.role !== USER_ROLES.ADMIN) {
    return sendErrorResponse(res, HTTP_STATUS.FORBIDDEN, "Only Admin can delete users");
  }

  // Prevent admin from deleting themselves
  if (String(admin._id) === String(userIdToDelete)) {
    return sendErrorResponse(res, HTTP_STATUS.BAD_REQUEST, "Admin cannot delete themselves");
  }

  // Check user existence
  const user = await User.findById(userIdToDelete);
  if (!user) {
    return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, "User not found");
  }

  // -------------------------
  // 1. HANDLE STUDENT DELETE
  // -------------------------
  const student = await Student.findOne({ userId: userIdToDelete });

  if (student) {
    // Find all parents having this child
    const parentsWithChild = await Parent.find({ childrenId: student._id });

    // Remove student from parent children lists
    await Parent.updateMany(
      { childrenId: student._id },
      { $pull: { childrenId: student._id } }
    );

    // Delete student record
    await Student.findByIdAndDelete(student._id);

    // For each parent → check if they now have zero children
    for (const parent of parentsWithChild) {
      const updatedParent = await Parent.findById(parent._id);

      if (updatedParent && updatedParent.childrenId.length === 0) {
        // Delete parent User account first
        await User.findByIdAndDelete(updatedParent.userId);

        // Delete parent document
        await Parent.findByIdAndDelete(updatedParent._id);
      }
    }
  }

  // -------------------------
  // 2. HANDLE TEACHER DELETE
  // -------------------------
  const teacher = await Teacher.findOne({ userId: userIdToDelete });
  if (teacher) {
    await Teacher.findByIdAndDelete(teacher._id);
    await Course.updateMany({ teacherId: userIdToDelete }, { $set: { teacherId: null } });
  }

  // -------------------------
  // 3. HANDLE PARENT DELETE
  // -------------------------
  const parent = await Parent.findOne({ userId: userIdToDelete });
  if (parent) {
    await Parent.findByIdAndDelete(parent._id);
  }

  // -------------------------
  // 4. DELETE BASE USER RECORD
  // -------------------------
  await User.findByIdAndDelete(userIdToDelete);

  return sendSuccessResponse(res, HTTP_STATUS.OK, "User and related data deleted successfully");
});


// @route   GET /api/users/list (Admin Only)
const getUserList = asyncHandler(async (req, res) => {
  const { role } = req.query;
  let responseData = {};

  // 1. FETCH STUDENTS
  if (!role || role === 'Student') {
    // Fetch students and populate necessary references
    const students = await Student.find()
      .populate('userId', 'firstName lastName userID email') 
      .populate('classId', 'classCode className')           
      .populate({
        path: 'parentId',
        populate: { path: 'userId', select: 'userID firstName lastName' } 
      })
      .lean();

    const formattedStudents = students.map(std => {
      if (!std.userId) return null; 
      return {
        userId: std.userId, 
        userRefId: std.userId.userID,
        fullName: `${std.userId.firstName} ${std.userId.lastName}`,
        classes: std.classId.map(c => ({ 
          name: c.className, 
          code: c.classCode 
        })),
        admissionDate: std.admissionDate,
        timeWithUs: calculateTimeWithUs(std.admissionDate),
        parentUserId: std.parentId?.userId?.userID || 'N/A',
        parentName: std.parentId?.userId ? `${std.parentId.userId.firstName} ${std.parentId.userId.lastName}` : 'N/A'
      };
    }).filter(Boolean);

    if (role === 'Student') return res.json({ success: true, count: formattedStudents.length, data: formattedStudents });
    responseData.students = formattedStudents;
  }

  // 2. FETCH TEACHERS
  if (!role || role === 'Teacher') {
    const teachers = await Teacher.find()
      .populate('userId', 'firstName lastName userID email')
      .lean();
    const formattedTeachers = teachers.map(tch => {
      if (!tch.userId) return null;
      return {
        dbId: tch._id,
        userId: tch.teacherId || tch.userId.userID,
        fullName: `${tch.userId.firstName} ${tch.userId.lastName}`,
        experience: tch.experience || 'Not Specified',
        empId: tch.employeeId || 'N/A'
      };
    }).filter(Boolean);

    if (role === 'Teacher') return res.json({ success: true, count: formattedTeachers.length, data: formattedTeachers });
    responseData.teachers = formattedTeachers;
  }

  // 3. RETURN BOTH (if no role specified)
  return res.json({
    success: true,
    data: responseData
  });
});

const updateProfile = asyncHandler(async (req, res) => {
  const targetUserIDParam = req.params.userId; 
  const currentUser = req.user;
  const updates = req.body;

  // 1. Fetch Master User
  const targetUser = await User.findOne({ userID: targetUserIDParam });

  if (!targetUser) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  const targetRole = targetUser.role;
  let updatedChildData = null;

  // SCENARIO A: TARGET IS A STUDENT
  if (targetRole === USER_ROLES.STUDENT) {
    const studentDoc = await Student.findOne({ userId: targetUser._id });
    if (!studentDoc) {
      return res.status(404).json({ success: false, message: 'Student profile details not found' });
    }
    // FIX: Compare ObjectIDs for self check
    const isAdmin = currentUser.role === USER_ROLES.ADMIN;
    const isSelf = currentUser._id.toString() === targetUser._id.toString();
    const isParent = currentUser.role === USER_ROLES.PARENT && 
                     studentDoc.parentId && 
                     studentDoc.parentId.toString() === currentUser._id.toString();

    if (!isAdmin && !isSelf && !isParent) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this student profile' });
    }
    let allowedFields = [];
    if (isAdmin) {
      allowedFields = ['classId', 'parentId', 'admissionDate', 'leavingDate', 'emergencyContact', 'studentId'];
    } else {
      allowedFields = ['emergencyContact', 'leavingDate'];
    }
    allowedFields.forEach((field) => {
      if (updates[field] !== undefined) {
        studentDoc[field] = updates[field];
      }
    });
    updatedChildData = await studentDoc.save();
  } else if (targetRole === USER_ROLES.TEACHER) { // SCENARIO B: TARGET IS A TEACHER
    const teacherDoc = await Teacher.findOne({ userId: targetUser._id });
    if (!teacherDoc) {
      return res.status(404).json({ success: false, message: 'Teacher profile details not found' });
    }
    const isAdmin = currentUser.role === USER_ROLES.ADMIN;
    const isSelf = currentUser._id.toString() === targetUser._id.toString();

    if (!isAdmin && !isSelf) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this teacher profile' });
    }
    let allowedFields = [];
    if (isAdmin) {
      allowedFields = ['employeeId', 'emergencyContact', 'resignationDate', 'DOJ', 'bio', 'experience']; 
    } else {
      allowedFields = ['bio', 'emergencyContact'];
    }

    allowedFields.forEach((field) => {
      if (updates[field] !== undefined) {
        teacherDoc[field] = updates[field];
      }
    });

    updatedChildData = await teacherDoc.save();
  }

  // COMMON: UPDATE MASTER USER TABLE
  const isAuthorizedMasterUpdate = currentUser.role === USER_ROLES.ADMIN || currentUser._id.toString() === targetUser._id.toString();
  if (isAuthorizedMasterUpdate) {
    const masterAllowedFields = ['firstName', 'lastName', 'phone', 'address', 'profileImage', 'gender', 'bloodGroup', 'dob'];
    let masterUpdated = false;

    // 1. Standard Fields
    masterAllowedFields.forEach((field) => {
      if (updates[field] !== undefined) {
        targetUser[field] = updates[field];
        masterUpdated = true;
      }
    });
    // 2. Admin Extras
    if (currentUser.role === USER_ROLES.ADMIN) {
      if (updates.role !== undefined) {
        const r = updates.role.toUpperCase();
        const mappedRole = USER_ROLES[r];
        if (!mappedRole) {
          return res.status(400).json({ success: false, message: 'Invalid role provided' });
        }
        targetUser.role = mappedRole;
        masterUpdated = true; 
      }

      if (updates.email !== undefined) {
        targetUser.email = updates.email;
        masterUpdated = true; 
      }
      if (updates.isActive !== undefined) {
        targetUser.isActive = updates.isActive;
        masterUpdated = true; 
      }
      if (updates.userID !== undefined) {
        targetUser.userID = updates.userID;
        masterUpdated = true; 
      }
    }
    if (masterUpdated) {
      await targetUser.save();
    }
  }

  // FINAL RESPONSE
  return res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    user: {
      userId: targetUser.userID,
      firstName: targetUser.firstName,
      lastName: targetUser.lastName,
      email: targetUser.email,
      role: targetUser.roleName,
      commonDetails: targetUser,
      specificDetails: updatedChildData 
    }
  });
});

module.exports = {
  register,
  login,
  logout,
  getProfile,
  changePassword,
  deleteUser,
  getUserList,
  updateProfile
};