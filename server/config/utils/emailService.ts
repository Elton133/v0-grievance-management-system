import nodemailer from "nodemailer";

// Email service configuration
const createTransporter = () => {
  // For Gmail, you need to use an App Password, not your regular password
  // Generate one at: https://myaccount.google.com/apppasswords
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "587");
  const isSecure = port === 465;
  
  return nodemailer.createTransport({
    host,
    port,
    secure: isSecure, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS, // Use App Password for Gmail
    },
    // Gmail-specific settings
    ...(host.includes("gmail.com") && {
      service: "gmail",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS, // App Password required
      },
    }),
  });
};

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export const sendEmail = async ({ to, subject, html }: EmailOptions): Promise<boolean> => {
  try {
    // Skip email sending if SMTP is not configured (for development)
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log(`[Email Service] SMTP not configured. Would send email to ${to}: ${subject}`);
      console.log(`[Email Service] Set SMTP_USER and SMTP_PASS environment variables to enable email sending.`);
      console.log(`[Email Service] For Gmail, use an App Password: https://myaccount.google.com/apppasswords`);
      return true; // Return true to not break the flow during development
    }

    console.log(`[Email Service] Attempting to send email to ${to}...`);
    console.log(`[Email Service] Using SMTP: ${process.env.SMTP_HOST || "smtp.gmail.com"}:${process.env.SMTP_PORT || "587"}`);
    console.log(`[Email Service] From: ${process.env.SMTP_USER}`);

    const transporter = createTransporter();
    
    // Verify connection
    await transporter.verify();
    console.log(`[Email Service] ✅ SMTP connection verified`);

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || `"Grievance Management System" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });

    console.log(`✅ Email sent successfully to ${to}`);
    console.log(`[Email Service] Message ID: ${info.messageId}`);
    return true;
  } catch (error: any) {
    console.error("❌ Error sending email:", error);
    
    // Provide helpful error messages
    if (error.code === "EAUTH") {
      console.error("❌ Authentication failed. For Gmail:");
      console.error("   1. Make sure you're using an App Password, not your regular password");
      console.error("   2. Generate one at: https://myaccount.google.com/apppasswords");
      console.error("   3. Enable 2-Step Verification first if you haven't");
    } else if (error.code === "ECONNECTION" || error.code === "ETIMEDOUT") {
      console.error("❌ Connection failed. Check your SMTP_HOST and SMTP_PORT settings");
    } else {
      console.error(`❌ Error details: ${error.message}`);
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
};

