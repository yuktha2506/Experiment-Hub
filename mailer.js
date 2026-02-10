const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "experimenthub974@gmail.com",
    pass: "ekcw vixq xtzz itco"
  }
});

module.exports = transporter;
