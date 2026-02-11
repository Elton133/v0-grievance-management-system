import nodemailer from "nodemailer";
import { sendEmailViaResend, isResendConfigured } from "./resendService";

// Email service configuration
const createTransporter = () => {
  // For Gmail, you need to use an App Password, not your regular password
  // Generate one at: https://myaccount.google.com/apppasswords
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "587");
  const isSecure = port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  
  // Validate configuration
  if (!user || !pass) {
    throw new Error("SMTP_USER and SMTP_PASS environment variables are required");
  }
  
  // Gmail-specific configuration
  if (host.includes("gmail.com")) {
    return nodemailer.createTransport({
      service: "gmail",
      auth: {
        user,
        pass, // App Password required for Gmail
      },
    });
  }
  
  // Generic SMTP configuration
  return nodemailer.createTransport({
    host,
    port,
    secure: isSecure, // true for 465, false for other ports
    auth: {
      user,
      pass,
    },
  });
};

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export const sendEmail = async ({ to, subject, html }: EmailOptions): Promise<boolean> => {
  const startTime = Date.now();
  
  // Prefer Resend if configured
  if (isResendConfigured()) {
    console.log(`[Email Service] Using Resend to send email to ${to}`);
    const success = await sendEmailViaResend(to, subject, html);
    if (success) {
      const duration = Date.now() - startTime;
      console.log(`[Email Service] ✅ Email sent via Resend (${duration}ms)`);
      return true;
    }
    // Fall back to SMTP if Resend fails
    console.log(`[Email Service] ⚠️ Resend failed, falling back to SMTP`);
  }
  
  try {
    // Check if SMTP is configured
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
    const smtpPort = process.env.SMTP_PORT || "587";
    
    if (!smtpUser || !smtpPass) {
      console.error(`[Email Service] ❌ Neither Resend nor SMTP configured. Cannot send email to ${to}`);
      console.error(`[Email Service] Configure one of the following:`);
      console.error(`   Option 1 (Recommended): Set RESEND_API_KEY and RESEND_FROM_EMAIL`);
      console.error(`   Option 2: Set SMTP_USER and SMTP_PASS`);
      return false; // Return false in production to indicate failure
    }

    console.log(`[Email Service] 📧 Attempting to send email...`);
    console.log(`[Email Service]   To: ${to}`);
    console.log(`[Email Service]   Subject: ${subject}`);
    console.log(`[Email Service]   SMTP: ${smtpHost}:${smtpPort}`);
    console.log(`[Email Service]   From: ${smtpUser}`);

    const transporter = createTransporter();
    
    // Verify connection with timeout (optional - skip if it causes issues)
    const skipVerification = process.env.SKIP_SMTP_VERIFY === "true";
    
    if (!skipVerification) {
      console.log(`[Email Service] 🔍 Verifying SMTP connection...`);
      try {
        await Promise.race([
          transporter.verify(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error("SMTP verification timeout after 10 seconds")), 10000)
          )
        ]);
        console.log(`[Email Service] ✅ SMTP connection verified`);
      } catch (verifyError: any) {
        console.error(`[Email Service] ⚠️ SMTP verification failed:`, verifyError.message);
        console.error(`[Email Service] ⚠️ Continuing anyway - will attempt to send email...`);
        if (verifyError.code === "EAUTH") {
          console.error(`[Email Service] ❌ Authentication issue detected. Check your SMTP credentials:`);
          console.error(`   - Make sure you're using an App Password for Gmail, not your regular password`);
          console.error(`   - Generate App Password at: https://myaccount.google.com/apppasswords`);
          console.error(`   - Enable 2-Step Verification first if you haven't`);
          console.error(`   - App Password should be 16 characters with NO spaces`);
        } else if (verifyError.code === "ECONNECTION" || verifyError.code === "ETIMEDOUT") {
          console.error(`[Email Service] ⚠️ Connection issue detected. Check:`);
          console.error(`   - SMTP_HOST: ${smtpHost}`);
          console.error(`   - SMTP_PORT: ${smtpPort}`);
          console.error(`   - Network connectivity`);
        }
        // Don't throw - continue to try sending anyway
      }
    } else {
      console.log(`[Email Service] ⚠️ Skipping SMTP verification (SKIP_SMTP_VERIFY=true)`);
    }

    const fromAddress = process.env.SMTP_FROM || `"Grievance Management System" <${smtpUser}>`;
    console.log(`[Email Service] 📤 Sending email...`);
    console.log(`[Email Service]   From: ${fromAddress}`);
    console.log(`[Email Service]   To: ${to}`);
    console.log(`[Email Service]   Subject: ${subject}`);
    
    try {
      // Add timeout to sendMail to prevent hanging indefinitely
      const sendTimeout = 30000; // 30 seconds
      console.log(`[Email Service]   Timeout: ${sendTimeout}ms`);
      
      const info = await Promise.race([
        transporter.sendMail({
          from: fromAddress,
          to,
          subject,
          html,
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`Email send timeout after ${sendTimeout}ms`)), sendTimeout)
        )
      ]) as any;

      const duration = Date.now() - startTime;
      console.log(`[Email Service] ✅ Email sent successfully!`);
      console.log(`[Email Service]   Message ID: ${info.messageId || "N/A"}`);
      console.log(`[Email Service]   Duration: ${duration}ms`);
      return true;
    } catch (sendError: any) {
      // If sendMail fails, log it but don't throw yet - let outer catch handle it
      console.error(`[Email Service] ❌ sendMail failed:`, sendError.message);
      if (sendError.message?.includes("timeout")) {
        console.error(`[Email Service] ❌ Email send timed out. Possible issues:`);
        console.error(`   1. Network connectivity from Render to Gmail`);
        console.error(`   2. Gmail blocking the connection`);
        console.error(`   3. Firewall/proxy blocking SMTP port 587`);
        console.error(`   4. Consider using a dedicated email service (SendGrid, Resend, etc.)`);
      }
      throw sendError;
    }
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[Email Service] ❌ Error sending email (took ${duration}ms):`);
    console.error(`[Email Service]   To: ${to}`);
    console.error(`[Email Service]   Subject: ${subject}`);
    console.error(`[Email Service]   Error Code: ${error.code || "UNKNOWN"}`);
    console.error(`[Email Service]   Error Message: ${error.message}`);
    
    // Provide helpful error messages
    if (error.code === "EAUTH") {
      console.error(`[Email Service] ❌ Authentication failed. For Gmail:`);
      console.error(`   1. Make sure you're using an App Password, not your regular password`);
      console.error(`   2. Generate one at: https://myaccount.google.com/apppasswords`);
      console.error(`   3. Enable 2-Step Verification first if you haven't`);
      console.error(`   4. Check that SMTP_USER matches the email used to generate the App Password`);
    } else if (error.code === "ECONNECTION" || error.code === "ETIMEDOUT") {
      console.error(`[Email Service] ❌ Connection failed. Check:`);
      console.error(`   - SMTP_HOST: ${process.env.SMTP_HOST || "smtp.gmail.com"}`);
      console.error(`   - SMTP_PORT: ${process.env.SMTP_PORT || "587"}`);
      console.error(`   - Network connectivity and firewall settings`);
    } else if (error.message?.includes("timeout")) {
      console.error(`[Email Service] ❌ Connection timeout. The SMTP server may be unreachable.`);
    } else {
      console.error(`[Email Service] ❌ Error details:`, error);
    }
    
    return false;
  }
};

// Email templates
export const emailTemplates = {
  newPetitionAssigned: (reviewerName: string, studentName: string, petitionSubject: string, petitionId: string) => ({
    subject: `New Grievance Assigned: ${petitionSubject}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">New Grievance Assigned</h2>
        <p>Dear ${reviewerName},</p>
        <p>A new grievance has been submitted and assigned to you for review:</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Student:</strong> ${studentName}</p>
          <p><strong>Subject:</strong> ${petitionSubject}</p>
          <p><strong>Petition ID:</strong> ${petitionId}</p>
        </div>
        <p>Please review this grievance at your earliest convenience.</p>
        <p style="margin-top: 30px;">Best regards,<br>Grievance Management System</p>
      </div>
    `,
  }),

  petitionStatusUpdate: (studentName: string, petitionSubject: string, newStatus: string, comment?: string) => {
    const statusMessages: Record<string, string> = {
      under_review: "is now under review by the class advisor",
      forwarded_to_hod: "has been forwarded to the Head of Department",
      forwarded_to_registrar: "has been forwarded to the Registrar",
      resolved: "has been resolved",
      rejected: "has been rejected",
    };

    const message = statusMessages[newStatus] || "status has been updated";

    return {
      subject: `Grievance Status Update: ${petitionSubject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Grievance Status Update</h2>
          <p>Dear ${studentName},</p>
          <p>Your grievance "${petitionSubject}" ${message}.</p>
          ${comment ? `<div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;"><p><strong>Comment:</strong> ${comment}</p></div>` : ""}
          <p>You can check the status of your grievance in the dashboard.</p>
          <p style="margin-top: 30px;">Best regards,<br>Grievance Management System</p>
        </div>
      `,
    };
  },

  nextReviewerAlert: (reviewerName: string, studentName: string, petitionSubject: string, petitionId: string, currentLevel: string) => {
    const levelMessages: Record<string, string> = {
      "2": "Head of Department",
      "3": "Registrar",
    };

    const levelName = levelMessages[currentLevel] || "Reviewer";

    return {
      subject: `Grievance Forwarded for Review: ${petitionSubject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Grievance Forwarded for Review</h2>
          <p>Dear ${reviewerName},</p>
          <p>A grievance has been forwarded to you (${levelName}) for review:</p>
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Student:</strong> ${studentName}</p>
            <p><strong>Subject:</strong> ${petitionSubject}</p>
            <p><strong>Petition ID:</strong> ${petitionId}</p>
          </div>
          <p>Please review this grievance and take appropriate action.</p>
          <p style="margin-top: 30px;">Best regards,<br>Grievance Management System</p>
        </div>
      `,
    };
  },

  emailVerification: (userName: string, verificationToken: string) => {
    const baseUrl = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://localhost:3000";
    const verificationUrl = `${baseUrl}/verify-email?token=${verificationToken}`;

    return {
      subject: "Verify Your Email Address - Grievance Management System",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2563eb;">Verify Your Email Address</h2>
          <p>Dear ${userName},</p>
          <p>Thank you for registering with the Grievance Management System. Please verify your email address to complete your registration.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Verify Email Address</a>
          </div>
          <p>Or copy and paste this link into your browser:</p>
          <p style="color: #6b7280; word-break: break-all;">${verificationUrl}</p>
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">This link will expire in 24 hours.</p>
          <p style="margin-top: 30px;">Best regards,<br>Grievance Management System</p>
        </div>
      `,
    };
  },

  passwordReset: (userName: string, resetToken: string) => {
    const baseUrl = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://localhost:3000";
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

    return {
      subject: "Reset Your Password - Grievance Management System",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2563eb;">Reset Your Password</h2>
          <p>Dear ${userName},</p>
          <p>We received a request to reset your password for your Grievance Management System account.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
          </div>
          <p>Or copy and paste this link into your browser:</p>
          <p style="color: #6b7280; word-break: break-all;">${resetUrl}</p>
          <p style="color: #dc2626; font-size: 14px; margin-top: 20px;"><strong>⚠️ Important:</strong> This link will expire in 1 hour. If you didn't request this, please ignore this email.</p>
          <p style="margin-top: 30px;">Best regards,<br>Grievance Management System</p>
        </div>
      `,
    };
  },
};

/**
 * Check email service configuration status
 * Useful for debugging production issues
 */
export const checkEmailConfiguration = () => {
  const resendConfigured = isResendConfigured();
  const smtpConfigured = !!(process.env.SMTP_USER && process.env.SMTP_PASS);
  
  const config = {
    provider: resendConfigured ? "Resend" : smtpConfigured ? "SMTP" : "None",
    resendApiKey: process.env.RESEND_API_KEY ? "✅ SET" : "❌ NOT SET",
    resendFromEmail: process.env.RESEND_FROM_EMAIL || "Using default",
    smtpHost: process.env.SMTP_HOST || "smtp.gmail.com",
    smtpPort: process.env.SMTP_PORT || "587",
    smtpUser: process.env.SMTP_USER,
    smtpPass: process.env.SMTP_PASS ? "***" : undefined,
    smtpFrom: process.env.SMTP_FROM,
    isConfigured: resendConfigured || smtpConfigured,
  };
  
  console.log("[Email Service] Configuration Status:");
  console.log(`  Provider: ${config.provider}`);
  if (resendConfigured) {
    console.log(`  RESEND_API_KEY: ${config.resendApiKey}`);
    console.log(`  RESEND_FROM_EMAIL: ${config.resendFromEmail}`);
  }
  if (smtpConfigured || !resendConfigured) {
    console.log(`  SMTP_HOST: ${config.smtpHost}`);
    console.log(`  SMTP_PORT: ${config.smtpPort}`);
    console.log(`  SMTP_USER: ${config.smtpUser || "❌ NOT SET"}`);
    console.log(`  SMTP_PASS: ${config.smtpPass ? "✅ SET" : "❌ NOT SET"}`);
    console.log(`  SMTP_FROM: ${config.smtpFrom || "Using default"}`);
  }
  console.log(`  Status: ${config.isConfigured ? "✅ CONFIGURED" : "❌ NOT CONFIGURED"}`);
  
  return config;
};

