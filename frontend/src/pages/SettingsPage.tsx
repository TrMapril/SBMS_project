import { useState, type FormEvent } from 'react'
import {
  useAddBannerImage,
  useRemoveBannerImage,
  useTenantConfig,
  useUpdateTenantConfig,
} from '../features/tenants/useTenantConfig'
import type { AssignmentWeights, TenantConfig } from '../lib/types'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'
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

export function SettingsPage() {
  const { data: config, isLoading, error } = useTenantConfig()

  if (isLoading) return <Spinner />
  if (error) return <ErrorBanner error={error} />
  if (!config) return null

  // `key` buộc React remount lại form mỗi khi load 1 config khác (đăng nhập tenant khác) — nhờ
  // đó state cục bộ có thể khởi tạo trực tiếp từ props lúc mount, không cần effect đồng bộ lại
  // (tránh setState-trong-effect gây cascading render).
  return <SettingsForm key={config.id} config={config} />
}

function SettingsForm({ config }: { config: TenantConfig }) {
  const updateConfig = useUpdateTenantConfig()

  const [systemName, setSystemName] = useState(config.systemName ?? '')
  const [primaryColor, setPrimaryColor] = useState(config.primaryColor ?? '')
  const [logoUrl, setLogoUrl] = useState(config.logoUrl ?? '')
  const [enabledModules, setEnabledModules] = useState<string[]>(config.enabledModules)
  const [weights, setWeights] = useState<AssignmentWeights>(config.assignmentWeights)
  const [introText, setIntroText] = useState(config.introText ?? '')
  const [address, setAddress] = useState(config.address ?? '')
  const [contactPhone, setContactPhone] = useState(config.contactPhone ?? '')
  const [contactEmail, setContactEmail] = useState(config.contactEmail ?? '')
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>(config.socialLinks)

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
      logoUrl: logoUrl || undefined,
      enabledModules,
      assignmentWeights: weights,
      introText: introText || undefined,
      address: address || undefined,
      contactPhone: contactPhone || undefined,
      contactEmail: contactEmail || undefined,
      socialLinks,
    })
  }

  return (
    <div className="max-w-xl">
      <h1 className="mb-1 text-xl font-semibold text-gray-900">Cài đặt</h1>
      <p className="mb-4 text-xs text-gray-400">
        Cấu hình chung của tenant — theme trang giới thiệu doanh nghiệp và các module tính năng.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
        <div>
          <h2 className="mb-2 text-sm font-semibold text-gray-700">Theme</h2>
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
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Logo URL</label>
              <Input
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4">
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
            Mặc định W1=0.30 / W2=0.30 / W3=0.25 / W4=0.15. Không bắt buộc tổng = 1, nhưng nên giữ
            gần 1 để điểm gợi ý dễ so sánh.
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

        <div className="border-t border-gray-100 pt-4">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">
            Trang giới thiệu doanh nghiệp (/t/{'{slug}'})
          </h2>
          <div className="space-y-3">
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
          </div>
        </div>

        {updateConfig.isError && <ErrorBanner error={updateConfig.error} />}
        {updateConfig.isSuccess && (
          <p className="text-sm text-green-700">Đã lưu Settings.</p>
        )}

        <Button type="submit" disabled={updateConfig.isPending}>
          {updateConfig.isPending ? 'Đang lưu...' : 'Lưu Settings'}
        </Button>
      </form>

      <BannerImagesSection bannerImages={config.bannerImages} />
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
