const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const settings = await prisma.tenantSettings.findUnique({where: {id: 'default'}});
  console.log(JSON.stringify(settings.statusLabelsConfig, null, 2));
}

main().finally(() => prisma.$disconnect());
