import { PrismaClient } from "@prisma/client"
import { currentTenant } from "./utils/tenantContext"

/**
 * Single PrismaClient per Node process (important with nodemon/tsx --watch so the pool is not multiplied).
 */
function createPrismaClient() {
  const client = new PrismaClient({
    // Omit "query" in dev to reduce noise; keep errors visible.
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    errorFormat: "pretty",
  })

  const tenantModels = new Set([
    "TenantSettings", "User", "Ticket", "TicketComment", "TicketAttachment",
    "TicketStatusHistory", "Notification", "AuditLog", "RegistryStudent",
    "AdvisorLevelAssignment", "ApiToken", "WebhookEndpoint",
  ])

  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const tenant = currentTenant()
          if (!tenant || tenant.bypassTenantScope || !tenantModels.has(model)) return query(args)

          const scoped = args as Record<string, any>
          const organizationId = tenant.organizationId
          if (["findUnique", "findUniqueOrThrow", "findFirst", "findFirstOrThrow", "findMany", "count", "aggregate", "groupBy", "update", "updateMany", "delete", "deleteMany"].includes(operation)) {
            scoped.where = { ...(scoped.where || {}), organizationId }
          }
          if (operation === "create") scoped.data = { ...(scoped.data || {}), organizationId }
          if (operation === "createMany") {
            const rows = Array.isArray(scoped.data) ? scoped.data : [scoped.data]
            scoped.data = rows.map((row: Record<string, unknown>) => ({ ...row, organizationId }))
          }
          if (operation === "upsert") {
            scoped.where = { ...(scoped.where || {}), organizationId }
            scoped.create = { ...(scoped.create || {}), organizationId }
          }
          return query(scoped)
        },
      },
    },
  })
}

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createPrismaClient> }

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
