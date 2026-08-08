import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/auth.store'
import { useWorkflows } from '../features/workflow/useWorkflows'
import {
  useBottleneckSnapshot,
  useRecomputeBottleneck,
  useRecomputeRiskScores,
  useRiskAlerts,
} from '../features/algorithms/useAlgorithms'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Select'
import { ErrorBanner } from '../components/ui/ErrorBanner'
import { Spinner } from '../components/ui/Spinner'

const QUICK_LINKS: Record<string, { to: string; label: string }[]> = {
  ADMIN: [
    { to: '/workflows', label: 'Quản lý Workflow' },
    { to: '/users', label: 'Quản lý người dùng' },
    { to: '/custom-fields', label: 'Quản lý Custom Fields' },
    { to: '/admin/projects', label: 'Quản lý dự án' },
  ],
  MANAGER: [{ to: '/projects', label: 'Quản lý dự án' }],
  EMPLOYEE: [{ to: '/projects', label: 'Xem dự án của tôi' }],
}

/** Phase 7.5 Đợt 2 — gộp "Trang chủ" và "Dashboard" cũ (2 trang riêng, Dashboard trống với
 * Employee vì bị chặn route) thành 1 trang duy nhất: quick links cho mọi role + cảnh báo
 * deadline/bottleneck chỉ hiện với Admin/Manager (nội dung y hệt DashboardPage cũ, không đổi). */
export function HomePage() {
  const user = useAuthStore((s) => s.user)
  if (!user) return null

  const showDashboardSections = user.systemRole === 'ADMIN' || user.systemRole === 'MANAGER'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Chào {user.fullName}</h1>
        <p className="mt-1 text-sm text-gray-500">
          Vai trò hệ thống: <span className="font-medium">{user.systemRole}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(QUICK_LINKS[user.systemRole] ?? []).map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="rounded-lg border border-gray-200 bg-white p-4 text-sm font-medium text-gray-700 shadow-sm hover:border-indigo-300 hover:text-indigo-700"
          >
            {link.label}
          </Link>
        ))}
      </div>

      {showDashboardSections && (
        <div className="space-y-6">
          <RiskAlertsSection />
          <BottleneckSection />
        </div>
      )}
    </div>
  )
}

function riskColor(score: number) {
  if (score > 70) return 'bg-red-100 text-red-700'
  if (score > 40) return 'bg-yellow-100 text-yellow-700'
  return 'bg-green-100 text-green-700'
}

function RiskAlertsSection() {
  const { data: tasks, isLoading, error } = useRiskAlerts()
  const recompute = useRecomputeRiskScores()

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">
          Cảnh báo nguy cơ trễ deadline
        </h2>
        <Button
          variant="secondary"
          className="px-2 py-1 text-xs"
          disabled={recompute.isPending}
          onClick={() => recompute.mutate()}
        >
          {recompute.isPending ? 'Đang tính...' : 'Tính lại ngay'}
        </Button>
      </div>

      {isLoading && <Spinner />}
      {error && <ErrorBanner error={error} />}
      {recompute.isError && <ErrorBanner error={recompute.error} />}

      {tasks && tasks.length === 0 && (
        <p className="text-sm text-gray-400">
          Chưa có Task nào được tính risk_score (cron chạy mỗi giờ, hoặc bấm "Tính lại ngay").
        </p>
      )}

      {tasks && tasks.length > 0 && (
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead>
            <tr>
              <th className="px-2 py-1.5 text-left font-medium text-gray-500">Task</th>
              <th className="px-2 py-1.5 text-left font-medium text-gray-500">Project</th>
              <th className="px-2 py-1.5 text-left font-medium text-gray-500">State</th>
              <th className="px-2 py-1.5 text-left font-medium text-gray-500">Assignee</th>
              <th className="px-2 py-1.5 text-left font-medium text-gray-500">Hạn</th>
              <th className="px-2 py-1.5 text-right font-medium text-gray-500">Rủi ro</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {tasks.map((t) => (
              <tr key={t.id}>
                <td className="px-2 py-1.5 text-gray-900">{t.title}</td>
                <td className="px-2 py-1.5 text-gray-600">{t.project.name}</td>
                <td className="px-2 py-1.5 text-gray-600">{t.currentState.name}</td>
                <td className="px-2 py-1.5 text-gray-600">
                  {t.assignee?.fullName ?? 'Chưa giao'}
                </td>
                <td className="px-2 py-1.5 text-gray-600">
                  {t.deadline ? new Date(t.deadline).toLocaleDateString('vi-VN') : '—'}
                </td>
                <td className="px-2 py-1.5 text-right">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${riskColor(t.riskScore ?? 0)}`}
                  >
                    {(t.riskScore ?? 0).toFixed(0)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function BottleneckSection() {
  const { data: workflows } = useWorkflows()
  const [workflowId, setWorkflowId] = useState('')
  const activeWorkflowId = workflowId || workflows?.data[0]?.id

  const { data: snapshot, isLoading, error } = useBottleneckSnapshot(activeWorkflowId)
  const recompute = useRecomputeBottleneck(activeWorkflowId)

  const maxDwell = useMemo(() => {
    if (!snapshot) return 0
    return Math.max(0, ...snapshot.stateStats.map((s) => s.avgDwellHours ?? 0))
  }, [snapshot])

  const backwardTransitions = useMemo(
    () =>
      (snapshot?.transitionStats ?? [])
        .filter((t) => t.isBackward && t.count > 0)
        .sort((a, b) => b.count - a.count),
    [snapshot],
  )

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-gray-700">Heatmap Bottleneck quy trình</h2>
        <div className="flex items-center gap-2">
          <div className="w-56 shrink-0">
            <Select value={activeWorkflowId ?? ''} onChange={(e) => setWorkflowId(e.target.value)}>
              {workflows?.data.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
          </div>
          <Button
            variant="secondary"
            className="px-2 py-1 text-xs"
            disabled={recompute.isPending || !activeWorkflowId}
            onClick={() => recompute.mutate()}
          >
            {recompute.isPending ? 'Đang tính...' : 'Tính lại ngay'}
          </Button>
        </div>
      </div>

      {isLoading && <Spinner />}
      {error && <ErrorBanner error={error} />}
      {recompute.isError && <ErrorBanner error={recompute.error} />}

      {!isLoading && !snapshot && (
        <p className="text-sm text-gray-400">
          Chưa có snapshot nào cho Workflow này (job chạy 1 lần/ngày, hoặc bấm "Tính lại ngay").
        </p>
      )}

      {snapshot && (
        <div className="space-y-4">
          <p className="text-xs text-gray-400">
            Tính lúc {new Date(snapshot.computedAt).toLocaleString('vi-VN')} · cửa sổ{' '}
            {snapshot.windowDays} ngày · tỷ lệ transition đi ngược tổng thể:{' '}
            <span className="font-medium text-gray-600">
              {(snapshot.overallBackwardRate * 100).toFixed(1)}%
            </span>
            {snapshot.deltaBackwardRateVsPrevious != null && (
              <span
                className={
                  snapshot.deltaBackwardRateVsPrevious > 0 ? 'text-red-600' : 'text-green-600'
                }
              >
                {' '}
                ({snapshot.deltaBackwardRateVsPrevious > 0 ? '+' : ''}
                {(snapshot.deltaBackwardRateVsPrevious * 100).toFixed(1)}% so với lần trước)
              </span>
            )}
          </p>

          <div>
            <h3 className="mb-2 text-xs font-semibold text-gray-500">
              Thời gian trung bình nằm ở mỗi State
            </h3>
            <div className="space-y-1.5">
              {snapshot.stateStats.map((s) => {
                const width = maxDwell > 0 ? Math.max(4, ((s.avgDwellHours ?? 0) / maxDwell) * 100) : 0
                return (
                  <div key={s.stateId} className="flex items-center gap-2">
                    <span className="w-28 shrink-0 truncate text-xs text-gray-600">
                      {s.stateName}
                    </span>
                    <div className="h-4 flex-1 rounded bg-gray-100">
                      <div
                        className="h-4 rounded bg-orange-400"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                    <span className="w-24 shrink-0 text-right text-xs text-gray-500">
                      {s.avgDwellHours != null ? `${s.avgDwellHours.toFixed(1)}h` : '—'}
                      {s.deltaHoursVsPrevious != null && (
                        <span className={s.deltaHoursVsPrevious > 0 ? 'text-red-500' : 'text-green-600'}>
                          {' '}
                          ({s.deltaHoursVsPrevious > 0 ? '+' : ''}
                          {s.deltaHoursVsPrevious.toFixed(1)}h)
                        </span>
                      )}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold text-gray-500">
              Transition đi ngược nhiều nhất (dấu hiệu bottleneck)
            </h3>
            {backwardTransitions.length === 0 && (
              <p className="text-xs text-gray-400">
                Không có transition đi ngược nào trong {snapshot.windowDays} ngày gần đây.
              </p>
            )}
            {backwardTransitions.length > 0 && (
              <ul className="space-y-1">
                {backwardTransitions.map((t) => (
                  <li
                    key={t.transitionId}
                    className="flex items-center justify-between rounded bg-red-50 px-2 py-1 text-xs"
                  >
                    <span className="text-red-800">
                      {t.fromStateName} → {t.toStateName} ({t.name})
                    </span>
                    <span className="font-medium text-red-700">{t.count} lần</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
