/**
 * Giai đoạn 9 (làm sớm) — seed dữ liệu DEMO thực tế cho buổi bảo vệ, tách biệt hoàn toàn khỏi
 * `seed.ts` gốc (chỉ chạy thủ công qua `npm run seed:demo`, không chạy qua `migrate reset`).
 *
 * Giả định bắt buộc trước khi chạy: tenant `demo-company` đã tồn tại (seed.ts gốc), Workflow
 * "Software Development" đúng cấu trúc gốc (8 transition: Start/Begin Dev/Submit for
 * Review/Approve/Request Changes/Pass QA/Fail QA/Reopen), Project "Website Redesign" tồn tại và
 * KHÔNG còn Task nào (đã dọn dữ liệu test tay trước đó — xem DECISIONS.md mục dọn dẹp Giai
 * đoạn 9). Idempotent ở mức thô: nếu Custom Field "Story Points" đã tồn tại, script dừng ngay để
 * tránh tạo trùng — muốn seed lại phải tự dọn dữ liệu demo cũ trước.
 *
 * Toàn bộ hành động "chuyển trạng thái" mô phỏng ở đây đều ghi task_history (Mục 3.11 CLAUDE.md:
 * không có ngoại lệ kể cả gọi từ script/seed).
 */
import { PrismaClient, Task, CustomFieldType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const NOW = new Date();
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY);
const hoursFromCreation = (base: Date, h: number) =>
  new Date(base.getTime() + h * HOUR);
const hash = (pw: string) => bcrypt.hash(pw, 10);

async function main() {
  const existingField = await prisma.customField.findFirst({
    where: { name: 'Story Points' },
  });
  if (existingField) {
    console.log(
      'Custom Field "Story Points" đã tồn tại — dữ liệu demo có vẻ đã seed rồi, script dừng để' +
        ' tránh trùng lặp. Muốn seed lại phải tự dọn dữ liệu demo cũ trước.',
    );
    return;
  }

  // ============================================================
  // PHẦN 1 — Mở rộng demo-company: Custom Field, Employee, Task
  // ============================================================
  const tenantRow = await prisma.tenant.findUnique({
    where: { slug: 'demo-company' },
  });
  if (!tenantRow)
    throw new Error(
      'Không tìm thấy tenant demo-company — chạy `npx prisma db seed` trước.',
    );
  const tenant = tenantRow;

  const developerRole = await prisma.role.findFirstOrThrow({
    where: { tenantId: tenant.id, name: 'Developer' },
  });
  const testerRole = await prisma.role.findFirstOrThrow({
    where: { tenantId: tenant.id, name: 'Tester' },
  });
  const testNotesField = await prisma.customField.findFirstOrThrow({
    where: { tenantId: tenant.id, name: 'Test Notes' },
  });

  const storyPointsField = await prisma.customField.create({
    data: {
      tenantId: tenant.id,
      name: 'Story Points',
      fieldType: 'NUMBER',
      isRequired: true,
    },
  });
  const testDateField = await prisma.customField.create({
    data: {
      tenantId: tenant.id,
      name: 'Ngày kiểm thử',
      fieldType: 'DATE',
      isRequired: true,
    },
  });
  const securityCheckedField = await prisma.customField.create({
    data: {
      tenantId: tenant.id,
      name: 'Đã kiểm tra bảo mật',
      fieldType: 'BOOLEAN',
      isRequired: true,
      defaultValue: 'false',
    },
  });

  const workflow = await prisma.workflow.findFirstOrThrow({
    where: { tenantId: tenant.id, name: 'Software Development' },
    include: { states: true, transitions: true },
  });
  const stateIdByName = Object.fromEntries(
    workflow.states.map((s) => [s.name, s.id]),
  );
  const submitForReview = workflow.transitions.find(
    (t) =>
      t.name === 'Submit for Review' &&
      t.fromStateId === stateIdByName['Development'],
  );
  if (!submitForReview)
    throw new Error('Không tìm thấy transition "Submit for Review" gốc.');
  await prisma.workflowTransition.update({
    where: { id: submitForReview.id },
    data: {
      condition: {
        requireCustomFields: [
          testNotesField.id,
          storyPointsField.id,
          testDateField.id,
          securityCheckedField.id,
        ],
      },
    },
  });
  console.log(
    'Đã mở rộng điều kiện "Submit for Review" — yêu cầu đủ 4 kiểu Custom Field (Text/Number/Date/Boolean).',
  );

  async function upsertEmployee(
    email: string,
    fullName: string,
    roleId: string,
  ) {
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        passwordHash: await hash('Employee@123'),
        fullName,
        systemRole: 'EMPLOYEE',
        tenantId: tenant.id,
      },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId } },
      update: {},
      create: { userId: user.id, roleId },
    });
    return user;
  }

  const khoi = await upsertEmployee(
    'khoi.nguyen@demo.local',
    'Nguyễn Minh Khôi',
    developerRole.id,
  );
  const huong = await upsertEmployee(
    'huong.do@demo.local',
    'Đỗ Thị Hương',
    testerRole.id,
  );
  const anh = await upsertEmployee(
    'anh.vu@demo.local',
    'Vũ Đức Anh',
    developerRole.id,
  );
  const demoEmployee = await prisma.user.findUniqueOrThrow({
    where: { email: 'employee@demo.local' },
  });
  const demoManager = await prisma.user.findUniqueOrThrow({
    where: { email: 'manager@demo.local' },
  });
  console.log('Đã tạo 3 Employee demo mới:', [
    khoi.email,
    huong.email,
    anh.email,
  ]);

  // ---------- Helper mô phỏng transition thật, ghi đủ task_history ----------
  async function doTransition(
    task: Task,
    transitionName: string,
    actorId: string,
    atTime: Date,
  ): Promise<Task> {
    const transition = workflow.transitions.find(
      (t) => t.name === transitionName && t.fromStateId === task.currentStateId,
    );
    if (!transition) {
      throw new Error(
        `Không tìm thấy transition "${transitionName}" từ state hiện tại của Task "${task.title}"`,
      );
    }
    await prisma.taskHistory.create({
      data: {
        taskId: task.id,
        fromStateId: transition.fromStateId,
        toStateId: transition.toStateId,
        transitionId: transition.id,
        actionBy: actorId,
        actionAt: atTime,
      },
    });
    return prisma.task.update({
      where: { id: task.id },
      data: {
        currentStateId: transition.toStateId,
        version: { increment: 1 },
        updatedAt: atTime,
      },
    });
  }

  async function setCustomField(
    taskId: string,
    field: { id: string; fieldType: CustomFieldType },
    raw: string,
  ) {
    await prisma.customFieldValue.create({
      data: { taskId, customFieldId: field.id, value: raw },
    });
  }

  async function fillAllFourFields(
    taskId: string,
    storyPoints: number,
    testDate: Date,
    securityChecked: boolean,
  ) {
    await setCustomField(
      taskId,
      testNotesField,
      'Đã kiểm tra local, không phát hiện lỗi.',
    );
    await setCustomField(taskId, storyPointsField, String(storyPoints));
    await setCustomField(taskId, testDateField, testDate.toISOString());
    await setCustomField(
      taskId,
      securityCheckedField,
      securityChecked ? 'true' : 'false',
    );
  }

  const project1 = await prisma.project.findFirstOrThrow({
    where: { tenantId: tenant.id, name: 'Website Redesign' },
  });
  for (const userId of [
    demoManager.id,
    demoEmployee.id,
    khoi.id,
    huong.id,
    anh.id,
  ]) {
    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: project1.id, userId } },
      update: {},
      create: { projectId: project1.id, userId },
    });
  }

  // A. Done, đã khoá (completedAt) — full flow.
  {
    const createdAt = daysAgo(14);
    let task = await prisma.task.create({
      data: {
        tenantId: tenant.id,
        projectId: project1.id,
        title: 'Thiết kế lại trang chủ',
        currentStateId: stateIdByName['Backlog'],
        assigneeId: khoi.id,
        deadline: hoursFromCreation(createdAt, 8 * 24),
        createdAt,
        updatedAt: createdAt,
      },
    });
    let t = createdAt;
    task = await doTransition(
      task,
      'Start',
      khoi.id,
      (t = hoursFromCreation(t, 4)),
    );
    task = await doTransition(
      task,
      'Begin Dev',
      khoi.id,
      (t = hoursFromCreation(t, 20)),
    );
    await fillAllFourFields(task.id, 5, hoursFromCreation(t, 2), true);
    task = await doTransition(
      task,
      'Submit for Review',
      khoi.id,
      (t = hoursFromCreation(t, 30)),
    );
    task = await doTransition(
      task,
      'Approve',
      huong.id,
      (t = hoursFromCreation(t, 10)),
    );
    task = await doTransition(
      task,
      'Pass QA',
      huong.id,
      (t = hoursFromCreation(t, 8)),
    );
    await prisma.task.update({
      where: { id: task.id },
      data: { completedAt: t },
    });
  }

  // B. Done, đã khoá — assignee khác để đa dạng.
  {
    const createdAt = daysAgo(12);
    let task = await prisma.task.create({
      data: {
        tenantId: tenant.id,
        projectId: project1.id,
        title: 'Tối ưu tốc độ tải trang di động',
        currentStateId: stateIdByName['Backlog'],
        assigneeId: anh.id,
        deadline: hoursFromCreation(createdAt, 7 * 24),
        createdAt,
        updatedAt: createdAt,
      },
    });
    let t = createdAt;
    task = await doTransition(
      task,
      'Start',
      anh.id,
      (t = hoursFromCreation(t, 3)),
    );
    task = await doTransition(
      task,
      'Begin Dev',
      anh.id,
      (t = hoursFromCreation(t, 15)),
    );
    await fillAllFourFields(task.id, 8, hoursFromCreation(t, 2), true);
    task = await doTransition(
      task,
      'Submit for Review',
      anh.id,
      (t = hoursFromCreation(t, 25)),
    );
    task = await doTransition(
      task,
      'Approve',
      huong.id,
      (t = hoursFromCreation(t, 9)),
    );
    task = await doTransition(
      task,
      'Pass QA',
      huong.id,
      (t = hoursFromCreation(t, 6)),
    );
    await prisma.task.update({
      where: { id: task.id },
      data: { completedAt: t },
    });
  }

  // C. Đang ở QA — deadline sắp tới (rủi ro trung bình).
  {
    const createdAt = daysAgo(9);
    let task = await prisma.task.create({
      data: {
        tenantId: tenant.id,
        projectId: project1.id,
        title: 'Thêm chatbot hỗ trợ khách hàng',
        currentStateId: stateIdByName['Backlog'],
        assigneeId: demoEmployee.id,
        deadline: hoursFromCreation(NOW, 48),
        createdAt,
        updatedAt: createdAt,
      },
    });
    let t = createdAt;
    task = await doTransition(
      task,
      'Start',
      demoEmployee.id,
      (t = hoursFromCreation(t, 4)),
    );
    task = await doTransition(
      task,
      'Begin Dev',
      demoEmployee.id,
      (t = hoursFromCreation(t, 18)),
    );
    await fillAllFourFields(task.id, 3, hoursFromCreation(t, 2), true);
    task = await doTransition(
      task,
      'Submit for Review',
      demoEmployee.id,
      (t = hoursFromCreation(t, 20)),
    );
    await doTransition(
      task,
      'Approve',
      huong.id,
      (t = hoursFromCreation(t, 12)),
    );
  }

  // D. Đang ở Review — deadline đã trễ 1 ngày (rủi ro cao).
  {
    const createdAt = daysAgo(7);
    let task = await prisma.task.create({
      data: {
        tenantId: tenant.id,
        projectId: project1.id,
        title: 'Chuẩn hoá bộ nhận diện thương hiệu',
        currentStateId: stateIdByName['Backlog'],
        assigneeId: khoi.id,
        deadline: hoursFromCreation(NOW, -24),
        createdAt,
        updatedAt: createdAt,
      },
    });
    let t = createdAt;
    task = await doTransition(
      task,
      'Start',
      khoi.id,
      (t = hoursFromCreation(t, 3)),
    );
    task = await doTransition(
      task,
      'Begin Dev',
      khoi.id,
      (t = hoursFromCreation(t, 20)),
    );
    await fillAllFourFields(task.id, 5, hoursFromCreation(t, 2), true);
    await doTransition(
      task,
      'Submit for Review',
      khoi.id,
      (t = hoursFromCreation(t, 24)),
    );
  }

  // E. Đang ở Development — CHƯA điền Custom Field nào (demo modal cảnh báo thiếu field).
  {
    const createdAt = daysAgo(5);
    let task = await prisma.task.create({
      data: {
        tenantId: tenant.id,
        projectId: project1.id,
        title: 'Viết lại nội dung trang giới thiệu',
        currentStateId: stateIdByName['Backlog'],
        assigneeId: demoEmployee.id,
        deadline: hoursFromCreation(NOW, 72),
        createdAt,
        updatedAt: createdAt,
      },
    });
    let t = createdAt;
    task = await doTransition(
      task,
      'Start',
      demoEmployee.id,
      (t = hoursFromCreation(t, 4)),
    );
    await doTransition(
      task,
      'Begin Dev',
      demoEmployee.id,
      (t = hoursFromCreation(t, 15)),
    );
  }

  // F. Đang ở Development — điền THIẾU 2/4 field (demo "còn thiếu Ngày kiểm thử, Đã kiểm tra bảo mật").
  {
    const createdAt = daysAgo(4);
    let task = await prisma.task.create({
      data: {
        tenantId: tenant.id,
        projectId: project1.id,
        title: 'Tích hợp thanh toán trực tuyến',
        currentStateId: stateIdByName['Backlog'],
        assigneeId: anh.id,
        deadline: hoursFromCreation(NOW, 240),
        createdAt,
        updatedAt: createdAt,
      },
    });
    let t = createdAt;
    task = await doTransition(
      task,
      'Start',
      anh.id,
      (t = hoursFromCreation(t, 3)),
    );
    await doTransition(
      task,
      'Begin Dev',
      anh.id,
      (t = hoursFromCreation(t, 12)),
    );
    await setCustomField(
      task.id,
      testNotesField,
      'Đang kiểm thử luồng thanh toán VNPay.',
    );
    await setCustomField(task.id, storyPointsField, '13');
  }

  // G. Ready — chưa có assignee.
  await prisma.task.create({
    data: {
      tenantId: tenant.id,
      projectId: project1.id,
      title: 'Kiểm thử bảo mật biểu mẫu liên hệ',
      currentStateId: stateIdByName['Ready'],
      createdAt: daysAgo(2),
      updatedAt: daysAgo(2),
    },
  });

  // H, I. Backlog — chưa có assignee, minh hoạ Task không deadline không tính risk_score.
  await prisma.task.create({
    data: {
      tenantId: tenant.id,
      projectId: project1.id,
      title: 'Rà soát SEO toàn trang',
      currentStateId: stateIdByName['Backlog'],
      deadline: hoursFromCreation(NOW, 480),
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
    },
  });
  await prisma.task.create({
    data: {
      tenantId: tenant.id,
      projectId: project1.id,
      title: 'Cập nhật chính sách bảo mật & điều khoản',
      currentStateId: stateIdByName['Backlog'],
      createdAt: NOW,
      updatedAt: NOW,
    },
  });
  console.log('Đã tạo 9 Task cho Website Redesign, trải đều 6 State.');

  // ---------- Project 2: Mobile App Onboarding (cùng Workflow, team khác) ----------
  const project2 = await prisma.project.create({
    data: {
      tenantId: tenant.id,
      name: 'Mobile App Onboarding',
      workflowId: workflow.id,
    },
  });
  for (const userId of [demoManager.id, anh.id, huong.id]) {
    await prisma.projectMember.create({
      data: { projectId: project2.id, userId },
    });
  }

  {
    const createdAt = daysAgo(8);
    let task = await prisma.task.create({
      data: {
        tenantId: tenant.id,
        projectId: project2.id,
        title: 'Thiết kế màn hình chào mừng',
        currentStateId: stateIdByName['Backlog'],
        assigneeId: anh.id,
        deadline: hoursFromCreation(createdAt, 5 * 24),
        createdAt,
        updatedAt: createdAt,
      },
    });
    let t = createdAt;
    task = await doTransition(
      task,
      'Start',
      anh.id,
      (t = hoursFromCreation(t, 3)),
    );
    task = await doTransition(
      task,
      'Begin Dev',
      anh.id,
      (t = hoursFromCreation(t, 14)),
    );
    await fillAllFourFields(task.id, 5, hoursFromCreation(t, 2), true);
    task = await doTransition(
      task,
      'Submit for Review',
      anh.id,
      (t = hoursFromCreation(t, 20)),
    );
    task = await doTransition(
      task,
      'Approve',
      huong.id,
      (t = hoursFromCreation(t, 10)),
    );
    task = await doTransition(
      task,
      'Pass QA',
      huong.id,
      (t = hoursFromCreation(t, 7)),
    );
    await prisma.task.update({
      where: { id: task.id },
      data: { completedAt: t },
    });
  }
  {
    const createdAt = daysAgo(5);
    let task = await prisma.task.create({
      data: {
        tenantId: tenant.id,
        projectId: project2.id,
        title: 'Xây luồng đăng ký tài khoản',
        currentStateId: stateIdByName['Backlog'],
        assigneeId: anh.id,
        deadline: hoursFromCreation(NOW, -12),
        createdAt,
        updatedAt: createdAt,
      },
    });
    let t = createdAt;
    task = await doTransition(
      task,
      'Start',
      anh.id,
      (t = hoursFromCreation(t, 3)),
    );
    task = await doTransition(
      task,
      'Begin Dev',
      anh.id,
      (t = hoursFromCreation(t, 16)),
    );
    await fillAllFourFields(task.id, 8, hoursFromCreation(t, 2), true);
    await doTransition(
      task,
      'Submit for Review',
      anh.id,
      (t = hoursFromCreation(t, 22)),
    );
  }
  {
    const createdAt = daysAgo(3);
    let task = await prisma.task.create({
      data: {
        tenantId: tenant.id,
        projectId: project2.id,
        title: 'Viết hướng dẫn sử dụng trong app',
        currentStateId: stateIdByName['Backlog'],
        assigneeId: anh.id,
        deadline: hoursFromCreation(NOW, 96),
        createdAt,
        updatedAt: createdAt,
      },
    });
    let t = createdAt;
    task = await doTransition(
      task,
      'Start',
      anh.id,
      (t = hoursFromCreation(t, 3)),
    );
    await doTransition(
      task,
      'Begin Dev',
      anh.id,
      (t = hoursFromCreation(t, 10)),
    );
  }
  await prisma.task.create({
    data: {
      tenantId: tenant.id,
      projectId: project2.id,
      title: 'Thiết lập thông báo đẩy',
      currentStateId: stateIdByName['Ready'],
      createdAt: daysAgo(2),
      updatedAt: daysAgo(2),
    },
  });
  await prisma.task.create({
    data: {
      tenantId: tenant.id,
      projectId: project2.id,
      title: 'Nghiên cứu đối thủ cạnh tranh',
      currentStateId: stateIdByName['Backlog'],
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
    },
  });
  console.log('Đã tạo Project "Mobile App Onboarding" với 5 Task.');

  // ---------- Đơn từ mẫu ----------
  await prisma.leaveRequest.create({
    data: {
      tenantId: tenant.id,
      userId: demoEmployee.id,
      type: 'LEAVE',
      startDate: daysAgo(6),
      endDate: daysAgo(5),
      reason: 'Về quê giải quyết việc gia đình',
      status: 'APPROVED',
      reviewedBy: demoManager.id,
      reviewedAt: daysAgo(6),
      reviewComment: 'Đã duyệt.',
      createdAt: daysAgo(7),
    },
  });
  await prisma.leaveRequest.create({
    data: {
      tenantId: tenant.id,
      userId: khoi.id,
      type: 'LEAVE',
      startDate: hoursFromCreation(NOW, 72),
      endDate: hoursFromCreation(NOW, 96),
      reason: 'Khám sức khoẻ định kỳ',
      status: 'PENDING',
      createdAt: daysAgo(1),
    },
  });
  console.log('Đã tạo 2 đơn từ mẫu (1 đã duyệt, 1 đang chờ).');

  // ============================================================
  // PHẦN 2 — Tenant thứ 2 độc lập: BrightWave Creative (marketing/thiết kế)
  // ============================================================
  const tenant2 = await prisma.tenant.create({
    data: {
      name: 'BrightWave Creative',
      slug: 'brightwave-creative',
      config: { create: {} },
    },
  });

  await prisma.user.create({
    data: {
      email: 'admin@brightwave.local',
      passwordHash: await hash('Admin@123'),
      fullName: 'Admin BrightWave',
      systemRole: 'ADMIN',
      tenantId: tenant2.id,
    },
  });
  const bwManager = await prisma.user.create({
    data: {
      email: 'manager@brightwave.local',
      passwordHash: await hash('Manager@123'),
      fullName: 'Quản lý BrightWave',
      systemRole: 'MANAGER',
      tenantId: tenant2.id,
    },
  });
  const designerRole = await prisma.role.create({
    data: {
      tenantId: tenant2.id,
      name: 'Designer',
      description: 'Thiết kế hình ảnh, bộ nhận diện thương hiệu',
    },
  });
  const copywriterRole = await prisma.role.create({
    data: {
      tenantId: tenant2.id,
      name: 'Copywriter',
      description: 'Viết nội dung, làm việc với khách hàng',
    },
  });
  const bwTruc = await prisma.user.create({
    data: {
      email: 'truc.ngo@brightwave.local',
      passwordHash: await hash('Employee@123'),
      fullName: 'Ngô Thanh Trúc',
      systemRole: 'EMPLOYEE',
      tenantId: tenant2.id,
    },
  });
  await prisma.userRole.create({
    data: { userId: bwTruc.id, roleId: designerRole.id },
  });
  const bwHan = await prisma.user.create({
    data: {
      email: 'han.bui@brightwave.local',
      passwordHash: await hash('Employee@123'),
      fullName: 'Bùi Gia Hân',
      systemRole: 'EMPLOYEE',
      tenantId: tenant2.id,
    },
  });
  await prisma.userRole.create({
    data: { userId: bwHan.id, roleId: copywriterRole.id },
  });
  console.log(
    'Đã tạo tenant "BrightWave Creative" + 4 tài khoản (Admin/Manager/2 Employee).',
  );

  const bwWorkflow = await prisma.workflow.create({
    data: { tenantId: tenant2.id, name: 'Creative Production' },
  });
  const [brief, concept, design, clientReview, revision, approved] =
    await Promise.all([
      prisma.workflowState.create({
        data: {
          workflowId: bwWorkflow.id,
          name: 'Brief',
          isStart: true,
          orderIndex: 0,
        },
      }),
      prisma.workflowState.create({
        data: { workflowId: bwWorkflow.id, name: 'Concept', orderIndex: 1 },
      }),
      prisma.workflowState.create({
        data: { workflowId: bwWorkflow.id, name: 'Design', orderIndex: 2 },
      }),
      prisma.workflowState.create({
        data: {
          workflowId: bwWorkflow.id,
          name: 'Client Review',
          orderIndex: 3,
        },
      }),
      prisma.workflowState.create({
        data: { workflowId: bwWorkflow.id, name: 'Revision', orderIndex: 4 },
      }),
      prisma.workflowState.create({
        data: {
          workflowId: bwWorkflow.id,
          name: 'Approved',
          isEnd: true,
          orderIndex: 5,
        },
      }),
    ]);
  await prisma.workflowTransition.createMany({
    data: [
      {
        workflowId: bwWorkflow.id,
        name: 'Nhận Brief',
        fromStateId: brief.id,
        toStateId: concept.id,
        allowRoles: [],
      },
      {
        workflowId: bwWorkflow.id,
        name: 'Lên Concept',
        fromStateId: concept.id,
        toStateId: design.id,
        allowRoles: [designerRole.id],
        condition: { requireAssignee: true },
      },
      {
        workflowId: bwWorkflow.id,
        name: 'Gửi Duyệt',
        fromStateId: design.id,
        toStateId: clientReview.id,
        allowRoles: [designerRole.id],
      },
      {
        workflowId: bwWorkflow.id,
        name: 'Khách duyệt',
        fromStateId: clientReview.id,
        toStateId: approved.id,
        allowRoles: [copywriterRole.id],
      },
      {
        workflowId: bwWorkflow.id,
        name: 'Khách yêu cầu chỉnh sửa',
        fromStateId: clientReview.id,
        toStateId: revision.id,
        allowRoles: [copywriterRole.id],
      },
      {
        workflowId: bwWorkflow.id,
        name: 'Hoàn tất chỉnh sửa',
        fromStateId: revision.id,
        toStateId: design.id,
        allowRoles: [designerRole.id],
      },
    ],
  });
  const bwWorkflowFull = await prisma.workflow.findUniqueOrThrow({
    where: { id: bwWorkflow.id },
    include: { states: true, transitions: true },
  });
  const bwStateId = Object.fromEntries(
    bwWorkflowFull.states.map((s) => [s.name, s.id]),
  );
  async function doBwTransition(
    task: Task,
    transitionName: string,
    actorId: string,
    atTime: Date,
  ): Promise<Task> {
    const transition = bwWorkflowFull.transitions.find(
      (t) => t.name === transitionName && t.fromStateId === task.currentStateId,
    );
    if (!transition)
      throw new Error(
        `BrightWave: không tìm thấy transition "${transitionName}"`,
      );
    await prisma.taskHistory.create({
      data: {
        taskId: task.id,
        fromStateId: transition.fromStateId,
        toStateId: transition.toStateId,
        transitionId: transition.id,
        actionBy: actorId,
        actionAt: atTime,
      },
    });
    return prisma.task.update({
      where: { id: task.id },
      data: {
        currentStateId: transition.toStateId,
        version: { increment: 1 },
        updatedAt: atTime,
      },
    });
  }
  console.log(
    'Đã tạo Workflow "Creative Production" (6 state / 6 transition, khác cấu trúc Software Development).',
  );

  const bwProject = await prisma.project.create({
    data: {
      tenantId: tenant2.id,
      name: 'TechNova Rebrand Package',
      workflowId: bwWorkflow.id,
    },
  });
  for (const userId of [bwManager.id, bwTruc.id, bwHan.id]) {
    await prisma.projectMember.create({
      data: { projectId: bwProject.id, userId },
    });
  }

  {
    const createdAt = daysAgo(10);
    let task = await prisma.task.create({
      data: {
        tenantId: tenant2.id,
        projectId: bwProject.id,
        title: 'Thiết kế logo mới',
        currentStateId: bwStateId['Brief'],
        assigneeId: bwTruc.id,
        deadline: hoursFromCreation(createdAt, 6 * 24),
        createdAt,
        updatedAt: createdAt,
      },
    });
    let t = createdAt;
    task = await doBwTransition(
      task,
      'Nhận Brief',
      bwTruc.id,
      (t = hoursFromCreation(t, 4)),
    );
    task = await doBwTransition(
      task,
      'Lên Concept',
      bwTruc.id,
      (t = hoursFromCreation(t, 24)),
    );
    task = await doBwTransition(
      task,
      'Gửi Duyệt',
      bwTruc.id,
      (t = hoursFromCreation(t, 30)),
    );
    task = await doBwTransition(
      task,
      'Khách duyệt',
      bwHan.id,
      (t = hoursFromCreation(t, 20)),
    );
    await prisma.task.update({
      where: { id: task.id },
      data: { completedAt: t },
    });
  }
  {
    const createdAt = daysAgo(6);
    let task = await prisma.task.create({
      data: {
        tenantId: tenant2.id,
        projectId: bwProject.id,
        title: 'Thiết kế bộ nhận diện thương hiệu',
        currentStateId: bwStateId['Brief'],
        assigneeId: bwTruc.id,
        deadline: hoursFromCreation(NOW, -6),
        createdAt,
        updatedAt: createdAt,
      },
    });
    let t = createdAt;
    task = await doBwTransition(
      task,
      'Nhận Brief',
      bwTruc.id,
      (t = hoursFromCreation(t, 5)),
    );
    task = await doBwTransition(
      task,
      'Lên Concept',
      bwTruc.id,
      (t = hoursFromCreation(t, 22)),
    );
    await doBwTransition(
      task,
      'Gửi Duyệt',
      bwTruc.id,
      (t = hoursFromCreation(t, 28)),
    );
  }
  {
    const createdAt = daysAgo(4);
    let task = await prisma.task.create({
      data: {
        tenantId: tenant2.id,
        projectId: bwProject.id,
        title: 'Viết nội dung landing page',
        currentStateId: bwStateId['Brief'],
        assigneeId: bwTruc.id,
        deadline: hoursFromCreation(NOW, 120),
        createdAt,
        updatedAt: createdAt,
      },
    });
    let t = createdAt;
    task = await doBwTransition(
      task,
      'Nhận Brief',
      bwTruc.id,
      (t = hoursFromCreation(t, 4)),
    );
    await doBwTransition(
      task,
      'Lên Concept',
      bwTruc.id,
      (t = hoursFromCreation(t, 15)),
    );
  }
  {
    const createdAt = daysAgo(2);
    const task = await prisma.task.create({
      data: {
        tenantId: tenant2.id,
        projectId: bwProject.id,
        title: 'Lên concept bộ ảnh quảng cáo',
        currentStateId: bwStateId['Brief'],
        assigneeId: bwTruc.id,
        deadline: hoursFromCreation(NOW, 200),
        createdAt,
        updatedAt: createdAt,
      },
    });
    await doBwTransition(
      task,
      'Nhận Brief',
      bwTruc.id,
      hoursFromCreation(createdAt, 5),
    );
  }
  await prisma.task.create({
    data: {
      tenantId: tenant2.id,
      projectId: bwProject.id,
      title: 'Tiếp nhận yêu cầu từ khách hàng TechNova',
      currentStateId: bwStateId['Brief'],
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
    },
  });
  console.log(
    'Đã tạo Project "TechNova Rebrand Package" với 5 Task cho tenant BrightWave Creative.',
  );

  console.log('\nSEED DEMO HOÀN TẤT.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
