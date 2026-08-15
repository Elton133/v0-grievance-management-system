# Multi-tenancy deployment guide

The application uses a shared-database, shared-schema tenancy model. Every tenant-owned record carries an `organizationId`; the Express request resolves a workspace slug and a request-scoped Prisma guard adds that ID to tenant-owned reads and writes.

## Deployment order

1. Back up the Supabase database.
2. Run `server/config/prisma/migrations/add_marketing_content.sql` if it has not already been applied.
3. Run `server/config/prisma/migrations/multi_tenant_foundation.sql` in the Supabase SQL editor.
4. Regenerate Prisma and deploy the server.
5. Run the seed once to mark the seeded default administrator as a platform owner, or manually set `isPlatformOwner = true` for the intended owner account.
6. Deploy the client and sign in again. Pre-migration JWTs are intentionally rejected because they do not contain organization context.

Do not deploy the new server before the database migration: API requests now resolve an `Organization` record.

## Workspace resolution

Clients send `X-Organization-Slug`. The web client resolves it in this order:

1. `?workspace=slug` (also remembered locally)
2. `NEXT_PUBLIC_ORGANIZATION_SLUG`
3. The first hostname segment for tenant subdomains
4. `default`

Production can therefore use either `institution.yourdomain.com` or a shared domain with `?workspace=institution` during onboarding and demos.

## Security model

- Institution JWTs include `organizationId` and `organizationSlug`.
- Email, student ID and ticket reference uniqueness are per organization.
- A request-scoped Prisma extension injects `organizationId` into tenant-owned operations.
- Platform-owner operations deliberately bypass tenant scoping only after both JWT and fresh database authorization checks.
- API keys are stored as SHA-256 hashes and are bound to an organization.

The next hardening layer is PostgreSQL RLS with a restricted runtime database role. Do not enable RLS while the runtime Prisma role uses `BYPASSRLS`; policies would provide no protection for that role.

## Cross-tenant integration test

Use a disposable test database only:

```powershell
$env:ALLOW_TENANT_INTEGRATION_TESTS="true"
$env:DATABASE_URL="postgresql://...test-database..."
$env:DIRECT_URL=$env:DATABASE_URL
npm run test:tenant
```

The test creates two organizations with the same user email, confirms each tenant sees only its own user, attempts a cross-tenant lookup by ID, and removes the fixtures afterward.
