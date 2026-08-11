# SBMS — Software Business Process Management System

Nền tảng SaaS multi-tenant hỗ trợ quản lý quy trình phát triển phần mềm cho doanh nghiệp vừa và
nhỏ. Đây là đồ án tốt nghiệp, với trọng tâm là **Workflow Engine dựa trên State Machine**, nơi quy
trình nghiệp vụ (trạng thái, điều kiện chuyển trạng thái, phân quyền theo vai trò) là **dữ liệu
cấu hình do Admin tự thiết kế**, không phải logic hard-code trong ứng dụng.

## Mục lục

- [Tính năng chính](#tính-năng-chính)
- [Kiến trúc & Tech stack](#kiến-trúc--tech-stack)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Bắt đầu nhanh](#bắt-đầu-nhanh)
- [Tài khoản demo](#tài-khoản-demo)
- [Kiểm thử](#kiểm-thử)
- [Tài liệu dự án](#tài-liệu-dự-án)
- [Triển khai](#triển-khai)

## Tính năng chính

- **Workflow Builder** — thiết kế quy trình (State/Transition) trực quan bằng kéo-thả
  ([@xyflow/react](https://reactflow.dev)), cấu hình quyền chuyển trạng thái theo Custom Role và
  điều kiện bắt buộc (Custom Field / phải có người phụ trách), nhập nhanh từ Workflow Template.
- **Workflow Engine** — dịch vụ duy nhất xử lý mọi lượt chuyển trạng thái công việc, đi qua 7 bước
  kiểm tra (quyền, điều kiện, khoá lạc quan/optimistic locking chống ghi đè đồng thời, ghi lịch sử
  đầy đủ) — không có `if (status === 'X')` rải rác trong business logic.
- **Quản lý Dự án & Công việc** — mỗi dự án gắn đúng 1 Workflow, bảng công việc dạng Kanban theo
  đúng các State đã thiết kế, quy trình báo cáo hoàn thành → Manager xác nhận, trả lại công việc có
  duyệt lý do.
- **Bộ ba thuật toán hỗ trợ ra quyết định** — gợi ý phân công công việc theo 4 tiêu chí có trọng
  số, dự báo nguy cơ trễ hạn (risk score, chạy định kỳ mỗi giờ, dùng BFS ước lượng số bước còn
  lại), phát hiện điểm nghẽn quy trình (chạy định kỳ mỗi ngày).
- **Đa doanh nghiệp (multi-tenant)** — cách ly dữ liệu 3 lớp (JWT → lọc theo `tenant_id` ở tầng
  Service → Row Level Security ở PostgreSQL), mỗi doanh nghiệp có trang giới thiệu công khai riêng.
- **Thông báo thời gian thực** qua Socket.io, đơn từ nội bộ (nghỉ phép, trả công việc, loại đơn tuỳ
  chỉnh), hồ sơ năng lực nội bộ và đề xuất nhân sự.

## Kiến trúc & Tech stack

| Tầng | Công nghệ |
|---|---|
| Frontend | React 18 + TypeScript + Vite + TailwindCSS, Zustand, React Query, react-router-dom |
| Workflow Builder UI | [@xyflow/react](https://reactflow.dev) (React Flow) |
| Backend | NestJS (Node.js) + Prisma ORM |
| Cache | `@nestjs/cache-manager` (in-memory, không dùng Redis) |
| Database | PostgreSQL — Supabase (kèm Row Level Security) |
| Auth | JWT (`@nestjs/jwt`) + bcrypt + Passport |
| Realtime | Socket.io |
| File Storage | Supabase Storage (giới hạn 5MB, kiểm tra magic bytes) |
| Scheduler | `@nestjs/schedule` (cron: risk score, phát hiện điểm nghẽn) |
| Deploy | Vercel (frontend) + Render (backend) + Supabase (database) |


## Cấu trúc thư mục

```
SBMS_project/
├── backend/                 # NestJS API
│   ├── prisma/               # schema.prisma, seed.ts, migrations
│   └── src/
│       ├── auth/              # đăng nhập, JWT, đổi mật khẩu
│       ├── tenants/            # quản lý doanh nghiệp, cấu hình tenant
│       ├── users/ roles/        # người dùng, Custom Role
│       ├── workflow/             # Workflow Builder CRUD + WorkflowEngineService
│       ├── projects/ tasks/       # dự án, công việc, Task Board
│       ├── custom-fields/          # trường dữ liệu tuỳ biến
│       ├── algorithms/              # 3 thuật toán hỗ trợ ra quyết định + cron job
│       ├── notifications/            # thông báo realtime qua Socket.io
│       ├── leave-requests/            # đơn từ nội bộ
│       ├── personnel/                  # hồ sơ năng lực, đề xuất nhân sự
│       ├── public/                      # API công khai cho trang giới thiệu doanh nghiệp
│       └── common/                       # guard, decorator, interceptor dùng chung
├── frontend/                 # React SPA
│   └── src/
│       ├── pages/ components/  # trang & component dùng chung
│       ├── features/            # theo domain: workflow-builder, task-board, dashboard...
│       ├── store/                 # Zustand store
│       └── lib/                     # API client, Socket.io client
└── docs/                    # sơ đồ UML (.drawio) + phụ lục báo cáo
```

## Bắt đầu nhanh

### Yêu cầu

- Node.js ≥ 20 (đã kiểm thử với v22)
- 1 project Supabase (PostgreSQL + Storage) — hoặc PostgreSQL tự host tương đương

### Backend

```bash
cd backend
npm install
cp .env.example .env      # điền DATABASE_URL, JWT_SECRET, SUPABASE_*
npx prisma migrate deploy
npx prisma db seed
npm run start:dev         # http://localhost:3000/api
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env      # VITE_API_URL=http://localhost:3000/api
npm run dev                # http://localhost:5173
```

Toàn bộ endpoint backend có prefix `/api`; kiểm tra service đang chạy qua `GET /api/health`.

## Tài khoản demo

Sau khi chạy `npx prisma db seed`, hệ thống có sẵn 1 tenant demo (`demo-company`) và các tài khoản
sau (mật khẩu tạm, hệ thống sẽ không bắt buộc đổi với dữ liệu seed sẵn):

| Vai trò | Email | Mật khẩu |
|---|---|---|
| Super Admin | `superadmin@sbms.local` | `SuperAdmin@123` |
| Admin | `admin@demo.local` | `Admin@123` |
| Manager | `manager@demo.local` | `Manager@123` |
| Employee | `employee@demo.local` | `Employee@123` |

## Kiểm thử

```bash
cd backend
npm run test        # unit test
npm run test:e2e     # end-to-end (multi-tenant isolation, HTTP security...)
npm run test:cov      # coverage
```

## Triển khai

Ứng dụng được triển khai theo mô hình 3 tầng tách biệt, có cơ chế UptimeRobot ping định kỳ để giữ
gói miễn phí Render/Supabase luôn "ấm":

- **Frontend**: Vercel — build từ thư mục `frontend/`
- **Backend**: Render — build từ thư mục `backend/`, biến môi trường theo `.env.example`
- **Database & Storage**: Supabase

URL thật sau khi deploy: Frontend `sbms-project.vercel.app` · Backend `sbms-backend-8gf1.onrender.com/api/health`
