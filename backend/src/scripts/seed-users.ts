import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

async function main() {
  console.log('🌱 Seeding users...');

  const password = await hashPassword('Password123!');

  const admin = await prisma.user.upsert({
    where: { email: 'admin@smartpick.com' },
    update: {},
    create: {
      email: 'admin@smartpick.com',
      passwordHash: password,
      firstName: 'System',
      lastName: 'Administrator',
      isActive: true,
      roles: {
        create: { role: Role.ADMIN },
      },
    },
  });
  console.log('✓ Created ADMIN:', admin.email);

  const safetyOfficer = await prisma.user.upsert({
    where: { email: 'safety@smartpick.com' },
    update: {},
    create: {
      email: 'safety@smartpick.com',
      passwordHash: password,
      firstName: 'Sarah',
      lastName: 'Safety',
      isActive: true,
      roles: {
        create: { role: Role.SAFETY_OFFICER },
      },
    },
  });
  console.log('✓ Created SAFETY_OFFICER:', safetyOfficer.email);

  const supervisor = await prisma.user.upsert({
    where: { email: 'supervisor@smartpick.com' },
    update: {},
    create: {
      email: 'supervisor@smartpick.com',
      passwordHash: password,
      firstName: 'Mike',
      lastName: 'Supervisor',
      isActive: true,
      roles: {
        create: { role: Role.SUPERVISOR },
      },
    },
  });
  console.log('✓ Created SUPERVISOR:', supervisor.email);

  const warehouses = await prisma.warehouse.findMany({ take: 1 });
  if (warehouses.length > 0) {
    await prisma.userWarehouse.upsert({
      where: {
        userId_warehouseId: {
          userId: supervisor.id,
          warehouseId: warehouses[0].id,
        },
      },
      update: {},
      create: {
        userId: supervisor.id,
        warehouseId: warehouses[0].id,
      },
    });
    console.log(`✓ Assigned supervisor to warehouse: ${warehouses[0].name}`);
  }

  const operator = await prisma.user.upsert({
    where: { email: 'operator@smartpick.com' },
    update: {},
    create: {
      email: 'operator@smartpick.com',
      passwordHash: password,
      firstName: 'John',
      lastName: 'Operator',
      isActive: true,
      roles: {
        create: { role: Role.OPERATOR },
      },
    },
  });
  console.log('✓ Created OPERATOR:', operator.email);

  console.log('\n✅ Seed complete!');
  console.log('\n📋 Test Credentials:');
  console.log('   Email: admin@smartpick.com | Password: Password123!');
  console.log('   Email: safety@smartpick.com | Password: Password123!');
  console.log('   Email: supervisor@smartpick.com | Password: Password123!');
  console.log('   Email: operator@smartpick.com | Password: Password123!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
