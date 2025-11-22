const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const authMiddleware = require("../middlewares/authMiddleware");

// Public routes (no authentication required)
router.post("/login", authController.login);
router.post("/logout", authController.logout);

// Register route (protected: only authenticated admins)
router.post("/register", authMiddleware, authController.register);

// Protected routes (authentication required)
router.use(authMiddleware);
router.get("/profile", authController.getProfile);
router.put("/profile", authController.updateProfile);
router.put("/change-password", authController.changePassword);

module.exports = router;
