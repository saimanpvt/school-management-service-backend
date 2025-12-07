# 🏫 School Management SaaS - Complete System Documentation

## 📋 Table of Contents
1. [System Overview](#system-overview)
2. [Authentication Flow](#authentication-flow)
3. [User Roles & Access Control](#user-roles--access-control)
4. [Complete User Journey](#complete-user-journey)
5. [Database Schema & Models](#database-schema--models)
6. [API Endpoints Reference](#api-endpoints-reference)
7. [Business Logic Flow](#business-logic-flow)
8. [Security Implementation](#security-implementation)

---

## 🎯 System Overview

### Architecture Pattern
- **Type**: Multi-tenant SaaS School Management System
- **Architecture**: RESTful API with JWT Authentication
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT Token-based with Role-based Access Control (RBAC)

### Core Features
- Role-based user management (Admin, Teacher, Student, Parent)
- Academic management (Classes, Courses, Exams)
- Assessment system (Marks, Grades)
- Fee management
- Parent-student relationship tracking

---

## 🔐 Authentication Flow

### 1. Initial Setup & Admin Creation
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   System Init   │ -> │  Create Admin    │ -> │   Admin Login   │
│                 │    │  (First User)    │    │   Get JWT Token │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### 2. Login Process
```
POST /api/auth/login
{
  "email": "admin@school.com",
  "password": "securepassword"
}

Response:
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "jwt_token_here",
    "user": {
      "_id": "user_id",
      "email": "admin@school.com",
      "firstName": "Admin",
      "lastName": "User",
      "role": "Admin",
      "userID": "ADMIN001"
    }
  }
}
```

### 3. Token Usage
- **Header**: `Authorization: Bearer <jwt_token>`
- **Expiration**: Configurable (default: 24h)
- **Refresh**: Manual login required

---

## 👥 User Roles & Access Control

### Role Hierarchy
```
Admin (Level 1) - Full System Access
├── Teacher (Level 2) - Academic Management
├── Student (Level 3) - Personal Data Access
└── Parent (Level 4) - Child's Data Access
```

### Detailed Role Permissions

#### 🔑 Admin (Role: 1)
**Can Access:**
- ✅ Create/Update/Delete all users (Teachers, Students, Parents)
- ✅ Manage classes, courses, exams
- ✅ View all academic records and marks
- ✅ Manage fee structures
- ✅ System configuration and settings
- ✅ All reports and analytics

**Cannot Access:**
- ❌ None (Full access)

#### 📚 Teacher (Role: 2)
**Can Access:**
- ✅ View assigned classes and students
- ✅ Create/Update/Delete exams for assigned courses
- ✅ Add/Update marks for students
- ✅ View student academic records
- ✅ Manage course content and references
- ✅ Update own profile

**Cannot Access:**
- ❌ Create/Delete users
- ❌ Manage other teachers' courses
- ❌ System-wide settings
- ❌ Fee management

#### 🎓 Student (Role: 3)
**Can Access:**
- ✅ View own profile and academic records
- ✅ View enrolled courses and classes
- ✅ View own exam results and marks
- ✅ View course materials and references
- ✅ Update own profile (limited fields)

**Cannot Access:**
- ❌ Other students' data
- ❌ Create/modify courses or exams
- ❌ Administrative functions

#### 👨‍👩‍👧‍👦 Parent (Role: 4)
**Can Access:**
- ✅ View child's academic records
- ✅ View child's exam results and marks
- ✅ View child's courses and classes
- ✅ Update own profile
- ✅ View fee information for child

**Cannot Access:**
- ❌ Other children's data
- ❌ Academic management functions
- ❌ Administrative functions

---

## 🔄 Complete User Journey

### Phase 1: System Setup (Admin)
```
1. Admin Login
   ↓
2. POST /api/auth/login
   ↓
3. Receive JWT Token
   ↓
4. Set Authorization Header: Bearer <token>
```

### Phase 2: User Management (Admin Only)
```
Admin Dashboard
├── Create Teachers
│   ├── POST /api/auth/register
│   ├── Required: email, password, firstName, lastName, role: "TEACHER"
│   ├── Additional: employeeId, experience, DOJ
│   └── Creates: User + Teacher records
│
├── Create Classes
│   ├── POST /api/classes
│   ├── Required: classID, className, classCode
│   └── Optional: description, year
│
├── Create Courses  
│   ├── POST /api/courses
│   ├── Required: courseCode, courseName, teacherId, classId
│   └── Links: Teacher to Class via Course
│
├── Create Students
│   ├── POST /api/auth/register  
│   ├── Required: email, password, firstName, lastName, role: "STUDENT"
│   ├── Additional: studentId, admissionDate, classId
│   └── Creates: User + Student records
│
└── Create Parents
    ├── POST /api/auth/register
    ├── Required: email, password, firstName, lastName, role: "PARENT"
    ├── Additional: childrenId (Student's User ID)
    └── Creates: User + Parent records with child relationship
```

### Phase 3: Academic Operations (Teacher)
```
Teacher Login
├── JWT Authentication
├── Access Assigned Courses
│   └── GET /api/courses (filtered by teacherId)
│
├── Manage Exams
│   ├── POST /api/exams (Create)
│   ├── PUT /api/exams/:id (Update)
│   └── DELETE /api/exams/:id (Delete)
│
├── Record Marks
│   ├── POST /api/marks (Add student marks)
│   ├── PUT /api/marks/:id (Update marks)
│   └── GET /api/marks (View class performance)
│
└── Course Materials
    ├── POST /api/references (Add study materials)
    └── PUT /api/references/:id (Update materials)
```

### Phase 4: Student Access
```
Student Login
├── JWT Authentication
├── View Profile
│   └── GET /api/auth/profile
│
├── View Courses
│   └── GET /api/courses (filtered by enrolled classes)
│
├── View Exams
│   └── GET /api/exams (filtered by classId)
│
├── View Marks
│   └── GET /api/marks (own marks only)
│
└── Course Materials
    └── GET /api/references (for enrolled courses)
```

### Phase 5: Parent Access
```
Parent Login
├── JWT Authentication
├── View Child Profile
│   └── GET /api/students/:childId (restricted to own child)
│
├── View Child's Academic Records
│   ├── GET /api/courses (child's courses)
│   ├── GET /api/exams (child's exams)
│   └── GET /api/marks (child's marks)
│
└── Fee Information
    └── GET /api/fees (child's fee structure)
```

---

## 🗃️ Database Schema & Models

### User Model (Base for all users)
```javascript
{
  _id: ObjectId,
  email: String (unique, required),
  userID: String (unique, required),
  password: String (hashed, required),
  firstName: String (required),
  lastName: String (required),
  role: Number (1=Admin, 2=Teacher, 3=Student, 4=Parent),
  phone: String,
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  isActive: Boolean (default: true),
  lastLogin: Date,
  profileImage: String,
  dob: Date,
  gender: String (Male/Female/Other),
  bloodGroup: String (A+, A-, B+, B-, AB+, AB-, O+, O-),
  createdAt: Date,
  updatedAt: Date
}
```

### Teacher Model (Extends User)
```javascript
{
  _id: ObjectId,
  teacherId: ObjectId (ref: User, unique),
  employeeId: String (unique, required),
  experience: Number (months),
  DOJ: Date (Date of Joining, required),
  resignationDate: Date,
  bio: String (max 500 chars),
  emergencyContact: String,
  createdAt: Date,
  updatedAt: Date
}
```

### Student Model (Extends User)
```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: User, unique),
  classId: [ObjectId] (ref: Class, array),
  parentId: ObjectId (ref: Parent),
  admissionDate: Date (required),
  leavingDate: Date,
  emergencyContact: String,
  studentId: String (required),
  createdAt: Date,
  updatedAt: Date
}
```

### Parent Model (Extends User)
```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: User, unique),
  parentId: String (unique, required),
  childrenId: [ObjectId] (ref: Student, array),
  createdAt: Date,
  updatedAt: Date
}
```

### Class Model
```javascript
{
  _id: ObjectId,
  classID: String (unique, required),
  className: String (required, max 50 chars),
  classType: String (Permanent/Temporary, default: Permanent),
  classStatus: String (Ongoing/Completed/Inactive, default: Ongoing),
  classCode: String (unique, required, max 20 chars),
  description: String (max 300 chars),
  year: Number,
  createdAt: Date,
  updatedAt: Date
}
```

### Course Model
```javascript
{
  _id: ObjectId,
  courseCode: String (unique, required),
  courseName: String (required, max 100 chars),
  description: String (max 500 chars),
  duration: Number (months, min 1),
  teacherId: ObjectId (ref: User, required),
  classId: ObjectId (ref: Class, required),
  academicYear: String (format: YYYY-YYYY, required),
  isActive: Boolean (default: true),
  createdAt: Date,
  updatedAt: Date
}
```

### Exam Model
```javascript
{
  _id: ObjectId,
  examName: String (required, max 100 chars),
  examType: String (Quiz/Midterm/Final/Assignment/Project/Presentation/Lab/Practical),
  course: ObjectId (ref: Course, required),
  classId: ObjectId (ref: Class, required),
  academicYear: String (format: YYYY-YYYY, required),
  totalMarks: Number (required, min 1),
  passingMarks: Number (required, must be <= totalMarks),
  examDate: Date (required),
  startTime: String,
  endTime: String,
  duration: Number (minutes),
  instructions: String,
  isActive: Boolean (default: true),
  createdAt: Date,
  updatedAt: Date
}
```

### Marks Model
```javascript
{
  _id: ObjectId,
  studentId: ObjectId (ref: User, required),
  examId: ObjectId (ref: Exam, required),
  courseId: ObjectId (ref: Course, required),
  marksObtained: Number (required, min 0),
  totalMarks: Number (required),
  percentage: Number (calculated),
  grade: String (A+/A/B+/B/C+/C/D/F),
  remarks: String,
  submittedAt: Date,
  evaluatedAt: Date,
  evaluatedBy: ObjectId (ref: User - Teacher),
  createdAt: Date,
  updatedAt: Date
}
```

### Fee Structure Model
```javascript
{
  _id: ObjectId,
  classId: ObjectId (ref: Class, required),
  academicYear: String (format: YYYY-YYYY, required),
  feeType: String (Tuition/Lab/Library/Sports/Transport/Miscellaneous),
  amount: Number (required, min 0),
  dueDate: Date,
  description: String,
  isActive: Boolean (default: true),
  createdAt: Date,
  updatedAt: Date
}
```

### Reference Model (Study Materials)
```javascript
{
  _id: ObjectId,
  courseId: ObjectId (ref: Course, required),
  title: String (required, max 200 chars),
  description: String (max 1000 chars),
  type: String (Book/Article/Video/Document/Link/Other),
  content: String (file path or URL),
  uploadedBy: ObjectId (ref: User - Teacher),
  isActive: Boolean (default: true),
  createdAt: Date,
  updatedAt: Date
}
```

---

## 🚀 API Endpoints Reference

### Authentication Endpoints
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/auth/login` | Public | User login |
| POST | `/api/auth/logout` | Public | User logout |
| POST | `/api/auth/register` | Admin Only | Create new user |
| GET | `/api/auth/profile` | Authenticated | Get user profile |
| PUT | `/api/auth/change-password` | Authenticated | Change password |
| DELETE | `/api/auth/delete/:userId` | Admin Only | Delete user |
| GET | `/api/auth/users` | Admin Only | Get all users |
| PUT | `/api/auth/update/:userId` | Authenticated | Update profile |

### Class Management Endpoints
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/classes` | Admin/Teacher | Get all classes |
| GET | `/api/classes/:id` | Admin/Teacher | Get class by ID |
| POST | `/api/classes` | Admin Only | Create new class |
| PUT | `/api/classes/:id` | Admin Only | Update class |
| DELETE | `/api/classes/:id` | Admin Only | Delete class |

### Course Management Endpoints  
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/courses` | All Roles | Get courses (filtered by role) |
| GET | `/api/courses/:id` | All Roles | Get course by ID |
| POST | `/api/courses` | Admin/Teacher | Create new course |
| PUT | `/api/courses/:id` | Admin/Teacher | Update course |
| DELETE | `/api/courses/:id` | Admin Only | Delete course |

### Exam Management Endpoints
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/exams` | All Roles | Get exams (filtered by role) |
| GET | `/api/exams/:id` | All Roles | Get exam by ID |
| POST | `/api/exams` | Admin/Teacher | Create new exam |
| PUT | `/api/exams/:id` | Admin/Teacher | Update exam |
| DELETE | `/api/exams/:id` | Admin/Teacher | Delete exam |

### Marks Management Endpoints
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/marks` | All Roles | Get marks (filtered by role) |
| GET | `/api/marks/:id` | All Roles | Get marks by ID |
| POST | `/api/marks` | Teacher Only | Add student marks |
| PUT | `/api/marks/:id` | Teacher Only | Update marks |
| DELETE | `/api/marks/:id` | Teacher Only | Delete marks |

### Fee Management Endpoints
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/fees` | All Roles | Get fee structures |
| GET | `/api/fees/:id` | All Roles | Get fee by ID |
| POST | `/api/fees` | Admin Only | Create fee structure |
| PUT | `/api/fees/:id` | Admin Only | Update fee structure |
| DELETE | `/api/fees/:id` | Admin Only | Delete fee structure |

### Reference/Materials Endpoints
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/references` | All Roles | Get study materials |
| GET | `/api/references/:id` | All Roles | Get material by ID |
| POST | `/api/references` | Admin/Teacher | Add study material |
| PUT | `/api/references/:id` | Admin/Teacher | Update material |
| DELETE | `/api/references/:id` | Admin/Teacher | Delete material |

---

## 🔧 Business Logic Flow

### 1. User Creation Workflow
```
Admin creates user → Validate input → Check duplicates → Create User record
                                                            ↓
If Teacher → Create Teacher record with employeeId, experience, DOJ
If Student → Create Student record with studentId, admissionDate, classId  
If Parent → Create Parent record with childrenId array
                                                            ↓
Send success response with user details (password excluded)
```

### 2. Authentication Middleware Chain
```
Request → Check Authorization Header → Verify JWT Token → Extract User Info → 
Attach to req.user → Continue to Route Handler
                                                            ↓
If Invalid → Return 401 Unauthorized
```

### 3. Role-Based Access Control
```
Route Request → Auth Middleware → Role Middleware → Check Allowed Roles →
                                                            ↓
If Authorized → Continue to Controller
If Not Authorized → Return 403 Forbidden
```

### 4. Data Access Filtering
```
Controller → Check User Role → Apply Data Filters → Query Database →
                                                            ↓
Admin: Full access to all data
Teacher: Access to assigned classes/courses only
Student: Access to own data only  
Parent: Access to children's data only
```

### 5. Course Enrollment Flow
```
Admin creates Student → Assigns to Class → Teacher creates Course for Class →
Student automatically enrolled → Can access course materials and exams
```

### 6. Marks Management Flow  
```
Teacher creates Exam → Students take exam → Teacher records marks →
System calculates percentage and grade → Students/Parents can view results
```

---

## 🔒 Security Implementation

### 1. Authentication Security
- **Password Hashing**: bcryptjs with salt rounds
- **JWT Tokens**: Signed with secret key, configurable expiration
- **Token Validation**: Every protected route validates token

### 2. Authorization Security
- **Role-Based Access**: Strict role checking on all endpoints
- **Data Isolation**: Users can only access permitted data
- **Route Protection**: All sensitive routes require authentication

### 3. Input Validation
- **Required Fields**: Validated before processing
- **Email Validation**: Regex pattern matching
- **Password Strength**: Minimum length requirements
- **Data Sanitization**: Trimming and cleaning input data

### 4. Database Security
- **Unique Constraints**: Prevent duplicate emails, IDs
- **Indexes**: Efficient querying and unique enforcement  
- **Schema Validation**: Mongoose schema-level validation
- **Reference Integrity**: Proper foreign key relationships

### 5. API Security
- **CORS**: Cross-origin request handling
- **Helmet**: Security headers
- **Rate Limiting**: Prevent API abuse
- **Error Handling**: Secure error messages without sensitive data

---

## 📊 System Metrics & KPIs

### User Management Metrics
- Total Users by Role
- Active Users (last login within 30 days)
- User Registration Trends
- Role Distribution

### Academic Metrics  
- Total Classes and Students
- Course Completion Rates
- Average Exam Scores by Class
- Teacher-Student Ratios

### Performance Metrics
- API Response Times
- Database Query Performance
- Token Validation Speed
- Error Rates by Endpoint

---

## 🚀 Deployment Considerations

### Environment Variables
```bash
PORT=3001
MONGODB_URI=mongodb+srv://school-management:wZNkXGn4azcOC1lT@cluster0.rk5vpun.mongodb.net/?appName=Cluster0
JWT_SECRET=your-secret-key-here
NODE_ENV=development
JWT_EXPIRE=24h
```