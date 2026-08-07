import { useMemo, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { useProject } from '../features/projects/useProjects'
import { useWorkflow } from '../features/workflow/useWorkflows'
import { useCreateTask, useTasks, useTransitionTask } from '../features/tasks/useTasks'
import { useMyRoles } from '../features/roles/useRoles'
import { useUsers } from '../features/users/useUsers'
import { useCustomFields } from '../features/custom-fields/useCustomFields'
import { useAssignmentSuggestions } from '../features/algorithms/useAlgorithms'
import { useAuthStore } from '../store/auth.store'
import { ApiError } from '../lib/api-client'
import type { Task, TaskPriority, WorkflowState, WorkflowTransition } from '../lib/types'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Modal } from '../components/ui/Modal'
import { ErrorBanner } from '../components/ui/ErrorBanner'
import { Spinner } from '../components/ui/Spinner'

const CUSTOM_FIELD_ERROR_PREFIX = 'Thiếu Custom Field bắt buộc: '
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi

/** BE trả lỗi 400 kèm `customFieldId` (UUID) thô — dịch sang tên field cho dễ đọc trên UI, đúng
 * quyết định Giai đoạn 4 (đã mở GET /api/custom-fields cho Employee chỉ để phục vụ việc này). */
function translateCustomFieldError(error: unknown, namesById: Map<string, string>): unknown {
  if (!(error instanceof ApiError) || !error.message.startsWith(CUSTOM_FIELD_ERROR_PREFIX)) {
    return error
  }
  const translated = error.message.replace(UUID_RE, (id) => namesById.get(id) ?? id)
  return new ApiError(error.status, translated, error.details)
}

const PRIORITY_BADGE: Record<TaskPriority, string> = {
  LOW: 'bg-gray-100 text-gray-600',
  MEDIUM: 'bg-blue-100 text-blue-700',
  HIGH: 'bg-orange-100 text-orange-700',
  URGENT: 'bg-red-100 text-red-700',
}

export function TaskBoardPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const { data: project, isLoading: loadingProject, error: projectError } = useProject(projectId)
  const { data: workflow, isLoading: loadingWorkflow, error: workflowError } = useWorkflow(
    project?.workflowId,
  )
  const { data: tasksPage, isLoading: loadingTasks, error: tasksError } = useTasks(projectId)
  const { data: myRoles } = useMyRoles()
  const { data: users } = useUsers()
  const { data: customFields } = useCustomFields()
  const isManager = useAuthStore((s) => s.user?.systemRole === 'MANAGER')
  const [showCreate, setShowCreate] = useState(false)
  const [actionError, setActionError] = useState<unknown>(null)

  const myRoleIds = useMemo(() => new Set((myRoles ?? []).map((r) => r.id)), [myRoles])
  const usersById = useMemo(
    () => new Map((users?.data ?? []).map((u) => [u.id, u])),
    [users],
  )
  const customFieldNamesById = useMemo(
    () => new Map((customFields?.data ?? []).map((f) => [f.id, f.name])),
    [customFields],
  )

  if (loadingProject || loadingWorkflow || loadingTasks) return <Spinner />
  if (projectError) return <ErrorBanner error={projectError} />
  if (workflowError) return <ErrorBanner error={workflowError} />
  if (tasksError) return <ErrorBanner error={tasksError} />
  if (!project || !workflow) return null

  const states = [...workflow.states]
    .filter((s) => s.isActive)
    .sort((a, b) => a.orderIndex - b.orderIndex)
  const tasks = tasksPage?.data ?? []

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{project.name}</h1>
          <p className="text-xs text-gray-400">Workflow: {workflow.name}</p>
        </div>
        {isManager && <Button onClick={() => setShowCreate(true)}>+ Task</Button>}
      </div>

      {actionError != null && <ErrorBanner error={actionError} />}

      <div className="flex gap-4 overflow-x-auto pb-4">
        {states.map((state) => (
          <KanbanColumn
            key={state.id}
            projectId={project.id}
            state={state}
            tasks={tasks.filter((t) => t.currentStateId === state.id)}
            transitions={workflow.transitions}
            myRoleIds={myRoleIds}
            assigneeName={(id) => usersById.get(id ?? '')?.fullName}
            onError={(error) => setActionError(translateCustomFieldError(error, customFieldNamesById))}
          />
        ))}
      </div>

      {showCreate && project && (
        <CreateTaskModal projectId={project.id} onClose={() => setShowCreate(false)} />
      )}
    </div>
  )
}

function KanbanColumn({
  projectId,
  state,
  tasks,
  transitions,
  myRoleIds,
  assigneeName,
  onError,
}: {
  projectId: string
  state: WorkflowState
  tasks: Task[]
  transitions: WorkflowTransition[]
  myRoleIds: Set<string>
  assigneeName: (id: string | null) => string | undefined
  onError: (error: unknown) => void
}) {
  const outgoing = transitions.filter((t) => t.fromStateId === state.id && t.isActive)

  return (
    <div className="w-72 shrink-0 rounded-lg bg-gray-100 p-3">
      <h2 className="mb-3 text-sm font-semibold text-gray-700">
        {state.name} <span className="text-gray-400">({tasks.length})</span>
      </h2>
      <div className="space-y-2">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            projectId={projectId}
            task={task}
            transitions={outgoing}
            myRoleIds={myRoleIds}
            assigneeName={assigneeName(task.assigneeId)}
            onError={onError}
          />
        ))}
      </div>
    </div>
  )
}

function TaskCard({
  projectId,
  task,
  transitions,
  myRoleIds,
  assigneeName,
  onError,
}: {
  projectId: string
  task: Task
  transitions: WorkflowTransition[]
  myRoleIds: Set<string>
  assigneeName?: string
  onError: (error: unknown) => void
}) {
  const transitionTask = useTransitionTask(projectId)

  function canUse(transition: WorkflowTransition) {
    return (
      transition.allowRoles.length === 0 ||
      transition.allowRoles.some((r) => myRoleIds.has(r))
    )
  }

  function handleTransition(transitionId: string) {
    onError(null)
    transitionTask.mutate(
      { taskId: task.id, transitionId, version: task.version },
      { onError: (error) => onError(error) },
    )
  }

  return (
    <div className="rounded-md border border-gray-200 bg-white p-3 shadow-sm">
      <div className="mb-1 flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-gray-900">{task.title}</span>
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${PRIORITY_BADGE[task.priority]}`}
        >
          {task.priority}
        </span>
      </div>
      <p className="text-xs text-gray-400">
        {assigneeName ? `Giao cho: ${assigneeName}` : 'Chưa có assignee'}
      </p>
      {task.deadline && (
        <p className="text-xs text-gray-400">
          Hạn: {new Date(task.deadline).toLocaleDateString('vi-VN')}
        </p>
      )}
      {task.riskScore != null && (
        <span
          className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${
            task.riskScore > 70
              ? 'bg-red-100 text-red-700'
              : task.riskScore > 40
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-green-100 text-green-700'
          }`}
          title="Thuật toán 2 — % nguy cơ trễ deadline, cập nhật mỗi giờ"
        >
          Rủi ro trễ: {task.riskScore.toFixed(0)}%
        </span>
      )}

      {transitions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {transitions.map((t) => {
            const allowed = canUse(t)
            return (
              <button
                key={t.id}
                disabled={!allowed || transitionTask.isPending}
                title={allowed ? undefined : 'Custom Role của bạn không có quyền transition này'}
                onClick={() => handleTransition(t.id)}
                className={`rounded px-2 py-1 text-xs font-medium ${
                  allowed
                    ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                    : 'cursor-not-allowed bg-gray-100 text-gray-300'
                }`}
              >
                {t.name}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function CreateTaskModal({
  projectId,
  onClose,
}: {
  projectId: string
  onClose: () => void
}) {
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM')
  const [assigneeId, setAssigneeId] = useState('')
  const [deadline, setDeadline] = useState('')
  const { data: users } = useUsers()
  const { data: customFields } = useCustomFields()
  const [customValues, setCustomValues] = useState<Record<string, string>>({})
  const createTask = useCreateTask(projectId)
  const {
    data: suggestions,
    isLoading: loadingSuggestions,
    error: suggestionsError,
  } = useAssignmentSuggestions(projectId)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const filledValues = Object.fromEntries(
      Object.entries(customValues).filter(([, v]) => v !== ''),
    )
    createTask.mutate(
      {
        projectId,
        title,
        priority,
        assigneeId: assigneeId || undefined,
        deadline: deadline || undefined,
        customFieldValues: Object.keys(filledValues).length ? filledValues : undefined,
      },
      { onSuccess: onClose },
    )
  }

  return (
    <Modal title="Tạo Task" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Tiêu đề</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Độ ưu tiên</label>
          <Select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
            <option value="URGENT">URGENT</option>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Hạn hoàn thành (tuỳ chọn)
          </label>
          <Input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Assignee</label>
          <Select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
            <option value="">-- Không giao --</option>
            {users?.data.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Gợi ý phân công (Thuật toán 1)
          </label>
          {loadingSuggestions && <p className="text-xs text-gray-400">Đang tính điểm...</p>}
          {suggestionsError && <ErrorBanner error={suggestionsError} />}
          {suggestions && suggestions.length === 0 && (
            <p className="text-xs text-gray-400">
              Project chưa có Employee nào là thành viên để gợi ý.
            </p>
          )}
          {suggestions && suggestions.length > 0 && (
            <ul className="space-y-1 rounded-md border border-gray-100">
              {suggestions.map((s, index) => (
                <li key={s.userId}>
                  <button
                    type="button"
                    onClick={() => setAssigneeId(s.userId)}
                    title={`Tải công việc: ${(s.breakdown.workload * 100).toFixed(0)} · Đúng hạn: ${(s.breakdown.onTimeRate * 100).toFixed(0)} · Tốc độ: ${(s.breakdown.stepSpeed * 100).toFixed(0)} · Ít trả về: ${(s.breakdown.returnRate * 100).toFixed(0)}`}
                    className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-gray-50 ${
                      assigneeId === s.userId ? 'bg-indigo-50' : ''
                    }`}
                  >
                    <span className="text-gray-800">
                      {index === 0 && '🏆 '}
                      {s.fullName}
                    </span>
                    <span className="text-xs font-medium text-indigo-600">
                      {(s.score * 100).toFixed(0)} điểm
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {customFields && customFields.data.length > 0 && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Custom Fields
            </label>
            <div className="space-y-2">
              {customFields.data.map((f) => (
                <div key={f.id}>
                  <label className="mb-0.5 block text-xs text-gray-500">
                    {f.name} {f.isRequired && <span className="text-red-500">*</span>}
                  </label>
                  <Input
                    value={customValues[f.id] ?? ''}
                    onChange={(e) =>
                      setCustomValues((prev) => ({ ...prev, [f.id]: e.target.value }))
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {createTask.isError && <ErrorBanner error={createTask.error} />}

        <Button type="submit" className="w-full" disabled={createTask.isPending}>
          {createTask.isPending ? 'Đang tạo...' : 'Tạo Task'}
        </Button>
      </form>
    </Modal>
  )
}
