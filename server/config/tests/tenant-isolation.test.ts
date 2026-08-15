import assert from "node:assert/strict";
import test from "node:test";
import prisma from "../db";
import { runWithTenant } from "../utils/tenantContext";

const enabled = process.env.ALLOW_TENANT_INTEGRATION_TESTS === "true";

test("tenant guard isolates reads and writes across organizations", { skip: !enabled }, async () => {
  const suffix = Date.now().toString(36);
  const sharedEmail = `shared-${suffix}@example.test`;
  const alpha = await prisma.organization.create({
    data: { name: "Isolation Alpha", slug: `isolation-alpha-${suffix}` },
  });
  const beta = await prisma.organization.create({
    data: { name: "Isolation Beta", slug: `isolation-beta-${suffix}` },
  });

  try {
    await runWithTenant({ organizationId: alpha.id, organizationSlug: alpha.slug }, async () =>
      await prisma.user.create({
        data: { name: "Shared Email Alpha", email: sharedEmail, passwordHash: "test", role: "admin" },
      })
    );
    await runWithTenant({ organizationId: beta.id, organizationSlug: beta.slug }, async () =>
      await prisma.user.create({
        data: { name: "Shared Email Beta", email: sharedEmail, passwordHash: "test", role: "admin" },
      })
    );

    const alphaUsers = await runWithTenant(
      { organizationId: alpha.id, organizationSlug: alpha.slug },
      async () => await prisma.user.findMany({ where: { email: sharedEmail } })
    );
    const betaUsers = await runWithTenant(
      { organizationId: beta.id, organizationSlug: beta.slug },
      async () => await prisma.user.findMany({ where: { email: sharedEmail } })
    );

    assert.equal(alphaUsers.length, 1);
    assert.equal(betaUsers.length, 1);
    assert.equal(alphaUsers[0].organizationId, alpha.id);
    assert.equal(betaUsers[0].organizationId, beta.id);

    const crossTenantLookup = await runWithTenant(
      { organizationId: alpha.id, organizationSlug: alpha.slug },
      async () => await prisma.user.findUnique({ where: { id: betaUsers[0].id } })
    );
    assert.equal(crossTenantLookup, null);
  } finally {
    await prisma.organization.deleteMany({ where: { id: { in: [alpha.id, beta.id] } } });
  }
});
