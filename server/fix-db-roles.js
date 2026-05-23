const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.tenantSettings.update({
    where: { id: 'default' },
    data: {
      rolesConfig: [
        { key: "student", label: "Student", level: 0, isSubmitter: true, groupScoped: true },
        { key: "advisor", label: "Advisor", level: 1, isSubmitter: false, groupScoped: true },
        { key: "hod", label: "Head of Department", level: 2, isSubmitter: false, groupScoped: true },
        { key: "registrar", label: "Registrar", level: 3, isSubmitter: false, groupScoped: false },
        { key: "admin", label: "System Administrator", level: 4, isSubmitter: false, groupScoped: false },
      ]
    }
  });
  console.log("Updated TenantSettings in DB");
}

main().finally(() => prisma.$disconnect());
