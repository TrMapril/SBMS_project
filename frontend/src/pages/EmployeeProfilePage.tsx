import { useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import {
  useEmployeeProfile,
  useUpdateMyEmployeeProfile,
} from '../features/employee-profiles/useEmployeeProfiles'
import { useAuthStore } from '../store/auth.store'
import type { Certification } from '../lib/types'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'
import { ErrorBanner } from '../components/ui/ErrorBanner'
import { Spinner } from '../components/ui/Spinner'

/** 1 component dùng chung cho cả xem hồ sơ công khai của người khác VÀ xem+sửa hồ sơ của chính
 * mình (`/my-profile` chỉ redirect vào đây) — form sửa chỉ hiện khi `userId` khớp user hiện tại. */
export function EmployeeProfilePage() {
  const { userId } = useParams<{ userId: string }>()
  const myUserId = useAuthStore((s) => s.user?.id)
  const isOwn = userId === myUserId
  const { data: profile, isLoading, error } = useEmployeeProfile(userId)
  const [editing, setEditing] = useState(false)

  if (isLoading) return <Spinner />
  if (error) return <ErrorBanner error={error} />
  if (!profile) return null

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{profile.fullName}</h1>
          <p className="text-sm text-gray-500">
            {profile.email} · {profile.systemRole}
          </p>
        </div>
        {isOwn && !editing && <Button onClick={() => setEditing(true)}>Sửa hồ sơ</Button>}
      </div>

      <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
        <p className="text-sm text-gray-500">Task đã hoàn thành</p>
        <p className="text-2xl font-semibold text-gray-800">{profile.completedTaskCount}</p>
      </div>

      {editing && isOwn ? (
        <EditProfileForm
          myUserId={myUserId}
          initial={profile}
          onDone={() => setEditing(false)}
        />
      ) : (
        <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 text-sm">
          <Field label="Điện thoại" value={profile.phone} />
          <Field label="Địa chỉ" value={profile.address} />
          <Field label="Giới thiệu" value={profile.bio} />
          <div>
            <p className="mb-1 text-xs font-medium text-gray-500">Bằng cấp / Chứng chỉ</p>
            {profile.certifications.length === 0 ? (
              <p className="text-gray-400">Chưa cập nhật</p>
            ) : (
              <ul className="space-y-1">
                {profile.certifications.map((c, i) => (
                  <li key={i} className="text-gray-700">
                    {c.name}
                    {c.issuer && ` — ${c.issuer}`}
                    {c.year && ` (${c.year})`}
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

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="text-gray-700">{value || <span className="text-gray-400">Chưa cập nhật</span>}</p>
    </div>
  )
}

function EditProfileForm({
  myUserId,
  initial,
  onDone,
}: {
  myUserId: string | undefined
  initial: { phone: string | null; address: string | null; bio: string | null; certifications: Certification[] }
  onDone: () => void
}) {
  const [phone, setPhone] = useState(initial.phone ?? '')
  const [address, setAddress] = useState(initial.address ?? '')
  const [bio, setBio] = useState(initial.bio ?? '')
  const [certifications, setCertifications] = useState<Certification[]>(initial.certifications)
  const updateProfile = useUpdateMyEmployeeProfile(myUserId)

  function updateCert(index: number, patch: Partial<Certification>) {
    setCertifications((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)))
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    updateProfile.mutate(
      {
        phone: phone || undefined,
        address: address || undefined,
        bio: bio || undefined,
        certifications: certifications.filter((c) => c.name.trim() !== ''),
      },
      { onSuccess: onDone },
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Điện thoại</label>
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Địa chỉ</label>
        <Input value={address} onChange={(e) => setAddress(e.target.value)} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Giới thiệu</label>
        <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">Bằng cấp / Chứng chỉ</label>
          <button
            type="button"
            onClick={() => setCertifications((prev) => [...prev, { name: '' }])}
            className="text-xs text-indigo-600 hover:underline"
          >
            + Thêm
          </button>
        </div>
        <div className="space-y-2">
          {certifications.map((c, i) => (
            <div key={i} className="flex gap-2">
              <Input
                placeholder="Tên bằng cấp"
                value={c.name}
                onChange={(e) => updateCert(i, { name: e.target.value })}
                className="min-w-0 flex-1"
              />
              {/* Input tự có sẵn w-full trong style gốc — set width cố định thẳng vào Input sẽ bị
                  w-full thắng (Tailwind cascade theo thứ tự sinh CSS, không theo thứ tự class
                  trong markup), nên bọc trong <div> kích thước cố định thay vì set trực tiếp. */}
              <div className="w-32 shrink-0">
                <Input
                  placeholder="Nơi cấp"
                  value={c.issuer ?? ''}
                  onChange={(e) => updateCert(i, { issuer: e.target.value })}
                />
              </div>
              <div className="w-20 shrink-0">
                <Input
                  placeholder="Năm"
                  type="number"
                  value={c.year ?? ''}
                  onChange={(e) =>
                    updateCert(i, { year: e.target.value ? Number(e.target.value) : undefined })
                  }
                />
              </div>
              <button
                type="button"
                onClick={() => setCertifications((prev) => prev.filter((_, idx) => idx !== i))}
                className="text-gray-400 hover:text-red-600"
                aria-label="Xoá"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      {updateProfile.isError && <ErrorBanner error={updateProfile.error} />}

      <div className="flex gap-2">
        <Button type="submit" disabled={updateProfile.isPending}>
          {updateProfile.isPending ? 'Đang lưu...' : 'Lưu'}
        </Button>
        <Button type="button" variant="secondary" onClick={onDone}>
          Huỷ
        </Button>
      </div>
    </form>
  )
}
