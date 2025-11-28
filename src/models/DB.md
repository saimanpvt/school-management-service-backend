User ───1:1───> Teacher
User ───1:1───> Student
User ───1:1───> Parent

Parent ───1:N───> Student

Class ───1:N───> Student
Class ───1:N───> Course
Class ───1:N───> Exam

Teacher(User) ───1:N───> Course

Course ───1:N───> Exam

Exam ───1:N───> Mark
Student ───1:N───> Mark
