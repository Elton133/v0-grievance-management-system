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
import {
  sendEmail,
  sendVerificationEmail,
  emailTemplates,
  isEmailSendingConfigured,
} from "../utils/emailService";
import { normalizeAllowedEmailDomains } from "../utils/allowedEmailDomains";
import { effectiveGroupPrefixes } from "../utils/defaultGroupPrefixes";
import { respondIfDatabaseUnavailable } from "../utils/prismaConnectionErrors";
import { validateAgainstRegistry } from "../utils/registryService";
import type { OrganizationRequest } from "../middleware/organization";

type PublicRoleConfig = { key: string; isSubmitter?: boolean; groupScoped?: boolean };

function isPublicRegistrableRole(role: PublicRoleConfig): boolean {
  const key = role.key.toLowerCase();
  return key === "student" || key === "alumni" || key === "submitter" || role.isSubmitter === true;
}

export const registerUser = async (req: OrganizationRequest, res: Response) => {
  try {
    const organizationId = req.organization?.id;
    if (!organizationId) return res.status(400).json({ msg: "Workspace is required" });
    // Load tenant settings for dynamic validation
    let tenantConfig: any = undefined;
    try {
      const settings = await prisma.tenantSettings.findUnique({ where: { organizationId } });
      if (settings) {
        const rolesConfig =
          (settings.rolesConfig as Array<{
            key: string
            isSubmitter?: boolean
            groupScoped?: boolean
          }>) || [];
        const submitterRole =
          rolesConfig.find((r) => r.key === "student") ??
          rolesConfig.find((r) => r.isSubmitter);
        tenantConfig = {
          allowedEmailDomains: normalizeAllowedEmailDomains(settings.allowedEmailDomains),
          groupPrefixes: effectiveGroupPrefixes(settings.groupPrefixes),
          submitterRoleKey: submitterRole?.key || "student",
          rolesConfig,
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

    if (role === "student" || role === "alumni") {
      const memberType = role === "alumni" ? "alumni" : "student";
      const rosterCheck = await validateAgainstRegistry(
        organizationId,
        memberType,
        name.trim(),
        submitterId ?? "",
        group
      );
      if (!rosterCheck.ok) {
        return res.status(400).json({
          msg: "Validation failed",
          errors: [{ field: rosterCheck.path, message: rosterCheck.message }],
        });
      }
    }

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
    // Treat "student" and "submitter" as equivalent (rename-script migration compat)
    if (publicRoleKeys.includes("submitter") && !publicRoleKeys.includes("student")) {
      publicRoleKeys.push("student");
    }
    if (publicRoleKeys.includes("student") && !publicRoleKeys.includes("submitter")) {
      publicRoleKeys.push("submitter");
    }
    // Alumni are a public-registration variant of student — always allowed alongside student
    if (publicRoleKeys.includes("student") && !publicRoleKeys.includes("alumni")) {
      publicRoleKeys.push("alumni");
    }
    console.log("[Auth] Registration role check:", {
      incomingRole: role,
      publicRoleKeys,
      configuredRoleKeys: configuredRoles.map((r) => r.key),
      hasTenantConfig: !!tenantConfig?.rolesConfig?.length,
    });
    if (!publicRoleKeys.includes(role)) {
      return res.status(403).json({
        msg: "This role cannot be created from public registration",
        errors: [
          {
            field: "role",
            message: "This role must be created by a system administrator in Settings → Staff Accounts.",
          },
        ],
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { organizationId_email: { organizationId, email } },
    });
    if (existingUser) {
      return res.status(400).json({ msg: "User already exists" });
    }

    const submitterIdNormalized = submitterId ? sanitizeInput(submitterId).trim() : null;
    if (submitterIdNormalized) {
      const existingIndex = await prisma.user.findFirst({
        where: { organizationId, submitterId: submitterIdNormalized },
      });
      if (existingIndex) {
        return res.status(400).json({
          msg: "This student ID is already registered",
          errors: [{ field: "submitterId", message: "This student ID is already in use. Sign in or use a different ID." }],
        });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const roleToSave = (role === "submitter" || role === "alumni") ? "student" : role;

    // Generate email verification token (32 bytes = 64 hex characters)
    const emailVerificationToken = crypto.randomBytes(32).toString("hex");
    const emailVerificationExpires = new Date();
    emailVerificationExpires.setHours(emailVerificationExpires.getHours() + 24); // 24 hours

    const user = await prisma.user.create({
      data: {
        organizationId,
        name: sanitizeInput(name),
        email: email.toLowerCase().trim(),
        passwordHash: hashedPassword,
        role: roleToSave,
        submitterId: submitterIdNormalized ?? undefined,
        group: group ? sanitizeInput(group) : undefined,
        emailVerified: false, // Email verification disabled until email service is configured
        emailVerificationToken,
        emailVerificationExpires,
      },
    });

    const mailReady = isEmailSendingConfigured();
    let verificationEmailSent = false;

    if (mailReady) {
      // Respond quickly; send in background so a slow SMTP handshake does not fail registration.
      void sendVerificationEmail(user.name, user.email, emailVerificationToken)
        .then((sent) => {
          if (!sent) {
            console.error(
              `[Auth] Verification email failed for ${user.email} — check MAIL_FROM (verified in Brevo), spam folder, or use Resend on login page.`
            );
          }
        })
        .catch((err) => console.error("[Auth] Verification email error:", err));
      verificationEmailSent = true; // queued — user should check inbox; login has resend if missing
    }

    // Auto-verify when mail is not configured (local demo)
    let emailVerifiedOut = user.emailVerified;
    if (!mailReady) {
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true },
      });
      emailVerifiedOut = true;
    }

    res.status(201).json({
      msg: mailReady
        ? "Account created. Check your inbox (and spam) for the verification link."
        : "User registered",
      verificationEmailSent: mailReady ? verificationEmailSent : undefined,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        emailVerified: emailVerifiedOut,
      },
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

export const loginUser = async (req: OrganizationRequest, res: Response) => {
  const { email, password } = req.body;
  try {
    // Sanitize email input
    const sanitizedEmail = sanitizeInput(email).toLowerCase().trim();

    const organizationId = req.organization?.id;
    if (!organizationId) return res.status(400).json({ msg: "Workspace is required" });
    const user = await prisma.user.findUnique({
      where: { organizationId_email: { organizationId, email: sanitizedEmail } },
    });
    if (!user) return res.status(400).json({ msg: "Invalid credentials" });

    // Require verification when mail is configured (set REQUIRE_EMAIL_VERIFICATION=false to bypass, e.g. local dev)
    const emailServiceConfigured = isEmailSendingConfigured();
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
    const token = jwt.sign({
      id: user.id,
      email: user.email,
      organizationId: user.organizationId,
      organizationSlug: req.organization!.slug,
      isPlatformOwner: user.isPlatformOwner,
    }, process.env.JWT_SECRET!, signOpts);

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
        organizationId: user.organizationId,
        organizationSlug: req.organization!.slug,
        isPlatformOwner: user.isPlatformOwner,
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
export const resendVerificationEmail = async (req: OrganizationRequest, res: Response) => {
  const { email } = req.body;

  try {
    if (!email) {
      return res.status(400).json({ msg: "Email is required" });
    }

    const sanitizedEmail = sanitizeInput(email).toLowerCase().trim();
    const organizationId = req.organization?.id;
    if (!organizationId) return res.status(400).json({ msg: "Workspace is required" });
    const user = await prisma.user.findUnique({
      where: { organizationId_email: { organizationId, email: sanitizedEmail } },
    });

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

    const sent = await sendVerificationEmail(user.name, user.email, emailVerificationToken);
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
export const requestPasswordReset = async (req: OrganizationRequest, res: Response) => {
  const { email } = req.body;

  try {
    if (!email) {
      return res.status(400).json({ msg: "Email is required" });
    }

    const sanitizedEmail = sanitizeInput(email).toLowerCase().trim();
    const organizationId = req.organization?.id;
    if (!organizationId) return res.status(400).json({ msg: "Workspace is required" });
    const user = await prisma.user.findUnique({
      where: { organizationId_email: { organizationId, email: sanitizedEmail } },
    });

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

    const emailTemplate = await emailTemplates.passwordReset(user.name, passwordResetToken);
    const mailReady = isEmailSendingConfigured();
    if (mailReady) {
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
    }

    res.json({
      msg: "If the email exists, a password reset link has been sent",
      ...(process.env.NODE_ENV === "development" &&
        !mailReady && { token: passwordResetToken }),
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

    const user = await prisma.user.findFirst({
      where: { id: userId, organizationId: req.user?.organizationId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        submitterId: true,
        group: true,
        emailVerified: true,
        organizationId: true,
        isPlatformOwner: true,
      },
    });

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    res.json({ user: { ...user, organizationSlug: req.user!.organizationSlug } });
  } catch (err) {
    if (respondIfDatabaseUnavailable(res, err)) return;
    console.error("getCurrentUser error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};
