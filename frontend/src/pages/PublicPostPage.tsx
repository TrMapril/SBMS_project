import { useParams, Link } from 'react-router-dom'
import { usePublicPost } from '../features/public/usePublicPosts'
import { Spinner } from '../components/ui/Spinner'

/** Phase 7.5 Đợt 5 mục 4 — trang chi tiết 1 bài viết công khai, route `/t/:slug/blog/:postSlug`.
 * Layout tối giản, nhất quán với `PublicTenantPage.tsx` (route công khai, không cần đăng nhập). */
export function PublicPostPage() {
  const { slug, postSlug } = useParams<{ slug: string; postSlug: string }>()
  const { data: post, isLoading, error } = usePublicPost(slug, postSlug)

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (error || !post) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 text-center">
        <p className="text-lg font-medium text-gray-700">Không tìm thấy bài viết này</p>
        <Link to={`/t/${slug}`} className="text-sm text-indigo-600 hover:underline">
          Quay lại trang giới thiệu doanh nghiệp
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <Link to={`/t/${slug}`} className="text-sm text-indigo-600 hover:underline">
          ← Quay lại trang giới thiệu doanh nghiệp
        </Link>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-10">
        {post.coverImageUrl && (
          <img
            src={post.coverImageUrl}
            alt=""
            className="mb-6 h-64 w-full rounded-lg object-cover shadow-sm"
          />
        )}
        <h1 className="text-2xl font-semibold text-gray-900">{post.title}</h1>
        <p className="mt-1 text-xs text-gray-400">
          {new Date(post.publishedAt).toLocaleDateString('vi-VN')}
        </p>
        <div className="mt-6 whitespace-pre-line text-base leading-relaxed text-gray-700">
          {post.content}
        </div>
      </main>
    </div>
  )
}
