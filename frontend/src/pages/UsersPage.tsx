import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  useBulkCreateUsers,
  useCreateUser,
  useUpdateUserStatus,
  useUsers,
  type BulkCreateUserRow,
  type BulkCreateUsersResult,
} from '../features/users/useUsers'
import { useRoleMutations, useRoles, useRolesForUser } from '../features/roles/useRoles'
import type { SystemRole, User, UserStatus } from '../lib/types'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Modal } from '../components/ui/Modal'
import { ErrorBanner } from '../components/ui/ErrorBanner'
import { Spinner } from '../components/ui/Spinner'

const STATUS_BADGE: Record<UserStatus, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  LOCKED: 'bg-red-100 text-red-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
}

export function UsersPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<UserStatus | ''>('')
  const { data, isLoading, error } = useUsers({
    search: search || undefined,
    status: statusFilter || undefined,
  })
  const updateStatus = useUpdateUserStatus()
  const [showCreate, setShowCreate] = useState(false)
  const [showBulkCreate, setShowBulkCreate] = useState(false)
  const [changeRoleFor, setChangeRoleFor] = useState<User | null>(null)

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Người dùng</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowBulkCreate(true)}>
            + Thêm hàng loạt
          </Button>
          <Button onClick={() => setShowCreate(true)}>+ Tạo user</Button>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo họ tên/email..."
          className="max-w-xs"
        />
        <div className="w-44 shrink-0">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as UserStatus | '')}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="LOCKED">LOCKED</option>
            <option value="PENDING">PENDING</option>
          </Select>
        </div>
      </div>

      {error && <ErrorBanner error={error} />}
      {isLoading && <Spinner />}

      {data && (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Họ tên</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Email</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">System Role</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Custom Role</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Trạng thái</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.data.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-2 text-gray-900">{u.fullName}</td>
                  <td className="px-4 py-2 text-gray-600">{u.email}</td>
                  <td className="px-4 py-2 text-gray-600">{u.systemRole}</td>
                  <td className="px-4 py-2 text-gray-600">
                    {u.systemRole === 'EMPLOYEE'
                      ? (u.customRoles ?? []).map((r) => r.name).join(', ') || (
                          <span className="text-gray-300">—</span>
                        )
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[u.status]}`}
                    >
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        to={`/employees/${u.id}/competency`}
                        className="inline-flex items-center rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Xem chi tiết
                      </Link>
                      {u.systemRole === 'EMPLOYEE' && (
                        <Button
                          variant="secondary"
                          className="px-2 py-1 text-xs"
                          onClick={() => setChangeRoleFor(u)}
                        >
                          Đổi Custom Role
                        </Button>
                      )}
                      {u.status !== 'LOCKED' ? (
                        <Button
                          variant="danger"
                          className="px-2 py-1 text-xs"
                          disabled={updateStatus.isPending}
                          onClick={() => updateStatus.mutate({ id: u.id, status: 'LOCKED' })}
                        >
                          Khoá
                        </Button>
                      ) : (
                        <Button
                          variant="secondary"
                          className="px-2 py-1 text-xs"
                          disabled={updateStatus.isPending}
                          onClick={() => updateStatus.mutate({ id: u.id, status: 'ACTIVE' })}
                        >
                          Mở khoá
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {data.data.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-400">
                    Không có user nào khớp bộ lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} />}
      {showBulkCreate && <BulkCreateModal onClose={() => setShowBulkCreate(false)} />}
      {changeRoleFor && (
        <ChangeCustomRoleModal user={changeRoleFor} onClose={() => setChangeRoleFor(null)} />
      )}
    </div>
  )
}

function CreateUserModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [systemRole, setSystemRole] = useState<SystemRole>('EMPLOYEE')
  const createUser = useCreateUser()
  const [result, setResult] = useState<{ email: string; tempPassword: string } | null>(
    null,
  )

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    createUser.mutate(
      { email, fullName, systemRole: systemRole as 'ADMIN' | 'MANAGER' | 'EMPLOYEE' },
      {
        onSuccess: (res) =>
          setResult({ email: res.user.email, tempPassword: res.tempPassword }),
      },
    )
  }

  return (
    <Modal title="Tạo user mới" onClose={onClose}>
      {result ? (
        <div className="space-y-3">
          <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
            Đã tạo <strong>{result.email}</strong>. Mật khẩu tạm (gửi cho user, không hiển thị
            lại):
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
            <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Họ tên</label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Vai trò hệ thống
            </label>
            <Select
              value={systemRole}
              onChange={(e) => setSystemRole(e.target.value as SystemRole)}
            >
              <option value="EMPLOYEE">EMPLOYEE</option>
              <option value="MANAGER">MANAGER</option>
              <option value="ADMIN">ADMIN</option>
            </Select>
          </div>

          {createUser.isError && <ErrorBanner error={createUser.error} />}

          <Button type="submit" className="w-full" disabled={createUser.isPending}>
            {createUser.isPending ? 'Đang tạo...' : 'Tạo user'}
          </Button>
        </form>
      )}
    </Modal>
  )
}

function ChangeCustomRoleModal({ user, onClose }: { user: User; onClose: () => void }) {
  const { data: allRoles, isLoading: loadingAll } = useRoles()
  const { data: userRoles, isLoading: loadingUser } = useRolesForUser(user.id)
  const { assignUser, unassignUser } = useRoleMutations()

  const assignedIds = new Set((userRoles ?? []).map((r) => r.id))

  function toggle(roleId: string, isAssigned: boolean) {
    if (isAssigned) {
      unassignUser.mutate({ roleId, userId: user.id })
    } else {
      assignUser.mutate({ roleId, userId: user.id })
    }
  }

  return (
    <Modal title={`Đổi Custom Role — ${user.fullName}`} onClose={onClose}>
      {(loadingAll || loadingUser) && <Spinner />}
      {(assignUser.isError || unassignUser.isError) && (
        <ErrorBanner error={assignUser.error ?? unassignUser.error} />
      )}
      {allRoles && (
        <div className="space-y-2">
          {allRoles.data.length === 0 && (
            <p className="text-sm text-gray-400">Tenant chưa có Custom Role nào.</p>
          )}
          {allRoles.data.map((role) => {
            const isAssigned = assignedIds.has(role.id)
            return (
              <label
                key={role.id}
                className="flex items-center gap-2 rounded-md border border-gray-100 px-3 py-2 text-sm hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={isAssigned}
                  disabled={assignUser.isPending || unassignUser.isPending}
                  onChange={() => toggle(role.id, isAssigned)}
                />
                <span className="text-gray-800">{role.name}</span>
              </label>
            )
          })}
        </div>
      )}
      <Button className="mt-4 w-full" variant="secondary" onClick={onClose}>
        Đóng
      </Button>
    </Modal>
  )
}

function BulkCreateModal({ onClose }: { onClose: () => void }) {
  const { data: roles } = useRoles()
  const [rows, setRows] = useState<BulkCreateUserRow[]>([{ fullName: '', roleId: undefined }])
  const bulkCreate = useBulkCreateUsers()
  const [result, setResult] = useState<BulkCreateUsersResult | null>(null)

  function updateRow(index: number, patch: Partial<BulkCreateUserRow>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  function addRow() {
    setRows((prev) => [...prev, { fullName: '', roleId: undefined }])
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index))
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const validRows = rows.filter((r) => r.fullName.trim().length > 0)
    if (validRows.length === 0) return
    bulkCreate.mutate(validRows, { onSuccess: setResult })
  }

  function copyRow(email: string, password: string) {
    void navigator.clipboard.writeText(`${email}\t${password}`)
  }

  function exportCsv() {
    if (!result) return
    const header = 'email,tempPassword,fullName'
    const lines = result.users.map((u) => `${u.email},${u.tempPassword},${u.fullName}`)
    const csv = [header, ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'user-tam-thoi.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-white p-5 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Thêm nhân sự hàng loạt</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Đóng">
            ✕
          </button>
        </div>

        {result ? (
          <div className="space-y-3">
            <div className="rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-800">
              Đã tạo {result.users.length} user. Mật khẩu tạm chỉ hiển thị DUY NHẤT 1 LẦN ở đây —
              không thể xem lại sau khi rời trang này. Hãy Copy/Export CSV ngay.
            </div>
            <div className="max-h-80 overflow-y-auto rounded-md border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-1.5 text-left font-medium text-gray-500">Email</th>
                    <th className="px-3 py-1.5 text-left font-medium text-gray-500">Mật khẩu tạm</th>
                    <th className="px-3 py-1.5 text-right font-medium text-gray-500"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {result.users.map((u) => (
                    <tr key={u.email}>
                      <td className="px-3 py-1.5 text-gray-800">{u.email}</td>
                      <td className="px-3 py-1.5 font-mono text-xs text-gray-800">
                        {u.tempPassword}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <Button
                          variant="ghost"
                          className="px-2 py-1 text-xs"
                          onClick={() => copyRow(u.email, u.tempPassword)}
                        >
                          Copy
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={exportCsv}>
                Export CSV
              </Button>
              <Button className="flex-1" onClick={onClose}>
                Đóng
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {rows.map((row, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    placeholder="Họ tên"
                    value={row.fullName}
                    onChange={(e) => updateRow(index, { fullName: e.target.value })}
                    className="min-w-0 flex-1"
                  />
                  {/* Bọc trong <div> thay vì truyền className="w-48" thẳng vào <Select> — Select
                      tự có sẵn `w-full` trong style gốc, 2 class cùng set `width` trên 1 phần tử
                      để CSS cascade tự quyết định class nào thắng (không phải thứ tự viết trong
                      JSX) nên có thể ra kết quả sai (w-full thắng, Select chiếm gần hết hàng, đẩy
                      Input họ tên co lại gần như biến mất — bug thực tế đã gặp phải). */}
                  <div className="w-48 shrink-0">
                    <Select
                      value={row.roleId ?? ''}
                      onChange={(e) => updateRow(index, { roleId: e.target.value || undefined })}
                    >
                      <option value="">-- Custom Role (tuỳ chọn) --</option>
                      {roles?.data.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="shrink-0 px-2 py-1 text-xs"
                    disabled={rows.length === 1}
                    onClick={() => removeRow(index)}
                  >
                    Xoá dòng
                  </Button>
                </div>
              ))}
            </div>
            <Button type="button" variant="secondary" onClick={addRow}>
              + Thêm dòng
            </Button>

            {bulkCreate.isError && <ErrorBanner error={bulkCreate.error} />}

            <Button type="submit" className="w-full" disabled={bulkCreate.isPending}>
              {bulkCreate.isPending ? 'Đang tạo...' : `Tạo ${rows.filter((r) => r.fullName.trim()).length} user`}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
