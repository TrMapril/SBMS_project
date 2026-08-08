import { Link, useParams } from 'react-router-dom'
import { useProject, useProjects } from '../features/projects/useProjects'
import type { ProjectStatus } from '../lib/types'
import { ErrorBanner } from '../components/ui/ErrorBanner'
import { Spinner } from '../components/ui/Spinner'

const STATUS_BADGE: Record<ProjectStatus, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  COMPLETED: 'bg-blue-100 text-blue-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
}

/** Phase 7.5 Đợt 2 — trang Quản lý dự án cho Admin, READ-ONLY HOÀN TOÀN: không có nút tạo Task,
 * không thực hiện được transition, không thêm/bớt member — chỉ xem tiến độ. Vì vậy không liên kết
 * sang Task Board (nơi thực hiện transition) như trang Dự án của Manager. */
export function AdminProjectsPage() {
  const { data, isLoading, error } = useProjects()

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-gray-900">Quản lý dự án (chỉ xem)</h1>

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
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.data.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2 text-gray-900">
                    <Link
                      to={`/admin/projects/${p.id}`}
                      className="font-medium hover:text-indigo-600 hover:underline"
                    >
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-gray-600">{p.workflow?.name ?? '—'}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{p.memberCount ?? 0}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{p.totalTasks ?? 0}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{p.completionPercent ?? 0}%</td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[p.status]}`}
                    >
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
              {data.data.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-400">
                    Chưa có dự án nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function AdminProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: project, isLoading, error } = useProject(id)

  if (isLoading) return <Spinner />
  if (error) return <ErrorBanner error={error} />
  if (!project) return null

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{project.name}</h1>
          <p className="text-xs text-gray-400">
            Workflow: {project.workflow?.name ?? '—'} · Chỉ xem, không thao tác được ở trang này.
          </p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[project.status]}`}
        >
          {project.status}
        </span>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat label="Thành viên" value={project.members.length} />
        <Stat label="Task" value={project.totalTasks ?? 0} />
        <Stat label="% hoàn thành" value={`${project.completionPercent ?? 0}%`} />
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Thành viên dự án</h2>
        <ul className="divide-y divide-gray-100">
          {project.members.map((m) => (
            <li key={m.id} className="flex items-center justify-between py-2 text-sm">
              <span className="text-gray-800">
                {m.user?.fullName ?? m.userId}{' '}
                <span className="text-gray-400">({m.user?.systemRole})</span>
              </span>
              <span className="text-xs text-gray-400">{m.status}</span>
            </li>
          ))}
          {project.members.length === 0 && (
            <li className="py-2 text-sm text-gray-400">Chưa có thành viên nào.</li>
          )}
        </ul>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-lg font-semibold text-gray-800">{value}</p>
    </div>
  )
}
