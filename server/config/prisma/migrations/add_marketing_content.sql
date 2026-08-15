-- Apply once to existing databases before deploying the marketing CMS update.
ALTER TABLE "TenantSettings"
ADD COLUMN IF NOT EXISTS "marketingContent" JSONB NOT NULL DEFAULT '{}'::jsonb;
