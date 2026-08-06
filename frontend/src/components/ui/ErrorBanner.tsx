import { ApiError } from '../../lib/api-client'

/** Hiển thị lỗi rõ ràng theo mã HTTP (400/403/409/...) — dùng chung toàn app. */
export function ErrorBanner({ error }: { error: unknown }) {
  if (!error) return null

  const message = error instanceof ApiError ? error.message : 'Đã có lỗi xảy ra'
  const status = error instanceof ApiError ? error.status : undefined

  const label =
    status === 403
      ? 'Không đủ quyền'
      : status === 409
        ? 'Xung đột dữ liệu'
        : status === 404
          ? 'Không tìm thấy'
          : status === 401
            ? 'Chưa đăng nhập'
            : 'Lỗi'

  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      <span className="font-medium">
        {label}
        {status ? ` (${status})` : ''}:
      </span>{' '}
      {message}
    </div>
  )
}
