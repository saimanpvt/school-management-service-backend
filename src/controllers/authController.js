const User = require("../models/User");
const { asyncHandler } = require("../middlewares/asyncHandler");
const { sendSuccessResponse, sendErrorResponse } = require("../utils/response");
const { HTTP_STATUS, USER_ROLES, ROLE_NAMES } = require("../config/constants");
const {
  validateRequiredFields,
  isValidEmail,
  validatePassword,
  sanitizeString,
} = require("../utils/validation");

// Register a new user
const register = asyncHandler(async (req, res) => {
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
  } = req.body;

  // Validate userID is present and non-empty
  if (!userID || typeof userID !== "string" || !userID.trim()) {
    return sendErrorResponse(
      res,
      HTTP_STATUS.BAD_REQUEST,
      "UserID is required and must be a non-empty string"
    );
  }
  const loggedInUser = await User.findOne({ email: req.user?.email });
  if (!loggedInUser || loggedInUser.role !== USER_ROLES.ADMIN) {
    return sendErrorResponse(
      res,
      HTTP_STATUS.FORBIDDEN,
      "Only admins can create new users"
    );
  }

  // Validate required fields
  const requiredFields = [
    "email",
    "userID",
    "password",
    "firstName",
    "lastName",
    "role",
  ];
  const fieldValidation = validateRequiredFields(req.body, requiredFields);
  if (!fieldValidation.isValid) {
    return sendErrorResponse(
      res,
      HTTP_STATUS.BAD_REQUEST,
      "Validation failed",
      fieldValidation.errors
    );
  }

  // Validate email and password
  if (!isValidEmail(email)) {
    return sendErrorResponse(res, HTTP_STATUS.BAD_REQUEST, "Invalid email");
  }
  const passwordValidation = validatePassword(password, "register");
  if (!passwordValidation.isValid) {
    return sendErrorResponse(
      res,
      HTTP_STATUS.BAD_REQUEST,
      "Password validation failed",
      passwordValidation.errors
    );
  }

  // Check if user exists
  const IsUserExists = await User.findOne({ email });
  if (IsUserExists) {
    return sendErrorResponse(
      res,
      HTTP_STATUS.CONFLICT,
      "User already exists with this email"
    );
  }

  // Create user
  const addedUser = await User.create({
    email,
    userID: userID ? sanitizeString(userID) : undefined,
    password,
    firstName: sanitizeString(firstName),
    lastName: sanitizeString(lastName),
    role: USER_ROLES[role] || USER_ROLES.STUDENT,
    phone: phone ? sanitizeString(phone) : undefined,
    address: address || undefined,
    dob: dob || undefined,
    gender: gender || undefined,
    profileImage: profileImage || undefined,
    bloodGroup: bloodGroup || undefined,
  });

  // Create role-specific records using the created user's ObjectId
  if (addedUser.role === USER_ROLES.TEACHER) {
    const Teacher = require("../models/Teacher");
    await Teacher.create({
      userId: addedUser._id, // Use the created user's ObjectId
      employeeId: req.body.employeeId || `EMP${addedUser.userID}`,
      department: req.body.department || "General",
      subject: req.body.subject || "",
      qualification: req.body.qualification || "Graduate",
      experience: req.body.experience ? parseInt(req.body.experience) : 0,
      DOJ: req.body.DOJ ? new Date(req.body.DOJ) : new Date(),
      resignationDate: req.body.resignationDate
        ? new Date(req.body.resignationDate)
        : undefined,
      bio: req.body.bio || "",
      emergencyContact: req.body.emergencyContact || phone,
    });
  } else if (addedUser.role === USER_ROLES.STUDENT) {
    const Student = require("../models/Student");
    await Student.create({
      userId: addedUser._id, // Use the created user's ObjectId
      classId: req.body.classId || new require("mongoose").Types.ObjectId(), // Required field
      studentId: req.body.studentId || addedUser.userID,
      admissionDate: req.body.admissionDate
        ? new Date(req.body.admissionDate)
        : new Date(),
      emergencyContact: req.body.emergencyContact || phone,
    });
  }

  sendSuccessResponse(
    res,
    HTTP_STATUS.CREATED,
    "User registered successfully",
    {
      uuid: addedUser.uuid,
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
      profileImage: addedUser.profileImage,
    }
  );
});

// Login user
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const fieldValidation = validateRequiredFields(req.body, [
    "email",
    "password",
  ]);
  if (!fieldValidation.isValid) {
    return sendErrorResponse(
      res,
      HTTP_STATUS.BAD_REQUEST,
      "Validation failed",
      fieldValidation.errors
    );
  }
  if (!isValidEmail(email)) {
    return sendErrorResponse(res, HTTP_STATUS.BAD_REQUEST, "Invalid email");
  }

  const user = await User.findOne({ email }).select("+password");
  if (!user || !user.isActive) {
    return sendErrorResponse(
      res,
      HTTP_STATUS.UNAUTHORIZED,
      "Invalid credentials or account inactive"
    );
  }

  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    return sendErrorResponse(
      res,
      HTTP_STATUS.UNAUTHORIZED,
      "Invalid credentials"
    );
  }

  user.lastLogin = new Date();
  await user.save();

  const token = user.generateAuthToken();

  sendSuccessResponse(res, HTTP_STATUS.OK, "Login successful", {
    uuid: user.uuid,
    id: user._id,
    email: user.email,
    userID: user.userID,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    address: user.address,
    dob: user.dob,
    gender: user.gender,
    bloodGroup: user.bloodGroup,
    role: ROLE_NAMES[user.role].toLowerCase(),
    profileImage: user.profileImage,
    accessToken: token,
  });
});

// Logout user
const logout = asyncHandler(async (req, res) => {
  res.cookie("token", "", { expires: new Date(0), httpOnly: true });
  sendSuccessResponse(res, HTTP_STATUS.OK, "Logout successful");
});

// Get user profile
const getProfile = asyncHandler(async (req, res) => {
  const loggedInUser = req.user;
  const { email } = req.body; // optional email to fetch profile for (admin/parent/teacher access)

  let targetUser;

  // Admin can access any profile
  if (loggedInUser.role === USER_ROLES.ADMIN) {
    if (!email) {
      return sendErrorResponse(
        res,
        HTTP_STATUS.BAD_REQUEST,
        "Mandatory parameter missing"
      );
    }
    targetUser = await User.findOne({ email }).select(
      "-password -__v -createdAt -updatedAt"
    );
    if (!targetUser) {
      return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, "User not found");
    }
  } else if (loggedInUser.role === USER_ROLES.PARENT) {
    // Parent can access own profile and children
    if (!email || email === loggedInUser.email) {
      targetUser = loggedInUser;
    } else {
      // check if email belongs to child
      const parent = await Parent.findOne({
        userId: loggedInUser._id,
      }).populate("childrenId");
      const child = parent.childrenId.find((c) => c.userId.email === email);
      if (!child) {
        return sendErrorResponse(
          res,
          HTTP_STATUS.FORBIDDEN,
          "Access denied to this profile"
        );
      }
      targetUser = await User.findById(child.userId).select(
        "-password -__v -createdAt -updatedAt"
      );
    }
  } else if (loggedInUser.role === USER_ROLES.TEACHER) {
    // Teacher can access own profile and students in their courses
    if (!email || email === loggedInUser.email) {
      targetUser = loggedInUser;
    } 
   /* else {
      // check if email belongs to student in teacher's courses
      const teacher = await Teacher.findOne({ userId: loggedInUser._id });
      const courses = await Course.find({ teacherId: teacher.userId }).select(
        "_id"
      );
      const courseIds = courses.map((c) => c._id);

      const students = await Student.find({
        classId: { $in: courseIds },
      }).populate("userId");
      const student = students.find((s) => s.userId.email === email);

      if (!student) {
        return sendErrorResponse(
          res,
          HTTP_STATUS.FORBIDDEN,
          "Access denied to this profile"
        );
      }
      targetUser = await User.findById(student.userId._id).select(
        "-password -__v -createdAt -updatedAt"
      );
    }
  */
  } 
  // Student can access only own profile
  else if (loggedInUser.role === USER_ROLES.STUDENT) {
    targetUser = loggedInUser;
  } else {
    return sendErrorResponse(res, HTTP_STATUS.FORBIDDEN, "Access denied");
  }

  sendSuccessResponse(res, HTTP_STATUS.OK, "Profile retrieved successfully", {
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

// Update user profile
const updateProfile = asyncHandler(async (req, res) => {
  const loggedInUser = req.user;
  const { targetEmail, ...updateData } = req.body; // targetEmail is the email of the user to update (only admin can provide it)

  let targetUser;

  // Determine which user is being updated
  if (loggedInUser.role === USER_ROLES.ADMIN) {
    // Admin can update any profile
    if (!targetEmail) {
      return sendErrorResponse(
        res,
        HTTP_STATUS.BAD_REQUEST,
        "targetEmail is required for admin"
      );
    }
    targetUser = await User.findOne({ email: targetEmail }).select(
      "-password -__v -createdAt -updatedAt"
    );
    if (!targetUser) {
      return sendErrorResponse(
        res,
        HTTP_STATUS.NOT_FOUND,
        "Target user not found"
      );
    }
  } else if (loggedInUser.role === USER_ROLES.PARENT) {
    // Parent can update own profile or children profiles
    if (!targetEmail || targetEmail === loggedInUser.email) {
      // updating own profile
      targetUser = loggedInUser;
    } else {
      // check if targetEmail belongs to any child
      const parentRecord = await Parent.findOne({
        userId: loggedInUser._id,
      }).populate("childrenId");
      const child = parentRecord?.childrenId.find(
        (c) => c.userId.email === targetEmail
      );
      if (!child) {
        return sendErrorResponse(
          res,
          HTTP_STATUS.FORBIDDEN,
          "You can only update your own profile or your children’s profiles"
        );
      }
      targetUser = await User.findById(child.userId).select(
        "-password -__v -createdAt -updatedAt"
      );
    }
  } else {
    // Teacher or Student can only update own profile
    targetUser = loggedInUser;
    if (targetEmail && targetEmail !== loggedInUser.email) {
      return sendErrorResponse(
        res,
        HTTP_STATUS.FORBIDDEN,
        "You can only update your own profile"
      );
    }
  }

  // Remove restricted fields if not admin
  if (loggedInUser.role !== USER_ROLES.ADMIN) {
    delete updateData.role;
    delete updateData.isActive;
    delete updateData.email;
    delete updateData.userId;
  }

  // Apply updates
  const allowedFields = [
    "firstName",
    "lastName",
    "phone",
    "address",
    "dob",
    "gender",
    "bloodGroup",
    "profileImage",
  ];

  const finalUpdate = {};
  allowedFields.forEach((field) => {
    if (updateData[field] !== undefined) finalUpdate[field] = updateData[field];
  });

  // If admin provided role, email or isActive, allow them
  if (loggedInUser.role === USER_ROLES.ADMIN) {
    if (updateData.role !== undefined) finalUpdate.role = updateData.role;
    if (updateData.email !== undefined) finalUpdate.email = updateData.email;
    if (updateData.isActive !== undefined)
      finalUpdate.isActive = updateData.isActive;
    if (updateData.userId !== undefined) finalUpdate.userId = updateData.userId;
  }

  const updatedUser = await User.findByIdAndUpdate(
    targetUser._id,
    finalUpdate,
    { new: true, runValidators: true }
  );

  sendSuccessResponse(res, HTTP_STATUS.OK, "Profile updated successfully", {
    email: updatedUser.email,
    firstName: updatedUser.firstName,
    lastName: updatedUser.lastName,
    userID: updatedUser.userID,
    phone: updatedUser.phone,
    address: updatedUser.address,
    dob: updatedUser.dob,
    gender: updatedUser.gender,
    bloodGroup: updatedUser.bloodGroup,
    role: ROLE_NAMES[updatedUser.role],
    isActive: updatedUser.isActive,
    profileImage: updatedUser.profileImage,
  });
});

// Change password
const changePassword = asyncHandler(async (req, res) => {
  const { targetEmail, currentPassword, newPassword } = req.body;
  const loggedInUser = req.user;

  // Validate required fields
  const requiredFields =
    loggedInUser.role === USER_ROLES.ADMIN
      ? ["targetEmail", "newPassword"]
      : ["currentPassword", "newPassword"];
  const fieldValidation = validateRequiredFields(req.body, requiredFields);

  if (!fieldValidation.isValid) {
    return sendErrorResponse(
      res,
      HTTP_STATUS.BAD_REQUEST,
      "Validation failed",
      fieldValidation.errors
    );
  }

  // Validate new password strength
  const passwordValidation = validatePassword(newPassword, "register");
  if (!passwordValidation.isValid) {
    return sendErrorResponse(
      res,
      HTTP_STATUS.BAD_REQUEST,
      "New password validation failed",
      passwordValidation.errors
    );
  }

  let userToUpdate;

  if (loggedInUser.role === USER_ROLES.ADMIN) {
    // Admin can update any user's password
    userToUpdate = await User.findOne({ email: targetEmail }).select(
      "+password"
    );
    if (!userToUpdate) {
      return sendErrorResponse(
        res,
        HTTP_STATUS.NOT_FOUND,
        "Target user not found"
      );
    }
  } else {
    // Non-admin: update own password only
    userToUpdate = await User.findOne({ email: loggedInUser.email }).select(
      "+password"
    );

    // Validate current password
    const isCurrentPasswordValid = await userToUpdate.comparePassword(
      currentPassword
    );
    if (!isCurrentPasswordValid) {
      return sendErrorResponse(
        res,
        HTTP_STATUS.BAD_REQUEST,
        "Current password is incorrect"
      );
    }
  }

  // Update password
  userToUpdate.password = newPassword;
  await userToUpdate.save();

  sendSuccessResponse(res, HTTP_STATUS.OK, "Password changed successfully");
});

module.exports = {
  register,
  login,
  logout,
  getProfile,
  updateProfile,
  changePassword,
};
