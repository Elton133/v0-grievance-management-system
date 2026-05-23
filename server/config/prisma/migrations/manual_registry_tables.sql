-- Run in Supabase SQL Editor if `npx prisma db push` cannot connect from your machine.
-- Creates Registry + advisor level assignment tables from schema.prisma.

CREATE TABLE IF NOT EXISTS "RegistryStudent" (
  "id" TEXT NOT NULL,
  "memberType" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "department" TEXT NOT NULL,
  "email" TEXT,
  "level" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RegistryStudent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RegistryStudent_studentId_key" ON "RegistryStudent"("studentId");
CREATE INDEX IF NOT EXISTS "RegistryStudent_department_idx" ON "RegistryStudent"("department");
CREATE INDEX IF NOT EXISTS "RegistryStudent_memberType_idx" ON "RegistryStudent"("memberType");
CREATE INDEX IF NOT EXISTS "RegistryStudent_fullName_idx" ON "RegistryStudent"("fullName");

CREATE TABLE IF NOT EXISTS "AdvisorLevelAssignment" (
  "id" TEXT NOT NULL,
  "advisorId" TEXT NOT NULL,
  "department" TEXT NOT NULL,
  "levels" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "petitionTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdvisorLevelAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AdvisorLevelAssignment_advisorId_department_key"
  ON "AdvisorLevelAssignment"("advisorId", "department");
CREATE INDEX IF NOT EXISTS "AdvisorLevelAssignment_department_idx" ON "AdvisorLevelAssignment"("department");

DO $$ BEGIN
  ALTER TABLE "AdvisorLevelAssignment"
    ADD CONSTRAINT "AdvisorLevelAssignment_advisorId_fkey"
    FOREIGN KEY ("advisorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
