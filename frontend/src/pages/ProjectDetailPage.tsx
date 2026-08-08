import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  useAddProjectMembers,
  useProject,
  useProjectMembers,
  useRemoveProjectMember,
  useSetProjectMemberStatus,
} from '../features/projects/useProjects'
import { useUsers } from '../features/users/useUsers'
import { useAuthStore } from '../store/auth.store'
import type { ProjectMember, User } from '../lib/types'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { ErrorBanner } from '../components/ui/ErrorBanner'
import { Spinner } from '../components/ui/Spinner'

const MEMBER_STATUS_BADGE: Record<'ACTIVE' | 'PAUSED' | 'DISABLED', string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  PAUSED: 'bg-yellow-100 text-yellow-700',
  DISABLED: 'bg-red-100 text-red-700',
}

/** Phase 7.5 Đợt 3 — "trang nhân sự dự án", đổi từ danh sách trơn sang bảng đầy đủ: Vai trò
 * (Custom Role), Số Task hoàn thành/được giao TRONG PROJECT NÀY, Trạng thái member (ACTIVE/
 * PAUSED từ Đợt 1C, hoặc DISABLED đọc từ `users.status` — không phải cột riêng). Nút "Task
 * Board" giữ nguyên vị trí góc trên như trước (không đổi). */
export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: project, isLoading, error } = useProject(id)
  const { data: members, isLoading: loadingMembers, error: membersError } = useProjectMembers(id)
  const isManager = useAuthStore((s) => s.user?.systemRole === 'MANAGER')
  const removeMember = useRemoveProjectMember(id!)
  const setMemberStatus = useSetProjectMemberStatus(id!)
  const [showAddMembers, setShowAddMembers] = useState(false)
  const [rowError, setRowError] = useState<unknown>(null)

  if (isLoading) return <Spinner />
  if (error) return <ErrorBanner error={error} />
  if (!project) return null

  function memberEffectiveStatus(m: ProjectMember): 'ACTIVE' | 'PAUSED' | 'DISABLED' {
    if (m.user?.status === 'LOCKED') return 'DISABLED'
    return m.status
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{project.name}</h1>
          <p className="text-xs text-gray-400">
            Workflow: {project.workflow?.name ?? '—'} · {project.completionPercent ?? 0}% hoàn
            thành
          </p>
        </div>
        <Link to={`/projects/${project.id}/board`}>
          <Button>Xem Task Board</Button>
        </Link>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Thành viên dự án</h2>
          {isManager && <Button onClick={() => setShowAddMembers(true)}>+ Thêm nhân sự</Button>}
        </div>

        {membersError && <ErrorBanner error={membersError} />}
        {loadingMembers && <Spinner />}
        {rowError != null && <ErrorBanner error={rowError} />}

        {members && (
          <div className="overflow-hidden rounded-md border border-gray-100">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-1.5 text-left font-medium text-gray-500">Họ tên</th>
                  <th className="px-3 py-1.5 text-left font-medium text-gray-500">Vai trò</th>
                  <th className="px-3 py-1.5 text-right font-medium text-gray-500">
                    Task hoàn thành / được giao
                  </th>
                  <th className="px-3 py-1.5 text-left font-medium text-gray-500">Trạng thái</th>
                  {isManager && (
                    <th className="px-3 py-1.5 text-right font-medium text-gray-500">Thao tác</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {members.map((m) => {
                  const effectiveStatus = memberEffectiveStatus(m)
                  const roleLabel =
                    m.user?.systemRole === 'EMPLOYEE'
                      ? (m.customRoles ?? []).map((r) => r.name).join(', ') || '—'
                      : m.user?.systemRole ?? '—'
                  return (
                    <tr key={m.id}>
                      <td className="px-3 py-1.5 text-gray-800">
                        {m.user?.fullName ?? m.userId}
                      </td>
                      <td className="px-3 py-1.5 text-gray-600">{roleLabel}</td>
                      <td className="px-3 py-1.5 text-right text-gray-600">
                        {m.completedTaskCount ?? 0} / {m.assignedTaskCount ?? 0}
                      </td>
                      <td className="px-3 py-1.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${MEMBER_STATUS_BADGE[effectiveStatus]}`}
                        >
                          {effectiveStatus}
                        </span>
                      </td>
                      {isManager && (
                        <td className="px-3 py-1.5 text-right">
                          <div className="flex justify-end gap-2">
                            {m.status === 'ACTIVE' ? (
                              <Button
                                variant="secondary"
                                className="px-2 py-1 text-xs"
                                disabled={setMemberStatus.isPending}
                                onClick={() => {
                                  setRowError(null)
                                  setMemberStatus.mutate(
                                    { userId: m.userId, action: 'pause' },
                                    { onError: setRowError },
                                  )
                                }}
                              >
                                Tạm dừng
                              </Button>
                            ) : (
                              <Button
                                variant="secondary"
                                className="px-2 py-1 text-xs"
                                disabled={setMemberStatus.isPending}
                                onClick={() => {
                                  setRowError(null)
                                  setMemberStatus.mutate(
                                    { userId: m.userId, action: 'resume' },
                                    { onError: setRowError },
                                  )
                                }}
                              >
                                Khôi phục
                              </Button>
                            )}
                            <Button
                              variant="danger"
                              className="px-2 py-1 text-xs"
                              disabled={removeMember.isPending}
                              onClick={() => {
                                setRowError(null)
                                removeMember.mutate(m.userId, { onError: setRowError })
                              }}
                            >
                              Xoá
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
                {members.length === 0 && (
                  <tr>
                    <td
                      colSpan={isManager ? 5 : 4}
                      className="px-3 py-4 text-center text-sm text-gray-400"
                    >
                      Chưa có thành viên nào.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddMembers && (
        <AddMembersModal
          projectId={project.id}
          existingMemberIds={new Set((members ?? []).map((m) => m.userId))}
          onClose={() => setShowAddMembers(false)}
        />
      )}
    </div>
  )
}

function AddMembersModal({
  projectId,
  existingMemberIds,
  onClose,
}: {
  projectId: string
  existingMemberIds: Set<string>
  onClose: () => void
}) {
  const { data: users, isLoading } = useUsers()
  const addMembers = useAddProjectMembers(projectId)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const availableUsers = useMemo(() => {
    const all = (users?.data ?? []).filter((u) => !existingMemberIds.has(u.id))
    if (!search) return all
    const q = search.toLowerCase()
    return all.filter(
      (u) => u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    )
  }, [users, existingMemberIds, search])

  function toggle(userId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  function handleConfirm() {
    if (selectedIds.size === 0) return
    addMembers.mutate([...selectedIds], { onSuccess: onClose })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">
            Thêm nhân sự {selectedIds.size > 0 && `(đã chọn ${selectedIds.size})`}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Đóng">
            ✕
          </button>
        </div>

        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo họ tên/email..."
          className="mb-3"
        />

        {isLoading && <Spinner />}
        {addMembers.isError && <ErrorBanner error={addMembers.error} />}

        <div className="mb-4 max-h-80 space-y-1 overflow-y-auto rounded-md border border-gray-100">
          {availableUsers.map((u) => (
            <UserCheckboxRow
              key={u.id}
              user={u}
              checked={selectedIds.has(u.id)}
              onToggle={() => toggle(u.id)}
            />
          ))}
          {availableUsers.length === 0 && !isLoading && (
            <p className="px-3 py-4 text-center text-sm text-gray-400">
              Không có user nào để thêm.
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Huỷ
          </Button>
          <Button
            className="flex-1"
            disabled={selectedIds.size === 0 || addMembers.isPending}
            onClick={handleConfirm}
          >
            {addMembers.isPending ? 'Đang thêm...' : `Thêm ${selectedIds.size} người`}
          </Button>
        </div>
      </div>
    </div>
  )
}

function UserCheckboxRow({
  user,
  checked,
  onToggle,
}: {
  user: User
  checked: boolean
  onToggle: () => void
}) {
  const roleLabel =
    user.systemRole === 'EMPLOYEE' ? (user.customRoles ?? []).map((r) => r.name).join(', ') : undefined
  return (
    <label className="flex cursor-pointer items-center gap-2 border-b border-gray-50 px-3 py-2 text-sm last:border-b-0 hover:bg-gray-50">
      <input type="checkbox" checked={checked} onChange={onToggle} />
      <span className="flex-1 text-gray-800">
        {user.fullName} <span className="text-gray-400">({user.email})</span>
      </span>
      <span className="shrink-0 text-xs text-gray-500">
        {user.systemRole}
        {roleLabel && ` · ${roleLabel}`}
      </span>
      <span
        className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
          user.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}
      >
        {user.status}
      </span>
    </label>
  )
}
