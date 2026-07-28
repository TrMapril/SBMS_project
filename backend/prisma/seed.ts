import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function hash(password: string) {
  return bcrypt.hash(password, 10);
}

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo-company' },
    update: {},
    create: {
      name: 'Demo Company',
      slug: 'demo-company',
      config: { create: {} },
    },
  });

  await prisma.user.upsert({
    where: { email: 'superadmin@sbms.local' },
    update: {},
    create: {
      email: 'superadmin@sbms.local',
      passwordHash: await hash('SuperAdmin@123'),
      fullName: 'Super Admin',
      systemRole: 'SUPER_ADMIN',
      tenantId: null,
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@demo.local' },
    update: {},
    create: {
      email: 'admin@demo.local',
      passwordHash: await hash('Admin@123'),
      fullName: 'Demo Admin',
      systemRole: 'ADMIN',
      tenantId: tenant.id,
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: 'manager@demo.local' },
    update: {},
    create: {
      email: 'manager@demo.local',
      passwordHash: await hash('Manager@123'),
      fullName: 'Demo Manager',
      systemRole: 'MANAGER',
      tenantId: tenant.id,
    },
  });

  const employee = await prisma.user.upsert({
    where: { email: 'employee@demo.local' },
    update: {},
    create: {
      email: 'employee@demo.local',
      passwordHash: await hash('Employee@123'),
      fullName: 'Demo Employee',
      systemRole: 'EMPLOYEE',
      tenantId: tenant.id,
    },
  });

  // Custom Role mẫu để test module roles (không thuộc DoD bắt buộc, chỉ hỗ trợ test tay).
  const developerRole = await prisma.role.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Developer' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Developer' },
  });
  await prisma.role.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Tester' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Tester' },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: { userId: employee.id, roleId: developerRole.id },
    },
    update: {},
    create: { userId: employee.id, roleId: developerRole.id },
  });

  console.log('Seed hoàn tất:', {
    tenant: tenant.slug,
    users: [admin.email, manager.email, employee.email],
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
