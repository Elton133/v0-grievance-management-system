import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import prisma from "../db";
import { registrationSchema } from "../validation/registrationSchema";
import { sanitizeInput } from "../utils/sanitize";
import { sendEmail, emailTemplates } from "../utils/emailService";

export const registerUser = async (req: Request, res: Response) => {
  try {
    // Validate request body with Zod
    const validationResult = registrationSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      return res.status(400).json({ 
        msg: "Validation failed", 
        errors 
      });
    }

    const { name, email, password, role, studentId, department } = validationResult.data;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ msg: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Generate email verification token (32 bytes = 64 hex characters)
    const emailVerificationToken = crypto.randomBytes(32).toString("hex");
    const emailVerificationExpires = new Date();
    emailVerificationExpires.setHours(emailVerificationExpires.getHours() + 24); // 24 hours

    const user = await prisma.user.create({
      data: { 
        name: sanitizeInput(name), 
        email: email.toLowerCase().trim(), 
        passwordHash: hashedPassword,
        role,
        studentId: studentId ? sanitizeInput(studentId) : undefined,
        department: department ? sanitizeInput(department) : undefined,
        emailVerified: false, // Email verification disabled until email service is configured
        emailVerificationToken,
        emailVerificationExpires,
      },
    });

    // Send verification email
    const emailTemplate = emailTemplates.emailVerification(user.name, emailVerificationToken);
    sendEmail({
      to: user.email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
    }).catch((err) => {
      console.error("Error sending verification email:", err);
    });

    // Auto-verify if email service is not configured (for development)
    if (!process.env.RESEND_API_KEY && !process.env.SMTP_USER) {
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true },
      });
    }

    res.status(201).json({ 
      msg: "User registered", 
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
      }
    });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ msg: "Server error", err });
  }
};

export const loginUser = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  try {
    // Sanitize email input
    const sanitizedEmail = sanitizeInput(email).toLowerCase().trim();
    
    const user = await prisma.user.findUnique({ where: { email: sanitizedEmail } });
    if (!user) return res.status(400).json({ msg: "Invalid credentials" });

    // Check if email is verified (if email verification is enabled)
    if (process.env.REQUIRE_EMAIL_VERIFICATION === "true" && !user.emailVerified) {
      return res.status(403).json({ 
        msg: "Email not verified", 
        error: "Please verify your email before logging in" 
      });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return res.status(400).json({ msg: "Invalid credentials" });

    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET!, { expiresIn: "1h" });

    res.json({ 
      token, 
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
      }
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ msg: "Server error", err });
  }
};

// Verify email with token
export const verifyEmail = async (req: Request, res: Response) => {
  const { token } = req.body;
  
  try {
    if (!token) {
      return res.status(400).json({ msg: "Verification token is required" });
    }

    const user = await prisma.user.findFirst({
      where: {
        emailVerificationToken: token,
        emailVerificationExpires: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      return res.status(400).json({ msg: "Invalid or expired verification token" });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
    });

    res.json({ msg: "Email verified successfully" });
  } catch (err) {
    console.error("Email verification error:", err);
    res.status(500).json({ msg: "Server error", err });
  }
};

// Resend verification email
export const resendVerificationEmail = async (req: Request, res: Response) => {
  const { email } = req.body;
  
  try {
    if (!email) {
      return res.status(400).json({ msg: "Email is required" });
    }

    const sanitizedEmail = sanitizeInput(email).toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email: sanitizedEmail } });

    if (!user) {
      // Don't reveal if user exists for security
      return res.json({ msg: "If the email exists, a verification link has been sent" });
    }

    if (user.emailVerified) {
      return res.status(400).json({ msg: "Email is already verified" });
    }

    // Generate new verification token
    const emailVerificationToken = crypto.randomBytes(32).toString("hex");
    const emailVerificationExpires = new Date();
    emailVerificationExpires.setHours(emailVerificationExpires.getHours() + 24);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken,
        emailVerificationExpires,
      },
    });

    // Send verification email
    const emailTemplate = emailTemplates.emailVerification(user.name, emailVerificationToken);
    sendEmail({
      to: user.email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
    }).catch((err) => {
      console.error("Error sending verification email:", err);
    });

    res.json({ msg: "If the email exists, a verification link has been sent" });
  } catch (err) {
    console.error("Resend verification error:", err);
    res.status(500).json({ msg: "Server error", err });
  }
};

// Request password reset
export const requestPasswordReset = async (req: Request, res: Response) => {
  const { email } = req.body;
  
  try {
    if (!email) {
      return res.status(400).json({ msg: "Email is required" });
    }

    const sanitizedEmail = sanitizeInput(email).toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email: sanitizedEmail } });

    if (!user) {
      // Don't reveal if user exists for security
      return res.json({ msg: "If the email exists, a password reset link has been sent" });
    }

    // Generate reset token
    const passwordResetToken = crypto.randomBytes(32).toString("hex");
    const passwordResetExpires = new Date();
    passwordResetExpires.setHours(passwordResetExpires.getHours() + 1); // 1 hour expiry

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken,
        passwordResetExpires,
      },
    });

    // Send password reset email
    const emailTemplate = emailTemplates.passwordReset(user.name, passwordResetToken);
    sendEmail({
      to: user.email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
    }).catch((err) => {
      console.error("Error sending password reset email:", err);
    });

    res.json({ 
      msg: "If the email exists, a password reset link has been sent",
      // In development, you might want to return the token for testing
      // Remove this in production!
      ...(process.env.NODE_ENV === "development" && !process.env.RESEND_API_KEY && !process.env.SMTP_USER && { token: passwordResetToken }),
    });
  } catch (err) {
    console.error("Password reset request error:", err);
    res.status(500).json({ msg: "Server error", err });
  }
};

// Reset password with token
export const resetPassword = async (req: Request, res: Response) => {
  const { token, password } = req.body;
  
  try {
    if (!token || !password) {
      return res.status(400).json({ msg: "Token and password are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ msg: "Password must be at least 6 characters" });
    }

    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      return res.status(400).json({ msg: "Invalid or expired reset token" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    res.json({ msg: "Password reset successfully" });
  } catch (err) {
    console.error("Password reset error:", err);
    res.status(500).json({ msg: "Server error", err });
  }
};
