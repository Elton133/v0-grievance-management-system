import rateLimit from "express-rate-limit";

// General API rate limiter - 100 requests per 15 minutes
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: Number(process.env.API_RATE_LIMIT || 300),
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiter for auth endpoints - 5 requests per 15 minutes
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: Number(process.env.AUTH_RATE_LIMIT || 10),
  message: "Too many authentication attempts, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

// Moderate rate limiter for create operations - 20 requests per 15 minutes
export const createLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: Number(process.env.CREATE_RATE_LIMIT || 30),
  message: "Too many creation requests, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

// Public lead form: intentionally strict to limit spam and email abuse.
export const demoRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.DEMO_REQUEST_RATE_LIMIT || 5),
  message: { error: "Too many demo requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});
