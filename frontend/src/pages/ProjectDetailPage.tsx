import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  useAddProjectMember,
  useProject,
  useRemoveProjectMember,
} from '../features/projects/useProjects'
import { useUsers } from '../features/users/useUsers'
import { useAuthStore } from '../store/auth.store'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Select'
import { ErrorBanner } from '../components/ui/ErrorBanner'
import { Spinner } from '../components/ui/Spinner'

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: project, isLoading, error } = useProject(id)
  const { data: users } = useUsers()
  const isManager = useAuthStore((s) => s.user?.systemRole === 'MANAGER')
  const addMember = useAddProjectMember(id!)
  const removeMember = useRemoveProjectMember(id!)
  const [selectedUserId, setSelectedUserId] = useState('')

  if (isLoading) return <Spinner />
  if (error) return <ErrorBanner error={error} />
  if (!project) return null

  const memberIds = new Set(project.members.map((m) => m.userId))
  const availableUsers = users?.data.filter((u) => !memberIds.has(u.id)) ?? []

  function handleAddMember(e: FormEvent) {
    e.preventDefault()
    if (!selectedUserId) return
    addMember.mutate(selectedUserId, { onSuccess: () => setSelectedUserId('') })
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{project.name}</h1>
        </div>
        <Link to={`/projects/${project.id}/board`}>
          <Button>Xem Task Board</Button>
        </Link>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Thành viên dự án</h2>

        {removeMember.isError && <ErrorBanner error={removeMember.error} />}
        {addMember.isError && <ErrorBanner error={addMember.error} />}

        <ul className="mb-4 divide-y divide-gray-100">
          {project.members.map((m) => (
            <li key={m.id} className="flex items-center justify-between py-2 text-sm">
              <span className="text-gray-800">
                {m.user?.fullName ?? m.userId}{' '}
                <span className="text-gray-400">({m.user?.systemRole})</span>
              </span>
              {isManager && (
                <Button
                  variant="danger"
                  className="px-2 py-1 text-xs"
                  disabled={removeMember.isPending}
                  onClick={() => removeMember.mutate(m.userId)}
                >
                  Xoá
                </Button>
              )}
            </li>
          ))}
          {project.members.length === 0 && (
            <li className="py-2 text-sm text-gray-400">Chưa có thành viên nào.</li>
          )}
        </ul>

        {isManager && (
          <form onSubmit={handleAddMember} className="flex gap-2">
            <Select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
            >
              <option value="">-- Chọn user để thêm --</option>
              {availableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName} ({u.email})
                </option>
              ))}
            </Select>
            <Button type="submit" disabled={!selectedUserId || addMember.isPending}>
              Thêm
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
