import { Request, Response } from "express";
import type { AuthRequest } from "../middleware/auth";
import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import crypto from "crypto";
import { Prisma } from "@prisma/client";
import prisma from "../db";
import { createRegistrationSchema } from "../validation/registrationSchema";
import { registrationPasswordSchema } from "../validation/passwordPolicy";
import { sanitizeInput } from "../utils/sanitize";
import { sendEmail, emailTemplates } from "../utils/emailService";
import { normalizeAllowedEmailDomains } from "../utils/allowedEmailDomains";
import { effectiveGroupPrefixes } from "../utils/defaultGroupPrefixes";
import { respondIfDatabaseUnavailable } from "../utils/prismaConnectionErrors";

type PublicRoleConfig = { key: string; isSubmitter?: boolean; groupScoped?: boolean };

function isPublicRegistrableRole(role: PublicRoleConfig): boolean {
  const key = role.key.toLowerCase();
  if (key.includes("registrar") || key.includes("admin")) return false;
  return role.isSubmitter === true || role.groupScoped !== false;
}

export const registerUser = async (req: Request, res: Response) => {
  try {
    // Load tenant settings for dynamic validation
    let tenantConfig: any = undefined;
    try {
      const settings = await prisma.tenantSettings.findUnique({ where: { id: "default" } });
      if (settings) {
        const roles = (settings.rolesConfig as Array<{ key: string }>) || [];
        const submitterRole = (settings.rolesConfig as Array<{ key: string; isSubmitter?: boolean }>)?.find(r => r.isSubmitter);
        tenantConfig = {
          allowedEmailDomains: normalizeAllowedEmailDomains(settings.allowedEmailDomains),
          roles: roles.map(r => r.key),
          groupPrefixes: effectiveGroupPrefixes(settings.groupPrefixes),
          submitterRoleKey: submitterRole?.key || "student",
          rolesConfig: (settings.rolesConfig as Array<{ key: string; isSubmitter?: boolean; groupScoped?: boolean }>) || [],
        };
      }
    } catch {
      // Fall through to defaults
    }

    // Validate request body with dynamic Zod schema
    const registrationSchema = createRegistrationSchema(tenantConfig);
    const validationResult = registrationSchema.safeParse(req.body);

    if (!validationResult.success) {
      const errors = validationResult.error.issues.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      console.error("VALIDATION ERRORS:", errors);
      return res.status(400).json({
        msg: "Validation failed",
        errors
      });
    }

    const { name, email, password, role, submitterId, group } = validationResult.data;

    const configuredRoles: PublicRoleConfig[] =
      tenantConfig?.rolesConfig?.length
        ? tenantConfig.rolesConfig
        : [
            { key: "student", isSubmitter: true, groupScoped: true },
            { key: "advisor", groupScoped: true },
            { key: "hod", groupScoped: true },
            { key: "registrar", groupScoped: false },
          ];
    const publicRoleKeys = configuredRoles.filter(isPublicRegistrableRole).map((r) => r.key);
    if (!publicRoleKeys.includes(role)) {
      return res.status(403).json({
        msg: "This role cannot be created from public registration",
        errors: [
          {
            field: "role",
            message: "Registrar/admin accounts must be created by seed, database admin, or a protected admin screen.",
          },
        ],
      });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ msg: "User already exists" });
    }

    const submitterIdNormalized = submitterId ? sanitizeInput(submitterId).trim() : null;
    if (submitterIdNormalized) {
      const existingIndex = await prisma.user.findFirst({
        where: { submitterId: submitterIdNormalized },
      });
      if (existingIndex) {
        return res.status(400).json({
          msg: "This student ID is already registered",
          errors: [{ field: "submitterId", message: "This student ID is already in use. Sign in or use a different ID." }],
        });
      }
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
        submitterId: submitterIdNormalized ?? undefined,
        group: group ? sanitizeInput(group) : undefined,
        emailVerified: false, // Email verification disabled until email service is configured
        emailVerificationToken,
        emailVerificationExpires,
      },
    });

    // Send verification email
    const emailTemplate = await emailTemplates.emailVerification(user.name, emailVerificationToken, user.email);
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
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const target = (err.meta as { target?: string[] } | undefined)?.target;
      if (target?.includes("submitterId")) {
        return res.status(400).json({
          msg: "This student ID is already registered",
          errors: [{ field: "submitterId", message: "This student ID is already in use." }],
        });
      }
      if (target?.includes("email")) {
        return res.status(400).json({ msg: "User already exists" });
      }
    }
    if (respondIfDatabaseUnavailable(res, err)) return;
    console.error("Registration error:", err);
    res.status(500).json(
      process.env.NODE_ENV === "development" ? { msg: "Server error", err } : { msg: "Server error" }
    );
  }
};

export const loginUser = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  try {
    // Sanitize email input
    const sanitizedEmail = sanitizeInput(email).toLowerCase().trim();

    const user = await prisma.user.findUnique({ where: { email: sanitizedEmail } });
    if (!user) return res.status(400).json({ msg: "Invalid credentials" });

    // Require verification when mail is configured (set REQUIRE_EMAIL_VERIFICATION=false to bypass, e.g. local dev)
    const emailServiceConfigured = !!(process.env.RESEND_API_KEY || process.env.SMTP_USER);
    const mustVerifyEmail =
      emailServiceConfigured && process.env.REQUIRE_EMAIL_VERIFICATION !== "false";
    if (mustVerifyEmail && !user.emailVerified) {
      return res.status(403).json({
        msg: "Email not verified",
        error: "Please verify your email before logging in. Check your inbox for the verification link.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return res.status(400).json({ msg: "Invalid credentials" });

    const signOpts: SignOptions = {
      expiresIn: (process.env.JWT_EXPIRES_IN || "8h") as SignOptions["expiresIn"],
    };
    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET!, signOpts);

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
        submitterId: user.submitterId,
        group: user.group,
      }
    });
  } catch (err) {
    if (respondIfDatabaseUnavailable(res, err)) return;
    console.error("Login error:", err);
    res.status(500).json(
      process.env.NODE_ENV === "development" ? { msg: "Server error", err } : { msg: "Server error" }
    );
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
    if (respondIfDatabaseUnavailable(res, err)) return;
    console.error("Email verification error:", err);
    res.status(500).json(
      process.env.NODE_ENV === "development" ? { msg: "Server error", err } : { msg: "Server error" }
    );
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

    // Send verification email — await so client can show a real error if mail is not configured
    const emailTemplate = await emailTemplates.emailVerification(user.name, emailVerificationToken, user.email);
    const sent = await sendEmail({
      to: user.email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
    });
    if (!sent) {
      return res.status(503).json({
        msg: "Could not send email. Check Resend/SMTP configuration on the server, then try again.",
      });
    }

    res.json({ msg: "Verification email sent. Check your inbox." });
  } catch (err) {
    if (respondIfDatabaseUnavailable(res, err)) return;
    console.error("Resend verification error:", err);
    res.status(500).json(
      process.env.NODE_ENV === "development" ? { msg: "Server error", err } : { msg: "Server error" }
    );
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
    const emailTemplate = await emailTemplates.passwordReset(user.name, passwordResetToken);
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
    if (respondIfDatabaseUnavailable(res, err)) return;
    console.error("Password reset request error:", err);
    res.status(500).json(
      process.env.NODE_ENV === "development" ? { msg: "Server error", err } : { msg: "Server error" }
    );
  }
};

// Reset password with token
export const resetPassword = async (req: Request, res: Response) => {
  const { token, password } = req.body;

  try {
    if (!token || !password) {
      return res.status(400).json({ msg: "Token and password are required" });
    }

    const pwdResult = registrationPasswordSchema.safeParse(password);
    if (!pwdResult.success) {
      const issues = pwdResult.error.issues;
      const first = issues[0]?.message || "Password does not meet requirements";
      return res.status(400).json({
        msg: first,
        errors: issues.map((i) => ({ field: "password", message: i.message })),
      });
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
    if (respondIfDatabaseUnavailable(res, err)) return;
    console.error("Password reset error:", err);
    res.status(500).json(
      process.env.NODE_ENV === "development" ? { msg: "Server error", err } : { msg: "Server error" }
    );
  }
};

/** Current session (validates JWT + returns fresh profile for client restore after reload). */
export const getCurrentUser = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        submitterId: true,
        group: true,
        emailVerified: true,
      },
    });

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    res.json({ user });
  } catch (err) {
    if (respondIfDatabaseUnavailable(res, err)) return;
    console.error("getCurrentUser error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};
