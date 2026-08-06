/**
 * Seed dữ liệu lịch sử task_history giả lập cho Giai đoạn 5 (Bộ ba thuật toán & Dashboard).
 *
 * TÁCH BIỆT HOÀN TOÀN khỏi `seed.ts` gốc (không chạy qua `npx prisma db seed`/`migrate reset`,
 * chỉ chạy thủ công qua `npm run seed:algorithm-history`) — theo đúng yêu cầu "không lẫn vào dữ
 * liệu seed gốc". Toàn bộ dữ liệu tạo ở đây đều thuộc:
 *   - Project riêng "Algorithm Demo Data" (không đụng tới "Website Redesign").
 *   - 3 user Employee riêng, tiền tố email `algo.` (không đụng tới employee@demo.local).
 *   - Task đều có tiêu đề tiền tố "Algo Demo:" để dễ nhận diện/xoá riêng nếu cần.
 *
 * Idempotent: nếu Project "Algorithm Demo Data" đã tồn tại, script dừng ngay, không tạo trùng.
 * Nếu cần seed lại từ đầu, phải tự xoá Project đó trước (in rõ số dòng sẽ ảnh hưởng và xác nhận
 * trước khi xoá — không tự động hoá việc xoá trong chính script này).
 *
 * Mục đích: cả 3 thuật toán đều cần dữ liệu lịch sử trải dài nhiều ngày mới có ý nghĩa để test:
 *   - Alice: hoàn thành nhanh, đúng hạn, không bị trả về → điểm gợi ý phân công cao nhất.
 *   - Bob: xử lý chậm hơn, có Task bị "Request Changes"/"Fail QA" (trả về), có Task trễ hạn.
 *   - Carol: đang ôm nhiều Task active cùng lúc (workload cao) → điểm W1 thấp dù các mặt khác ổn.
 *   - State "Review" cố tình có avg dwell time cao nhất, transition "Request Changes" là backward
 *     transition chiếm đa số → heatmap bottleneck (Thuật toán 3) có tín hiệu rõ ràng để demo.
 *   - Vài Task active có deadline rất gần/đã quá hạn → risk_score sẽ vượt 70% khi cron chạy.
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const NOW = new Date();
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * DAY);
}

interface StepSpec {
  transitionName: string;
  /** Số giờ Task nằm ở State trước đó, TRƯỚC KHI transition này xảy ra. */
  dwellHours: number;
}

interface TaskSpec {
  title: string;
  assigneeEmail: string;
  createdDaysAgo: number;
  /** null = không có deadline. */
  deadlineHoursFromCreation: number | null;
  steps: StepSpec[];
}

const REWORK_VIA_REQUEST_CHANGES: StepSpec[] = [
  { transitionName: 'Request Changes', dwellHours: 80 }, // nằm ở Review rất lâu trước khi bị trả về
  { transitionName: 'Submit for Review', dwellHours: 40 }, // sửa lại ở Development
];

const REWORK_VIA_FAIL_QA: StepSpec[] = [
  { transitionName: 'Fail QA', dwellHours: 20 },
  { transitionName: 'Submit for Review', dwellHours: 35 },
];

const TASK_SPECS: TaskSpec[] = [
  // ---------- Alice — nhanh, đúng hạn, không bị trả về (6 Task) ----------
  {
    title: 'Algo Demo: Landing page copy',
    assigneeEmail: 'algo.alice@demo.local',
    createdDaysAgo: 40,
    deadlineHoursFromCreation: 240,
    steps: [
      { transitionName: 'Start', dwellHours: 4 },
      { transitionName: 'Begin Dev', dwellHours: 20 },
      { transitionName: 'Submit for Review', dwellHours: 30 },
      { transitionName: 'Submit for Review', dwellHours: 10 },
      { transitionName: 'Pass QA', dwellHours: 8 },
    ],
  },
  {
    title: 'Algo Demo: Navbar redesign',
    assigneeEmail: 'algo.alice@demo.local',
    createdDaysAgo: 35,
    deadlineHoursFromCreation: 200,
    steps: [
      { transitionName: 'Start', dwellHours: 3 },
      { transitionName: 'Begin Dev', dwellHours: 18 },
      { transitionName: 'Submit for Review', dwellHours: 28 },
      { transitionName: 'Submit for Review', dwellHours: 9 },
      { transitionName: 'Pass QA', dwellHours: 7 },
    ],
  },
  {
    title: 'Algo Demo: Contact form validation',
    assigneeEmail: 'algo.alice@demo.local',
    createdDaysAgo: 30,
    deadlineHoursFromCreation: 150,
    steps: [
      { transitionName: 'Start', dwellHours: 4 },
      { transitionName: 'Begin Dev', dwellHours: 16 },
      { transitionName: 'Submit for Review', dwellHours: 24 },
      { transitionName: 'Submit for Review', dwellHours: 9 },
      { transitionName: 'Pass QA', dwellHours: 6 },
    ],
  },
  {
    title: 'Algo Demo: Footer responsive fix',
    assigneeEmail: 'algo.alice@demo.local',
    createdDaysAgo: 25,
    deadlineHoursFromCreation: 120,
    steps: [
      { transitionName: 'Start', dwellHours: 3 },
      { transitionName: 'Begin Dev', dwellHours: 15 },
      { transitionName: 'Submit for Review', dwellHours: 22 },
      { transitionName: 'Submit for Review', dwellHours: 8 },
      { transitionName: 'Pass QA', dwellHours: 6 },
    ],
  },
  {
    title: 'Algo Demo: Image lazy loading (đang làm)',
    assigneeEmail: 'algo.alice@demo.local',
    createdDaysAgo: 6,
    deadlineHoursFromCreation: 240,
    steps: [
      { transitionName: 'Start', dwellHours: 3 },
      { transitionName: 'Begin Dev', dwellHours: 10 },
    ],
  },
  {
    title: 'Algo Demo: Accessibility audit (đang review)',
    assigneeEmail: 'algo.alice@demo.local',
    createdDaysAgo: 10,
    deadlineHoursFromCreation: 200,
    steps: [
      { transitionName: 'Start', dwellHours: 3 },
      { transitionName: 'Begin Dev', dwellHours: 15 },
      { transitionName: 'Submit for Review', dwellHours: 20 },
    ],
  },

  // ---------- Bob — chậm hơn, có rework, có Task trễ hạn (6 Task) ----------
  {
    title: 'Algo Demo: Payment gateway integration',
    assigneeEmail: 'algo.bob@demo.local',
    createdDaysAgo: 42,
    deadlineHoursFromCreation: 150,
    steps: [
      { transitionName: 'Start', dwellHours: 5 },
      { transitionName: 'Begin Dev', dwellHours: 40 },
      { transitionName: 'Submit for Review', dwellHours: 60 },
      ...REWORK_VIA_REQUEST_CHANGES,
      { transitionName: 'Submit for Review', dwellHours: 30 },
      { transitionName: 'Pass QA', dwellHours: 20 },
    ],
  },
  {
    title: 'Algo Demo: Search indexing bug',
    assigneeEmail: 'algo.bob@demo.local',
    createdDaysAgo: 38,
    deadlineHoursFromCreation: 130,
    steps: [
      { transitionName: 'Start', dwellHours: 5 },
      { transitionName: 'Begin Dev', dwellHours: 35 },
      { transitionName: 'Submit for Review', dwellHours: 55 },
      ...REWORK_VIA_FAIL_QA_ADAPTED(),
      { transitionName: 'Submit for Review', dwellHours: 25 },
      { transitionName: 'Pass QA', dwellHours: 15 },
    ],
  },
  {
    title: 'Algo Demo: Checkout flow polish',
    assigneeEmail: 'algo.bob@demo.local',
    createdDaysAgo: 20,
    deadlineHoursFromCreation: 300,
    steps: [
      { transitionName: 'Start', dwellHours: 4 },
      { transitionName: 'Begin Dev', dwellHours: 30 },
      { transitionName: 'Submit for Review', dwellHours: 45 },
      ...REWORK_VIA_REQUEST_CHANGES,
      { transitionName: 'Submit for Review', dwellHours: 20 },
      { transitionName: 'Pass QA', dwellHours: 12 },
    ],
  },
  {
    title: 'Algo Demo: Notification center (đang review lâu)',
    assigneeEmail: 'algo.bob@demo.local',
    createdDaysAgo: 15,
    deadlineHoursFromCreation: 72, // đã quá hạn từ lâu, vẫn còn ở Review
    steps: [
      { transitionName: 'Start', dwellHours: 4 },
      { transitionName: 'Begin Dev', dwellHours: 30 },
      { transitionName: 'Submit for Review', dwellHours: 40 },
    ],
  },
  {
    title: 'Algo Demo: API rate limiting (sắp hết hạn)',
    assigneeEmail: 'algo.bob@demo.local',
    createdDaysAgo: 4,
    deadlineHoursFromCreation: 144, // 4 ngày (đã trôi qua) + 2 ngày tới = deadline còn ~2 ngày kể từ hôm nay
    steps: [
      { transitionName: 'Start', dwellHours: 3 },
      { transitionName: 'Begin Dev', dwellHours: 20 },
    ],
  },
  {
    title: 'Algo Demo: Email template revamp (đã quá hạn)',
    assigneeEmail: 'algo.bob@demo.local',
    createdDaysAgo: 8,
    deadlineHoursFromCreation: 96, // deadline đã qua từ ~4 ngày trước
    steps: [
      { transitionName: 'Start', dwellHours: 3 },
      { transitionName: 'Begin Dev', dwellHours: 25 },
      { transitionName: 'Submit for Review', dwellHours: 35 },
      { transitionName: 'Submit for Review', dwellHours: 15 },
    ],
  },

  // ---------- Carol — đang ôm nhiều Task active cùng lúc (workload cao, 6 Task) ----------
  {
    title: 'Algo Demo: Pricing page copy',
    assigneeEmail: 'algo.carol@demo.local',
    createdDaysAgo: 28,
    deadlineHoursFromCreation: 180,
    steps: [
      { transitionName: 'Start', dwellHours: 5 },
      { transitionName: 'Begin Dev', dwellHours: 20 },
      { transitionName: 'Submit for Review', dwellHours: 30 },
      { transitionName: 'Submit for Review', dwellHours: 12 },
      { transitionName: 'Pass QA', dwellHours: 8 },
    ],
  },
  {
    title: 'Algo Demo: Dark mode support (đang làm)',
    assigneeEmail: 'algo.carol@demo.local',
    createdDaysAgo: 12,
    deadlineHoursFromCreation: 300,
    steps: [{ transitionName: 'Start', dwellHours: 5 }, { transitionName: 'Begin Dev', dwellHours: 12 }],
  },
  {
    title: 'Algo Demo: Export to PDF (đang làm)',
    assigneeEmail: 'algo.carol@demo.local',
    createdDaysAgo: 10,
    deadlineHoursFromCreation: 280,
    steps: [{ transitionName: 'Start', dwellHours: 4 }, { transitionName: 'Begin Dev', dwellHours: 10 }],
  },
  {
    title: 'Algo Demo: Multi-currency support (chưa bắt đầu)',
    assigneeEmail: 'algo.carol@demo.local',
    createdDaysAgo: 5,
    deadlineHoursFromCreation: 350,
    steps: [],
  },
  {
    title: 'Algo Demo: Onboarding tour (chưa bắt đầu)',
    assigneeEmail: 'algo.carol@demo.local',
    createdDaysAgo: 3,
    deadlineHoursFromCreation: 320,
    steps: [],
  },
  {
    title: 'Algo Demo: Print stylesheet (đang chờ dev)',
    assigneeEmail: 'algo.carol@demo.local',
    createdDaysAgo: 7,
    deadlineHoursFromCreation: 260,
    steps: [{ transitionName: 'Start', dwellHours: 6 }],
  },
];

/** REWORK_VIA_FAIL_QA cần đứng sau "Submit for Review" đầu tiên (đã ở Review) nhưng transition
 * "Fail QA" lại xuất phát từ QA — nghĩa là spec ở trên phải đi qua Approve trước rồi mới Fail QA
 * được. Để giữ mảng REWORK_VIA_FAIL_QA đơn giản (chỉ 2 bước) mà vẫn đúng đồ thị thật của
 * workflow mẫu, hàm này chèn thêm bước "Approve" (Review → QA) làm bước đầu tiên. */
function REWORK_VIA_FAIL_QA_ADAPTED(): StepSpec[] {
  return [{ transitionName: 'Submit for Review', dwellHours: 25 }, ...REWORK_VIA_FAIL_QA];
}

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: 'demo-company' } });
  if (!tenant) {
    throw new Error(
      'Không tìm thấy tenant demo-company — hãy chạy `npx prisma db seed` (seed.ts gốc) trước.',
    );
  }
  const tenantId = tenant.id;

  const existingProject = await prisma.project.findFirst({
    where: { tenantId, name: 'Algorithm Demo Data' },
  });
  if (existingProject) {
    console.log(
      'Project "Algorithm Demo Data" đã tồn tại — script dừng, không tạo trùng dữ liệu.' +
        ' Nếu muốn seed lại từ đầu, tự xoá Project này trước (kiểm tra kỹ số dòng sẽ bị ảnh hưởng).',
    );
    return;
  }

  const workflow = await prisma.workflow.findFirst({
    where: { tenantId, name: 'Software Development' },
    include: { states: true, transitions: true },
  });
  if (!workflow) {
    throw new Error('Không tìm thấy workflow "Software Development" — chạy seed.ts gốc trước.');
  }
  // KHÔNG dùng Map<name, transition> vì workflow "Software Development" hiện có 2 transition
  // trùng tên "Submit for Review" (Development→Review từ seed.ts gốc, và Review→QA do người
  // dùng tự tạo qua Workflow Builder khi test tay Giai đoạn 4) — tên không unique, phải tìm theo
  // ĐÚNG cặp (tên, fromStateId = trạng thái hiện tại của Task) mới xác định đúng cạnh trên đồ thị.
  const findTransition = (name: string, fromStateId: string) =>
    workflow.transitions.find((t) => t.name === name && t.fromStateId === fromStateId);
  const startState = workflow.states.find((s) => s.isStart);
  if (!startState) throw new Error('Workflow chưa có State is_start.');

  const developerRole = await prisma.role.findFirst({
    where: { tenantId, name: 'Developer' },
  });

  async function upsertAlgoEmployee(email: string, fullName: string) {
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        passwordHash: await bcrypt.hash('AlgoDemo@123', 10),
        fullName,
        systemRole: 'EMPLOYEE',
        tenantId,
      },
    });
    if (developerRole) {
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: developerRole.id } },
        update: {},
        create: { userId: user.id, roleId: developerRole.id },
      });
    }
    return user;
  }

  const alice = await upsertAlgoEmployee('algo.alice@demo.local', 'Algo Demo Alice');
  const bob = await upsertAlgoEmployee('algo.bob@demo.local', 'Algo Demo Bob');
  const carol = await upsertAlgoEmployee('algo.carol@demo.local', 'Algo Demo Carol');
  const usersByEmail = new Map([
    [alice.email, alice],
    [bob.email, bob],
    [carol.email, carol],
  ]);

  const project = await prisma.project.create({
    data: { tenantId, name: 'Algorithm Demo Data', workflowId: workflow.id },
  });
  for (const u of [alice, bob, carol]) {
    await prisma.projectMember.create({ data: { projectId: project.id, userId: u.id } });
  }

  let createdCount = 0;
  let historyCount = 0;

  for (const spec of TASK_SPECS) {
    const assignee = usersByEmail.get(spec.assigneeEmail);
    if (!assignee) throw new Error(`Không tìm thấy assignee ${spec.assigneeEmail}`);

    const createdAt = daysAgo(spec.createdDaysAgo);
    const deadline =
      spec.deadlineHoursFromCreation != null
        ? new Date(createdAt.getTime() + spec.deadlineHoursFromCreation * HOUR)
        : null;

    const task = await prisma.task.create({
      data: {
        tenantId,
        projectId: project.id,
        title: spec.title,
        currentStateId: startState.id,
        assigneeId: assignee.id,
        deadline,
        createdAt,
        updatedAt: createdAt,
      },
    });
    createdCount++;

    let currentTime = createdAt;
    let currentStateId = startState.id;
    let version = 1;

    for (const step of spec.steps) {
      const transition = findTransition(step.transitionName, currentStateId);
      if (!transition) {
        throw new Error(
          `Spec Task "${spec.title}" sai đồ thị: không tìm thấy transition "${step.transitionName}" ` +
            `xuất phát từ state hiện tại (${currentStateId})`,
        );
      }

      currentTime = new Date(currentTime.getTime() + step.dwellHours * HOUR);
      await prisma.taskHistory.create({
        data: {
          taskId: task.id,
          fromStateId: transition.fromStateId,
          toStateId: transition.toStateId,
          transitionId: transition.id,
          actionBy: assignee.id,
          actionAt: currentTime,
        },
      });
      historyCount++;

      currentStateId = transition.toStateId;
      version += 1;
      await prisma.task.update({
        where: { id: task.id },
        data: { currentStateId, version, updatedAt: currentTime },
      });
    }
  }

  console.log('Seed algorithm-history hoàn tất:', {
    tenant: tenant.slug,
    project: project.name,
    employees: [alice.email, bob.email, carol.email],
    tasksCreated: createdCount,
    historyRowsCreated: historyCount,
  });
  console.log(
    'Lưu ý: risk_score/bottleneck snapshot chưa có ngay — gọi ' +
      'POST /api/algorithms/risk-alerts/recompute và POST /api/algorithms/bottleneck-snapshots/recompute' +
      '?workflowId=' +
      workflow.id +
      ' (hoặc đợi cron) để tính lần đầu.',
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
