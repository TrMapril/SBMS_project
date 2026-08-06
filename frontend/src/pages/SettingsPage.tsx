import { useState, type FormEvent } from 'react'
import { useTenantConfig, useUpdateTenantConfig } from '../features/tenants/useTenantConfig'
import type { TenantConfig } from '../lib/types'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { ErrorBanner } from '../components/ui/ErrorBanner'
import { Spinner } from '../components/ui/Spinner'

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

  function toggleModule(key: string) {
    setEnabledModules((prev) =>
      prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key],
    )
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    updateConfig.mutate({
      systemName: systemName || undefined,
      primaryColor: primaryColor || undefined,
      logoUrl: logoUrl || undefined,
      enabledModules,
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

        {updateConfig.isError && <ErrorBanner error={updateConfig.error} />}
        {updateConfig.isSuccess && (
          <p className="text-sm text-green-700">Đã lưu Settings.</p>
        )}

        <Button type="submit" disabled={updateConfig.isPending}>
          {updateConfig.isPending ? 'Đang lưu...' : 'Lưu Settings'}
        </Button>
      </form>
    </div>
  )
}
