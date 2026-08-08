-- rls-policies.sql
-- Bật Row Level Security (lớp phòng thủ thứ 3 trong nguyên tắc "multi-tenant isolation 3 lớp"
-- ở Mục 3.12 CLAUDE.md) cho các bảng đã tạo tính đến Giai đoạn hiện tại.
--
-- CÁCH CHẠY (thủ công, theo guide.md):
--   Supabase Dashboard → SQL Editor → New query → dán toàn bộ nội dung file này → Run.
--
-- FILE NÀY IDEMPOTENT: mỗi khi có bảng mới ở giai đoạn sau, chỉ cần thêm block mới vào cuối rồi
-- dán/chạy lại TOÀN BỘ file — các ALTER TABLE ... ENABLE/FORCE ROW LEVEL SECURITY vốn đã idempotent
-- (không lỗi nếu bật lại), còn mỗi CREATE POLICY đều có DROP POLICY IF EXISTS đứng trước (Postgres
-- không có cú pháp "CREATE POLICY IF NOT EXISTS") nên chạy lại bao nhiêu lần cũng không báo lỗi
-- "policy already exists".
--
-- GHI CHÚ QUAN TRỌNG VỀ GIỚI HẠN CỦA LỚP NÀY TRONG PHẠM VI ĐỒ ÁN:
-- Backend NestJS kết nối Supabase bằng connection string mặc định (role `postgres`), là
-- superuser nên LUÔN BYPASS RLS bất kể các policy dưới đây, kể cả khi đã bật `FORCE ROW LEVEL
-- SECURITY`. Do đó lớp bảo vệ đang thực sự có hiệu lực với API là Lớp 1 (JWT chứa tenantId) +
-- Lớp 2 (mọi Prisma query ở tầng Service filter theo tenant_id). RLS ở đây đóng vai trò lớp
-- phòng thủ cuối cho các đường truy cập KHÔNG đi qua backend (ví dụ ai đó có quyền truy cập
-- Supabase SQL Editor/API key khác dùng role không phải superuser). Để RLS thực sự áp dụng cho
-- chính backend, cần đổi sang một DB role không có BYPASSRLS và cho Prisma
-- `SET LOCAL app.current_tenant_id`/`app.is_super_admin` mỗi request — đây là hướng mở rộng,
-- chưa làm ở giai đoạn hiện tại.
--
-- Session dùng 2 biến do ứng dụng SET LOCAL mỗi transaction/request:
--   app.current_tenant_id : id (dạng chuỗi uuid) của tenant thuộc JWT hiện tại
--   app.is_super_admin    : 'true' nếu systemRole = SUPER_ADMIN, ngược lại 'false'
-- Lưu ý: cột id/tenant_id trong schema Prisma là kiểu `text` (String @id @default(uuid()),
-- không @db.Uuid), nên so sánh ở đây cũng dùng text, KHÔNG cast ::uuid (nếu cast sẽ lỗi
-- "operator does not exist: text = uuid").

-- ============================================================================
-- Giai đoạn 1: tenants, tenant_config, users, roles, user_roles
-- ============================================================================

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_select ON tenants;
CREATE POLICY tenant_isolation_select ON tenants
  FOR SELECT
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR id = current_setting('app.current_tenant_id', true)
  );

DROP POLICY IF EXISTS tenant_isolation_write ON tenants;
CREATE POLICY tenant_isolation_write ON tenants
  FOR INSERT WITH CHECK (current_setting('app.is_super_admin', true) = 'true');

DROP POLICY IF EXISTS tenant_isolation_update ON tenants;
CREATE POLICY tenant_isolation_update ON tenants
  FOR UPDATE
  USING (current_setting('app.is_super_admin', true) = 'true');

DROP POLICY IF EXISTS tenant_isolation_delete ON tenants;
CREATE POLICY tenant_isolation_delete ON tenants
  FOR DELETE
  USING (current_setting('app.is_super_admin', true) = 'true');

ALTER TABLE tenant_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_config FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_config_isolation ON tenant_config;
CREATE POLICY tenant_config_isolation ON tenant_config
  FOR ALL
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR tenant_id = current_setting('app.current_tenant_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR tenant_id = current_setting('app.current_tenant_id', true)
  );

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_tenant_isolation ON users;
CREATE POLICY users_tenant_isolation ON users
  FOR ALL
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR tenant_id = current_setting('app.current_tenant_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR tenant_id = current_setting('app.current_tenant_id', true)
  );

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS roles_tenant_isolation ON roles;
CREATE POLICY roles_tenant_isolation ON roles
  FOR ALL
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR tenant_id = current_setting('app.current_tenant_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR tenant_id = current_setting('app.current_tenant_id', true)
  );

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_roles_tenant_isolation ON user_roles;
CREATE POLICY user_roles_tenant_isolation ON user_roles
  FOR ALL
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR EXISTS (
      SELECT 1 FROM roles
      WHERE roles.id = user_roles.role_id
        AND roles.tenant_id = current_setting('app.current_tenant_id', true)
    )
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR EXISTS (
      SELECT 1 FROM roles
      WHERE roles.id = user_roles.role_id
        AND roles.tenant_id = current_setting('app.current_tenant_id', true)
    )
  );

-- ============================================================================
-- Giai đoạn 2: workflows, workflow_states, workflow_transitions,
--              workflow_templates, tasks, task_history
-- ============================================================================

ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workflows_tenant_isolation ON workflows;
CREATE POLICY workflows_tenant_isolation ON workflows
  FOR ALL
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR tenant_id = current_setting('app.current_tenant_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR tenant_id = current_setting('app.current_tenant_id', true)
  );

-- workflow_states không có cột tenant_id riêng, xét qua workflows.tenant_id (workflow_id).
ALTER TABLE workflow_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_states FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workflow_states_tenant_isolation ON workflow_states;
CREATE POLICY workflow_states_tenant_isolation ON workflow_states
  FOR ALL
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR EXISTS (
      SELECT 1 FROM workflows
      WHERE workflows.id = workflow_states.workflow_id
        AND workflows.tenant_id = current_setting('app.current_tenant_id', true)
    )
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR EXISTS (
      SELECT 1 FROM workflows
      WHERE workflows.id = workflow_states.workflow_id
        AND workflows.tenant_id = current_setting('app.current_tenant_id', true)
    )
  );

-- workflow_transitions không có cột tenant_id riêng, xét qua workflows.tenant_id (workflow_id).
ALTER TABLE workflow_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_transitions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workflow_transitions_tenant_isolation ON workflow_transitions;
CREATE POLICY workflow_transitions_tenant_isolation ON workflow_transitions
  FOR ALL
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR EXISTS (
      SELECT 1 FROM workflows
      WHERE workflows.id = workflow_transitions.workflow_id
        AND workflows.tenant_id = current_setting('app.current_tenant_id', true)
    )
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR EXISTS (
      SELECT 1 FROM workflows
      WHERE workflows.id = workflow_transitions.workflow_id
        AND workflows.tenant_id = current_setting('app.current_tenant_id', true)
    )
  );

-- workflow_templates KHÔNG thuộc tenant nào (catalog dùng chung để clone — Mục 3.10 CLAUDE.md):
-- ai đăng nhập cũng đọc được để chọn import, nhưng chỉ Super Admin mới được tạo/sửa/xoá template.
ALTER TABLE workflow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_templates FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workflow_templates_select ON workflow_templates;
CREATE POLICY workflow_templates_select ON workflow_templates
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS workflow_templates_insert ON workflow_templates;
CREATE POLICY workflow_templates_insert ON workflow_templates
  FOR INSERT WITH CHECK (current_setting('app.is_super_admin', true) = 'true');

DROP POLICY IF EXISTS workflow_templates_update ON workflow_templates;
CREATE POLICY workflow_templates_update ON workflow_templates
  FOR UPDATE
  USING (current_setting('app.is_super_admin', true) = 'true');

DROP POLICY IF EXISTS workflow_templates_delete ON workflow_templates;
CREATE POLICY workflow_templates_delete ON workflow_templates
  FOR DELETE
  USING (current_setting('app.is_super_admin', true) = 'true');

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tasks_tenant_isolation ON tasks;
CREATE POLICY tasks_tenant_isolation ON tasks
  FOR ALL
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR tenant_id = current_setting('app.current_tenant_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR tenant_id = current_setting('app.current_tenant_id', true)
  );

-- task_history không có cột tenant_id riêng, xét qua tasks.tenant_id (task_id).
ALTER TABLE task_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_history FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS task_history_tenant_isolation ON task_history;
CREATE POLICY task_history_tenant_isolation ON task_history
  FOR ALL
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = task_history.task_id
        AND tasks.tenant_id = current_setting('app.current_tenant_id', true)
    )
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = task_history.task_id
        AND tasks.tenant_id = current_setting('app.current_tenant_id', true)
    )
  );

-- ============================================================================
-- Giai đoạn 3: projects, project_members, custom_fields, custom_field_values
-- ============================================================================

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS projects_tenant_isolation ON projects;
CREATE POLICY projects_tenant_isolation ON projects
  FOR ALL
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR tenant_id = current_setting('app.current_tenant_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR tenant_id = current_setting('app.current_tenant_id', true)
  );

-- project_members không có cột tenant_id riêng, xét qua projects.tenant_id (project_id).
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_members_tenant_isolation ON project_members;
CREATE POLICY project_members_tenant_isolation ON project_members
  FOR ALL
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_members.project_id
        AND projects.tenant_id = current_setting('app.current_tenant_id', true)
    )
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_members.project_id
        AND projects.tenant_id = current_setting('app.current_tenant_id', true)
    )
  );

ALTER TABLE custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_fields FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS custom_fields_tenant_isolation ON custom_fields;
CREATE POLICY custom_fields_tenant_isolation ON custom_fields
  FOR ALL
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR tenant_id = current_setting('app.current_tenant_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR tenant_id = current_setting('app.current_tenant_id', true)
  );

-- custom_field_values không có cột tenant_id riêng, xét qua tasks.tenant_id (task_id) — cùng
-- kiểu quan hệ "bảng giá trị/log gắn theo Task" như task_history.
ALTER TABLE custom_field_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_field_values FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS custom_field_values_tenant_isolation ON custom_field_values;
CREATE POLICY custom_field_values_tenant_isolation ON custom_field_values
  FOR ALL
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = custom_field_values.task_id
        AND tasks.tenant_id = current_setting('app.current_tenant_id', true)
    )
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = custom_field_values.task_id
        AND tasks.tenant_id = current_setting('app.current_tenant_id', true)
    )
  );

-- ============================================================================
-- Giai đoạn 5: bottleneck_snapshots
-- (tasks.deadline/risk_score/risk_score_updated_at và tenant_config.assignment_weights chỉ là
-- CỘT MỚI trên bảng đã có policy ở trên — RLS áp dụng theo hàng, không theo cột, nên không cần
-- policy riêng cho 2 bảng này.)
-- ============================================================================

ALTER TABLE bottleneck_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE bottleneck_snapshots FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bottleneck_snapshots_tenant_isolation ON bottleneck_snapshots;
CREATE POLICY bottleneck_snapshots_tenant_isolation ON bottleneck_snapshots
  FOR ALL
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR tenant_id = current_setting('app.current_tenant_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR tenant_id = current_setting('app.current_tenant_id', true)
  );

-- ============================================================================
-- Giai đoạn 6: notifications
-- ============================================================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_tenant_isolation ON notifications;
CREATE POLICY notifications_tenant_isolation ON notifications
  FOR ALL
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR tenant_id = current_setting('app.current_tenant_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR tenant_id = current_setting('app.current_tenant_id', true)
  );

-- ============================================================================
-- Giai đoạn 7: leave_requests, competency_profiles, personnel_proposals,
-- employee_profiles
-- (tenant_config.intro_text/banner_images/address/contact_phone/contact_email/social_links chỉ
-- là CỘT MỚI trên bảng đã có policy — không cần policy riêng. GET /api/public/tenant/:slug đọc
-- qua PrismaService KHÔNG đi qua JWT/RLS session context — do đó chỉ trả đúng field công khai ở
-- tầng Service (PublicService), không dựa vào RLS để giới hạn dữ liệu trả về cho route này.)
-- ============================================================================

ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS leave_requests_tenant_isolation ON leave_requests;
CREATE POLICY leave_requests_tenant_isolation ON leave_requests
  FOR ALL
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR tenant_id = current_setting('app.current_tenant_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR tenant_id = current_setting('app.current_tenant_id', true)
  );

ALTER TABLE competency_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE competency_profiles FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS competency_profiles_tenant_isolation ON competency_profiles;
CREATE POLICY competency_profiles_tenant_isolation ON competency_profiles
  FOR ALL
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR tenant_id = current_setting('app.current_tenant_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR tenant_id = current_setting('app.current_tenant_id', true)
  );

ALTER TABLE personnel_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE personnel_proposals FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS personnel_proposals_tenant_isolation ON personnel_proposals;
CREATE POLICY personnel_proposals_tenant_isolation ON personnel_proposals
  FOR ALL
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR tenant_id = current_setting('app.current_tenant_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR tenant_id = current_setting('app.current_tenant_id', true)
  );

ALTER TABLE employee_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_profiles FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employee_profiles_tenant_isolation ON employee_profiles;
CREATE POLICY employee_profiles_tenant_isolation ON employee_profiles
  FOR ALL
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR tenant_id = current_setting('app.current_tenant_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR tenant_id = current_setting('app.current_tenant_id', true)
  );

-- ============================================================================
-- Phase 7.5 Đợt 1: chỉ thêm CỘT/ENUM trên các bảng đã có policy ở trên (leave_requests,
-- project_members, projects, roles, tasks, tenant_config) — không có bảng mới, không cần policy
-- riêng (RLS áp dụng theo hàng, không theo cột).
--
-- Phase 7.5 Đợt 2: request_type_templates ("loại đơn mẫu" do Admin tự định nghĩa)
-- ============================================================================

ALTER TABLE request_type_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_type_templates FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS request_type_templates_tenant_isolation ON request_type_templates;
CREATE POLICY request_type_templates_tenant_isolation ON request_type_templates
  FOR ALL
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR tenant_id = current_setting('app.current_tenant_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR tenant_id = current_setting('app.current_tenant_id', true)
  );
