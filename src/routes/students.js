const express = require("express");
const router = express.Router();
const studentController = require("../controllers/studentController");
const authMiddleware = require("../middlewares/authMiddleware");
const {
  USER_ROLES,
  allowRoles,
  requireAdmin,
  requireTeacherOrAdmin,
  canAccessStudentData,
} = require("../middlewares/roleMiddleware");

// All routes require authentication
router.use(authMiddleware);

// Admin only routes
router.post("/", allowRoles([USER_ROLES.ADMIN]), studentController.addStudent);
router.put(
  "/:id",
  allowRoles([USER_ROLES.ADMIN]),
  studentController.updateStudent
);
router.delete(
  "/:id",
  allowRoles([USER_ROLES.ADMIN]),
  studentController.deleteStudent
);

// Teacher + Admin routes
router.get(
  "/",
  allowRoles([USER_ROLES.ADMIN, USER_ROLES.TEACHER]),
  studentController.getStudentList
);

// All roles with data access control
router.get("/:id", canAccessStudentData, studentController.getStudent);

module.exports = router;
