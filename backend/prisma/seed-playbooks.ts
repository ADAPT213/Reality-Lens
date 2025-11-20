import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.clarityPlaybook.upsert({
    where: { code: 'REPLEN_NIGHT_SHIFT' },
    update: {
      title: 'Night shift replen focus',
      audience: 'replen',
      stepsJson: [
        {
          id: 'hit_red_zones_first',
          title: 'Secure red zones',
          description: 'Work red risk locations first until each drops below threshold.',
          condition: { overloadMax: 80, clarityMin: 40 },
        },
        {
          id: 'clear_jams',
          title: 'Clear physical bottlenecks',
          description: 'Remove pallets or obstructions in aisles feeding red zones.',
          condition: { alertsMin: 1 },
        },
      ],
    },
    create: {
      code: 'REPLEN_NIGHT_SHIFT',
      name: 'Replen Night Shift',
      title: 'Night shift replen focus',
      audience: 'replen',
      config: {},
      stepsJson: [
        {
          id: 'hit_red_zones_first',
          title: 'Secure red zones',
          description: 'Work red risk locations first until each drops below threshold.',
          condition: { overloadMax: 80, clarityMin: 40 },
        },
        {
          id: 'clear_jams',
          title: 'Clear physical bottlenecks',
          description: 'Remove pallets or obstructions in aisles feeding red zones.',
          condition: { alertsMin: 1 },
        },
      ],
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
