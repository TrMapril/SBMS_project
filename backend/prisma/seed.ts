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

  // ---------- Giai đoạn 3: Custom Field mẫu (Task 3/4 dùng để test condition) ----------
  const testNotesField = await prisma.customField.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Test Notes' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Test Notes',
      fieldType: 'TEXT',
      isRequired: true,
    },
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
          condition: { requireCustomFields: [testNotesField.id] },
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
  }

  // Đảm bảo transition "Submit for Review" luôn trỏ đúng id thật của CustomField "Test Notes"
  // — cần chạy độc lập với khối `if (!workflow)` ở trên vì workflow này có thể đã tồn tại từ
  // trước khi CustomField "Test Notes" được tạo (ví dụ dữ liệu tạo ở Giai đoạn 2), lúc đó
  // condition vẫn còn giữ placeholder chuỗi 'test-notes' cũ chứ không phải id thật.
  await prisma.workflowTransition.updateMany({
    where: { workflowId: workflow.id, name: 'Submit for Review' },
    data: { condition: { requireCustomFields: [testNotesField.id] } },
  });

  // ---------- Giai đoạn 3: Project gắn 1-1 với Workflow ở trên ----------
  let project = await prisma.project.findFirst({
    where: { tenantId: tenant.id, name: 'Website Redesign' },
  });
  if (!project) {
    project = await prisma.project.create({
      data: { tenantId: tenant.id, name: 'Website Redesign', workflowId: workflow.id },
    });
  }

  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: project.id, userId: manager.id } },
    update: {},
    create: { projectId: project.id, userId: manager.id },
  });
  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: project.id, userId: employee.id } },
    update: {},
    create: { projectId: project.id, userId: employee.id },
  });

  // ---------- Giai đoạn 3: 4 Task mẫu gắn Project, dùng để test WorkflowEngineService ----------
  const existingTaskCount = await prisma.task.count({ where: { projectId: project.id } });
  if (existingTaskCount === 0) {
    const states = await prisma.workflowState.findMany({ where: { workflowId: workflow.id } });
    const stateIdByName = Object.fromEntries(states.map((s) => [s.name, s.id]));

    await prisma.task.create({
      data: {
        tenantId: tenant.id,
        projectId: project.id,
        title: 'Demo Task 1 - tại Backlog',
        currentStateId: stateIdByName['Backlog'],
      },
    });
    await prisma.task.create({
      data: {
        tenantId: tenant.id,
        projectId: project.id,
        title: 'Demo Task 2 - tại Ready (chưa có assignee)',
        currentStateId: stateIdByName['Ready'],
      },
    });
    await prisma.task.create({
      data: {
        tenantId: tenant.id,
        projectId: project.id,
        title: 'Demo Task 3 - tại Development (thiếu custom field)',
        currentStateId: stateIdByName['Development'],
        assigneeId: employee.id,
      },
    });
    const task4 = await prisma.task.create({
      data: {
        tenantId: tenant.id,
        projectId: project.id,
        title: 'Demo Task 4 - tại Development (đủ điều kiện Submit for Review)',
        currentStateId: stateIdByName['Development'],
        assigneeId: employee.id,
      },
    });
    await prisma.customFieldValue.create({
      data: {
        taskId: task4.id,
        customFieldId: testNotesField.id,
        value: 'Đã kiểm tra local',
      },
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

  // ---------- Phase 7.5 Đợt 2 — đa dạng hoá Workflow Template (thêm 3 mẫu ngoài "Simple
  // Approval" đã có từ Giai đoạn 2) ----------
  const extraTemplates: {
    name: string;
    description: string;
    definition: {
      states: { tempId: string; name: string; isStart?: boolean; isEnd?: boolean; orderIndex: number }[];
      transitions: { name: string; fromTempId: string; toTempId: string }[];
    };
  }[] = [
    {
      name: 'Bug Tracking',
      description:
        'Quy trình theo dõi lỗi: New → Confirmed → In Progress → Fixed → Verified → Closed',
      definition: {
        states: [
          { tempId: 's1', name: 'New', isStart: true, orderIndex: 0 },
          { tempId: 's2', name: 'Confirmed', orderIndex: 1 },
          { tempId: 's3', name: 'In Progress', orderIndex: 2 },
          { tempId: 's4', name: 'Fixed', orderIndex: 3 },
          { tempId: 's5', name: 'Verified', orderIndex: 4 },
          { tempId: 's6', name: 'Closed', isEnd: true, orderIndex: 5 },
        ],
        transitions: [
          { name: 'Confirm', fromTempId: 's1', toTempId: 's2' },
          { name: 'Start Fixing', fromTempId: 's2', toTempId: 's3' },
          { name: 'Mark Fixed', fromTempId: 's3', toTempId: 's4' },
          { name: 'Verify', fromTempId: 's4', toTempId: 's5' },
          { name: 'Reopen', fromTempId: 's5', toTempId: 's3' },
          { name: 'Close', fromTempId: 's5', toTempId: 's6' },
        ],
      },
    },
    {
      name: 'Content Approval',
      description: 'Quy trình duyệt nội dung: Draft → Review → Approved/Rejected → Published',
      definition: {
        states: [
          { tempId: 's1', name: 'Draft', isStart: true, orderIndex: 0 },
          { tempId: 's2', name: 'Review', orderIndex: 1 },
          { tempId: 's3', name: 'Approved', orderIndex: 2 },
          { tempId: 's4', name: 'Rejected', isEnd: true, orderIndex: 3 },
          { tempId: 's5', name: 'Published', isEnd: true, orderIndex: 4 },
        ],
        transitions: [
          { name: 'Submit for Review', fromTempId: 's1', toTempId: 's2' },
          { name: 'Approve', fromTempId: 's2', toTempId: 's3' },
          { name: 'Reject', fromTempId: 's2', toTempId: 's4' },
          { name: 'Publish', fromTempId: 's3', toTempId: 's5' },
        ],
      },
    },
    {
      name: 'Simple Kanban',
      description: 'Kanban tối giản: To Do → Doing → Done',
      definition: {
        states: [
          { tempId: 's1', name: 'To Do', isStart: true, orderIndex: 0 },
          { tempId: 's2', name: 'Doing', orderIndex: 1 },
          { tempId: 's3', name: 'Done', isEnd: true, orderIndex: 2 },
        ],
        transitions: [
          { name: 'Start', fromTempId: 's1', toTempId: 's2' },
          { name: 'Complete', fromTempId: 's2', toTempId: 's3' },
          { name: 'Reopen', fromTempId: 's3', toTempId: 's1' },
        ],
      },
    },
  ];
  for (const tpl of extraTemplates) {
    const exists = await prisma.workflowTemplate.findFirst({ where: { name: tpl.name } });
    if (!exists) {
      await prisma.workflowTemplate.create({ data: tpl });
    }
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
