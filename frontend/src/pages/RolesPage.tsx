import { useState, type FormEvent } from 'react'
import { useRole, useRoleMutations, useRoles } from '../features/roles/useRoles'
import { useUsers } from '../features/users/useUsers'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Modal } from '../components/ui/Modal'
import { ErrorBanner } from '../components/ui/ErrorBanner'
import { Spinner } from '../components/ui/Spinner'

export function RolesPage() {
  const { data, isLoading, error } = useRoles()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Custom Role</h1>
          <p className="text-xs text-gray-400">
            Dùng để đối chiếu quyền chuyển trạng thái Task (allow_roles) — khác với vai trò hệ
            thống (Admin/Manager/Employee).
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ Custom Role</Button>
      </div>

      {error && <ErrorBanner error={error} />}
      {isLoading && <Spinner />}

      {data && (
        <div className="flex gap-4">
          <div className="w-64 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-white">
            <ul className="divide-y divide-gray-100">
              {data.data.map((role) => (
                <li key={role.id}>
                  <button
                    onClick={() => setSelectedId(role.id)}
                    className={`block w-full px-4 py-2 text-left text-sm ${
                      selectedId === role.id
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {role.name}
                  </button>
                </li>
              ))}
              {data.data.length === 0 && (
                <li className="px-4 py-3 text-sm text-gray-400">Chưa có Custom Role nào.</li>
              )}
            </ul>
          </div>

          <div className="flex-1 rounded-lg border border-gray-200 bg-white p-4">
            {selectedId ? (
              <RoleDetailPanel roleId={selectedId} onDeleted={() => setSelectedId(null)} />
            ) : (
              <p className="text-sm text-gray-400">Chọn 1 Custom Role để xem chi tiết.</p>
            )}
          </div>
        </div>
      )}

      {showCreate && <CreateRoleModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}

function CreateRoleModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const { createRole } = useRoleMutations()

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    createRole.mutate(name, { onSuccess: onClose })
  }

  return (
    <Modal title="Tạo Custom Role" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Tên</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </div>
        {createRole.isError && <ErrorBanner error={createRole.error} />}
        <Button type="submit" className="w-full" disabled={createRole.isPending}>
          {createRole.isPending ? 'Đang tạo...' : 'Tạo'}
        </Button>
      </form>
    </Modal>
  )
}

function RoleDetailPanel({
  roleId,
  onDeleted,
}: {
  roleId: string
  onDeleted: () => void
}) {
  const { data: role, isLoading, error } = useRole(roleId)
  const { data: users } = useUsers()
  const { renameRole, removeRole, assignUser, unassignUser } = useRoleMutations()
  const [name, setName] = useState('')
  const [selectedUserId, setSelectedUserId] = useState('')

  if (isLoading) return <Spinner />
  if (error) return <ErrorBanner error={error} />
  if (!role) return null

  const assignedIds = new Set(role.userRoles.map((ur) => ur.userId))
  const availableUsers = users?.data.filter((u) => !assignedIds.has(u.id)) ?? []

  function handleRename(e: FormEvent) {
    e.preventDefault()
    renameRole.mutate({ id: role!.id, name: name || role!.name })
  }

  function handleAssign(e: FormEvent) {
    e.preventDefault()
    if (!selectedUserId) return
    assignUser.mutate(
      { roleId: role!.id, userId: selectedUserId },
      { onSuccess: () => setSelectedUserId('') },
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="mb-2 text-sm font-semibold text-gray-700">Đổi tên</h2>
        <form onSubmit={handleRename} className="flex gap-2">
          <Input
            defaultValue={role.name}
            onChange={(e) => setName(e.target.value)}
            className="max-w-xs"
          />
          <Button type="submit" variant="secondary" disabled={renameRole.isPending}>
            Lưu
          </Button>
        </form>
        {renameRole.isError && <ErrorBanner error={renameRole.error} />}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-gray-700">
          Thành viên ({role.userRoles.length})
        </h2>
        <ul className="mb-3 divide-y divide-gray-100 rounded-md border border-gray-100">
          {role.userRoles.map((ur) => (
            <li key={ur.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <span className="text-gray-800">
                {ur.user.fullName} <span className="text-gray-400">({ur.user.email})</span>
              </span>
              <Button
                variant="danger"
                className="px-2 py-1 text-xs"
                disabled={unassignUser.isPending}
                onClick={() => unassignUser.mutate({ roleId: role.id, userId: ur.userId })}
              >
                Bỏ gán
              </Button>
            </li>
          ))}
          {role.userRoles.length === 0 && (
            <li className="px-3 py-2 text-sm text-gray-400">Chưa gán cho user nào.</li>
          )}
        </ul>
        {unassignUser.isError && <ErrorBanner error={unassignUser.error} />}

        <form onSubmit={handleAssign} className="flex gap-2">
          <Select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="max-w-xs"
          >
            <option value="">-- Chọn user để gán --</option>
            {availableUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName} ({u.email})
              </option>
            ))}
          </Select>
          <Button type="submit" disabled={!selectedUserId || assignUser.isPending}>
            Gán
          </Button>
        </form>
        {assignUser.isError && <ErrorBanner error={assignUser.error} />}
      </div>

      <div className="border-t border-gray-100 pt-4">
        {removeRole.isError && <ErrorBanner error={removeRole.error} />}
        <Button
          variant="danger"
          disabled={removeRole.isPending}
          onClick={() => removeRole.mutate(role.id, { onSuccess: onDeleted })}
        >
          Xoá Custom Role
        </Button>
      </div>
    </div>
  )
}
