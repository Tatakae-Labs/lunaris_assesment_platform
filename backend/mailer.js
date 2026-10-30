/**
 * Lunaris NodeMailer Service Configuration
 * 
 * Reads all SMTP secrets directly from the project root .env file.
 * Use this module to send emails from any Node.js process, script, or cloud function.
 */

const nodemailer = require("nodemailer");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
const smtpPort = parseInt(process.env.SMTP_PORT || "587", 10);
const smtpUser = process.env.SMTP_USER || "";
const smtpPass = process.env.SMTP_PASSWORD || "";
const smtpFromEmail = process.env.SMTP_FROM_EMAIL || "notifications@lunaris.com";
const smtpFromName = process.env.SMTP_FROM_NAME || "Lunaris Assessment Platform";
const smtpSecure = process.env.SMTP_SSL === "true" || smtpPort === 465;

// Create reusable transporter object using standard SMTP transport
const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpSecure,
  auth: (smtpUser && smtpPass && smtpPass !== "your_smtp_app_password_here") ? {
    user: smtpUser,
    pass: smtpPass
  } : undefined,
  tls: {
    rejectUnauthorized: false
  }
});

/**
 * Send an email using NodeMailer
 * @param {Object} options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML body
 * @param {string} [options.text] - Plain text body fallback
 */
async function sendMail({ to, subject, html, text }) {
  if (!smtpUser || !smtpPass || smtpPass === "your_smtp_app_password_here") {
    console.log(`[NodeMailer DEV MODE] Simulated email to ${to}: ${subject}`);
    return {
      success: true,
      simulated: true,
      message: `Email to ${to} simulated (configure SMTP_USER and SMTP_PASSWORD in .env for live dispatch)`
    };
  }

  try {
    const info = await transporter.sendMail({
      from: `"${smtpFromName}" <${smtpFromEmail}>`,
      to,
      subject,
      text: text || html.replace(/<[^>]*>/g, ""),
      html
    });
    console.log(`[NodeMailer] Message sent: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[NodeMailer Error] Failed to send to ${to}:`, err);
    throw err;
  }
}

module.exports = {
  transporter,
  sendMail
};

