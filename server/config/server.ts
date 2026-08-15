import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import authRoutes from "./routes/authRoutes";
import ticketRoutes from "./routes/ticketRoutes";
import settingsRoutes from "./routes/settingsRoutes";
import auditRoutes from "./routes/auditRoutes";
import usersRoutes from "./routes/usersRoutes";
import registryRoutes from "./routes/registryRoutes";
import advisorAssignmentRoutes from "./routes/advisorAssignmentRoutes";
import v1TicketRoutes from "./routes/v1/ticketRoutes";
import { checkEmailConfiguration } from "./utils/emailService";
import { requireApiToken } from "./middleware/apiAuthMiddleware";
import demoRequestRoutes from "./routes/demoRequestRoutes";
import { organizationMiddleware } from "./middleware/organization";
import { platformRouter, workspaceRouter } from "./routes/organizationRoutes";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Trust loopback proxy only (avoids permissive trust proxy issues with rate limiting)
app.set("trust proxy", "loopback");

// Middleware
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error("Origin not allowed by CORS"));
  },
}));
app.use(express.json({ limit: "15mb" }));
app.use("/api", organizationMiddleware);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/tickets", ticketRoutes); // Internal React App Routes
app.use("/api/settings", settingsRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/registry", registryRoutes);
app.use("/api/advisor-assignments", advisorAssignmentRoutes);
app.use("/api/audit-logs", auditRoutes);
app.use("/api/demo-requests", demoRequestRoutes);
app.use("/api/workspaces", workspaceRouter);
app.use("/api/platform", platformRouter);

// External Developer APIs (v1)
app.use("/api/v1/tickets", requireApiToken, v1TicketRoutes);

// Health check endpoint
app.get("/health", (req: express.Request, res: express.Response) => {
  res.json({ status: "ok", message: "Server is running" });
});

// Email configuration diagnostic endpoint
app.get("/api/email/status", (req: express.Request, res: express.Response) => {
  const config = checkEmailConfiguration();
  res.json({
    configured: config.isConfigured,
    provider: config.provider,
    providerKey: config.providerKey,
    from: config.from,
    message: config.isConfigured
      ? `Email service is configured (${config.provider})`
      : "Email is not configured. Set EMAIL_PROVIDER and credentials in server .env (see .env.example — Brevo recommended for demos).",
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📧 Checking email configuration...`);
  checkEmailConfiguration();
});
