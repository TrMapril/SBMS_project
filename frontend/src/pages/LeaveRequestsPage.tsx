import { useState, type FormEvent } from 'react'
import {
  useCreateLeaveRequest,
  useLeaveRequests,
  useResetTask,
  useResolveLeaveRequest,
} from '../features/leave-requests/useLeaveRequests'
import { useRequestTypes } from '../features/request-types/useRequestTypes'
import { useAuthStore } from '../store/auth.store'
import type { LeaveRequest, LeaveRequestStatus, RequestType } from '../lib/types'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Textarea } from '../components/ui/Textarea'
import { ErrorBanner } from '../components/ui/ErrorBanner'
import { Spinner } from '../components/ui/Spinner'

const STATUS_BADGE: Record<LeaveRequestStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
}

const TYPE_LABEL: Record<RequestType, string> = {
  LEAVE: 'Nghỉ phép',
  TASK_RETURN: 'Trả task',
  CUSTOM: 'Loại mẫu',
}

/** Với TASK_RETURN, APPROVED/REJECTED mang ngữ nghĩa "lý do phù hợp"/"không phù hợp" (Phase 7.5
 * Đợt 1 mục D — không thêm enum mới, chỉ đổi label hiển thị theo `type`). */
function statusLabel(lr: Pick<LeaveRequest, 'type' | 'status'>): string {
  if (lr.type === 'TASK_RETURN') {
    if (lr.status === 'APPROVED') return 'Phù hợp'
    if (lr.status === 'REJECTED') return 'Không phù hợp'
  }
  return lr.status
}

export function LeaveRequestsPage() {
  const user = useAuthStore((s) => s.user)
  // Phase 7.5 Đợt 2 — Quyết định nền tảng #2: CHỈ Manager duyệt được. Admin xem TOÀN BỘ đơn
  // (view-only, không có nút duyệt) — khác Manager vừa xem toàn bộ vừa duyệt được.
  const canResolve = user?.systemRole === 'MANAGER'
  const canViewAll = user?.systemRole === 'MANAGER' || user?.systemRole === 'ADMIN'
  // Phase 7.5 Đợt 3 — Manager không còn tự gửi đơn được nữa (chỉ Employee/Admin).
  const canCreate = user?.systemRole !== 'MANAGER'
  const [statusFilter, setStatusFilter] = useState<LeaveRequestStatus | ''>('')
  const [typeFilter, setTypeFilter] = useState<RequestType | ''>('')
  const { data, isLoading, error } = useLeaveRequests(
    statusFilter || undefined,
    typeFilter || undefined,
  )
  const [showCreate, setShowCreate] = useState(false)

  if (!user) return null

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Đơn từ nội bộ</h1>
        <div className="flex gap-2">
          {canCreate && <Button onClick={() => setShowCreate(true)}>+ Gửi đơn</Button>}
        </div>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm text-gray-500">Lọc:</span>
        <div className="w-40 shrink-0">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as LeaveRequestStatus | '')}
          >
            <option value="">Mọi trạng thái</option>
            <option value="PENDING">PENDING</option>
            <option value="APPROVED">APPROVED</option>
            <option value="REJECTED">REJECTED</option>
          </Select>
        </div>
        <div className="w-40 shrink-0">
          <Select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as RequestType | '')}
          >
            <option value="">Mọi loại đơn</option>
            <option value="LEAVE">Nghỉ phép</option>
            <option value="TASK_RETURN">Trả task</option>
            <option value="CUSTOM">Loại mẫu</option>
          </Select>
        </div>
      </div>

      {error && <ErrorBanner error={error} />}
      {isLoading && <Spinner />}

      {data && (
        <div className="space-y-2">
          {data.data.length === 0 && (
            <p className="text-sm text-gray-400">Chưa có đơn từ nào.</p>
          )}
          {data.data.map((lr) => (
            <div
              key={lr.id}
              className="rounded-lg border border-gray-200 bg-white p-4 text-sm"
            >
              <div className="mb-1 flex items-start justify-between gap-2">
                <div>
                  {canViewAll && lr.user && (
                    <span className="font-medium text-gray-900">{lr.user.fullName} · </span>
                  )}
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                    {TYPE_LABEL[lr.type]}
                  </span>{' '}
                  {lr.type === 'LEAVE' && lr.startDate && lr.endDate && (
                    <span className="text-gray-600">
                      {new Date(lr.startDate).toLocaleDateString('vi-VN')} →{' '}
                      {new Date(lr.endDate).toLocaleDateString('vi-VN')}
                    </span>
                  )}
                  {lr.type === 'TASK_RETURN' && lr.task && (
                    <span className="text-gray-600">Task: {lr.task.title}</span>
                  )}
                  {lr.type === 'CUSTOM' && lr.requestType && (
                    <span className="text-gray-600">{lr.requestType.name}</span>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[lr.status]}`}
                >
                  {statusLabel(lr)}
                </span>
              </div>
              <p className="text-gray-700">{lr.reason}</p>
              {lr.type === 'CUSTOM' && lr.requestType && lr.customFieldValues && (
                <dl className="mt-2 space-y-0.5 text-xs text-gray-500">
                  {lr.requestType.fields.map((f) => (
                    <div key={f.key}>
                      <dt className="inline font-medium text-gray-600">{f.label}: </dt>
                      <dd className="inline">{lr.customFieldValues?.[f.key] ?? '—'}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {lr.attachmentUrl && (
                <a
                  href={lr.attachmentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-xs text-indigo-600 hover:underline"
                >
                  Xem file đính kèm
                </a>
              )}
              {lr.status !== 'PENDING' && (
                <p className="mt-1 text-xs text-gray-400">
                  {lr.reviewer && `${lr.reviewer.fullName} đã xử lý`}
                  {lr.reviewComment && ` — "${lr.reviewComment}"`}
                </p>
              )}

              {canResolve && lr.status === 'PENDING' && (
                <ResolveActions leaveRequestId={lr.id} type={lr.type} />
              )}
              {/* Phase 7.5 Đợt 3 — sau khi đã duyệt đơn TASK_RETURN (dù phù hợp hay không), Manager
                  bấm "Reset" để đưa Task về State ban đầu, gỡ assignee, giao lại sau. Chỉ hiện 1
                  lần cho tới khi đã reset (`taskResetAt`). */}
              {canResolve && lr.type === 'TASK_RETURN' && lr.status !== 'PENDING' && !lr.taskResetAt && (
                <ResetTaskAction leaveRequestId={lr.id} />
              )}
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreateLeaveRequestModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}

function ResolveActions({
  leaveRequestId,
  type,
}: {
  leaveRequestId: string
  type: RequestType
}) {
  const resolve = useResolveLeaveRequest()
  const [comment, setComment] = useState('')
  const approveLabel = type === 'TASK_RETURN' ? 'Phù hợp' : 'Duyệt'
  const rejectLabel = type === 'TASK_RETURN' ? 'Không phù hợp' : 'Từ chối'

  return (
    <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
      <Input
        placeholder="Phản hồi (tuỳ chọn)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      {resolve.isError && <ErrorBanner error={resolve.error} />}
      <div className="flex gap-2">
        <Button
          className="px-3 py-1.5 text-xs"
          disabled={resolve.isPending}
          onClick={() =>
            resolve.mutate({ id: leaveRequestId, status: 'APPROVED', comment: comment || undefined })
          }
        >
          {approveLabel}
        </Button>
        <Button
          variant="danger"
          className="px-3 py-1.5 text-xs"
          disabled={resolve.isPending}
          onClick={() =>
            resolve.mutate({ id: leaveRequestId, status: 'REJECTED', comment: comment || undefined })
          }
        >
          {rejectLabel}
        </Button>
      </div>
    </div>
  )
}

function ResetTaskAction({ leaveRequestId }: { leaveRequestId: string }) {
  const resetTask = useResetTask()

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      {resetTask.isError && <ErrorBanner error={resetTask.error} />}
      <Button
        variant="secondary"
        className="px-3 py-1.5 text-xs"
        disabled={resetTask.isPending}
        onClick={() => resetTask.mutate(leaveRequestId)}
      >
        {resetTask.isPending ? 'Đang reset...' : 'Reset Task (đưa về trạng thái ban đầu)'}
      </Button>
    </div>
  )
}

function CreateLeaveRequestModal({ onClose }: { onClose: () => void }) {
  const { data: requestTypes } = useRequestTypes()
  // requestTypeId rỗng = đang gửi đơn "Xin nghỉ phép" (LEAVE), khác rỗng = đang gửi theo 1 loại
  // đơn mẫu (CUSTOM) — dùng chính giá trị này làm value của <Select>, không cần state `type`
  // riêng dễ lệch nhau.
  const [requestTypeId, setRequestTypeId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [file, setFile] = useState<File | undefined>()
  const [customValues, setCustomValues] = useState<Record<string, string>>({})
  const createLeaveRequest = useCreateLeaveRequest()

  const selectedTemplate = requestTypes?.find((t) => t.id === requestTypeId)
  const isCustom = requestTypeId !== ''

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isCustom) {
      createLeaveRequest.mutate(
        { type: 'LEAVE', startDate, endDate, reason, file },
        { onSuccess: onClose },
      )
    } else {
      createLeaveRequest.mutate(
        { type: 'CUSTOM', requestTypeId, reason, customFieldValues: customValues, file },
        { onSuccess: onClose },
      )
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Gửi đơn</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Đóng">
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Loại đơn</label>
            <Select value={requestTypeId} onChange={(e) => setRequestTypeId(e.target.value)}>
              <option value="">Xin nghỉ phép</option>
              {requestTypes?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>

          {!isCustom ? (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Từ ngày</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Đến ngày</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              </div>
            </>
          ) : (
            selectedTemplate?.fields.map((f) => (
              <div key={f.key}>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {f.label}
                  {f.required && <span className="text-red-500"> *</span>}
                </label>
                <Input
                  value={customValues[f.key] ?? ''}
                  onChange={(e) =>
                    setCustomValues((prev) => ({ ...prev, [f.key]: e.target.value }))
                  }
                  required={f.required}
                />
              </div>
            ))
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Lý do</label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              File đính kèm (tuỳ chọn — PDF/DOCX/JPG/PNG, tối đa 5MB)
            </label>
            <input
              type="file"
              accept=".pdf,.docx,.jpg,.jpeg,.png"
              onChange={(e) => setFile(e.target.files?.[0])}
              className="block w-full text-sm text-gray-600"
            />
          </div>

          {createLeaveRequest.isError && <ErrorBanner error={createLeaveRequest.error} />}

          <Button type="submit" className="w-full" disabled={createLeaveRequest.isPending}>
            {createLeaveRequest.isPending ? 'Đang gửi...' : 'Gửi đơn'}
          </Button>
        </form>
      </div>
    </div>
  )
}
