import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useUsers } from '../features/users/useUsers'
import {
  useCompetencyProfile,
  useCreateCompetencyProfileEntry,
} from '../features/personnel/useCompetencyProfiles'
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

/** Nội bộ (chỉ Manager/Admin — @Roles ở ProtectedRoute cha), 2 module độc lập gộp 1 trang dạng
 * tab đúng cách plan.md gộp chung 1 bullet "Phạm vi": Hồ sơ năng lực (đánh giá định kỳ) và Đề
 * xuất nhân sự (propose → resolve). */
export function PersonnelPage() {
  const [tab, setTab] = useState<'competency' | 'proposals'>('competency')

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-gray-900">Nhân sự</h1>
      <div className="mb-4 flex gap-1 border-b border-gray-200">
        <TabButton active={tab === 'competency'} onClick={() => setTab('competency')}>
          Hồ sơ năng lực
        </TabButton>
        <TabButton active={tab === 'proposals'} onClick={() => setTab('proposals')}>
          Đề xuất nhân sự
        </TabButton>
      </div>
      {tab === 'competency' ? <CompetencyTab /> : <ProposalsTab />}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`border-b-2 px-4 py-2 text-sm font-medium ${
        active
          ? 'border-indigo-600 text-indigo-700'
          : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {children}
    </button>
  )
}

function CompetencyTab() {
  const { data: users } = useUsers()
  const employees = (users?.data ?? []).filter((u) => u.systemRole === 'EMPLOYEE')
  const [selectedUserId, setSelectedUserId] = useState('')
  const { data: profile, isLoading, error } = useCompetencyProfile(selectedUserId || undefined)
  const createEntry = useCreateCompetencyProfileEntry()
  const [periodLabel, setPeriodLabel] = useState('')
  const [overallRating, setOverallRating] = useState(3)
  const [managerNotes, setManagerNotes] = useState('')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!selectedUserId) return
    createEntry.mutate(
      { userId: selectedUserId, periodLabel, overallRating, managerNotes: managerNotes || undefined },
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
        <label className="mb-1 block text-sm font-medium text-gray-700">Chọn nhân viên</label>
        <Select
          value={selectedUserId}
          onChange={(e) => setSelectedUserId(e.target.value)}
          className="max-w-xs"
        >
          <option value="">-- Chọn --</option>
          {employees.map((u) => (
            <option key={u.id} value={u.id}>
              {u.fullName}
            </option>
          ))}
        </Select>
      </div>

      {selectedUserId && (
        <>
          {isLoading && <Spinner />}
          {error && <ErrorBanner error={error} />}
          {profile && (
            <>
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700">Chỉ số tự động</h3>
                  <Link
                    to={`/employees/${selectedUserId}`}
                    className="text-xs text-indigo-600 hover:underline"
                  >
                    Xem hồ sơ công khai
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
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
                      required
                    />
                    <Select
                      value={overallRating}
                      onChange={(e) => setOverallRating(Number(e.target.value))}
                      className="w-24"
                    >
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>
                          {n} sao
                        </option>
                      ))}
                    </Select>
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

const PROPOSAL_TYPES: PersonnelProposalType[] = ['PROMOTION', 'RAISE', 'WARNING', 'AWARD']

function ProposalsTab() {
  const isAdmin = useAuthStore((s) => s.user?.systemRole === 'ADMIN')
  const [statusFilter, setStatusFilter] = useState<PersonnelProposalStatus | ''>('')
  const { data, isLoading, error } = usePersonnelProposals(statusFilter || undefined)
  const [showCreate, setShowCreate] = useState(false)

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as PersonnelProposalStatus | '')}
          className="w-40"
        >
          <option value="">Tất cả</option>
          <option value="PENDING">PENDING</option>
          <option value="APPROVED">APPROVED</option>
          <option value="REJECTED">REJECTED</option>
        </Select>
        <Button onClick={() => setShowCreate(true)}>+ Đề xuất</Button>
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
