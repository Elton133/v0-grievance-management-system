import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import authRoutes from "./routes/authRoutes";
import petitionRoutes from "./routes/petitionRoutes";
import { checkEmailConfiguration } from "./utils/emailService";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy for Render and other hosting platforms
app.set('trust proxy', true);

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/petitions", petitionRoutes);

// Health check endpoint
app.get("/health", (req: express.Request, res: express.Response) => {
  res.json({ status: "ok", message: "Server is running" });
});

// Email configuration diagnostic endpoint
app.get("/api/email/status", (req: express.Request, res: express.Response) => {
  const config = checkEmailConfiguration();
  res.json({
    configured: config.isConfigured,
    host: config.smtpHost,
    port: config.smtpPort,
    user: config.smtpUser || null,
    from: config.smtpFrom || null,
    message: config.isConfigured 
      ? "Email service is configured" 
      : "Email service is not configured. Set SMTP_USER and SMTP_PASS environment variables.",
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📧 Checking email configuration...`);
  checkEmailConfiguration();
});
