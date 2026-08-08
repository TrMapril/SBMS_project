import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  useCancelProject,
  useCreateProject,
  useProjects,
  useRestartProject,
} from '../features/projects/useProjects'
import { useWorkflows } from '../features/workflow/useWorkflows'
import { useAuthStore } from '../store/auth.store'
import type { Project, ProjectStatus } from '../lib/types'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Modal } from '../components/ui/Modal'
import { ErrorBanner } from '../components/ui/ErrorBanner'
import { Spinner } from '../components/ui/Spinner'

const STATUS_BADGE: Record<ProjectStatus, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  COMPLETED: 'bg-blue-100 text-blue-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
}

/** Phase 7.5 Đợt 3 — trang Dự án đổi sang dạng bảng cho cả Manager (đầy đủ thao tác Cancel/
 * Restart) và Employee (chỉ xem + vào chi tiết, không đổi cách ly dữ liệu đã có từ Giai đoạn 6 —
 * BE đã tự lọc đúng project theo project_members). */
export function ProjectsPage() {
  const { data, isLoading, error } = useProjects()
  const isManager = useAuthStore((s) => s.user?.systemRole === 'MANAGER')
  const [showCreate, setShowCreate] = useState(false)

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Dự án</h1>
        {isManager && <Button onClick={() => setShowCreate(true)}>+ Tạo dự án</Button>}
      </div>

      {error && <ErrorBanner error={error} />}
      {isLoading && <Spinner />}

      {data && (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Tên</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Workflow</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">Thành viên</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">Task</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">% hoàn thành</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Trạng thái</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.data.map((p) => (
                <ProjectRow key={p.id} project={p} isManager={!!isManager} />
              ))}
              {data.data.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-sm text-gray-400">
                    Chưa có dự án nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <CreateProjectModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}

function ProjectRow({ project: p, isManager }: { project: Project; isManager: boolean }) {
  const cancelProject = useCancelProject()
  const restartProject = useRestartProject()
  const [error, setError] = useState<unknown>(null)

  function handleCancel() {
    if (!window.confirm(`Huỷ project "${p.name}"?`)) return
    setError(null)
    cancelProject.mutate(p.id, { onError: setError })
  }

  function handleRestart() {
    setError(null)
    restartProject.mutate(p.id, { onError: setError })
  }

  return (
    <tr>
      <td className="px-4 py-2 text-gray-900">
        <Link to={`/projects/${p.id}`} className="font-medium hover:text-indigo-600 hover:underline">
          {p.name}
        </Link>
        {error != null && (
          <div className="mt-1">
            <ErrorBanner error={error} />
          </div>
        )}
      </td>
      <td className="px-4 py-2 text-gray-600">{p.workflow?.name ?? '—'}</td>
      <td className="px-4 py-2 text-right text-gray-600">{p.memberCount ?? 0}</td>
      <td className="px-4 py-2 text-right text-gray-600">{p.totalTasks ?? 0}</td>
      <td className="px-4 py-2 text-right text-gray-600">{p.completionPercent ?? 0}%</td>
      <td className="px-4 py-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[p.status]}`}>
          {p.status}
        </span>
      </td>
      <td className="px-4 py-2 text-right">
        <div className="flex justify-end gap-2">
          {isManager && p.status === 'ACTIVE' && (
            <Button
              variant="danger"
              className="px-2 py-1 text-xs"
              disabled={cancelProject.isPending}
              onClick={handleCancel}
            >
              Huỷ
            </Button>
          )}
          {isManager && p.status === 'CANCELLED' && (
            <Button
              variant="secondary"
              className="px-2 py-1 text-xs"
              disabled={restartProject.isPending}
              onClick={handleRestart}
            >
              Khởi động lại
            </Button>
          )}
          <Link to={`/projects/${p.id}`}>
            <Button variant="secondary" className="px-2 py-1 text-xs">
              Chi tiết
            </Button>
          </Link>
        </div>
      </td>
    </tr>
  )
}

function CreateProjectModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [workflowId, setWorkflowId] = useState('')
  const { data: workflows } = useWorkflows()
  const createProject = useCreateProject()

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    createProject.mutate({ name, workflowId }, { onSuccess: onClose })
  }

  return (
    <Modal title="Tạo dự án" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Tên dự án</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Workflow</label>
          <Select
            value={workflowId}
            onChange={(e) => setWorkflowId(e.target.value)}
            required
          >
            <option value="">-- Chọn workflow --</option>
            {workflows?.data.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
        </div>

        {createProject.isError && <ErrorBanner error={createProject.error} />}

        <Button type="submit" className="w-full" disabled={createProject.isPending}>
          {createProject.isPending ? 'Đang tạo...' : 'Tạo dự án'}
        </Button>
      </form>
    </Modal>
  )
}
