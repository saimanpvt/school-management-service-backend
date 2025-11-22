const mongoose = require("mongoose");
require("dotenv").config();

const User = require("../src/models/User");
const Course = require("../src/models/Course");
const FeeStructure = require("../src/models/FeeStructure");
const Marks = require("../src/models/Marks");
const Exam = require("../src/models/Exam");
const Reference = require("../src/models/Reference");

async function seedDemoData() {
  await mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  console.log("✅ Connected to MongoDB");

  // Fetch users
  const student = await User.findOne({ email: "student1@gmail.com" });
  const teacher = await User.findOne({ email: "teacher1@gmail.com" });
  const parent = await User.findOne({ email: "parent1@gmail.com" });
  const admin = await User.findOne({ email: "admin1@gmail.com" });

  // If users not found, stop
  if (!student || !teacher || !parent || !admin) {
    console.log(
      "❌ Required users not found. Please make sure student1, teacher1, parent1, and admin1 exist before seeding."
    );
    await mongoose.connection.close();
    return;
  }

  // ✅ Create or reuse a Class
  let classId;
  try {
    const Class = require("../src/models/Class");
    let classDoc = await Class.findOne({ className: "Grade 10", section: "A" });
    if (!classDoc) {
      classDoc = await Class.create({
        className: "Grade 10",
        section: "A",
        academicYear: "2025-2026",
      });
      console.log("🆕 Class created:", classDoc.className);
    } else {
      console.log("ℹ️ Using existing class:", classDoc.className);
    }
    classId = classDoc._id;
  } catch (err) {
    console.warn("⚠️ Class model not found, using fallback classId");
    classId = "CLASS001";
  }

  // ✅ Add multiple courses with proper fields
  const courses = await Course.insertMany([
    {
      courseName: "Mathematics",
      courseCode: "MATH101",
      teacherId: teacher._id,
      classId: classId,
      students: [student._id],
      academicYear: "2025-2026",
      duration: "1 year",
      credits: 3,
      description: "Basic Mathematics Course",
    },
    {
      courseName: "Science",
      courseCode: "SCI101",
      teacherId: teacher._id,
      classId: classId,
      students: [student._id],
      academicYear: "2025-2026",
      duration: "1 year",
      credits: 4,
      description: "Basic Science Course",
    },
  ]);

  console.log("📚 Courses added:", courses.map((c) => c.courseName));

  // ✅ Add multiple exams
  const exams = await Exam.insertMany([
    {
      name: "Mathematics Midterm",
      course: courses[0]._id,
      date: new Date(),
      totalMarks: 100,
    },
    {
      name: "Science Midterm",
      course: courses[1]._id,
      date: new Date(),
      totalMarks: 100,
    },
  ]);

  console.log("🧾 Exams added:", exams.map((e) => e.name));

  // ✅ Add marks for both exams
  await Marks.insertMany([
    {
      student: student._id,
      exam: exams[0]._id,
      marksObtained: 85,
    },
    {
      student: student._id,
      exam: exams[1]._id,
      marksObtained: 90,
    },
  ]);

  // ✅ Add fee records for student
  await FeeStructure.insertMany([
    {
      student: student._id,
      amount: 5000,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: "unpaid",
    },
    {
      student: student._id,
      amount: 2000,
      dueDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      status: "paid",
    },
  ]);

  // ✅ Add reference records
  await Reference.insertMany([
    {
      student: student._id,
      referenceType: "Character",
      description: "Good conduct",
      issuedBy: teacher._id,
      dateIssued: new Date(),
    },
    {
      student: student._id,
      referenceType: "Academic",
      description: "Excellent performance in Mathematics",
      issuedBy: teacher._id,
      dateIssued: new Date(),
    },
  ]);

  // ✅ Dashboard summary
  const userCount = await User.countDocuments();
  const courseCount = await Course.countDocuments();
  const examCount = await Exam.countDocuments();
  const marksCount = await Marks.countDocuments();
  const feeCount = await FeeStructure.countDocuments();
  const referenceCount = await Reference.countDocuments();

  console.log("📊 Dashboard summary:");
  console.log({
    userCount,
    courseCount,
    examCount,
    marksCount,
    feeCount,
    referenceCount,
  });

  await mongoose.connection.close();
  console.log("✅ Demo data seeded successfully!");
}

(async () => {
  try {
    await seedDemoData();
  } catch (err) {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
  }
})();
