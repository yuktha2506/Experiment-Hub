const express = require("express");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const transporter = require("./mailer");
const db = require("./db");

const app = express();
const PORT = 3000;

// Create uploads directory
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}
app.use("/uploads", express.static(uploadsDir));

// Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname || ""));
  }
});
const upload = multer({ storage });

app.use(express.json());
app.use(express.static(__dirname));

// Create experiments table if not exists (MySQL)
const createExperimentsTable = () => {
  const sql = `
    CREATE TABLE IF NOT EXISTS experiments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      subject VARCHAR(50),
      level VARCHAR(50),
      \`class\` VARCHAR(50),
      \`procedure\` TEXT,
      video_link TEXT,
      file_path VARCHAR(500),
      file_name VARCHAR(255),
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;
  db.query(sql, (err) => {
    if (err) console.error("Experiments table init error:", err);
    else console.log("Experiments table ready");
  });
};
createExperimentsTable();

// Create users table if not exists (for first-time setup)
const createUsersTable = () => {
  const sql = `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role ENUM('student','staff') NOT NULL DEFAULT 'student',
      grade VARCHAR(50) NULL,
      staff_id VARCHAR(100) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;
  db.query(sql, (err) => {
    if (err) console.error("Users table init error:", err);
    else console.log("Users table ready");
  });
};
createUsersTable();

// Create password_reset_otp table
const createOtpTable = () => {
  const sql = `
    CREATE TABLE IF NOT EXISTS password_reset_otp (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      otp VARCHAR(10) NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;
  db.query(sql, (err) => {
    if (err) console.error("OTP table init error:", err);
    else console.log("OTP table ready");
  });
};
createOtpTable();

// Generate 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}



/* ================= FORGOT PASSWORD (SEND OTP) ================= */
app.post("/api/forgot-password", (req, res) => {
  const { email } = req.body;
  if (!email || !String(email).trim()) {
    return res.json({ success: false, message: "Email is required" });
  }
  const emailTrim = String(email).trim().toLowerCase();
  db.query("SELECT id, email FROM users WHERE email = ?", [emailTrim], (err, rows) => {
    if (err) {
      console.error("❌ FORGOT-PASSWORD DB ERROR:", err);
      return res.json({ success: false, message: "Server error" });
    }
    if (!rows || rows.length === 0) {
      return res.json({ success: false, message: "No account found with this email" });
    }
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    db.query("DELETE FROM password_reset_otp WHERE email = ?", [emailTrim], () => {
      db.query(
        "INSERT INTO password_reset_otp (email, otp, expires_at) VALUES (?, ?, ?)",
        [emailTrim, otp, expiresAt],
        (err2) => {
          if (err2) {
            console.error("❌ OTP INSERT ERROR:", err2);
            return res.json({ success: false, message: "Failed to generate OTP" });
          }
          console.log("📧 OTP for", emailTrim, ":", otp, "(expires in 10 min)");
          const mailOptions = {
            from: "experimenthub974@gmail.com",
            to: emailTrim,
            subject: "Password Reset OTP - ExperimentHub",
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #7c5cff, #23d5ab); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                  <h1 style="color: white; margin: 0;">ExperimentHub</h1>
                </div>
                <div style="background: white; padding: 30px; border: 1px solid #eee; border-top: none; border-radius: 0 0 10px 10px;">
                  <h2 style="color: #333;">Password Reset</h2>
                  <p style="color: #666;">Your OTP is: <strong style="font-size: 24px; letter-spacing: 4px;">${otp}</strong></p>
                  <p style="color: #999; font-size: 12px;">Valid for 10 minutes. If you didn't request this, ignore this email.</p>
                </div>
              </div>
            `
          };
          transporter.sendMail(mailOptions, (emailErr) => {
            if (emailErr) {
              console.error("FULL EMAIL ERROR:", emailErr); // Add this line
              console.warn("⚠️ Email send failed...");
              return res.json({ success: true, message: "OTP generated. Check server console..." });
            }
            res.json({ success: true, message: "OTP sent to your email" });
          });
        }
      );
    });
  });
});

/* ================= VERIFY OTP ================= */
app.post("/api/verify-otp", (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.json({ success: false, message: "Email and OTP required" });
  }
  const emailTrim = String(email).trim().toLowerCase();
  const now = new Date();
  db.query(
    "SELECT id FROM password_reset_otp WHERE email = ? AND otp = ? AND expires_at > NOW()",
    [emailTrim, String(otp).trim(), now],
    (err, rows) => {
      if (err) return res.json({ success: false, message: "Server error" });
      if (!rows || rows.length === 0) {
        return res.json({ success: false, message: "Invalid or expired OTP" });
      }
      res.json({ success: true, message: "OTP verified" });
    }
  );
});

/* ================= RESET PASSWORD ================= */
app.post("/api/reset-password", async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) {
    return res.json({ success: false, message: "Email, OTP and new password required" });
  }
  const emailTrim = String(email).trim().toLowerCase();
  const otpTrim = String(otp).trim();
  const now = new Date();
  db.query(
    "SELECT id FROM password_reset_otp WHERE email = ? AND otp = ? AND expires_at > NOW()",
    [emailTrim, otpTrim, now],
    async (err, rows) => {
      if (err) return res.json({ success: false, message: "Server error" });
      if (!rows || rows.length === 0) {
        return res.json({ success: false, message: "Invalid or expired OTP" });
      }
      try {
        const hashed = await bcrypt.hash(newPassword, 10);
        db.query("UPDATE users SET password = ? WHERE email = ?", [hashed, emailTrim], (err2) => {
          if (err2) return res.json({ success: false, message: "Failed to update password" });
          db.query("DELETE FROM password_reset_otp WHERE email = ?", [emailTrim], () => {});
          res.json({ success: true, message: "Password reset successful" });
        });
      } catch (e) {
        res.json({ success: false, message: "Server error" });
      }
    }
  );
});

/* ================= SIGNUP ================= */
app.post("/api/signup", async (req, res) => {
  const { name, email, password, role, grade, staff_id } = req.body;

  console.log("📥 SIGNUP REQUEST:", req.body);

  if (!name || !email || !password || !role) {
    return res.json({ success: false, message: "Missing fields" });
  }

  if (role === "student" && !grade) {
    return res.json({ success: false, message: "Grade required" });
  }

  if (role === "staff" && !staff_id) {
    return res.json({ success: false, message: "Staff ID required" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    // Check existing user
    db.query(
      "SELECT id FROM users WHERE email = ?",
      [email],
      (err, rows) => {
        if (err) {
          console.error("❌ SELECT ERROR:", err);
          return res.json({ success: false, message: "Database error" });
        }

        if (rows.length > 0) {
          return res.json({ success: false, message: "Email already exists" });
        }

        // Insert user
        const sql = `
          INSERT INTO users (name, email, password, role, grade, staff_id)
          VALUES (?, ?, ?, ?, ?, ?)
        `;

        const values = [
          name,
          email,
          hashedPassword,
          role,
          role === "student" ? grade : null,
          role === "staff" ? staff_id : null
        ];

        db.query(sql, values, (err, result) => {
          if (err) {
            console.error("❌ INSERT ERROR:", err);
            return res.json({ success: false, message: "Signup failed" });
          }

          console.log("✅ USER INSERTED ID:", result.insertId);
          res.json({ success: true });
        });
      }
    );
  } catch (e) {
    console.error("❌ SIGNUP CRASH:", e);
    res.json({ success: false, message: "Server error" });
  }
});

/* ================= LOGIN ================= */
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  console.log("📥 LOGIN REQUEST:", email);

  if (!email || !password) {
    return res.json({ success: false, message: "Missing credentials" });
  }

  db.query(
    "SELECT * FROM users WHERE email = ?",
    [email],
    async (err, rows) => {
      if (err) {
        console.error("❌ LOGIN DB ERROR:", err);
        return res.json({ success: false, message: "Database error" });
      }

      if (rows.length === 0) {
        return res.json({ success: false, message: "User not found" });
      }

      const user = rows[0];
      const match = await bcrypt.compare(password, user.password);

      if (!match) {
        return res.json({ success: false, message: "Wrong password" });
      }

      const redirect =
        user.role === "staff"
          ? "dashboard.html"
          : "student-dashboard.html";

      res.json({
        success: true,
        role: user.role,
        redirect
      });
    }
  );
});

/* ================= DELETE EXPERIMENT ================= */
app.delete("/api/experiments/:id", (req, res) => {
  const experimentId = req.params.id;

  db.query("SELECT file_path FROM experiments WHERE id = ?", [experimentId], (err, rows) => {
    if (err) return res.json({ success: false, message: "Database error" });
    
    if (rows.length > 0 && rows[0].file_path) {
      // Use the stored path directly since multer usually provides a full path
      const fullPath = rows[0].file_path; 
      if (fs.existsSync(fullPath)) {
        try {
          fs.unlinkSync(fullPath); 
        } catch (unlinkErr) {
          console.error("File deletion error:", unlinkErr);
        }
      }
    }

    db.query("DELETE FROM experiments WHERE id = ?", [experimentId], (err2, result) => {
      if (err2) return res.json({ success: false, message: "Failed to delete record" });
      res.json({ success: true, message: "Experiment and associated file deleted" });
    });
  });
});

/* ================= EXPERIMENTS (GET) ================= */
app.get("/api/experiments", (req, res) => {
  db.query(
    "SELECT id, user_id, title, description, subject, level, `class`, `procedure` AS procedureJson, video_link, file_path, file_name, uploaded_at FROM experiments ORDER BY uploaded_at DESC",
    [],
    (err, rows) => {
      if (err) {
        console.error("❌ EXPERIMENTS FETCH ERROR:", err);
        return res.json([]);
      }
      const out = (rows || []).map((r) => {
        let procedureArray = [];
        if (r.procedureJson) {
          try {
            procedureArray = typeof r.procedureJson === "string" ? JSON.parse(r.procedureJson) : r.procedureJson;
          } catch (e) {
            procedureArray = [];
          }
        }
        return {
          id: r.id,
          title: r.title,
          description: r.description || "",
          subject: r.subject || "science",
          level: r.level || "easy",
          class: r.class || "4-6",
          detailedProc: procedureArray,
          videoLink: r.video_link || "",
          video_link: r.video_link,
          file_name: r.file_name || "",
          uploaded_at: r.uploaded_at,
          uploadDate: r.uploaded_at
        };
      });
      res.json(out);
    }
  );
});

/* ================= UPLOAD EXPERIMENT ================= */
app.post("/api/upload", upload.single("file"), (req, res) => {
  const { title, description, subject, level, class: className, procedure, videoLink } = req.body || {};
  if (!title || !title.trim()) {
    return res.json({ success: false, error: "Title is required" });
  }
  let procedureArray = [];
  if (procedure) {
    try {
      procedureArray = typeof procedure === "string" ? JSON.parse(procedure) : procedure;
    } catch (e) {
      procedureArray = Array.isArray(procedure) ? procedure : [procedure];
    }
  }
  const procedureJson = JSON.stringify(procedureArray);
  const filePath = req.file ? req.file.path : null;
  const fileName = req.file ? req.file.originalname : null;
  const sql = "INSERT INTO experiments (user_id, title, description, subject, level, `class`, `procedure`, video_link, file_path, file_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
  const values = [
    1,
    title.trim(),
    description ? description.trim() : "",
    subject || null,
    level || null,
    className || null,
    procedureJson,
    videoLink ? videoLink.trim() : null,
    filePath,
    fileName
  ];
  db.query(sql, values, (err, result) => {
    if (err) {
      console.error("❌ UPLOAD INSERT ERROR:", err);
      return res.json({ success: false, error: "Upload failed" });
    }
    res.json({ success: true });
  });
});

/* ================= SERVER ================= */
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
