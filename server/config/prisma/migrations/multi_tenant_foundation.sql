-- Backward-compatible tenant foundation. Existing records are assigned to the
-- default workspace. Run in a transaction after taking a database backup.
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS "Organization" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "status" TEXT NOT NULL DEFAULT 'active',
  "subscriptionTier" TEXT NOT NULL DEFAULT 'starter',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "WorkspaceRequest" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "organizationName" TEXT NOT NULL,
  "preferredSlug" TEXT NOT NULL,
  "contactName" TEXT NOT NULL,
  "contactEmail" TEXT NOT NULL,
  "message" TEXT,
  "status" TEXT NOT NULL DEFAULT 'new',
  "source" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "WorkspaceRequest_status_createdAt_idx" ON "WorkspaceRequest"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "WorkspaceRequest_contactEmail_idx" ON "WorkspaceRequest"("contactEmail");

CREATE TABLE IF NOT EXISTS "DemoRequest" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "organization" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'new',
  "source" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "DemoRequest_status_createdAt_idx" ON "DemoRequest"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "DemoRequest_email_idx" ON "DemoRequest"("email");

INSERT INTO "Organization" ("id", "name", "slug", "status", "subscriptionTier")
VALUES ('default', 'Resolve', 'default', 'active', 'starter')
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "TenantSettings" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isPlatformOwner" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "TicketComment" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "TicketAttachment" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "TicketStatusHistory" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "RegistryStudent" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "AdvisorLevelAssignment" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL DEFAULT 'default';

ALTER TABLE "ApiToken" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ApiToken' AND column_name = 'tenantId'
  ) THEN
    EXECUTE 'UPDATE "ApiToken" SET "organizationId" = COALESCE("tenantId", ''default'') WHERE "organizationId" IS NULL';
  ELSE
    UPDATE "ApiToken" SET "organizationId" = 'default' WHERE "organizationId" IS NULL;
  END IF;
END $$;
UPDATE "ApiToken" SET "tokenHash" = encode(digest("tokenHash", 'sha256'), 'hex') WHERE "tokenHash" LIKE 'gms_live_%';
ALTER TABLE "ApiToken" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "WebhookEndpoint" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'WebhookEndpoint' AND column_name = 'tenantId'
  ) THEN
    EXECUTE 'UPDATE "WebhookEndpoint" SET "organizationId" = COALESCE("tenantId", ''default'') WHERE "organizationId" IS NULL';
  ELSE
    UPDATE "WebhookEndpoint" SET "organizationId" = 'default' WHERE "organizationId" IS NULL;
  END IF;
END $$;
ALTER TABLE "WebhookEndpoint" ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_email_key";
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_submitterId_key";
ALTER TABLE "Ticket" DROP CONSTRAINT IF EXISTS "Ticket_referenceCode_key";
ALTER TABLE "RegistryStudent" DROP CONSTRAINT IF EXISTS "RegistryStudent_studentId_key";
ALTER TABLE "AdvisorLevelAssignment" DROP CONSTRAINT IF EXISTS "AdvisorLevelAssignment_advisorId_department_key";
DROP INDEX IF EXISTS "User_email_key";
DROP INDEX IF EXISTS "User_submitterId_key";
DROP INDEX IF EXISTS "Ticket_referenceCode_key";
DROP INDEX IF EXISTS "RegistryStudent_studentId_key";
DROP INDEX IF EXISTS "AdvisorLevelAssignment_advisorId_department_key";

CREATE UNIQUE INDEX IF NOT EXISTS "TenantSettings_organizationId_key" ON "TenantSettings"("organizationId");
CREATE UNIQUE INDEX IF NOT EXISTS "User_organizationId_email_key" ON "User"("organizationId", "email");
CREATE UNIQUE INDEX IF NOT EXISTS "User_organizationId_submitterId_key" ON "User"("organizationId", "submitterId");
CREATE UNIQUE INDEX IF NOT EXISTS "Ticket_organizationId_referenceCode_key" ON "Ticket"("organizationId", "referenceCode");
CREATE UNIQUE INDEX IF NOT EXISTS "RegistryStudent_organizationId_studentId_key" ON "RegistryStudent"("organizationId", "studentId");
CREATE UNIQUE INDEX IF NOT EXISTS "AdvisorLevelAssignment_organizationId_advisorId_department_key" ON "AdvisorLevelAssignment"("organizationId", "advisorId", "department");

CREATE INDEX IF NOT EXISTS "User_organizationId_role_group_idx" ON "User"("organizationId", "role", "group");
CREATE INDEX IF NOT EXISTS "Ticket_organizationId_status_group_idx" ON "Ticket"("organizationId", "status", "group");
CREATE INDEX IF NOT EXISTS "Notification_organizationId_userId_isRead_idx" ON "Notification"("organizationId", "userId", "isRead");
CREATE INDEX IF NOT EXISTS "RegistryStudent_organizationId_department_idx" ON "RegistryStudent"("organizationId", "department");
CREATE INDEX IF NOT EXISTS "AdvisorLevelAssignment_organizationId_department_idx" ON "AdvisorLevelAssignment"("organizationId", "department");
CREATE INDEX IF NOT EXISTS "ApiToken_organizationId_idx" ON "ApiToken"("organizationId");
CREATE INDEX IF NOT EXISTS "WebhookEndpoint_organizationId_isActive_idx" ON "WebhookEndpoint"("organizationId", "isActive");

ALTER TABLE "TenantSettings" DROP CONSTRAINT IF EXISTS "TenantSettings_organizationId_fkey";
ALTER TABLE "TenantSettings" ADD CONSTRAINT "TenantSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE;
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_organizationId_fkey";
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE;
ALTER TABLE "Ticket" DROP CONSTRAINT IF EXISTS "Ticket_organizationId_fkey";
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE;
ALTER TABLE "TicketComment" DROP CONSTRAINT IF EXISTS "TicketComment_organizationId_fkey";
ALTER TABLE "TicketComment" ADD CONSTRAINT "TicketComment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE;
ALTER TABLE "TicketAttachment" DROP CONSTRAINT IF EXISTS "TicketAttachment_organizationId_fkey";
ALTER TABLE "TicketAttachment" ADD CONSTRAINT "TicketAttachment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE;
ALTER TABLE "TicketStatusHistory" DROP CONSTRAINT IF EXISTS "TicketStatusHistory_organizationId_fkey";
ALTER TABLE "TicketStatusHistory" ADD CONSTRAINT "TicketStatusHistory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE;
ALTER TABLE "Notification" DROP CONSTRAINT IF EXISTS "Notification_organizationId_fkey";
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE;
ALTER TABLE "AuditLog" DROP CONSTRAINT IF EXISTS "AuditLog_organizationId_fkey";
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE;
ALTER TABLE "RegistryStudent" DROP CONSTRAINT IF EXISTS "RegistryStudent_organizationId_fkey";
ALTER TABLE "RegistryStudent" ADD CONSTRAINT "RegistryStudent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE;
ALTER TABLE "AdvisorLevelAssignment" DROP CONSTRAINT IF EXISTS "AdvisorLevelAssignment_organizationId_fkey";
ALTER TABLE "AdvisorLevelAssignment" ADD CONSTRAINT "AdvisorLevelAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE;
ALTER TABLE "ApiToken" DROP CONSTRAINT IF EXISTS "ApiToken_organizationId_fkey";
ALTER TABLE "ApiToken" ADD CONSTRAINT "ApiToken_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE;
ALTER TABLE "WebhookEndpoint" DROP CONSTRAINT IF EXISTS "WebhookEndpoint_organizationId_fkey";
ALTER TABLE "WebhookEndpoint" ADD CONSTRAINT "WebhookEndpoint_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE;

ALTER TABLE "ApiToken" DROP COLUMN IF EXISTS "tenantId";
ALTER TABLE "WebhookEndpoint" DROP COLUMN IF EXISTS "tenantId";

COMMIT;
