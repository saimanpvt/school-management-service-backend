const Teacher = require("../models/Teacher");
const User = require("../models/User");
const { asyncHandler } = require("../middlewares/errorMiddleware");
const {
  sendSuccessResponse,
  sendErrorResponse,
  sendPaginatedResponse,
} = require("../utils/response");
const { HTTP_STATUS, USER_ROLES } = require("../config/constants");
const {
  validateRequiredFields,
  isValidObjectId,
} = require("../utils/validation");
const {
  getPaginationOptions,
  getPaginationMeta,
  getSortOptions,
} = require("../utils/pagination");

/**
 * Add teacher (Admin only)
 */
const addTeacher = asyncHandler(async (req, res) => {
  const {
    email,
    password,
    firstName,
    lastName,
    phone,
    address,
    dob,
    gender,
    bloodGroup,
    employeeId,
    department,
    subject,
    qualification,
    experience,
    DOJ,
    resignationDate,
    bio,
    emergencyContact,
  } = req.body;

  // Validate required fields for User + Teacher
  const requiredFields = [
    "email",
    "password",
    "firstName",
    "lastName",
    "employeeId",
    "department",
    "qualification",
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

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return sendErrorResponse(
      res,
      HTTP_STATUS.CONFLICT,
      "User already exists with this email"
    );
  }

  // Check if employee ID already exists
  const existingTeacher = await Teacher.findOne({ employeeId });
  if (existingTeacher) {
    return sendErrorResponse(
      res,
      HTTP_STATUS.CONFLICT,
      "Teacher with this employee ID already exists"
    );
  }

  // Create User first
  const newUser = await User.create({
    email,
    userID: employeeId, // Use employeeId as userID or generate unique one
    password,
    firstName,
    lastName,
    role: USER_ROLES.TEACHER,
    phone,
    address,
    dob: dob ? new Date(dob) : undefined,
    gender,
    bloodGroup,
  });

  // Create Teacher record
  const teacher = await Teacher.create({
    userId: newUser._id,
    employeeId,
    department,
    subject,
    qualification,
    experience: experience ? parseInt(experience) : 0,
    DOJ: DOJ ? new Date(DOJ) : new Date(),
    resignationDate: resignationDate ? new Date(resignationDate) : undefined,
    bio,
    emergencyContact: emergencyContact || phone,
  });

  // Populate user reference
  await teacher.populate([
    {
      path: "userId",
      select: "firstName lastName email phone address bloodGroup dob gender",
    },
  ]);

  sendSuccessResponse(res, HTTP_STATUS.CREATED, "Teacher added successfully", {
    user: {
      uuid: newUser.uuid,
      email: newUser.email,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      role: "Teacher",
      phone: newUser.phone,
      address: newUser.address,
      dob: newUser.dob,
      gender: newUser.gender,
      bloodGroup: newUser.bloodGroup,
    },
    teacher: teacher,
  });
});

/**
 * Get teacher list (Admin only)
 */
const getTeacherList = asyncHandler(async (req, res) => {
  const paginationOptions = getPaginationOptions(req.query);
  const sortOptions = getSortOptions(req.query, [
    "firstName",
    "lastName",
    "employeeId",
    "department",
    "createdAt",
  ]);

  // Build filter options
  const filters = { isActive: true };

  if (req.query.department) {
    filters.department = req.query.department;
  }

  if (req.query.isClassTeacher !== undefined) {
    filters.isClassTeacher = req.query.isClassTeacher === "true";
  }

  if (req.query.search) {
    filters.$or = [{ employeeId: { $regex: req.query.search, $options: "i" } }];
  }

  // Get teachers with pagination
  const teachers = await Teacher.find(filters)
    .populate([
      { path: "user", select: "firstName lastName email phone address" },
      { path: "classTeacherFor", select: "courseName courseCode department" },
    ])
    .sort(sortOptions)
    .skip(paginationOptions.skip)
    .limit(paginationOptions.limit);

  const total = await Teacher.countDocuments(filters);
  const paginationMeta = getPaginationMeta(
    total,
    paginationOptions.page,
    paginationOptions.limit
  );

  sendPaginatedResponse(
    res,
    HTTP_STATUS.OK,
    "Teachers retrieved successfully",
    teachers,
    paginationMeta
  );
});

/**
 * Get single teacher (Admin only)
 */
const getTeacher = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return sendErrorResponse(
      res,
      HTTP_STATUS.BAD_REQUEST,
      "Invalid teacher ID"
    );
  }

  const teacher = await Teacher.findById(id).populate([
    { path: "user", select: "firstName lastName email phone address" },
    { path: "classTeacherFor", select: "courseName courseCode department" },
  ]);

  if (!teacher) {
    return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, "Teacher not found");
  }

  sendSuccessResponse(
    res,
    HTTP_STATUS.OK,
    "Teacher retrieved successfully",
    teacher
  );
});

/**
 * Update teacher (Admin only)
 */
const updateTeacher = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  if (!isValidObjectId(id)) {
    return sendErrorResponse(
      res,
      HTTP_STATUS.BAD_REQUEST,
      "Invalid teacher ID"
    );
  }

  // Validate ObjectIds if provided
  if (
    updateData.classTeacherFor &&
    !isValidObjectId(updateData.classTeacherFor)
  ) {
    return sendErrorResponse(res, HTTP_STATUS.BAD_REQUEST, "Invalid course ID");
  }

  const teacher = await Teacher.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  }).populate([
    { path: "user", select: "firstName lastName email phone address" },
    { path: "classTeacherFor", select: "courseName courseCode department" },
  ]);

  if (!teacher) {
    return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, "Teacher not found");
  }

  sendSuccessResponse(
    res,
    HTTP_STATUS.OK,
    "Teacher updated successfully",
    teacher
  );
});

/**
 * Delete teacher (Admin only)
 */
const deleteTeacher = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return sendErrorResponse(
      res,
      HTTP_STATUS.BAD_REQUEST,
      "Invalid teacher ID"
    );
  }

  const teacher = await Teacher.findByIdAndUpdate(
    id,
    { isActive: false },
    { new: true }
  );

  if (!teacher) {
    return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, "Teacher not found");
  }

  sendSuccessResponse(res, HTTP_STATUS.OK, "Teacher deactivated successfully");
});

module.exports = {
  addTeacher,
  getTeacherList,
  getTeacher,
  updateTeacher,
  deleteTeacher,
};
