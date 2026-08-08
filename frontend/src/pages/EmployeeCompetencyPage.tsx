import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  useCompetencyProfile,
  useCreateCompetencyProfileEntry,
} from '../features/personnel/useCompetencyProfiles'
import { useUsers } from '../features/users/useUsers'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Textarea } from '../components/ui/Textarea'
import { ErrorBanner } from '../components/ui/ErrorBanner'
import { Spinner } from '../components/ui/Spinner'

/** Phase 7.5 Đợt 2 — Hồ sơ năng lực NỘI BỘ của 1 Employee cụ thể, chỉ vào được qua nút "Xem chi
 * tiết" ở trang User (không còn browse tự do qua sidebar — xem ghi chú ở AppLayout.tsx). */
export function EmployeeCompetencyPage() {
  const { userId } = useParams<{ userId: string }>()
  const { data: users } = useUsers()
  const employee = users?.data.find((u) => u.id === userId)
  const { data: profile, isLoading, error } = useCompetencyProfile(userId)
  const createEntry = useCreateCompetencyProfileEntry()
  const [periodLabel, setPeriodLabel] = useState('')
  const [overallRating, setOverallRating] = useState(3)
  const [managerNotes, setManagerNotes] = useState('')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!userId) return
    createEntry.mutate(
      { userId, periodLabel, overallRating, managerNotes: managerNotes || undefined },
      {
        onSuccess: () => {
          setPeriodLabel('')
          setManagerNotes('')
        },
      },
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">
          Hồ sơ năng lực — {employee?.fullName ?? '...'}
        </h1>
        {userId && (
          <Link to={`/employees/${userId}`} className="text-xs text-indigo-600 hover:underline">
            Xem hồ sơ công khai
          </Link>
        )}
      </div>

      {isLoading && <Spinner />}
      {error && <ErrorBanner error={error} />}

      {profile && (
        <>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="mb-2 text-sm font-semibold text-gray-700">Chỉ số tự động</h3>
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
              <Stat label="Task hoàn thành" value={profile.autoMetrics.totalCompletedTasks} />
              <Stat
                label="Tỷ lệ đúng hạn"
                value={
                  profile.autoMetrics.onTimeRate != null
                    ? `${(profile.autoMetrics.onTimeRate * 100).toFixed(0)}%`
                    : '—'
                }
              />
              <Stat label="Số lần trả về" value={profile.autoMetrics.returnCount} />
              <Stat
                label="TB xử lý/bước"
                value={
                  profile.autoMetrics.avgProcessingHours != null
                    ? `${profile.autoMetrics.avgProcessingHours.toFixed(1)}h`
                    : '—'
                }
              />
              <Stat
                label="Đơn trả task bị từ chối"
                value={profile.autoMetrics.taskReturnRejectedCount}
              />
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="mb-2 text-sm font-semibold text-gray-700">Đánh giá định tính</h3>
            <form onSubmit={handleSubmit} className="mb-4 space-y-2 border-b border-gray-100 pb-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Kỳ đánh giá (vd: 2026-Q3)"
                  value={periodLabel}
                  onChange={(e) => setPeriodLabel(e.target.value)}
                  className="min-w-0 flex-1"
                  required
                />
                {/* Select tự có sẵn w-full trong style gốc — truyền className width thẳng vào
                    Select sẽ bị w-full thắng bất kể thứ tự viết trong JSX (Tailwind cascade theo
                    thứ tự sinh CSS, không theo thứ tự class trong markup), nên bọc trong <div>
                    kích thước cố định thay vì set width trực tiếp lên Select. */}
                <div className="w-24 shrink-0">
                  <Select
                    value={overallRating}
                    onChange={(e) => setOverallRating(Number(e.target.value))}
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n} sao
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <Textarea
                placeholder="Nhận xét nội bộ (chỉ Manager/Admin thấy)"
                value={managerNotes}
                onChange={(e) => setManagerNotes(e.target.value)}
                rows={2}
              />
              {createEntry.isError && <ErrorBanner error={createEntry.error} />}
              <Button type="submit" disabled={createEntry.isPending}>
                {createEntry.isPending ? 'Đang lưu...' : 'Thêm đánh giá'}
              </Button>
            </form>

            <div className="space-y-2">
              {profile.entries.length === 0 && (
                <p className="text-xs text-gray-400">Chưa có đánh giá nào.</p>
              )}
              {profile.entries.map((entry) => (
                <div key={entry.id} className="rounded border border-gray-100 p-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-800">{entry.periodLabel}</span>
                    <span className="text-xs text-yellow-600">
                      {'★'.repeat(entry.overallRating)}
                      {'☆'.repeat(5 - entry.overallRating)}
                    </span>
                  </div>
                  {entry.managerNotes && (
                    <p className="mt-1 text-gray-600">{entry.managerNotes}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-400">
                    Ghi bởi {entry.createdByUser?.fullName} ·{' '}
                    {new Date(entry.createdAt).toLocaleDateString('vi-VN')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-base font-semibold text-gray-800">{value}</p>
    </div>
  )
}
