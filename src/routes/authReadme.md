* API Base URL prefix → **`/api/auth`**
* All routes
* Request/Response formats
* Access control per role
* Error format
* Success format

You can copy directly into your project as `README.md`.

---

# **Auth Service API – Documentation**

## **Base URL**

```
/api/auth
```

---

# **User Roles**

| Role Name | Value | Description    |
| --------- | ----- | -------------- |
| ADMIN     | 1     | Full Access    |
| TEACHER   | 2     | Teacher Access |
| STUDENT   | 3     | Student Access |
| PARENT    | 4     | Parent Access  |

---

# **Success Response Structure**

```json
{
  "success": true,
  "message": "Message here",
  "data": { ... }
}
```

# **Error Response Structure**

```json
{
  "success": false,
  "message": "Error message",
  "errors": {}
}
```

---

# ✅ **API Endpoints**

---

# **1. Register User**

### **POST** `/api/auth/register`

**Access:** `ADMIN only`

### **Request Body**

```json
{
  "email": "user@example.com",
  "userID": "U123",
  "password": "Password@123",
  "firstName": "John",
  "lastName": "Doe",
  "role": "TEACHER",
  "phone": "9876543210",
  "address": "Chennai",
  "dob": "2000-01-01",
  "gender": "Male",
  "bloodGroup": "O+",
  "profileImage": "image-url"
}
```

### **Success Response**

```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "_id": "65a...",
    "email": "user@example.com",
    "userID": "U123",
    "firstName": "John",
    "lastName": "Doe",
    "role": "TEACHER",
    "phone": "9876543210",
    "address: "Trichy",
    "dob": "17th Aug 2002",
   "gender"": "Male",
    "bloodGroup": "O+",
    "profileImage": "../../img.jpg"
  }
}
```

---

# **2. Login**

### **POST** `/api/auth/login`

**Access:** Public

### **Request Body**

```json
{
  "email": "user@example.com",
  "password": "Password@123"
}
```

### **Response**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "_id": "65a...",
    "email": "user@example.com",
    "userID": "U123",
    "firstName": "John",
    "lastName": "Doe",
    "role": "TEACHER",
    "phone": "9876543210",
    "address: "Trichy",
    "dob": "17th Aug 2002",
   "gender"": "Male",
    "bloodGroup": "O+",
    "profileImage": "../../img.jpg",
    "token"
  }
}
```

---

# **3. Logout**

### **POST** `/api/auth/logout`

**Access:** Public

### **Response**

```json
{
  "success": true,
  "message": "Logout successful"
}
```

---

# **Protected Routes (JWT Required)**

---

# **4. Get Profile**

### **GET** `/api/auth/profile`

**Access:**

* **ADMIN** – Can fetch any profile (requires `email`)
* **PARENT** – Own + child profiles
* **TEACHER** – Own profile
* **STUDENT** – Own profile

### **Request (Admin Example)**

```json
{
  "email": "student@example.com"
}
```

### **Response**

```json
{
  "success": true,
  "message": "Profile retrieved successfully",
  "data": {
    "email": "user@example.com",
    "userID": "U123",
    "firstName": "John",
    "lastName": "Doe",
    "role": "TEACHER",
    "phone": "9876543210",
    "address: "Trichy",
    "dob": "17th Aug 2002",
   "gender"": "Male",
    "bloodGroup": "O+",
    "profileImage": "../../img.jpg"
  }
}
```

---

# **5. Update Profile**

### **PUT** `/api/auth/profile`

**Access:**

* **ADMIN** – Can update ANY user
* **PARENT** – Can update self + children
* **TEACHER/STUDENT** – Only own profile

### **Request Body (Admin Example)**

```json
{
  "targetEmail": "student@example.com",
  "firstName": "Updated",
  "role": "PARENT",
  "isActive": true
}
```

### **Response**

```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": { ... }
}
```

---

# **6. Change Password**

### **PUT** `/api/auth/change-password`

**Access:**

* **ADMIN** – Can change password of any user
* **Others** – Must provide current password

### **Request (Admin Example)**

```json
{
  "targetEmail": "student@example.com",
  "newPassword": "NewPass@123"
}
```

### **Request (Non-Admin Example)**

```json
{
  "currentPassword": "OldPass@123",
  "newPassword": "NewPass@123"
}
```

### **Response**

```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

---

# **7. Delete User**

### **DELETE** `/api/auth/delete/:userId`

**Access:** `ADMIN ONLY`

### **Response**

```json
{
  "success": true,
  "message": "User and related data deleted successfully"
}
```

---

# **8. Get All Users**

### **GET** `/api/auth/users`

**Access:** `ADMIN ONLY`

### **Response**

```json
{
  "success": true,
  "message": "Users fetched successfully",
  "data": {
    "teachers": [],
    "studentsByClass": {},
    "parentsByClass": {}
  }
}
```

---

# **Access Control Summary**

| Route                | Admin   | Teacher  | Student  | Parent            | Public |
| -------------------- | ------- | -------- | -------- | ----------------- | ------ |
| POST /register       | ✔️      | ❌        | ❌        | ❌                 | ❌      |
| POST /login          | ✔️      | ✔️       | ✔️       | ✔️                | ✔️     |
| POST /logout         | ✔️      | ✔️       | ✔️       | ✔️                | ✔️     |
| GET /profile         | ✔️(any) | ✔️(self) | ✔️(self) | ✔️(self+children) | ❌      |
| PUT /profile         | ✔️(any) | ✔️(self) | ✔️(self) | ✔️(self+children) | ❌      |
| PUT /change-password | ✔️(any) | ✔️(self) | ✔️(self) | ✔️(self)          | ❌      |
| DELETE /delete/:id   | ✔️      | ❌        | ❌        | ❌                 | ❌      |
| GET /users           | ✔️      | ❌        | ❌        | ❌                 | ❌      |

---
