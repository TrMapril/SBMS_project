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
  const testerRole = await prisma.role.upsert({
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

  // ---------- Giai đoạn 2: workflow mẫu dạng directed graph có vòng lặp ----------
  let workflow = await prisma.workflow.findFirst({
    where: { tenantId: tenant.id, name: 'Software Development' },
  });

  if (!workflow) {
    workflow = await prisma.workflow.create({
      data: { tenantId: tenant.id, name: 'Software Development' },
    });

    const [backlog, ready, development, review, qa, done] =
      await Promise.all([
        prisma.workflowState.create({
          data: { workflowId: workflow.id, name: 'Backlog', isStart: true, orderIndex: 0 },
        }),
        prisma.workflowState.create({
          data: { workflowId: workflow.id, name: 'Ready', orderIndex: 1 },
        }),
        prisma.workflowState.create({
          data: { workflowId: workflow.id, name: 'Development', orderIndex: 2 },
        }),
        prisma.workflowState.create({
          data: { workflowId: workflow.id, name: 'Review', orderIndex: 3 },
        }),
        prisma.workflowState.create({
          data: { workflowId: workflow.id, name: 'QA', orderIndex: 4 },
        }),
        prisma.workflowState.create({
          data: { workflowId: workflow.id, name: 'Done', isEnd: true, orderIndex: 5 },
        }),
      ]);

    await prisma.workflowTransition.createMany({
      data: [
        {
          workflowId: workflow.id,
          name: 'Start',
          fromStateId: backlog.id,
          toStateId: ready.id,
          allowRoles: [],
        },
        {
          workflowId: workflow.id,
          name: 'Begin Dev',
          fromStateId: ready.id,
          toStateId: development.id,
          allowRoles: [developerRole.id],
          condition: { requireAssignee: true },
        },
        {
          workflowId: workflow.id,
          name: 'Submit for Review',
          fromStateId: development.id,
          toStateId: review.id,
          allowRoles: [developerRole.id],
          condition: { requireCustomFields: ['test-notes'] },
        },
        {
          workflowId: workflow.id,
          name: 'Approve',
          fromStateId: review.id,
          toStateId: qa.id,
          allowRoles: [testerRole.id],
        },
        {
          workflowId: workflow.id,
          name: 'Request Changes',
          fromStateId: review.id,
          toStateId: development.id,
          allowRoles: [testerRole.id],
        },
        {
          workflowId: workflow.id,
          name: 'Pass QA',
          fromStateId: qa.id,
          toStateId: done.id,
          allowRoles: [testerRole.id],
        },
        {
          workflowId: workflow.id,
          name: 'Fail QA',
          fromStateId: qa.id,
          toStateId: development.id,
          allowRoles: [testerRole.id],
        },
        {
          workflowId: workflow.id,
          name: 'Reopen',
          fromStateId: done.id,
          toStateId: backlog.id,
          allowRoles: [],
        },
      ],
    });

    await prisma.task.createMany({
      data: [
        {
          tenantId: tenant.id,
          title: 'Demo Task 1 - tại Backlog',
          currentStateId: backlog.id,
        },
        {
          tenantId: tenant.id,
          title: 'Demo Task 2 - tại Ready (chưa có assignee)',
          currentStateId: ready.id,
        },
        {
          tenantId: tenant.id,
          title: 'Demo Task 3 - tại Development (thiếu custom field)',
          currentStateId: development.id,
          assigneeId: employee.id,
        },
        {
          tenantId: tenant.id,
          title: 'Demo Task 4 - tại Development (đủ điều kiện Submit for Review)',
          currentStateId: development.id,
          assigneeId: employee.id,
          customFieldValues: { 'test-notes': 'Đã kiểm tra local' },
        },
      ],
    });
  }

  // ---------- Workflow Template mẫu để test API import (Mục 3.10) ----------
  const templateExists = await prisma.workflowTemplate.findFirst({
    where: { name: 'Simple Approval' },
  });
  if (!templateExists) {
    await prisma.workflowTemplate.create({
      data: {
        name: 'Simple Approval',
        description: 'Quy trình phê duyệt đơn giản 3 bước: Draft → Pending → Approved/Rejected',
        definition: {
          states: [
            { tempId: 's1', name: 'Draft', isStart: true, orderIndex: 0 },
            { tempId: 's2', name: 'Pending', orderIndex: 1 },
            { tempId: 's3', name: 'Approved', isEnd: true, orderIndex: 2 },
            { tempId: 's4', name: 'Rejected', isEnd: true, orderIndex: 3 },
          ],
          transitions: [
            { name: 'Submit', fromTempId: 's1', toTempId: 's2' },
            { name: 'Approve', fromTempId: 's2', toTempId: 's3' },
            { name: 'Reject', fromTempId: 's2', toTempId: 's4' },
          ],
        },
      },
    });
  }

  console.log('Seed hoàn tất:', {
    tenant: tenant.slug,
    users: [admin.email, manager.email, employee.email],
    workflow: workflow.name,
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
