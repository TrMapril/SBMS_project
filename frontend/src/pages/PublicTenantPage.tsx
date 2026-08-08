import type { CSSProperties } from 'react'
import { useParams, Link } from 'react-router-dom'
import { usePublicTenant } from '../features/public/usePublicTenant'
import { Spinner } from '../components/ui/Spinner'

const SOCIAL_LABELS: Record<string, string> = {
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  twitter: 'Twitter/X',
  youtube: 'YouTube',
  instagram: 'Instagram',
}

/** Layout tĩnh dùng chung cho MỌI tenant (Mục 4.8 tài liệu phân tích thiết kế) — chỉ nội dung
 * khác nhau theo `tenant_config`, không phải page builder kéo-thả. Route công khai, không cần
 * đăng nhập; nút "Đăng nhập" dẫn thẳng /login, tách biệt hoàn toàn khỏi luồng xác thực. */
export function PublicTenantPage() {
  const { slug } = useParams<{ slug: string }>()
  const { data: tenant, isLoading, error } = usePublicTenant(slug)

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (error || !tenant) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 text-center">
        <p className="text-lg font-medium text-gray-700">Không tìm thấy trang giới thiệu này</p>
        <Link to="/login" className="text-sm text-indigo-600 hover:underline">
          Đến trang đăng nhập
        </Link>
      </div>
    )
  }

  const displayName = tenant.systemName || tenant.name
  const socialEntries = Object.entries(tenant.socialLinks).filter(([, url]) => url)

  // Phase 7.5 Đợt 4 — tuỳ chỉnh background (ảnh ưu tiên hơn màu nếu Admin lỡ đặt cả 2, đúng như
  // đã ghi chú ở SettingsPage.tsx). Không đụng `bg-gray-50` mặc định khi cả 2 đều chưa đặt.
  const backgroundStyle: CSSProperties = tenant.landingBackgroundImageUrl
    ? {
        backgroundImage: `url(${tenant.landingBackgroundImageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }
    : tenant.landingBackgroundColor
      ? { backgroundColor: tenant.landingBackgroundColor }
      : {}

  return (
    <div
      className={`min-h-screen ${tenant.landingBackgroundImageUrl || tenant.landingBackgroundColor ? '' : 'bg-gray-50'}`}
      style={backgroundStyle}
    >
      <header
        className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4"
        style={tenant.primaryColor ? { borderBottomColor: tenant.primaryColor } : undefined}
      >
        <div className="flex items-center gap-3">
          {tenant.logoUrl && (
            <img src={tenant.logoUrl} alt={displayName} className="h-10 w-10 rounded object-contain" />
          )}
          <span className="text-lg font-semibold text-gray-900">{displayName}</span>
        </div>
        <Link
          to="/login"
          className="rounded-md px-4 py-2 text-sm font-medium text-white"
          style={{ backgroundColor: tenant.primaryColor ?? '#4f46e5' }}
        >
          Đăng nhập
        </Link>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        {tenant.introText && (
          <p className="mb-8 whitespace-pre-line text-base leading-relaxed text-gray-700">
            {tenant.introText}
          </p>
        )}

        {tenant.bannerImages.length > 0 && (
          <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {tenant.bannerImages.map((url) => (
              <img
                key={url}
                src={url}
                alt=""
                className="h-40 w-full rounded-lg object-cover shadow-sm"
              />
            ))}
          </div>
        )}

        {(tenant.address || tenant.contactPhone || tenant.contactEmail) && (
          <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600">
            <h2 className="mb-2 text-sm font-semibold text-gray-900">Thông tin liên hệ</h2>
            {tenant.address && <p>Địa chỉ: {tenant.address}</p>}
            {tenant.contactPhone && <p>Điện thoại: {tenant.contactPhone}</p>}
            {tenant.contactEmail && <p>Email: {tenant.contactEmail}</p>}
          </div>
        )}
      </main>

      {socialEntries.length > 0 && (
        <footer className="border-t border-gray-200 bg-white px-6 py-4 text-center text-sm text-gray-500">
          {socialEntries.map(([key, url]) => (
            <a
              key={key}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="mx-2 hover:text-indigo-600 hover:underline"
            >
              {SOCIAL_LABELS[key] ?? key}
            </a>
          ))}
        </footer>
      )}
    </div>
  )
}
