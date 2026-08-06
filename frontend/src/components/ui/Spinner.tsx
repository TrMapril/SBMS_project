export function Spinner({ className = '' }: { className?: string }) {
  return (
    <div
      className={`h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600 ${className}`}
      role="status"
      aria-label="Đang tải"
    />
  )
}
