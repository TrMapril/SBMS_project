import { useState, type FormEvent } from 'react'
import {
  useCreateLeaveRequest,
  useLeaveRequests,
  useResolveLeaveRequest,
} from '../features/leave-requests/useLeaveRequests'
import { useAuthStore } from '../store/auth.store'
import type { LeaveRequestStatus } from '../lib/types'
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

export function LeaveRequestsPage() {
  const user = useAuthStore((s) => s.user)
  const canReview = user?.systemRole === 'MANAGER' || user?.systemRole === 'ADMIN'
  const [statusFilter, setStatusFilter] = useState<LeaveRequestStatus | ''>('')
  const { data, isLoading, error } = useLeaveRequests(statusFilter || undefined)
  const [showCreate, setShowCreate] = useState(false)

  if (!user) return null

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Đơn từ nội bộ</h1>
        <Button onClick={() => setShowCreate(true)}>+ Gửi đơn</Button>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm text-gray-500">Lọc trạng thái:</span>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as LeaveRequestStatus | '')}
          className="w-40"
        >
          <option value="">Tất cả</option>
          <option value="PENDING">PENDING</option>
          <option value="APPROVED">APPROVED</option>
          <option value="REJECTED">REJECTED</option>
        </Select>
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
                  {canReview && lr.user && (
                    <span className="font-medium text-gray-900">{lr.user.fullName} · </span>
                  )}
                  <span className="text-gray-600">
                    {new Date(lr.startDate).toLocaleDateString('vi-VN')} →{' '}
                    {new Date(lr.endDate).toLocaleDateString('vi-VN')}
                  </span>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[lr.status]}`}
                >
                  {lr.status}
                </span>
              </div>
              <p className="text-gray-700">{lr.reason}</p>
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

              {canReview && lr.status === 'PENDING' && (
                <ResolveActions leaveRequestId={lr.id} />
              )}
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreateLeaveRequestModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}

function ResolveActions({ leaveRequestId }: { leaveRequestId: string }) {
  const resolve = useResolveLeaveRequest()
  const [comment, setComment] = useState('')

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
          Duyệt
        </Button>
        <Button
          variant="danger"
          className="px-3 py-1.5 text-xs"
          disabled={resolve.isPending}
          onClick={() =>
            resolve.mutate({ id: leaveRequestId, status: 'REJECTED', comment: comment || undefined })
          }
        >
          Từ chối
        </Button>
      </div>
    </div>
  )
}

function CreateLeaveRequestModal({ onClose }: { onClose: () => void }) {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [file, setFile] = useState<File | undefined>()
  const createLeaveRequest = useCreateLeaveRequest()

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    createLeaveRequest.mutate(
      { startDate, endDate, reason, file },
      { onSuccess: onClose },
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Gửi đơn nghỉ phép</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Đóng">
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
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
