const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const settings = await prisma.tenantSettings.findUnique({where: {id: 'default'}});
  if (settings && settings.statusLabelsConfig) {
    const updatedConfig = settings.statusLabelsConfig.map(status => {
      if (status.key === 'forwarded_to_registrar' && status.label === 'Forwarded to Manager') {
        return { ...status, label: 'Forwarded to Registrar' };
      }
      return status;
    });

    await prisma.tenantSettings.update({
      where: { id: 'default' },
      data: { statusLabelsConfig: updatedConfig }
    });
    console.log("Updated status label in DB.");
  } else {
    console.log("No settings or statusLabelsConfig found.");
  }
}

main().finally(() => prisma.$disconnect());
