const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");
require("dotenv").config();

// Import database connection
const connectDB = require("./config/database");

// Import routes
const authRoutes = require("./routes/auth");
const studentRoutes = require("./routes/students");
const teacherRoutes = require("./routes/teachers");
const courseRoutes = require("./routes/courses");
const marksRoutes = require("./routes/marks");
const examRoutes = require("./routes/exams");
const referenceRoutes = require("./routes/references");
const feeRoutes = require("./routes/fees");

// Import middlewares
const { errorHandler, notFound } = require("./middlewares/errorMiddleware");

// Connect to database
connectDB();

// Initialize Express app
const app = express();

// Trust proxy (for rate limiting behind reverse proxy)
app.set("trust proxy", 1);

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// CORS configuration
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all requests
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// Logging middleware
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// Simple root-level routes (no /api prefix)
app.use("/", authRoutes);
app.use("/student", studentRoutes);
app.use("/teacher", teacherRoutes);
app.use("/courses", courseRoutes);
app.use("/marks", marksRoutes);
app.use("/exams", examRoutes);
app.use("/references", referenceRoutes);
app.use("/fees", feeRoutes);

// API documentation endpoint (simple)
app.get("/api", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Student Management System API",
    version: "1.0.0",
    endpoints: {
      auth: "/login, /register, /logout, /profile, /change-password",
      students: "/students",
      teachers: "/teachers",
      courses: "/courses",
      marks: "/marks",
      exams: "/exams",
      references: "/references",
      fees: "/fees",
    },
    documentation: "See README.md for detailed API documentation",
  });
});

// Root endpoint
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to Student Management System API",
    version: "1.0.0",
    status: "Server is running successfully",
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

// Handle unhandled promise rejections
process.on("unhandledRejection", (err, promise) => {
  console.error("Unhandled Promise Rejection:", err.message);
  // Close server & exit process
  process.exit(1);
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err.message);
  console.error(err.stack);
  process.exit(1);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received. Shutting down gracefully...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT received. Shutting down gracefully...");
  process.exit(0);
});

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`
🚀 Server running in ${process.env.NODE_ENV || "development"} mode
📡 Server listening on port ${PORT}
🌐 API available at http://localhost:${PORT}/api
📚 Health check at http://localhost:${PORT}/health
  `);
});

module.exports = app;
