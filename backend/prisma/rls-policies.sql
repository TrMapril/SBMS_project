-- rls-policies.sql
-- Bật Row Level Security (lớp phòng thủ thứ 3 trong nguyên tắc "multi-tenant isolation 3 lớp"
-- ở Mục 3.12 CLAUDE.md) cho các bảng tạo ở Giai đoạn 1.
--
-- CÁCH CHẠY (thủ công, theo guide.md Phase 1):
--   Supabase Dashboard → SQL Editor → New query → dán toàn bộ nội dung file này → Run.
--
-- GHI CHÚ QUAN TRỌNG VỀ GIỚI HẠN CỦA LỚP NÀY TRONG PHẠM VI ĐỒ ÁN:
-- Backend NestJS kết nối Supabase bằng connection string mặc định (role `postgres`), là
-- superuser nên LUÔN BYPASS RLS bất kể các policy dưới đây, kể cả khi đã bật `FORCE ROW LEVEL
-- SECURITY`. Do đó tại Giai đoạn 1, lớp bảo vệ đang thực sự có hiệu lực với API là Lớp 1 (JWT
-- chứa tenantId) + Lớp 2 (mọi Prisma query ở tầng Service filter theo tenant_id — xem
-- tenants/users/roles Service). RLS ở đây đóng vai trò lớp phòng thủ cuối cho các đường truy cập
-- KHÔNG đi qua backend (ví dụ ai đó có quyền truy cập Supabase SQL Editor/API key khác dùng
-- role không phải superuser). Để RLS thực sự áp dụng cho chính backend, cần đổi sang một DB role
-- không có BYPASSRLS và cho Prisma `SET LOCAL app.current_tenant_id`/`app.is_super_admin` mỗi
-- request — đây là hướng mở rộng, không nằm trong phạm vi Giai đoạn 1.

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;

ALTER TABLE tenant_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_config FORCE ROW LEVEL SECURITY;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles FORCE ROW LEVEL SECURITY;

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles FORCE ROW LEVEL SECURITY;

-- Session dùng 2 biến do ứng dụng SET LOCAL mỗi transaction/request:
--   app.current_tenant_id : id (dạng chuỗi uuid) của tenant thuộc JWT hiện tại
--   app.is_super_admin    : 'true' nếu systemRole = SUPER_ADMIN, ngược lại 'false'
-- Lưu ý: cột id/tenant_id trong schema Prisma là kiểu `text` (String @id @default(uuid()),
-- không @db.Uuid), nên so sánh ở đây cũng dùng text, KHÔNG cast ::uuid (nếu cast sẽ lỗi
-- "operator does not exist: text = uuid").

CREATE POLICY tenant_isolation_select ON tenants
  FOR SELECT
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR id = current_setting('app.current_tenant_id', true)
  );

CREATE POLICY tenant_isolation_write ON tenants
  FOR INSERT WITH CHECK (current_setting('app.is_super_admin', true) = 'true');

CREATE POLICY tenant_isolation_update ON tenants
  FOR UPDATE
  USING (current_setting('app.is_super_admin', true) = 'true');

CREATE POLICY tenant_isolation_delete ON tenants
  FOR DELETE
  USING (current_setting('app.is_super_admin', true) = 'true');

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
