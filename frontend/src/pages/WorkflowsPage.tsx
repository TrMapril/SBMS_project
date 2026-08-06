import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  useCreateWorkflow,
  useImportWorkflowTemplate,
  useWorkflowTemplates,
  useWorkflows,
} from '../features/workflow/useWorkflows'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Modal } from '../components/ui/Modal'
import { ErrorBanner } from '../components/ui/ErrorBanner'
import { Spinner } from '../components/ui/Spinner'

export function WorkflowsPage() {
  const { data, isLoading, error } = useWorkflows()
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

      {error && <ErrorBanner error={error} />}
      {isLoading && <Spinner />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data?.data.map((w) => (
          <Link
            key={w.id}
            to={`/workflows/${w.id}`}
            className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:border-indigo-300"
          >
            <div className="font-medium text-gray-900">{w.name}</div>
            <div className="mt-1 text-xs text-gray-400">
              {w.isActive ? 'Đang hoạt động' : 'Đã tắt'}
            </div>
          </Link>
        ))}
        {data?.data.length === 0 && (
          <p className="text-sm text-gray-400">Chưa có workflow nào.</p>
        )}
      </div>

      {showCreate && <CreateWorkflowModal onClose={() => setShowCreate(false)} />}
      {showImport && <ImportTemplateModal onClose={() => setShowImport(false)} />}
    </div>
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
