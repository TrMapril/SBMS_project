import { useState, type FormEvent } from 'react'
import {
  useCreateTenant,
  useCreateTenantAdmin,
  useTenants,
  useUpdateTenantMaxEmployees,
  useUpdateTenantStatus,
  type CreateTenantAdminResult,
} from '../features/tenants/useTenants'
import type { Tenant } from '../lib/types'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { ErrorBanner } from '../components/ui/ErrorBanner'
import { Spinner } from '../components/ui/Spinner'

/** Phase 7.5 Đợt 4 — "Trang quản lý doanh nghiệp" (Super Admin). Vô hiệu hoá 1 tenant KHÔNG xoá dữ
 * liệu, chỉ chặn toàn bộ user trong tenant đó đăng nhập (`AuthService.login`). */
export function TenantsPage() {
  const { data, isLoading, error } = useTenants()
  const updateStatus = useUpdateTenantStatus()
  const [showCreate, setShowCreate] = useState(false)
  const [editLimitFor, setEditLimitFor] = useState<Tenant | null>(null)

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Quản lý doanh nghiệp</h1>
        <Button onClick={() => setShowCreate(true)}>+ Thêm doanh nghiệp</Button>
      </div>

      {error && <ErrorBanner error={error} />}
      {isLoading && <Spinner />}

      {data && (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Tên</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Slug</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Nhân sự</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Project</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">
                  Hoạt động gần nhất
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Trạng thái</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.data.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-2 text-gray-900">{t.name}</td>
                  <td className="px-4 py-2 text-gray-600">{t.slug}</td>
                  <td className="px-4 py-2 text-gray-600">
                    {t.userCount}/{t.maxEmployees ?? '∞'}
                  </td>
                  <td className="px-4 py-2 text-gray-600">{t.projectCount}</td>
                  <td className="px-4 py-2 text-gray-600">
                    {t.lastActivityAt ? (
                      new Date(t.lastActivityAt).toLocaleString('vi-VN')
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        t.isDisabled
                          ? 'bg-red-100 text-red-700'
                          : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {t.isDisabled ? 'Đã vô hiệu hoá' : 'ACTIVE'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="secondary"
                        className="px-2 py-1 text-xs"
                        onClick={() => setEditLimitFor(t)}
                      >
                        Sửa giới hạn
                      </Button>
                      {t.isDisabled ? (
                        <Button
                          variant="secondary"
                          className="px-2 py-1 text-xs"
                          disabled={updateStatus.isPending}
                          onClick={() =>
                            updateStatus.mutate({ id: t.id, isDisabled: false })
                          }
                        >
                          Kích hoạt lại
                        </Button>
                      ) : (
                        <Button
                          variant="danger"
                          className="px-2 py-1 text-xs"
                          disabled={updateStatus.isPending}
                          onClick={() => updateStatus.mutate({ id: t.id, isDisabled: true })}
                        >
                          Vô hiệu hoá
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {data.data.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-sm text-gray-400">
                    Chưa có doanh nghiệp nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <CreateTenantModal onClose={() => setShowCreate(false)} />}
      {editLimitFor && (
        <EditMaxEmployeesModal tenant={editLimitFor} onClose={() => setEditLimitFor(null)} />
      )}
    </div>
  )
}

function EditMaxEmployeesModal({
  tenant,
  onClose,
}: {
  tenant: Tenant
  onClose: () => void
}) {
  const [value, setValue] = useState(tenant.maxEmployees != null ? String(tenant.maxEmployees) : '')
  const updateMaxEmployees = useUpdateTenantMaxEmployees()

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = value.trim()
    updateMaxEmployees.mutate(
      { id: tenant.id, maxEmployees: trimmed === '' ? null : Number(trimmed) },
      { onSuccess: onClose },
    )
  }

  return (
    <Modal title={`Giới hạn nhân sự — ${tenant.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Số nhân sự tối đa
          </label>
          <Input
            type="number"
            min={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Để trống = không giới hạn"
          />
          <p className="mt-1 text-xs text-gray-400">
            Hiện tại: {tenant.userCount} user. Để trống nghĩa là không giới hạn.
          </p>
        </div>

        {updateMaxEmployees.isError && <ErrorBanner error={updateMaxEmployees.error} />}

        <Button type="submit" className="w-full" disabled={updateMaxEmployees.isPending}>
          {updateMaxEmployees.isPending ? 'Đang lưu...' : 'Lưu'}
        </Button>
      </form>
    </Modal>
  )
}

/** Tạo doanh nghiệp mới = 2 lệnh gọi tuần tự (POST /tenants rồi POST /tenants/:id/admin, cả 2 đã
 * có sẵn từ Giai đoạn 1) — hiện kết quả mật khẩu tạm của Admin mặc định 1 LẦN DUY NHẤT, đúng cơ
 * chế đã dùng cho "Thêm user"/"Thêm hàng loạt" ở Đợt 2. */
function CreateTenantModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminFullName, setAdminFullName] = useState('')
  const createTenant = useCreateTenant()
  const createTenantAdmin = useCreateTenantAdmin()
  const [result, setResult] = useState<CreateTenantAdminResult | null>(null)
  const [step, setStep] = useState<'form' | 'creating-admin'>('form')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    createTenant.mutate(
      { name, slug },
      {
        onSuccess: (tenant) => {
          setStep('creating-admin')
          createTenantAdmin.mutate(
            { tenantId: tenant.id, email: adminEmail, fullName: adminFullName },
            { onSuccess: setResult },
          )
        },
      },
    )
  }

  return (
    <Modal title="Thêm doanh nghiệp mới" onClose={onClose}>
      {result ? (
        <div className="space-y-3">
          <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
            Đã tạo doanh nghiệp và tài khoản Admin <strong>{result.user.email}</strong>. Mật khẩu
            tạm (gửi cho Admin, không hiển thị lại sau khi đóng cửa sổ này):
            <div className="mt-1 rounded bg-white px-2 py-1 font-mono text-xs">
              {result.tempPassword}
            </div>
          </div>
          <Button className="w-full" onClick={onClose}>
            Đóng
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Tên doanh nghiệp</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Slug (dùng cho URL, chữ thường/số/gạch ngang)
            </label>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="cong-ty-abc"
              required
            />
          </div>
          <div className="border-t border-gray-100 pt-3">
            <p className="mb-2 text-xs font-medium text-gray-500">Tài khoản Admin mặc định</p>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
                <Input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Họ tên</label>
                <Input
                  value={adminFullName}
                  onChange={(e) => setAdminFullName(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {createTenant.isError && <ErrorBanner error={createTenant.error} />}
          {createTenantAdmin.isError && <ErrorBanner error={createTenantAdmin.error} />}

          <Button
            type="submit"
            className="w-full"
            disabled={createTenant.isPending || step === 'creating-admin'}
          >
            {createTenant.isPending || step === 'creating-admin'
              ? 'Đang tạo...'
              : 'Tạo doanh nghiệp'}
          </Button>
        </form>
      )}
    </Modal>
  )
}
