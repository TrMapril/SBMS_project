import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useCreateProject, useProjects } from '../features/projects/useProjects'
import { useWorkflows } from '../features/workflow/useWorkflows'
import { useAuthStore } from '../store/auth.store'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Modal } from '../components/ui/Modal'
import { ErrorBanner } from '../components/ui/ErrorBanner'
import { Spinner } from '../components/ui/Spinner'

export function ProjectsPage() {
  const { data, isLoading, error } = useProjects()
  const isManager = useAuthStore((s) => s.user?.systemRole === 'MANAGER')
  const [showCreate, setShowCreate] = useState(false)

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Dự án</h1>
        {isManager && <Button onClick={() => setShowCreate(true)}>+ Tạo dự án</Button>}
      </div>

      {error && <ErrorBanner error={error} />}
      {isLoading && <Spinner />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data?.data.map((p) => (
          <Link
            key={p.id}
            to={`/projects/${p.id}`}
            className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:border-indigo-300"
          >
            <div className="font-medium text-gray-900">{p.name}</div>
          </Link>
        ))}
        {data?.data.length === 0 && (
          <p className="text-sm text-gray-400">Chưa có dự án nào.</p>
        )}
      </div>

      {showCreate && <CreateProjectModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}

function CreateProjectModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [workflowId, setWorkflowId] = useState('')
  const { data: workflows } = useWorkflows()
  const createProject = useCreateProject()

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    createProject.mutate({ name, workflowId }, { onSuccess: onClose })
  }

  return (
    <Modal title="Tạo dự án" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Tên dự án</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Workflow</label>
          <Select
            value={workflowId}
            onChange={(e) => setWorkflowId(e.target.value)}
            required
          >
            <option value="">-- Chọn workflow --</option>
            {workflows?.data.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
        </div>

        {createProject.isError && <ErrorBanner error={createProject.error} />}

        <Button type="submit" className="w-full" disabled={createProject.isPending}>
          {createProject.isPending ? 'Đang tạo...' : 'Tạo dự án'}
        </Button>
      </form>
    </Modal>
  )
}
