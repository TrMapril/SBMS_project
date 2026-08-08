import { useState, type FormEvent } from 'react'
import {
  useAddBannerImage,
  useRemoveBackgroundImage,
  useRemoveBannerImage,
  useRemoveLogo,
  useTenantConfig,
  useUpdateTenantConfig,
  useUploadBackgroundImage,
  useUploadLogo,
} from '../features/tenants/useTenantConfig'
import { useRequestTypeMutations, useRequestTypes } from '../features/request-types/useRequestTypes'
import { useCreatePost, useDeletePost, usePosts, useUpdatePost } from '../features/posts/usePosts'
import type { AssignmentWeights, RequestTypeField, TenantConfig, TenantPost } from '../lib/types'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'
import { Modal } from '../components/ui/Modal'
import { ErrorBanner } from '../components/ui/ErrorBanner'
import { Spinner } from '../components/ui/Spinner'

const SOCIAL_PLATFORMS: { key: string; label: string }[] = [
  { key: 'facebook', label: 'Facebook' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'twitter', label: 'Twitter/X' },
]

const WEIGHT_FIELDS: { key: keyof AssignmentWeights; label: string; hint: string }[] = [
  { key: 'workload', label: 'W1 — Tải công việc hiện tại', hint: 'Ít Task đang chạy hơn → điểm cao hơn' },
  { key: 'onTimeRate', label: 'W2 — Tỷ lệ hoàn thành đúng hạn', hint: 'Dựa trên lịch sử các Task có deadline' },
  { key: 'stepSpeed', label: 'W3 — Tốc độ xử lý bước tương tự', hint: 'So sánh thời gian xử lý cùng 1 State giữa các ứng viên' },
  { key: 'returnRate', label: 'W4 — Tỷ lệ Task bị trả về', hint: 'Ít bị trả về (transition đi ngược) hơn → điểm cao hơn' },
]

/** Danh sách module khả dụng — Giai đoạn 5 (thuật toán) và Giai đoạn 7 (trang giới thiệu doanh
 * nghiệp) sẽ đọc enabledModules này để bật/tắt tính năng tương ứng; Giai đoạn 4 chỉ dựng khung
 * lưu/đọc, chưa có nơi nào đọc lại giá trị này để bật/tắt thật. */
const AVAILABLE_MODULES: { key: string; label: string }[] = [
  { key: 'ALGORITHMS', label: 'Risk Score & Bottleneck Analysis (Giai đoạn 5)' },
  { key: 'NOTIFICATIONS', label: 'Thông báo realtime (Giai đoạn 6)' },
  { key: 'PUBLIC_LANDING_PAGE', label: 'Trang giới thiệu doanh nghiệp /t/:slug (Giai đoạn 7)' },
]

type SettingsTab = 'theme' | 'modules' | 'landing' | 'request-types' | 'posts'

const TABS: { key: SettingsTab; label: string }[] = [
  { key: 'theme', label: 'Theme' },
  { key: 'modules', label: 'Module & Thuật toán' },
  { key: 'landing', label: 'Landing page' },
  { key: 'request-types', label: 'Đơn từ mẫu' },
  { key: 'posts', label: 'Bài viết' },
]

/** Phase 7.5 Đợt 5 mục 3 — bố trí lại thành tab thay vì xếp dọc 1 cột. "Đơn từ mẫu" chuyển hẳn
 * vào đây từ `LeaveRequestsPage.tsx` (nơi tự nhiên hơn cho 1 hành động cấu hình của Admin, tách
 * biệt khỏi trang xem/gửi đơn hàng ngày). "Bài viết" là tab mới (mục 4). */
export function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>('theme')

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-center text-xl font-semibold text-gray-900">Cài đặt</h1>
      <p className="mb-4 text-center text-xs text-gray-400">
        Cấu hình chung của tenant — theme trang giới thiệu doanh nghiệp và các module tính năng.
      </p>

      <div className="mb-4 flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm font-medium ${
              tab === t.key
                ? 'border-b-2 border-indigo-600 text-indigo-700'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {(tab === 'theme' || tab === 'modules' || tab === 'landing') && <ConfigTab tab={tab} />}
      {tab === 'request-types' && <RequestTypesTab />}
      {tab === 'posts' && <PostsTab />}
    </div>
  )
}

function ConfigTab({ tab }: { tab: 'theme' | 'modules' | 'landing' }) {
  const { data: config, isLoading, error } = useTenantConfig()

  if (isLoading) return <Spinner />
  if (error) return <ErrorBanner error={error} />
  if (!config) return null

  // `key` buộc React remount lại form mỗi khi load 1 config khác (đăng nhập tenant khác) — nhờ
  // đó state cục bộ có thể khởi tạo trực tiếp từ props lúc mount, không cần effect đồng bộ lại
  // (tránh setState-trong-effect gây cascading render).
  return <SettingsForm key={config.id} config={config} tab={tab} />
}

function SettingsForm({ config, tab }: { config: TenantConfig; tab: 'theme' | 'modules' | 'landing' }) {
  const updateConfig = useUpdateTenantConfig()

  const [systemName, setSystemName] = useState(config.systemName ?? '')
  const [primaryColor, setPrimaryColor] = useState(config.primaryColor ?? '')
  const [enabledModules, setEnabledModules] = useState<string[]>(config.enabledModules)
  const [weights, setWeights] = useState<AssignmentWeights>(config.assignmentWeights)
  const [introText, setIntroText] = useState(config.introText ?? '')
  const [address, setAddress] = useState(config.address ?? '')
  const [contactPhone, setContactPhone] = useState(config.contactPhone ?? '')
  const [contactEmail, setContactEmail] = useState(config.contactEmail ?? '')
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>(config.socialLinks)
  const [backgroundColor, setBackgroundColor] = useState(config.landingBackgroundColor ?? '')

  function toggleModule(key: string) {
    setEnabledModules((prev) =>
      prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key],
    )
  }

  function setWeight(key: keyof AssignmentWeights, value: number) {
    setWeights((prev) => ({ ...prev, [key]: Number.isNaN(value) ? 0 : value }))
  }

  const weightSum = weights.workload + weights.onTimeRate + weights.stepSpeed + weights.returnRate

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    updateConfig.mutate({
      systemName: systemName || undefined,
      primaryColor: primaryColor || undefined,
      enabledModules,
      assignmentWeights: weights,
      introText: introText || undefined,
      address: address || undefined,
      contactPhone: contactPhone || undefined,
      contactEmail: contactEmail || undefined,
      socialLinks,
      landingBackgroundColor: backgroundColor || undefined,
    })
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
        {tab === 'theme' && (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Tên hệ thống hiển thị
              </label>
              <Input
                value={systemName}
                onChange={(e) => setSystemName(e.target.value)}
                placeholder="Demo Company"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Màu chủ đạo (hex)
              </label>
              <div className="flex items-center gap-2">
                <Input
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  placeholder="#4f46e5"
                  className="max-w-[160px]"
                />
                {primaryColor && (
                  <span
                    className="h-8 w-8 shrink-0 rounded border border-gray-200"
                    style={{ backgroundColor: primaryColor }}
                  />
                )}
              </div>
            </div>
            <LogoUploadField logoUrl={config.logoUrl} />
          </div>
        )}

        {tab === 'modules' && (
          <div className="space-y-6">
            <div>
              <h2 className="mb-2 text-sm font-semibold text-gray-700">Module tính năng</h2>
              <div className="space-y-2">
                {AVAILABLE_MODULES.map((m) => (
                  <label key={m.key} className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={enabledModules.includes(m.key)}
                      onChange={() => toggleModule(m.key)}
                    />
                    {m.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <h2 className="mb-2 text-sm font-semibold text-gray-700">
                Trọng số Thuật toán 1 — Gợi ý phân công
              </h2>
              <p className="mb-3 text-xs text-gray-400">
                Mặc định W1=0.30 / W2=0.30 / W3=0.25 / W4=0.15. Không bắt buộc tổng = 1, nhưng nên
                giữ gần 1 để điểm gợi ý dễ so sánh.
              </p>
              <div className="space-y-3">
                {WEIGHT_FIELDS.map((f) => (
                  <div key={f.key}>
                    <label className="mb-1 flex items-center justify-between text-sm font-medium text-gray-700">
                      <span>{f.label}</span>
                      <span className="text-xs font-normal text-gray-400">{f.hint}</span>
                    </label>
                    <Input
                      type="number"
                      min={0}
                      max={1}
                      step={0.05}
                      value={weights[f.key]}
                      onChange={(e) => setWeight(f.key, e.target.valueAsNumber)}
                      className="max-w-[120px]"
                    />
                  </div>
                ))}
                <p
                  className={`text-xs ${Math.abs(weightSum - 1) > 0.01 ? 'text-orange-600' : 'text-gray-400'}`}
                >
                  Tổng hiện tại: {weightSum.toFixed(2)}
                  {Math.abs(weightSum - 1) > 0.01 && ' (khác 1, vẫn lưu được bình thường)'}
                </p>
              </div>
            </div>
          </div>
        )}

        {tab === 'landing' && (
          <div className="space-y-3">
            <p className="text-xs text-gray-400">Nội dung trang giới thiệu doanh nghiệp (/t/{'{slug}'}).</p>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Giới thiệu</label>
              <Textarea
                value={introText}
                onChange={(e) => setIntroText(e.target.value)}
                rows={3}
                placeholder="Vài dòng giới thiệu về doanh nghiệp..."
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Địa chỉ</label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium text-gray-700">Điện thoại</label>
                <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
                <Input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Mạng xã hội</label>
              <div className="space-y-2">
                {SOCIAL_PLATFORMS.map((p) => (
                  <div key={p.key} className="flex items-center gap-2">
                    <span className="w-20 shrink-0 text-xs text-gray-500">{p.label}</span>
                    <Input
                      value={socialLinks[p.key] ?? ''}
                      onChange={(e) =>
                        setSocialLinks((prev) => ({ ...prev, [p.key]: e.target.value }))
                      }
                      placeholder="https://..."
                    />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Background — màu (hex)
              </label>
              <div className="flex items-center gap-2">
                <Input
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  placeholder="#f9fafb"
                  className="max-w-[160px]"
                />
                {backgroundColor && (
                  <span
                    className="h-8 w-8 shrink-0 rounded border border-gray-200"
                    style={{ backgroundColor }}
                  />
                )}
              </div>
              <p className="mt-1 text-xs text-gray-400">
                Chỉ áp dụng khi chưa đặt ảnh background bên dưới (ảnh được ưu tiên hơn).
              </p>
            </div>
            <BackgroundImageUploadField backgroundImageUrl={config.landingBackgroundImageUrl} />
          </div>
        )}

        {updateConfig.isError && <ErrorBanner error={updateConfig.error} />}
        {updateConfig.isSuccess && <p className="text-sm text-green-700">Đã lưu Settings.</p>}

        <Button type="submit" disabled={updateConfig.isPending}>
          {updateConfig.isPending ? 'Đang lưu...' : 'Lưu Settings'}
        </Button>
      </form>

      {tab === 'landing' && <BannerImagesSection bannerImages={config.bannerImages} />}
    </div>
  )
}

/** Phase 7.5 Đợt 5 mục 2 — thay ô nhập URL logo bằng upload ảnh thật (Supabase Storage, cùng cơ
 * chế giới hạn 5MB + magic bytes như bannerImages). Upload/xoá thực thi NGAY (không gộp vào nút
 * "Lưu Settings"), cùng tinh thần `BannerImagesSection` bên dưới. */
function LogoUploadField({ logoUrl }: { logoUrl: string | null }) {
  const uploadLogo = useUploadLogo()
  const removeLogo = useRemoveLogo()

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) uploadLogo.mutate(file)
    e.target.value = ''
  }

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">Logo</label>
      <div className="flex items-center gap-3">
        {logoUrl ? (
          <img src={logoUrl} alt="Logo" className="h-14 w-14 rounded border border-gray-200 object-contain" />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded border border-dashed border-gray-300 text-[10px] text-gray-400">
            Chưa có
          </div>
        )}
        <div>
          <input
            type="file"
            accept="image/jpeg,image/png"
            onChange={handleFileChange}
            disabled={uploadLogo.isPending}
            className="block text-sm text-gray-600"
          />
          {logoUrl && (
            <button
              type="button"
              onClick={() => removeLogo.mutate()}
              disabled={removeLogo.isPending}
              className="mt-1 text-xs text-red-600 hover:underline"
            >
              Xoá logo
            </button>
          )}
        </div>
      </div>
      <p className="mt-1 text-xs text-gray-400">Ảnh JPG/PNG, tối đa 5MB.</p>
      {uploadLogo.isError && <ErrorBanner error={uploadLogo.error} />}
      {removeLogo.isError && <ErrorBanner error={removeLogo.error} />}
    </div>
  )
}

function BackgroundImageUploadField({ backgroundImageUrl }: { backgroundImageUrl: string | null }) {
  const uploadImage = useUploadBackgroundImage()
  const removeImage = useRemoveBackgroundImage()

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) uploadImage.mutate(file)
    e.target.value = ''
  }

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">Background — ảnh</label>
      <div className="flex items-center gap-3">
        {backgroundImageUrl ? (
          <img
            src={backgroundImageUrl}
            alt="Background"
            className="h-14 w-24 rounded border border-gray-200 object-cover"
          />
        ) : (
          <div className="flex h-14 w-24 shrink-0 items-center justify-center rounded border border-dashed border-gray-300 text-[10px] text-gray-400">
            Chưa có
          </div>
        )}
        <div>
          <input
            type="file"
            accept="image/jpeg,image/png"
            onChange={handleFileChange}
            disabled={uploadImage.isPending}
            className="block text-sm text-gray-600"
          />
          {backgroundImageUrl && (
            <button
              type="button"
              onClick={() => removeImage.mutate()}
              disabled={removeImage.isPending}
              className="mt-1 text-xs text-red-600 hover:underline"
            >
              Xoá ảnh nền
            </button>
          )}
        </div>
      </div>
      <p className="mt-1 text-xs text-gray-400">Ảnh JPG/PNG, tối đa 5MB.</p>
      {uploadImage.isError && <ErrorBanner error={uploadImage.error} />}
      {removeImage.isError && <ErrorBanner error={removeImage.error} />}
    </div>
  )
}

/** Tách khỏi <form> chính — mỗi ảnh upload/xoá gọi API riêng ngay lập tức (đếm giới hạn 5 ảnh
 * tại đúng thời điểm upload ở backend), không gộp vào action "Lưu Settings" chung. */
function BannerImagesSection({ bannerImages }: { bannerImages: string[] }) {
  const addImage = useAddBannerImage()
  const removeImage = useRemoveBannerImage()

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) addImage.mutate(file)
    e.target.value = ''
  }

  return (
    <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="mb-1 text-sm font-semibold text-gray-700">
        Ảnh giới thiệu ({bannerImages.length}/5)
      </h2>
      <p className="mb-3 text-xs text-gray-400">Ảnh JPG/PNG, tối đa 5MB mỗi ảnh.</p>

      <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
        {bannerImages.map((url, index) => (
          <div key={url} className="group relative">
            <img src={url} alt="" className="h-20 w-full rounded object-cover" />
            <button
              type="button"
              onClick={() => removeImage.mutate(index)}
              disabled={removeImage.isPending}
              className="absolute right-1 top-1 rounded-full bg-black/60 px-1.5 py-0.5 text-xs text-white opacity-0 group-hover:opacity-100"
              aria-label="Xoá ảnh"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {bannerImages.length < 5 && (
        <input
          type="file"
          accept="image/jpeg,image/png"
          onChange={handleFileChange}
          disabled={addImage.isPending}
          className="block text-sm text-gray-600"
        />
      )}
      {addImage.isError && <ErrorBanner error={addImage.error} />}
      {removeImage.isError && <ErrorBanner error={removeImage.error} />}
    </div>
  )
}

/** Phase 7.5 Đợt 5 mục 3 — "Đơn từ mẫu" chuyển từ `LeaveRequestsPage.tsx` sang đây (tách quản trị
 * khỏi trang xem/gửi đơn hàng ngày). Dùng lại nguyên API/hook đã có từ Đợt 2, chỉ thêm UI liệt kê
 * + xoá (trước đó chỉ có form tạo, chưa có danh sách quản lý). */
function RequestTypesTab() {
  const { data: requestTypes, isLoading, error } = useRequestTypes()
  const { removeRequestType } = useRequestTypeMutations()
  const [showCreate, setShowCreate] = useState(false)

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-gray-400">
          Loại đơn tuỳ biến để Employee/Admin chọn khi gửi đơn (ngoài "Xin nghỉ phép" mặc định).
        </p>
        <Button onClick={() => setShowCreate(true)}>+ Loại đơn mới</Button>
      </div>

      {error && <ErrorBanner error={error} />}
      {isLoading && <Spinner />}
      {removeRequestType.isError && <ErrorBanner error={removeRequestType.error} />}

      {requestTypes && (
        <div className="space-y-2">
          {requestTypes.length === 0 && (
            <p className="text-sm text-gray-400">Chưa có loại đơn mẫu nào.</p>
          )}
          {requestTypes.map((rt) => (
            <div
              key={rt.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3 text-sm"
            >
              <div>
                <p className="font-medium text-gray-900">{rt.name}</p>
                <p className="text-xs text-gray-500">
                  {rt.fields.map((f) => f.label).join(', ') || 'Không có trường nào'}
                </p>
              </div>
              <Button
                variant="danger"
                className="px-2 py-1 text-xs"
                disabled={removeRequestType.isPending}
                onClick={() => removeRequestType.mutate(rt.id)}
              >
                Xoá
              </Button>
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreateRequestTypeModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}

function CreateRequestTypeModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [fields, setFields] = useState<RequestTypeField[]>([
    { key: '', label: '', required: true },
  ])
  const { createRequestType } = useRequestTypeMutations()

  function updateField(index: number, patch: Partial<RequestTypeField>) {
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)))
  }

  function addField() {
    setFields((prev) => [...prev, { key: '', label: '', required: true }])
  }

  function removeField(index: number) {
    setFields((prev) => prev.filter((_, i) => i !== index))
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const cleaned = fields
      .filter((f) => f.label.trim())
      .map((f) => ({
        ...f,
        key: f.key.trim() || f.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_'),
      }))
    createRequestType.mutate({ name, fields: cleaned }, { onSuccess: onClose })
  }

  return (
    <Modal title="Tạo loại đơn mới" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Tên loại đơn</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Các trường cần điền</label>
          <div className="space-y-2">
            {fields.map((f, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  placeholder="Tên trường (vd: Nơi công tác)"
                  value={f.label}
                  onChange={(e) => updateField(index, { label: e.target.value })}
                  className="flex-1"
                />
                <label className="flex items-center gap-1 text-xs text-gray-500">
                  <input
                    type="checkbox"
                    checked={f.required}
                    onChange={(e) => updateField(index, { required: e.target.checked })}
                  />
                  Bắt buộc
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  className="px-2 py-1 text-xs"
                  disabled={fields.length === 1}
                  onClick={() => removeField(index)}
                >
                  Xoá
                </Button>
              </div>
            ))}
          </div>
          <Button type="button" variant="secondary" className="mt-2" onClick={addField}>
            + Thêm trường
          </Button>
        </div>

        {createRequestType.isError && <ErrorBanner error={createRequestType.error} />}

        <Button type="submit" className="w-full" disabled={createRequestType.isPending}>
          {createRequestType.isPending ? 'Đang tạo...' : 'Tạo loại đơn'}
        </Button>
      </form>
    </Modal>
  )
}

/** Phase 7.5 Đợt 5 mục 4 — module "Bài viết" cho landing page (mở rộng có kiểm soát so với Quyết
 * định #9 CLAUDE.md, xem DECISIONS.md). `content` là text thuần, không rich-text/markdown. */
function PostsTab() {
  const { data: posts, isLoading, error } = usePosts()
  const deletePost = useDeletePost()
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<TenantPost | null>(null)

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-gray-400">
          Bài viết hiện trên trang giới thiệu doanh nghiệp (/t/{'{slug}'}/blog/...) — chỉ bài đã
          xuất bản mới hiện công khai.
        </p>
        <Button onClick={() => setShowCreate(true)}>+ Bài viết mới</Button>
      </div>

      {error && <ErrorBanner error={error} />}
      {isLoading && <Spinner />}
      {deletePost.isError && <ErrorBanner error={deletePost.error} />}

      {posts && (
        <div className="space-y-2">
          {posts.length === 0 && <p className="text-sm text-gray-400">Chưa có bài viết nào.</p>}
          {posts.map((post) => (
            <div
              key={post.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3 text-sm"
            >
              <div className="flex items-center gap-3">
                {post.coverImageUrl && (
                  <img src={post.coverImageUrl} alt="" className="h-12 w-16 rounded object-cover" />
                )}
                <div>
                  <p className="font-medium text-gray-900">{post.title}</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      post.publishedAt
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {post.publishedAt ? 'Đã xuất bản' : 'Nháp'}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  variant="secondary"
                  className="px-2 py-1 text-xs"
                  onClick={() => setEditing(post)}
                >
                  Sửa
                </Button>
                <Button
                  variant="danger"
                  className="px-2 py-1 text-xs"
                  disabled={deletePost.isPending}
                  onClick={() => deletePost.mutate(post.id)}
                >
                  Xoá
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && <PostFormModal onClose={() => setShowCreate(false)} />}
      {editing && <PostFormModal post={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function PostFormModal({ post, onClose }: { post?: TenantPost; onClose: () => void }) {
  const [title, setTitle] = useState(post?.title ?? '')
  const [content, setContent] = useState(post?.content ?? '')
  const [published, setPublished] = useState(!!post?.publishedAt)
  const [coverImage, setCoverImage] = useState<File | undefined>()
  const createPost = useCreatePost()
  const updatePost = useUpdatePost()
  const mutation = post ? updatePost : createPost

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const input = { title, content, published, coverImage }
    if (post) {
      updatePost.mutate({ id: post.id, ...input }, { onSuccess: onClose })
    } else {
      createPost.mutate(input, { onSuccess: onClose })
    }
  }

  return (
    <Modal title={post ? 'Sửa bài viết' : 'Bài viết mới'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Tiêu đề</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Nội dung</label>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Ảnh đại diện (tuỳ chọn — JPG/PNG, tối đa 5MB)
          </label>
          {post?.coverImageUrl && !coverImage && (
            <img src={post.coverImageUrl} alt="" className="mb-2 h-20 w-32 rounded object-cover" />
          )}
          <input
            type="file"
            accept="image/jpeg,image/png"
            onChange={(e) => setCoverImage(e.target.files?.[0])}
            className="block w-full text-sm text-gray-600"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
          />
          Xuất bản ngay (bỏ tick = lưu nháp)
        </label>

        {mutation.isError && <ErrorBanner error={mutation.error} />}

        <Button type="submit" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending ? 'Đang lưu...' : 'Lưu bài viết'}
        </Button>
      </form>
    </Modal>
  )
}
