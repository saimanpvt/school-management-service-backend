const Student = require("../models/Student");
const User = require("../models/User");
const Course = require("../models/Course");
const mongoose = require("mongoose");
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
 * Add a new student (Admin only)
 */
const addStudent = asyncHandler(async (req, res) => {
  const {
    email,
    password,
    firstName,
    lastName,
    phone,
    address,
    dateOfBirth,
    gender,
    bloodGroup,
    studentId,
    classId,
    admissionDate,
    leavingDate,
    emergencyContact,
    course,
    parent,
    classTeacher,
  } = req.body;

  // Validate required fields for User + Student
  const requiredFields = [
    "email",
    "password",
    "firstName",
    "lastName",
    "studentId",
    "classId",
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

  // Check if student ID already exists
  const existingStudent = await Student.findOne({ studentId });
  if (existingStudent) {
    return sendErrorResponse(
      res,
      HTTP_STATUS.CONFLICT,
      "Student with this student ID already exists"
    );
  }

  // Generate unique userID
  const generateUserID = () =>
    `STU${Date.now()}${Math.floor(Math.random() * 1000)}`;

  // Create User first
  const newUser = await User.create({
    email,
    userID: generateUserID(), // Generate unique userID
    password,
    firstName,
    lastName,
    role: USER_ROLES.STUDENT,
    phone,
    address,
    dob: dateOfBirth ? new Date(dateOfBirth) : undefined,
    gender,
    bloodGroup,
  });

  // Create Student record
  const student = await Student.create({
    userId: newUser._id,
    studentId,
    classId: new mongoose.Types.ObjectId(classId), // Convert string to ObjectId
    admissionDate: admissionDate ? new Date(admissionDate) : new Date(),
    leavingDate: leavingDate ? new Date(leavingDate) : undefined,
    emergencyContact: emergencyContact || phone,
  });

  // Populate user reference
  await student.populate([
    {
      path: "userId",
      select: "firstName lastName email phone address bloodGroup dob gender",
    },
  ]);

  sendSuccessResponse(res, HTTP_STATUS.CREATED, "Student added successfully", {
    user: {
      uuid: newUser.uuid,
      email: newUser.email,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      role: "Student",
      phone: newUser.phone,
      address: newUser.address,
      dob: newUser.dob,
      gender: newUser.gender,
      bloodGroup: newUser.bloodGroup,
    },
    student: student,
  });
});

/**
 * Get student list (Admin, Teacher)
 */
const getStudentList = asyncHandler(async (req, res) => {
  const paginationOptions = getPaginationOptions(req.query);
  const sortOptions = getSortOptions(req.query, [
    "firstName",
    "lastName",
    "studentId",
    "createdAt",
  ]);

  // Build filter options
  const filters = {};

  if (req.query.course) {
    filters.course = req.query.course;
  }

  if (req.query.classTeacher) {
    filters.classTeacher = req.query.classTeacher;
  }

  if (req.query.gender) {
    filters.gender = req.query.gender;
  }

  if (req.query.isActive !== undefined) {
    filters.isActive = req.query.isActive === "true";
  }

  if (req.query.search) {
    filters.$or = [{ studentId: { $regex: req.query.search, $options: "i" } }];
  }

  // Get students with pagination
  const students = await Student.find(filters)
    .populate([
      { path: "user", select: "firstName lastName email phone" },
      { path: "parent", select: "firstName lastName email phone" },
      { path: "classTeacher", select: "firstName lastName email phone" },
      { path: "course", select: "courseName courseCode department" },
    ])
    .sort(sortOptions)
    .skip(paginationOptions.skip)
    .limit(paginationOptions.limit);

  const total = await Student.countDocuments(filters);
  const paginationMeta = getPaginationMeta(
    total,
    paginationOptions.page,
    paginationOptions.limit
  );

  sendPaginatedResponse(
    res,
    HTTP_STATUS.OK,
    "Students retrieved successfully",
    students,
    paginationMeta
  );
});

/**
 * Get single student (Admin, Teacher, Parent, Student)
 */
const getStudent = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return sendErrorResponse(
      res,
      HTTP_STATUS.BAD_REQUEST,
      "Invalid student ID"
    );
  }

  const student = await Student.findById(id).populate([
    { path: "user", select: "firstName lastName email phone address" },
    { path: "parent", select: "firstName lastName email phone address" },
    { path: "classTeacher", select: "firstName lastName email phone" },
    { path: "course", select: "courseName courseCode department duration" },
  ]);

  if (!student) {
    return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, "Student not found");
  }

  sendSuccessResponse(
    res,
    HTTP_STATUS.OK,
    "Student retrieved successfully",
    student
  );
});

/**
 * Update student (Admin only)
 */
const updateStudent = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  if (!isValidObjectId(id)) {
    return sendErrorResponse(
      res,
      HTTP_STATUS.BAD_REQUEST,
      "Invalid student ID"
    );
  }

  // Validate ObjectIds if provided
  if (updateData.parent && !isValidObjectId(updateData.parent)) {
    return sendErrorResponse(res, HTTP_STATUS.BAD_REQUEST, "Invalid parent ID");
  }
  if (updateData.classTeacher && !isValidObjectId(updateData.classTeacher)) {
    return sendErrorResponse(
      res,
      HTTP_STATUS.BAD_REQUEST,
      "Invalid class teacher ID"
    );
  }
  if (updateData.course && !isValidObjectId(updateData.course)) {
    return sendErrorResponse(res, HTTP_STATUS.BAD_REQUEST, "Invalid course ID");
  }

  const student = await Student.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  }).populate([
    { path: "user", select: "firstName lastName email phone" },
    { path: "parent", select: "firstName lastName email phone" },
    { path: "classTeacher", select: "firstName lastName email phone" },
    { path: "course", select: "courseName courseCode department" },
  ]);

  if (!student) {
    return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, "Student not found");
  }

  sendSuccessResponse(
    res,
    HTTP_STATUS.OK,
    "Student updated successfully",
    student
  );
});

/**
 * Delete student (Admin only)
 */
const deleteStudent = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return sendErrorResponse(
      res,
      HTTP_STATUS.BAD_REQUEST,
      "Invalid student ID"
    );
  }

  const student = await Student.findByIdAndUpdate(
    id,
    { isActive: false },
    { new: true }
  );

  if (!student) {
    return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, "Student not found");
  }

  sendSuccessResponse(res, HTTP_STATUS.OK, "Student deactivated successfully");
});

module.exports = {
  addStudent,
  getStudentList,
  getStudent,
  updateStudent,
  deleteStudent,
};
