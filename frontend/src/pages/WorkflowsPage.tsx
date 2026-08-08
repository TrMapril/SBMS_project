import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  useCreateWorkflow,
  useDeleteWorkflow,
  useImportWorkflowTemplate,
  useUpdateWorkflow,
  useWorkflowTemplates,
  useWorkflows,
} from '../features/workflow/useWorkflows'
import type { Workflow } from '../lib/types'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Modal } from '../components/ui/Modal'
import { ErrorBanner } from '../components/ui/ErrorBanner'
import { Spinner } from '../components/ui/Spinner'

export function WorkflowsPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'true' | 'false' | ''>('')
  const { data, isLoading, error } = useWorkflows({
    search: search || undefined,
    isActive: statusFilter === '' ? undefined : statusFilter === 'true',
  })
  const [showCreate, setShowCreate] = useState(false)
  const [showImport, setShowImport] = useState(false)

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Workflow</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowImport(true)}>
            Import từ Template
          </Button>
          <Button onClick={() => setShowCreate(true)}>+ Tạo workflow</Button>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo tên workflow..."
          className="max-w-xs"
        />
        <div className="w-44 shrink-0">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'true' | 'false' | '')}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="true">Đang hoạt động</option>
            <option value="false">Đã tắt</option>
          </Select>
        </div>
      </div>

      {error && <ErrorBanner error={error} />}
      {isLoading && <Spinner />}

      {data && (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Tên</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">Số State</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">Số Transition</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">
                  Project đang dùng
                </th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">
                  Tổng Project từng dùng
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Trạng thái</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.data.map((w) => (
                <WorkflowRow key={w.id} workflow={w} />
              ))}
              {data.data.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-sm text-gray-400">
                    Không có workflow nào khớp bộ lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <CreateWorkflowModal onClose={() => setShowCreate(false)} />}
      {showImport && <ImportTemplateModal onClose={() => setShowImport(false)} />}
    </div>
  )
}

function WorkflowRow({ workflow: w }: { workflow: Workflow }) {
  const updateWorkflow = useUpdateWorkflow()
  const deleteWorkflow = useDeleteWorkflow()
  const [error, setError] = useState<unknown>(null)

  // Phase 7.5 Đợt 2 — Xoá chỉ được phép khi CHƯA từng có Project nào dùng workflow này (kể cả đã
  // COMPLETED/CANCELLED); nếu đã từng có, chỉ cho Vô hiệu hoá/Kích hoạt lại.
  const canHardDelete = (w.totalProjectCount ?? 0) === 0

  function handleToggleActive() {
    setError(null)
    updateWorkflow.mutate({ id: w.id, isActive: !w.isActive }, { onError: setError })
  }

  function handleDelete() {
    if (!window.confirm(`Xoá vĩnh viễn workflow "${w.name}"? Không thể hoàn tác.`)) return
    setError(null)
    deleteWorkflow.mutate(w.id, { onError: setError })
  }

  return (
    <tr>
      <td className="px-4 py-2 text-gray-900">
        <Link to={`/workflows/${w.id}`} className="font-medium hover:text-indigo-600 hover:underline">
          {w.name}
        </Link>
        {error != null && (
          <div className="mt-1">
            <ErrorBanner error={error} />
          </div>
        )}
      </td>
      <td className="px-4 py-2 text-right text-gray-600">{w.stateCount}</td>
      <td className="px-4 py-2 text-right text-gray-600">{w.transitionCount}</td>
      <td className="px-4 py-2 text-right text-gray-600">{w.activeProjectCount}</td>
      <td className="px-4 py-2 text-right text-gray-600">{w.totalProjectCount}</td>
      <td className="px-4 py-2">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            w.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}
        >
          {w.isActive ? 'Đang hoạt động' : 'Đã tắt'}
        </span>
      </td>
      <td className="px-4 py-2 text-right">
        <div className="flex justify-end gap-2">
          {canHardDelete ? (
            <Button
              variant="danger"
              className="px-2 py-1 text-xs"
              disabled={deleteWorkflow.isPending}
              onClick={handleDelete}
            >
              Xoá
            </Button>
          ) : (
            <Button
              variant={w.isActive ? 'secondary' : 'primary'}
              className="px-2 py-1 text-xs"
              disabled={updateWorkflow.isPending}
              onClick={handleToggleActive}
            >
              {w.isActive ? 'Vô hiệu hoá' : 'Kích hoạt lại'}
            </Button>
          )}
        </div>
      </td>
    </tr>
  )
}

function ImportTemplateModal({ onClose }: { onClose: () => void }) {
  const { data: templates, isLoading, error } = useWorkflowTemplates()
  const [templateId, setTemplateId] = useState('')
  const [name, setName] = useState('')
  const importTemplate = useImportWorkflowTemplate()
  const navigate = useNavigate()

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!templateId) return
    importTemplate.mutate(
      { templateId, name: name || undefined },
      {
        onSuccess: (workflow) => {
          onClose()
          navigate(`/workflows/${workflow.id}`)
        },
      },
    )
  }

  const selected = templates?.find((t) => t.id === templateId)

  return (
    <Modal title="Import Workflow từ Template" onClose={onClose}>
      {isLoading && <Spinner />}
      {error && <ErrorBanner error={error} />}
      {templates && (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Template</label>
            <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)} required>
              <option value="">-- Chọn template --</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
            {selected?.description && (
              <p className="mt-1 text-xs text-gray-400">{selected.description}</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Tên workflow mới (tuỳ chọn)
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={selected?.name ?? 'Mặc định lấy tên template'}
            />
          </div>

          {importTemplate.isError && <ErrorBanner error={importTemplate.error} />}

          <Button type="submit" className="w-full" disabled={!templateId || importTemplate.isPending}>
            {importTemplate.isPending ? 'Đang import...' : 'Import & mở Builder'}
          </Button>
        </form>
      )}
    </Modal>
  )
}

function CreateWorkflowModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const createWorkflow = useCreateWorkflow()

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    createWorkflow.mutate(name, { onSuccess: onClose })
  }

  return (
    <Modal title="Tạo workflow" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Tên workflow</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </div>

        {createWorkflow.isError && <ErrorBanner error={createWorkflow.error} />}

        <Button type="submit" className="w-full" disabled={createWorkflow.isPending}>
          {createWorkflow.isPending ? 'Đang tạo...' : 'Tạo & mở Builder'}
        </Button>
      </form>
    </Modal>
  )
}
