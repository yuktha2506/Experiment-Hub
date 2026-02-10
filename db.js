const mysql = require("mysql2");

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "123456",   // your MySQL password
  database: "experimenthub"
});

db.connect(err => {
  if (err) {
    console.error("DB error:", err);
  } else {
    console.log("MySQL connected");
  }
});

module.exports = db;
