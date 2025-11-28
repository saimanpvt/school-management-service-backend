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
## **1. Register User**

### **POST** `/api/auth/register`

**Access:** `ADMIN only`

### **Request Body**

```json
{
  "email": "user@example.com",
  "userID": "U123",
  "password": "Pass@123",
  "firstName": "John",
  "lastName": "Doe",
  "role": "TEACHER",
  "phone": "9876543210",
  "address": "Chennai",
  "dob": "2000-01-01",
  "gender": "Male",
  "bloodGroup": "O+",
  "profileImage": "https://img.com/pic.jpg"
}
```

---

### **Success Response**

```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "_id": "65a12345",
    "email": "user@example.com",
    "userID": "U123",
    "firstName": "John",
    "lastName": "Doe",
    "role": "TEACHER",
    "phone": "9876543210",
    "address": "Chennai",
    "dob": "2000-01-01",
    "gender": "Male",
    "bloodGroup": "O+",
    "profileImage": "https://img.com/pic.jpg"
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
  "password": "Pass@123"
}
```

---

### **Success Response **

> **Includes JWT token**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "_id": "65a12345",
    "email": "user@example.com",
    "userID": "U123",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "9876543210",
    "address": "Chennai",
    "dob": "2000-01-01",
    "gender": "Male",
    "bloodGroup": "O+",
    "role": "TEACHER",
    "profileImage": "https://img.com/pic.jpg",
    "token": "jwt-token-here"
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


---

# **4. GET USER PROFILE – API Documentation**

## **Endpoint**

`POST /api/user/get-profile`

## **Description**

Fetches the profile details of a user.
The data returned depends on the role of the logged-in user.

---

# **Request Headers**

| Key             | Value                |
| --------------- | -------------------- |
| `Authorization` | `Bearer <JWT Token>` |

---

# **Request Body**

| Field   | Type   | Required                                                       | Description                                         |
| ------- | ------ | -------------------------------------------------------------- | --------------------------------------------------- |
| `email` | String | *Admin: Yes*, *Parent: Optional*, *Teacher: No*, *Student: No* | Email of the user whose profile needs to be fetched |

---

# **Role-wise Behaviour**

## **1. ADMIN**

* **Must pass `email`** in request body.
* Can fetch **any user's profile**.
* If the user is not found → `404 Not Found`.

### Example Request (Admin)

```json
{
  "email": "student1@example.com"
}
```

---

## **2. PARENT**

* **If `email` is not provided or email == parent's own email → return own profile**.
* If an email is provided:

  * Parent can fetch **ONLY their children's profiles**.
  * If requested email is not the child's email → `403 Access denied`.

### Example Request (Parent accessing child)

```json
{
  "email": "child1@example.com"
}
```

---

## **3. TEACHER**

* No email required.
* Can view **only their own profile**.

### Example Request (Teacher)

```json
{}
```

---

## **4. STUDENT**

* No email required.
* Can view **only their own profile**.

### Example Request (Student)

```json
{}
```

---

# **Success Response (200 – Profile retrieved successfully)**

Response format (same for all roles):

```json
{
  "success": true,
  "message": "Profile retrieved successfully",
  "data": {
    "email": "user@example.com",
    "userID": "USR123456",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "9876543210",
    "address": "Sample address",
    "dob": "2001-05-22",
    "gender": "Male",
    "bloodGroup": "O+",
    "role": "STUDENT",
    "profileImage": "https://.../profile.jpg"
  }
}
```

---

# **Error Responses**

### **400 – Mandatory parameter missing (Admin only)**

```json
{
  "success": false,
  "message": "Mandatory parameter missing"
}
```

### **404 – User not found (Admin only)**

```json
{
  "success": false,
  "message": "User not found"
}
```

### **403 – Parent unauthorized to access another profile**

```json
{
  "success": false,
  "message": "Access denied to this profile"
}
```

### **403 – Other roles unauthorized**

```json
{
  "success": false,
  "message": "Access denied"
}
```

---
---

# **5. UPDATE USER PROFILE – API Documentation**

## **Endpoint**

`PUT /api/user/update-profile`

## **Description**

Updates the profile details of a user.
The allowed scope depends on the role of the logged-in user.

---

# **Request Headers**

| Key             | Value                |
| --------------- | -------------------- |
| `Authorization` | `Bearer <JWT Token>` |

---

# **Request Body**

| Field          | Type    | Required?                                             | Who Can Use?                           | Description                   |
| -------------- | ------- | ----------------------------------------------------- | -------------------------------------- | ----------------------------- |
| `targetEmail`  | String  | **Admin: Yes**; Parent: Optional; Teacher/Student: No | Defines whose profile is being updated |                               |
| `firstName`    | String  | Optional                                              | All Roles                              | Updatable fields for everyone |
| `lastName`     | String  | Optional                                              | All Roles                              | —                             |
| `phone`        | String  | Optional                                              | All Roles                              | —                             |
| `address`      | String  | Optional                                              | All Roles                              | —                             |
| `dob`          | Date    | Optional                                              | All Roles                              | —                             |
| `gender`       | String  | Optional                                              | All Roles                              | —                             |
| `bloodGroup`   | String  | Optional                                              | All Roles                              | —                             |
| `profileImage` | String  | Optional                                              | All Roles                              | —                             |
| `role`         | String  | Optional                                              | Admin only                             | New role for the target user  |
| `email`        | String  | Optional                                              | Admin only                             | To change the user's email    |
| `userID`       | String  | Optional                                              | Admin only                             | Update unique ID              |
| `isActive`     | Boolean | Optional                                              | Admin only                             | Activate/deactivate user      |

---

# **Role-wise Behaviour**

---

## **1. ADMIN**

* **Must provide `targetEmail`** to identify which user to update.
* Can update:

  * All personal fields (name, phone, address, etc.)
  * **Email**
  * **Role (validated)**
  * **isActive**
  * **userID**

### Example Request (Admin)

```json
{
  "targetEmail": "student1@example.com",
  "firstName": "Updated",
  "role": "STUDENT",
  "isActive": false
}
```

If the target user does not exist → `404 Target user not found`.

---

## **2. PARENT**

* If **targetEmail not provided** → updates **own profile**.
* If `targetEmail == parent.email` → updates **own profile**.
* If `targetEmail` is a **child's email** → allowed.
* If trying to update anyone else → **403 Forbidden**

### Example Request (Parent updating child)

```json
{
  "targetEmail": "child1@example.com",
  "address": "New address"
}
```

---

## **3. TEACHER**

* Can update **only their own profile**.
* If `targetEmail` is provided and it does NOT match own email → **403 Forbidden**

### Example Request (Teacher)

```json
{
  "phone": "9876543210"
}
```

---

## **4. STUDENT**

* Can update **only own profile**.
* Same restriction as teacher.

### Example Request (Student)

```json
{
  "profileImage": "https://image-link"
}
```

---

# **Allowed Fields Summary**

| Field        | Everyone | Admin Only |
| ------------ | -------- | ---------- |
| firstName    | ✔        | ✔          |
| lastName     | ✔        | ✔          |
| phone        | ✔        | ✔          |
| address      | ✔        | ✔          |
| dob          | ✔        | ✔          |
| gender       | ✔        | ✔          |
| bloodGroup   | ✔        | ✔          |
| profileImage | ✔        | ✔          |
| role         | ❌        | ✔          |
| email        | ❌        | ✔          |
| isActive     | ❌        | ✔          |
| userID       | ❌        | ✔          |

---

# **Success Response**

```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "email": "updated@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "userID": "USR200123",
    "phone": "9876543210",
    "address": "Sample Address",
    "dob": "2001-05-22",
    "gender": "Male",
    "bloodGroup": "O+",
    "role": "STUDENT",
    "isActive": true,
    "profileImage": "https://image.jpg"
  }
}
```

---

# **Error Responses**

### **400 – Admin missing targetEmail**

```json
{
  "success": false,
  "message": "targetEmail is required for admin"
}
```

### **404 – Target user not found (Admin only)**

```json
{
  "success": false,
  "message": "Target user not found"
}
```

### **403 – Parent updating someone unrelated**

```json
{
  "success": false,
  "message": "You can only update your own or your children’s profiles"
}
```

### **403 – Teacher/Student attempting to update others**

```json
{
  "success": false,
  "message": "You can only update your own profile"
}
```

---

# **6. CHANGE PASSWORD – API Documentation**

## **Endpoint**

`PUT /api/user/change-password`

## **Description**

Allows a user to change their password.
Permissions differ based on user role:

* **Admin** → Can change *any* user’s password
* **Parent, Teacher, Student** → Can change *only their own* password

---

# **Request Headers**

| Key             | Value                |
| --------------- | -------------------- |
| `Authorization` | `Bearer <JWT Token>` |

---

# **Request Body Requirements**

| Field             | Admin        | Parent       | Teacher      | Student      | Description                                    |
| ----------------- | ------------ | ------------ | ------------ | ------------ | ---------------------------------------------- |
| `targetEmail`     | **Required** | Not allowed  | Not allowed  | Not allowed  | Email of user whose password admin is updating |
| `currentPassword` | Not required | **Required** | **Required** | **Required** | Current password for verification              |
| `newPassword`     | **Required** | **Required** | **Required** | **Required** | New password (must pass validation rules)      |

---

# **Role-Based Behavior**

---

## **1. ADMIN**

* Does **NOT** need currentPassword
* Must provide:

  * `targetEmail`
  * `newPassword`
* Can change password for **any user**

### Example Request (Admin)

```json
{
  "targetEmail": "student1@example.com",
  "newPassword": "NewPassword@2024"
}
```

If target user not found → **404 Target user not found**

---

## **2. PARENT / TEACHER / STUDENT**

* Must provide:

  * `currentPassword`
  * `newPassword`
* Can update **only their own password**
* System verifies current password before applying change

### Example Request (Non-Admin)

```json
{
  "currentPassword": "OldPass@123",
  "newPassword": "NewPass@2024"
}
```

If current password is wrong → **400 Current password is incorrect**

---

# **Password Validation Rules**

Validation is applied through:

```
validatePassword(newPassword, "register")
```

This ensures password meets the same requirements as user registration (strong password rules).

If validation fails:

```json
{
  "success": false,
  "message": "New password validation failed",
  "errors": { ... }
}
```

---

# **Success Response**

```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

---

# **Error Responses**

### **400 – Missing fields**

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {
    "currentPassword": "Required",
    "newPassword": "Required"
  }
}
```

### **400 – Wrong current password**

```json
{
  "success": false,
  "message": "Current password is incorrect"
}
```

### **400 – Weak new password**

```json
{
  "success": false,
  "message": "New password validation failed",
  "errors": {
    "newPassword": "Password must contain ..."
  }
}
```

### **404 – Admin: target user not found**

```json
{
  "success": false,
  "message": "Target user not found"
}
```

---
---

# **7. DELETE USER – API Documentation**

## **Endpoint**

`DELETE /api/user/:userId`

## **Description**

Deletes a user and all associated records depending on their role (**Student, Parent, Teacher**).
This is a **high-impact, cascading delete** handled **exclusively by Admin**.

---

# **Permissions**

| Role      | Allowed                                         |
| --------- | ----------------------------------------------- |
| **Admin** | ✅ Yes – can delete any user (except themselves) |
| Parent    | ❌ No                                            |
| Teacher   | ❌ No                                            |
| Student   | ❌ No                                            |

---

# **Request Headers**

| Key             | Value                      |
| --------------- | -------------------------- |
| `Authorization` | `Bearer <Admin JWT Token>` |

---

# **Path Parameters**

| Param    | Type             | Description              |
| -------- | ---------------- | ------------------------ |
| `userId` | String (MongoID) | ID of the user to delete |

---

# **Admin Restrictions**

| Rule                                  | Description                 |
| ------------------------------------- | --------------------------- |
| Cannot delete themselves              | Prevents accidental lockout |
| Can delete any Student/Parent/Teacher | Yes                         |
| Cascading deletes applied             | Yes                         |

---

# **Cascade Delete Logic (Very Important)**

When a user is deleted, the system automatically handles linked records.

---

## **1. If the user is a STUDENT**

### Steps performed:

1. Remove student record from **Student** collection
2. Remove student ID from **Parent.childrenId[]**
3. Find parents who had this child
4. After removal → If the parent has **no children left**, then:

   * Delete Parent’s **User** record
   * Delete Parent’s **Parent** document

### Example impact:

* If a parent had 2 children and 1 is deleted → parent remains
* If parent had only 1 child → parent account is **completely deleted**

---

## **2. If the user is a TEACHER**

### Steps performed:

1. Delete Teacher record
2. Set `teacherId = null` in all courses taught by that teacher
   (course remains but becomes “unassigned”)

---

## **3. If the user is a PARENT**

### Steps performed:

1. Delete parent record
2. (No impact on students—students remain intact)

---

## **4. Delete the BASE USER record**

After role-specific cleanups → the user’s main User document is deleted.

---

# **Response – Success**

**200 OK**

```json
{
  "success": true,
  "message": "User and related data deleted successfully"
}
```

---

# **Error Responses**

### **403 – Forbidden (non-admin user)**

```json
{
  "success": false,
  "message": "Only Admin can delete users"
}
```

---

### **400 – Admin tries to delete themselves**

```json
{
  "success": false,
  "message": "Admin cannot delete themselves"
}
```

---

### **404 – User not found**

```json
{
  "success": false,
  "message": "User not found"
}
```

---

# **Example Requests**

### **Delete Student**

`DELETE /api/user/65df83f98b8e2b6774b9e55a`

→ Deletes:

* Student
* Student-Parent link
* Parents with no remaining children

---

### **Delete Teacher**

`DELETE /api/user/65df83f98b8e2b6774b9e55a`

→ Deletes Teacher record
→ Sets teacherId = null in all assigned courses

---

### **Delete Parent**

`DELETE /api/user/65df83f98b8e2b6774b9e55a`

→ Deletes Parent record only
→ Students remain unchanged

---
---

# **8. GET ALL USERS – API Documentation**

## **Endpoint**

`GET /api/user/all`

## **Description**

Returns a complete list of **Teachers**, and grouped lists of **Students** and **Parents**, grouped by class.
This API is designed **for Admin dashboard usage only**.

---

# **Permissions**

| Role      | Allowed |
| --------- | ------- |
| **Admin** | ✅ Yes   |
| Parent    | ❌ No    |
| Teacher   | ❌ No    |
| Student   | ❌ No    |

---

# **Request Headers**

| Key             | Value                      |
| --------------- | -------------------------- |
| `Authorization` | `Bearer <Admin JWT Token>` |

---

# **Response Structure**

### **200 OK**

```json
{
  "success": true,
  "data": {
    "teachers": [ ... ],
    "studentsByClass": {
      "Class 1": [ ... ],
      "Class 2": [ ... ]
    },
    "parentsByClass": {
      "Class 1": [ ... ],
      "Class 2": [ ... ]
    }
  }
}
```

---

# **Detailed Response Documentation**

## **1. `teachers` (Flat list)**

All teachers with basic details.

### **Teacher Object**

```json
{
  "_id": "ObjectId",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@school.com",
  "phone": "9876543210",
  "role": 3,
  "isActive": true,
  "profileImage": "string",
  "address": "string",
  "dob": "YYYY-MM-DD",
  "gender": "Male/Female/Other",
  "bloodGroup": "A+/O-/etc"
}
```

(Password and __v excluded)

---

## **2. `studentsByClass` (Grouped)**

Students grouped based on their class.

### **Structure**

```json
{
  "Class 1": [
    {
      "studentId": "ObjectId",
      "firstName": "Aman",
      "lastName": "Singh",
      "email": "aman@school.com",
      "phone": "9999999999"
    }
  ],
  "Class 2": [ ... ]
}
```

---

## **3. `parentsByClass` (Grouped via children)**

Parents grouped by the classes of their children.
**Duplicate parents for the same class are removed.**

### **Structure**

```json
{
  "Class 1": [
    {
      "parentId": "ObjectId",
      "firstName": "Rita",
      "lastName": "Sharma",
      "email": "rita@school.com",
      "phone": "8888888888"
    }
  ],
  "Class 2": [ ... ]
}
```

---

# **Example Successful Response**

```json
{
  "success": true,
  "data": {
    "teachers": [
      {
        "_id": "67abca12456abf01e23cd345",
        "firstName": "Rohit",
        "lastName": "Verma",
        "email": "rohit@school.com",
        "phone": "9876543210"
      }
    ],
    "studentsByClass": {
      "Class 5": [
        {
          "studentId": "67abc123e45fcd6789012345",
          "firstName": "Ankit",
          "lastName": "Mishra",
          "email": "ankit@school.com",
          "phone": "9090909090"
        }
      ]
    },
    "parentsByClass": {
      "Class 5": [
        {
          "parentId": "67abc999aa55cc66dd772233",
          "firstName": "Suman",
          "lastName": "Raj",
          "email": "suman@school.com",
          "phone": "8080808080"
        }
      ]
    }
  }
}
```

---

# **Error Responses**

### **500 – Server Error**

```json
{
  "success": false,
  "message": "Server error"
}
```

---

# **Notes**

* Students & parents are grouped **by className**, not `classCode` or `_id`.
* If a child has no class assigned → grouped under `"Unknown Class"`.
* Parents are deduplicated inside each class group.
* Teachers are returned as a **flat list**.

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