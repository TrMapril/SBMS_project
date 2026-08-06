import { useState, type FormEvent } from 'react'
import { useCreateUser, useUpdateUserStatus, useUsers } from '../features/users/useUsers'
import type { SystemRole, UserStatus } from '../lib/types'
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
  const { data, isLoading, error } = useUsers()
  const updateStatus = useUpdateUserStatus()
  const [showCreate, setShowCreate] = useState(false)

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Người dùng</h1>
        <Button onClick={() => setShowCreate(true)}>+ Tạo user</Button>
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
                <th className="px-4 py-2 text-left font-medium text-gray-500">Vai trò</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Trạng thái</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.data.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-2 text-gray-900">{u.fullName}</td>
                  <td className="px-4 py-2 text-gray-600">{u.email}</td>
                  <td className="px-4 py-2 text-gray-600">{u.systemRole}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[u.status]}`}
                    >
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {u.status !== 'LOCKED' ? (
                      <Button
                        variant="danger"
                        className="px-2 py-1 text-xs"
                        disabled={updateStatus.isPending}
                        onClick={() =>
                          updateStatus.mutate({ id: u.id, status: 'LOCKED' })
                        }
                      >
                        Khoá
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        className="px-2 py-1 text-xs"
                        disabled={updateStatus.isPending}
                        onClick={() =>
                          updateStatus.mutate({ id: u.id, status: 'ACTIVE' })
                        }
                      >
                        Mở khoá
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} />}
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
