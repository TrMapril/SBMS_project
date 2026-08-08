import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useCreateWorkflowTemplate,
  useDeleteWorkflowTemplate,
  useWorkflowTemplates,
} from '../features/workflow/useWorkflows'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'
import { Modal } from '../components/ui/Modal'
import { ErrorBanner } from '../components/ui/ErrorBanner'
import { Spinner } from '../components/ui/Spinner'

/** Phase 7.5 Đợt 5 mục 6 — Super Admin quản lý bộ Workflow Template dùng chung cho MỌI tenant
 * (khác `WorkflowsPage.tsx` — Workflow THẬT của riêng 1 tenant). Bảng này có sẵn từ Giai đoạn 2
 * (chỉ tạo qua seed), giờ mới có UI CRUD. */
export function WorkflowTemplatesPage() {
  const { data: templates, isLoading, error } = useWorkflowTemplates()
  const deleteTemplate = useDeleteWorkflowTemplate()
  const [showCreate, setShowCreate] = useState(false)

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Workflow Template</h1>
        <Button onClick={() => setShowCreate(true)}>+ Tạo Template</Button>
      </div>
      <p className="mb-4 text-xs text-gray-400">
        Bộ Template dùng chung cho mọi doanh nghiệp import (Admin tenant import qua "Import từ
        Template" ở trang Workflow) — sửa đổi ở đây KHÔNG ảnh hưởng Workflow đã import trước đó
        (import = clone dữ liệu).
      </p>

      {error && <ErrorBanner error={error} />}
      {isLoading && <Spinner />}
      {deleteTemplate.isError && <ErrorBanner error={deleteTemplate.error} />}

      {templates && (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Tên</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Mô tả</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">Số State</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">Số Transition</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {templates.map((t) => (
                <TemplateRow key={t.id} id={t.id} name={t.name} description={t.description} stateCount={t.definition.states.length} transitionCount={t.definition.transitions.length} onDelete={() => deleteTemplate.mutate(t.id)} deletePending={deleteTemplate.isPending} />
              ))}
              {templates.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-400">
                    Chưa có Workflow Template nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <CreateTemplateModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}

function TemplateRow({
  id,
  name,
  description,
  stateCount,
  transitionCount,
  onDelete,
  deletePending,
}: {
  id: string
  name: string
  description: string | null
  stateCount: number
  transitionCount: number
  onDelete: () => void
  deletePending: boolean
}) {
  const navigate = useNavigate()
  return (
    <tr>
      <td className="px-4 py-2 text-gray-900">
        <button
          onClick={() => navigate(`/workflow-templates/${id}`)}
          className="font-medium text-indigo-600 hover:underline"
        >
          {name}
        </button>
      </td>
      <td className="px-4 py-2 text-gray-600">{description || <span className="text-gray-300">—</span>}</td>
      <td className="px-4 py-2 text-right text-gray-600">{stateCount}</td>
      <td className="px-4 py-2 text-right text-gray-600">{transitionCount}</td>
      <td className="px-4 py-2 text-right">
        <div className="flex justify-end gap-2">
          <Button variant="secondary" className="px-2 py-1 text-xs" onClick={() => navigate(`/workflow-templates/${id}`)}>
            Sửa
          </Button>
          <Button
            variant="danger"
            className="px-2 py-1 text-xs"
            disabled={deletePending}
            onClick={() => {
              if (confirm(`Xoá Template "${name}"? Không ảnh hưởng Workflow đã import trước đó.`)) {
                onDelete()
              }
            }}
          >
            Xoá
          </Button>
        </div>
      </td>
    </tr>
  )
}

function CreateTemplateModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const createTemplate = useCreateWorkflowTemplate()
  const navigate = useNavigate()

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    createTemplate.mutate(
      { name, description: description || undefined },
      { onSuccess: (template) => navigate(`/workflow-templates/${template.id}`) },
    )
  }

  return (
    <Modal title="Tạo Workflow Template mới" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Tên Template</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Mô tả (tuỳ chọn)</label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </div>
        <p className="text-xs text-gray-400">
          Template tạo mới bắt đầu rỗng — xây State/Transition ở bước tiếp theo qua canvas kéo-thả.
        </p>

        {createTemplate.isError && <ErrorBanner error={createTemplate.error} />}

        <Button type="submit" className="w-full" disabled={createTemplate.isPending}>
          {createTemplate.isPending ? 'Đang tạo...' : 'Tạo và mở Builder'}
        </Button>
      </form>
    </Modal>
  )
}
