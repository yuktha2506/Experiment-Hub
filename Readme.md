# 🧪 ExperimentHub – Student & Staff Experiment Management System

ExperimentHub is a full-stack web application designed to help **students explore experiment ideas** and **staff manage, review, and guide submissions**.  
The platform supports **role-based authentication**, **OTP-based password recovery**, and an **interactive experiment dashboard**.

---

## ✨ Features

### 👨‍🎓 Student Features
- Student registration and login
- Browse experiment ideas (Science & Maths)
- Filter by subject, class, and difficulty
- View detailed experiment procedures
- Watch experiment demonstration videos
- Copy experiment content for assignments

### 👩‍🏫 Staff Features
- Staff registration and login
- Secure authentication
- Upload and manage experiments
- Review student submissions

### 🔐 Authentication & Security
- Password hashing using bcrypt
- OTP-based password recovery via email
- Role-based user management (Student / Staff)

---

## 🛠️ Tech Stack

### Frontend
- HTML5
- CSS3 (Glassmorphism UI)
- JavaScript (ES6)

### Backend
- Node.js
- Express.js
- MySQL
- Multer (file uploads)
- Nodemailer (OTP emails)

---

## 📁 Project Structure

experimenthub/
│
├── server.js # Express backend
├── db.js # MySQL connection
├── mailer.js # Email configuration
├── package.json
│
├── index.html # Portal selection
│
├── student-login.html
├── student-signup.html
├── student-dashboard.html
│
├── staff-login.html
├── staff-signup.html
│
├── forgotten-password.html # OTP password recovery
│
├── styles.css # Global styles
├── uploads/ # Uploaded experiment files
└── README.md

## 🚀 How to Run the Project

Follow these steps to run **ExperimentHub** on your local system.

---

### 1️⃣ Prerequisites

Make sure you have the following installed:
- **Node.js** (v16 or later)
- **MySQL Server**
- A modern web browser (Chrome recommended)

---

### 2️⃣ Database Setup

1. Open MySQL and create a database:
   ```sql
   CREATE DATABASE experimenthub;
2. Update database credentials in db.js:

    host: "localhost",
    user: "root",
    password: "your_mysql_password",
    database: "experimenthub"
3. Install Dependencies

    Open terminal in the project folder and run:
    npm install
4. Start the Server

    Run the backend server using:
    node server.js
    You should see:
    MySQL connected
    Users table ready
    Experiments table ready
    OTP table ready
    Server running on port 3000    
5. Open the Application

    Open your browser and go to:

    http://localhost:3000/index.html    
    