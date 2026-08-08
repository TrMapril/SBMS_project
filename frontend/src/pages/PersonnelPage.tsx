import { useState, type FormEvent } from 'react'
import { useUsers } from '../features/users/useUsers'
import {
  useCreatePersonnelProposal,
  usePersonnelProposals,
  useResolvePersonnelProposal,
} from '../features/personnel/usePersonnelProposals'
import { useAuthStore } from '../store/auth.store'
import type { PersonnelProposalStatus, PersonnelProposalType } from '../lib/types'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Textarea } from '../components/ui/Textarea'
import { ErrorBanner } from '../components/ui/ErrorBanner'
import { Spinner } from '../components/ui/Spinner'

const PROPOSAL_STATUS_BADGE: Record<PersonnelProposalStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
}

/** Phase 7.5 Đợt 2 — trước đây trang này gộp 2 tab "Hồ sơ năng lực" + "Đề xuất nhân sự". Đã tách
 * "Hồ sơ năng lực" ra `EmployeeCompetencyPage` (chỉ vào được qua "Xem chi tiết" ở trang User, bỏ
 * khỏi sidebar) — trang này giờ chỉ còn "Đề xuất nhân sự" (Manager tạo, Admin phê duyệt). */
export function PersonnelPage() {
  const isAdmin = useAuthStore((s) => s.user?.systemRole === 'ADMIN')
  const [statusFilter, setStatusFilter] = useState<PersonnelProposalStatus | ''>('')
  const { data, isLoading, error } = usePersonnelProposals(statusFilter || undefined)
  const [showCreate, setShowCreate] = useState(false)

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Đề xuất nhân sự</h1>
        <Button onClick={() => setShowCreate(true)}>+ Đề xuất</Button>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm text-gray-500">Lọc trạng thái:</span>
        <div className="w-40 shrink-0">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as PersonnelProposalStatus | '')}
          >
            <option value="">Tất cả</option>
            <option value="PENDING">PENDING</option>
            <option value="APPROVED">APPROVED</option>
            <option value="REJECTED">REJECTED</option>
          </Select>
        </div>
      </div>

      {error && <ErrorBanner error={error} />}
      {isLoading && <Spinner />}

      {data && (
        <div className="space-y-2">
          {data.data.length === 0 && (
            <p className="text-sm text-gray-400">Chưa có đề xuất nào.</p>
          )}
          {data.data.map((p) => (
            <div key={p.id} className="rounded-lg border border-gray-200 bg-white p-4 text-sm">
              <div className="mb-1 flex items-start justify-between gap-2">
                <div>
                  <span className="font-medium text-gray-900">{p.user?.fullName}</span>{' '}
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                    {p.type}
                  </span>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${PROPOSAL_STATUS_BADGE[p.status]}`}
                >
                  {p.status}
                </span>
              </div>
              <p className="text-gray-700">{p.description}</p>
              <p className="mt-1 text-xs text-gray-400">
                Đề xuất bởi {p.proposedByUser?.fullName} ·{' '}
                {new Date(p.createdAt).toLocaleDateString('vi-VN')}
              </p>
              {p.status !== 'PENDING' && (
                <p className="mt-1 text-xs text-gray-400">
                  {p.reviewer && `${p.reviewer.fullName} đã xử lý`}
                  {p.reviewComment && ` — "${p.reviewComment}"`}
                </p>
              )}
              {isAdmin && p.status === 'PENDING' && <ResolveProposalActions proposalId={p.id} />}
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreateProposalModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}

function ResolveProposalActions({ proposalId }: { proposalId: string }) {
  const resolve = useResolvePersonnelProposal()
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
            resolve.mutate({ id: proposalId, status: 'APPROVED', comment: comment || undefined })
          }
        >
          Duyệt
        </Button>
        <Button
          variant="danger"
          className="px-3 py-1.5 text-xs"
          disabled={resolve.isPending}
          onClick={() =>
            resolve.mutate({ id: proposalId, status: 'REJECTED', comment: comment || undefined })
          }
        >
          Từ chối
        </Button>
      </div>
    </div>
  )
}

function CreateProposalModal({ onClose }: { onClose: () => void }) {
  const { data: users } = useUsers()
  const employees = (users?.data ?? []).filter((u) => u.systemRole === 'EMPLOYEE')
  const [userId, setUserId] = useState('')
  const [type, setType] = useState<PersonnelProposalType>('PROMOTION')
  const [description, setDescription] = useState('')
  const createProposal = useCreatePersonnelProposal()

  const PROPOSAL_TYPES: PersonnelProposalType[] = ['PROMOTION', 'RAISE', 'WARNING', 'AWARD']

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    createProposal.mutate({ userId, type, description }, { onSuccess: onClose })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Tạo đề xuất nhân sự</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Đóng">
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Nhân viên</label>
            <Select value={userId} onChange={(e) => setUserId(e.target.value)} required>
              <option value="">-- Chọn --</option>
              {employees.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Loại đề xuất</label>
            <Select value={type} onChange={(e) => setType(e.target.value as PersonnelProposalType)}>
              {PROPOSAL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Mô tả</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              required
            />
          </div>

          {createProposal.isError && <ErrorBanner error={createProposal.error} />}

          <Button type="submit" className="w-full" disabled={createProposal.isPending}>
            {createProposal.isPending ? 'Đang tạo...' : 'Tạo đề xuất'}
          </Button>
        </form>
      </div>
    </div>
  )
}
