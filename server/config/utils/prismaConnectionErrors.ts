import type { Response } from "express"
import { Prisma } from "@prisma/client"

/** Prisma errors: unreachable DB, pool timeout, connection closed. */
const CONNECTIVITY_AND_POOL_CODES = new Set([
  "P1001", // Can't reach database server
  "P1002", // Database server timeout
  "P1017", // Server has closed the connection
  "P2024", // Timed out fetching a new connection from the connection pool
])

/**
 * Send 503 when the database or pool is unavailable. Call from route catch blocks before a generic 500.
 * @returns true if a response was sent
 */
export function respondIfDatabaseUnavailable(res: Response, err: unknown): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return false
  if (!CONNECTIVITY_AND_POOL_CODES.has(err.code)) return false

  const payload: Record<string, unknown> = {
    msg: "Database temporarily unavailable. Check your Supabase project (not paused), network, and DATABASE_URL. If pool errors continue, see server/.env.example for connection string hints.",
  }
  if (process.env.NODE_ENV === "development") {
    payload.code = err.code
    payload.meta = err.meta
  }
  res.status(503).json(payload)
  return true
}
