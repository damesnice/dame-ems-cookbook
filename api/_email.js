import nodemailer from "nodemailer";

function isConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function sendOTPEmail(to, code) {
  if (!isConfigured()) {
    throw new Error("Email sign-in codes aren't set up yet — SMTP_HOST/SMTP_USER/SMTP_PASS are missing.");
  }
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: "Your Dame and Ems' Cookbook sign-in code",
    text: `Your sign-in code is ${code}. It expires in 10 minutes.`,
  });
}
