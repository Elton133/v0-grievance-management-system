import { PrismaClient } from "@prisma/client"

/**
 * Single PrismaClient per Node process (important with nodemon/tsx --watch so the pool is not multiplied).
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function createPrismaClient() {
  return new PrismaClient({
    // Omit "query" in dev to reduce noise; keep errors visible.
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    errorFormat: "pretty",
  })
}

const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}

function disconnect() {
  void prisma.$disconnect()
}

process.once("SIGINT", disconnect)
process.once("SIGTERM", disconnect)

export default prisma
