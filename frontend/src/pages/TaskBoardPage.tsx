import { useMemo, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { useProject, useProjectMembers } from '../features/projects/useProjects'
import { useWorkflow } from '../features/workflow/useWorkflows'
import {
  useAssignTaskCustomFields,
  useCancelTask,
  useConfirmDone,
  useCreateTask,
  useRejectDone,
  useReportDone,
  useTasks,
  useTransitionTask,
  useUpdateTaskAssignee,
} from '../features/tasks/useTasks'
import { useCreateLeaveRequest, useLeaveRequests } from '../features/leave-requests/useLeaveRequests'
import { useMyRoles } from '../features/roles/useRoles'
import { useCustomFields } from '../features/custom-fields/useCustomFields'
import { useAssignmentSuggestions } from '../features/algorithms/useAlgorithms'
import { useAuthStore } from '../store/auth.store'
import { ApiError } from '../lib/api-client'
import type {
  CustomField,
  ProjectMember,
  Task,
  TaskPriority,
  WorkflowState,
  WorkflowTransition,
} from '../lib/types'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Modal } from '../components/ui/Modal'
import { Textarea } from '../components/ui/Textarea'
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
  // Phase 7.5 Đợt 3 (fix bug sau test tay) — assignee CHỈ được là project_members của đúng
  // project này, không phải toàn bộ user trong tenant như trước.
  const { data: members } = useProjectMembers(projectId)
  const { data: customFields } = useCustomFields()
  // Phase 7.5 Đợt 3 (fix UX sau test tay) — biết Task nào đang có đơn TASK_RETURN ở trạng thái
  // PENDING để disable đúng nút "Trả task", tránh Employee bấm gửi trùng (đã bị chặn ở BE nhưng
  // UI cũ không phản ánh, gây hiểu lầm là chưa gửi được). Employee gọi endpoint này chỉ thấy ĐÚNG
  // đơn của chính mình (BE tự lọc), Manager/Admin thấy toàn bộ — cả 2 trường hợp đều đủ để tra
  // đúng theo `taskId` vì mỗi Task chỉ có tối đa 1 đơn TASK_RETURN đang PENDING tại 1 thời điểm
  // (BE đã chặn tạo trùng).
  const { data: pendingReturns } = useLeaveRequests('PENDING', 'TASK_RETURN')
  const isManager = useAuthStore((s) => s.user?.systemRole === 'MANAGER')
  const isAdmin = useAuthStore((s) => s.user?.systemRole === 'ADMIN')
  const currentUserId = useAuthStore((s) => s.user?.id)
  const [showCreate, setShowCreate] = useState(false)
  const [actionError, setActionError] = useState<unknown>(null)

  const myRoleIds = useMemo(() => new Set((myRoles ?? []).map((r) => r.id)), [myRoles])
  const usersById = useMemo(
    () => new Map((members ?? []).flatMap((m) => (m.user ? [[m.user.id, m.user] as const] : []))),
    [members],
  )
  const pendingReturnTaskIds = useMemo(
    () =>
      new Set(
        (pendingReturns?.data ?? []).flatMap((r) => (r.taskId ? [r.taskId] : [])),
      ),
    [pendingReturns],
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
            currentUserId={currentUserId}
            isManager={!!isManager}
            canManageAssignee={!!isManager || !!isAdmin}
            members={members ?? []}
            pendingReturnTaskIds={pendingReturnTaskIds}
            customFields={customFields?.data ?? []}
            assigneeName={(id) => usersById.get(id ?? '')?.fullName}
            onError={(error) => setActionError(translateCustomFieldError(error, customFieldNamesById))}
          />
        ))}
      </div>

      {showCreate && project && (
        <CreateTaskModal projectId={project.id} members={members ?? []} onClose={() => setShowCreate(false)} />
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
  currentUserId,
  isManager,
  canManageAssignee,
  members,
  pendingReturnTaskIds,
  customFields,
  assigneeName,
  onError,
}: {
  projectId: string
  state: WorkflowState
  tasks: Task[]
  transitions: WorkflowTransition[]
  myRoleIds: Set<string>
  currentUserId: string | undefined
  isManager: boolean
  canManageAssignee: boolean
  members: ProjectMember[]
  pendingReturnTaskIds: Set<string>
  customFields: CustomField[]
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
            isEndState={state.isEnd}
            currentUserId={currentUserId}
            isManager={isManager}
            canManageAssignee={canManageAssignee}
            members={members}
            hasPendingReturn={pendingReturnTaskIds.has(task.id)}
            customFields={customFields}
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
  isEndState,
  currentUserId,
  isManager,
  canManageAssignee,
  members,
  hasPendingReturn,
  customFields,
  assigneeName,
  onError,
}: {
  projectId: string
  task: Task
  transitions: WorkflowTransition[]
  myRoleIds: Set<string>
  isEndState: boolean
  currentUserId: string | undefined
  isManager: boolean
  canManageAssignee: boolean
  members: ProjectMember[]
  hasPendingReturn: boolean
  customFields: CustomField[]
  assigneeName?: string
  onError: (error: unknown) => void
}) {
  const transitionTask = useTransitionTask(projectId)
  const reportDone = useReportDone(projectId)
  const confirmDone = useConfirmDone(projectId)
  const rejectDone = useRejectDone(projectId)
  const cancelTask = useCancelTask(projectId)
  const [showReturnModal, setShowReturnModal] = useState(false)
  const [showReassignModal, setShowReassignModal] = useState(false)
  const [showCustomFieldsModal, setShowCustomFieldsModal] = useState(false)
  const [pendingTransition, setPendingTransition] = useState<WorkflowTransition | null>(null)
  const isAssignee = !!currentUserId && task.assigneeId === currentUserId
  // Bổ sung sau test tay — quyền sửa Custom Field: assignee, hoặc Manager/Admin (đã encode sẵn
  // trong `canManageAssignee`, tái dùng thay vì tính lại), nhất quán ràng buộc đã có ở backend.
  const canEditCustomFields = (canManageAssignee || isAssignee) && !task.completedAt && !task.cancelledAt

  function canUse(transition: WorkflowTransition) {
    return (
      transition.allowRoles.length === 0 ||
      transition.allowRoles.some((r) => myRoleIds.has(r))
    )
  }

  /** Bổ sung sau test tay — kiểm tra TRƯỚC khi gọi API, thay vì đợi lỗi 400 "Thiếu Custom Field
   * bắt buộc" mới báo. Field coi là "đã điền" khi có `CustomFieldValue` khác rỗng — khớp đúng
   * cách BE kiểm tra (`WorkflowEngineService.assertCondition`, lọc `NOT: {value: ''}`). */
  function missingRequiredFieldNames(transition: WorkflowTransition): string[] {
    const requiredIds = transition.condition?.requireCustomFields ?? []
    if (requiredIds.length === 0) return []
    const filledIds = new Set(
      (task.customFieldValues ?? [])
        .filter((v) => v.value.trim() !== '')
        .map((v) => v.customFieldId),
    )
    return requiredIds
      .filter((id) => !filledIds.has(id))
      .map((id) => customFields.find((f) => f.id === id)?.name ?? id)
  }

  function fireTransition(transition: WorkflowTransition) {
    onError(null)
    transitionTask.mutate(
      { taskId: task.id, transitionId: transition.id, version: task.version },
      { onError },
    )
  }

  function handleTransition(transition: WorkflowTransition) {
    if (missingRequiredFieldNames(transition).length > 0) {
      setPendingTransition(transition)
      setShowCustomFieldsModal(true)
      return
    }
    fireTransition(transition)
  }

  /** Custom Field vừa lưu xong (đủ điều kiện) — tiếp tục luôn transition đang chờ, không bắt bấm
   * lại lần 2 (`task.version` không đổi vì sửa Custom Field không đụng optimistic locking). */
  function handleCustomFieldsSaved() {
    setShowCustomFieldsModal(false)
    if (pendingTransition) {
      const transition = pendingTransition
      setPendingTransition(null)
      fireTransition(transition)
    }
  }

  function handleCloseCustomFieldsModal() {
    setShowCustomFieldsModal(false)
    setPendingTransition(null)
  }

  function handleReportDone() {
    onError(null)
    reportDone.mutate(task.id, { onError })
  }

  function handleConfirmDone() {
    onError(null)
    confirmDone.mutate(task.id, { onError })
  }

  function handleRejectDone() {
    onError(null)
    rejectDone.mutate(task.id, { onError })
  }

  function handleCancelTask() {
    if (!window.confirm(`Huỷ Task "${task.title}"? Không thể hoàn tác.`)) return
    onError(null)
    cancelTask.mutate(task.id, { onError })
  }

  return (
    <div className="rounded-md border border-gray-200 bg-white p-3 shadow-sm">
      <div className="mb-1 flex items-start justify-between gap-2">
        <button
          onClick={() => setShowCustomFieldsModal(true)}
          className="text-left text-sm font-medium text-gray-900 hover:text-indigo-700 hover:underline"
          title="Xem chi tiết Custom Field"
        >
          {task.title}
        </button>
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${PRIORITY_BADGE[task.priority]}`}
        >
          {task.priority}
        </span>
      </div>
      <p className="text-xs text-gray-400">
        {assigneeName ? `Giao cho: ${assigneeName}` : 'Chưa có assignee'}
        {/* Phase 7.5 Đợt 3 (fix UX sau test tay) — chỉ hiện link đổi nhỏ khi ĐÃ có assignee; khi
            chưa có (vd sau khi Reset Task) thì hiện hẳn 1 nút rõ ràng ở khu vực action bên dưới
            (xem `!assigneeName` block) thay vì chỉ 1 link nhỏ dễ bị bỏ sót. */}
        {assigneeName && canManageAssignee && !task.completedAt && !task.cancelledAt && (
          <button
            onClick={() => setShowReassignModal(true)}
            className="ml-1 text-indigo-500 hover:underline"
          >
            (Đổi)
          </button>
        )}
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

      {task.completedAt ? (
        <p className="mt-2 rounded bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-500">
          🔒 Đã hoàn thành, khoá vĩnh viễn
        </p>
      ) : task.cancelledAt ? (
        <p className="mt-2 rounded bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-500">
          ❌ Đã huỷ, khoá vĩnh viễn
        </p>
      ) : (
        <>
          {transitions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {transitions.map((t) => {
                const allowed = canUse(t)
                const missing = allowed ? missingRequiredFieldNames(t) : []
                return (
                  <button
                    key={t.id}
                    disabled={!allowed || transitionTask.isPending}
                    title={
                      !allowed
                        ? 'Custom Role của bạn không có quyền transition này'
                        : missing.length > 0
                          ? `Cần điền Custom Field: ${missing.join(', ')}`
                          : undefined
                    }
                    onClick={() => handleTransition(t)}
                    className={`rounded px-2 py-1 text-xs font-medium ${
                      allowed
                        ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                        : 'cursor-not-allowed bg-gray-100 text-gray-300'
                    }`}
                  >
                    {t.name}
                    {missing.length > 0 && <span className="ml-0.5 text-orange-500">●</span>}
                  </button>
                )
              })}
            </div>
          )}

          {/* Phase 7.5 Đợt 1 mục B — Report Done (assignee, chỉ khi State hiện tại is_end) /
              Xác nhận Done (Manager). Đợt 1 mục D — Trả task (assignee). Đợt 3 (bổ sung sau test
              tay) — "Trả lại" (Manager thấy chưa đạt, hoàn về đúng State trước đó). */}
          <div className="mt-2 flex flex-wrap gap-1 border-t border-gray-100 pt-2">
            {task.pendingDoneConfirmation ? (
              isManager ? (
                <>
                  <button
                    disabled={confirmDone.isPending}
                    onClick={handleConfirmDone}
                    className="rounded bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100"
                  >
                    Xác nhận Done
                  </button>
                  <button
                    disabled={rejectDone.isPending}
                    onClick={handleRejectDone}
                    className="rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                  >
                    Trả lại
                  </button>
                </>
              ) : (
                <span className="text-[11px] text-gray-400">Đang chờ Manager xác nhận Done</span>
              )
            ) : (
              isAssignee &&
              isEndState && (
                <button
                  disabled={reportDone.isPending}
                  onClick={handleReportDone}
                  className="rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                >
                  Report Done
                </button>
              )
            )}
            {isAssignee && !task.pendingDoneConfirmation && (
              // Phase 7.5 Đợt 3 (fix UX sau test tay) — trước đây nút này KHÔNG đổi trạng thái
              // sau khi đã gửi, Employee bấm lại được (bị chặn ở BE nhưng trải nghiệm gây hiểu
              // lầm là chưa gửi thành công). Giờ đổi hẳn label + disable khi đã có 1 đơn
              // TASK_RETURN đang PENDING cho đúng Task này (rõ ràng hơn tooltip-only).
              hasPendingReturn ? (
                <button
                  disabled
                  title="Yêu cầu trả task đang chờ Manager duyệt"
                  className="cursor-not-allowed rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-400"
                >
                  Đang chờ duyệt trả task
                </button>
              ) : (
                <button
                  onClick={() => setShowReturnModal(true)}
                  className="rounded bg-orange-50 px-2 py-1 text-xs font-medium text-orange-700 hover:bg-orange-100"
                >
                  Trả task
                </button>
              )
            )}
            {/* Phase 7.5 Đợt 3 (bổ sung sau test tay) — Manager huỷ Task, loại khỏi mẫu số %
                hoàn thành Project. */}
            {isManager && !task.pendingDoneConfirmation && (
              <button
                disabled={cancelTask.isPending}
                onClick={handleCancelTask}
                className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-200"
              >
                Huỷ Task
              </button>
            )}
            {/* Phase 7.5 Đợt 3 (fix UX sau test tay) — Task chưa/không còn assignee (vd sau khi
                Manager Reset 1 đơn trả task) phải LUÔN có cách gán người mới ngay trên Task Board,
                không để Task "mồ côi" không ai thao tác tiếp được. Nút chính, rõ ràng hơn hẳn link
                "(Đổi)" nhỏ ở dòng tên assignee (chỉ dùng khi ĐÃ có assignee). */}
            {canManageAssignee && !task.assigneeId && !task.pendingDoneConfirmation && (
              <button
                onClick={() => setShowReassignModal(true)}
                className="rounded bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
              >
                + Chọn assignee
              </button>
            )}
          </div>
        </>
      )}

      {showReturnModal && (
        <TaskReturnModal
          taskId={task.id}
          taskTitle={task.title}
          onClose={() => setShowReturnModal(false)}
        />
      )}
      {showReassignModal && (
        <ReassignModal
          projectId={projectId}
          taskId={task.id}
          taskTitle={task.title}
          currentAssigneeId={task.assigneeId}
          members={members}
          onClose={() => setShowReassignModal(false)}
        />
      )}
      {showCustomFieldsModal && (
        <CustomFieldsModal
          projectId={projectId}
          task={task}
          customFields={customFields}
          canEdit={canEditCustomFields}
          pendingTransitionName={pendingTransition?.name}
          onClose={handleCloseCustomFieldsModal}
          onSaved={handleCustomFieldsSaved}
        />
      )}
    </div>
  )
}

/** Bổ sung sau test tay — trước đây Custom Field chỉ điền được lúc Manager tạo Task (Giai đoạn
 * 3), Employee (assignee) không có UI nào để tự điền/sửa trong lúc làm việc dù
 * `PATCH /tasks/:id/custom-fields` đã có sẵn. Dùng lại ĐÚNG modal này cho cả 2 luồng: (1) bấm
 * tiêu đề Task để xem/sửa chủ động, (2) tự mở khi 1 transition bị thiếu field bắt buộc
 * (`pendingTransitionName` khác undefined) — điền xong, `onSaved` tự tiếp tục transition đang chờ. */
function CustomFieldsModal({
  projectId,
  task,
  customFields,
  canEdit,
  pendingTransitionName,
  onClose,
  onSaved,
}: {
  projectId: string
  task: Task
  customFields: CustomField[]
  canEdit: boolean
  pendingTransitionName?: string
  onClose: () => void
  onSaved: () => void
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const f of customFields) {
      const existing = task.customFieldValues?.find((v) => v.customFieldId === f.id)
      initial[f.id] = existing?.value ?? f.defaultValue ?? ''
    }
    return initial
  })
  const assignValues = useAssignTaskCustomFields(projectId)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    assignValues.mutate({ taskId: task.id, values }, { onSuccess: onSaved })
  }

  return (
    <Modal title={`Custom Field — ${task.title}`} onClose={onClose}>
      {pendingTransitionName && (
        <div className="mb-3 rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-800">
          Cần điền đủ trường bắt buộc bên dưới trước khi chuyển sang "{pendingTransitionName}".
        </div>
      )}
      {customFields.length === 0 ? (
        <p className="text-sm text-gray-400">Tenant chưa có Custom Field nào.</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          {customFields.map((f) => (
            <div key={f.id}>
              <label className="mb-0.5 block text-xs text-gray-500">
                {f.name} {f.isRequired && <span className="text-red-500">*</span>}
              </label>
              <Input
                value={values[f.id] ?? ''}
                onChange={(e) => setValues((prev) => ({ ...prev, [f.id]: e.target.value }))}
                disabled={!canEdit}
              />
            </div>
          ))}
          {!canEdit && (
            <p className="text-xs text-gray-400">
              Chỉ assignee của Task hoặc Manager/Admin mới sửa được Custom Field.
            </p>
          )}
          {assignValues.isError && <ErrorBanner error={assignValues.error} />}
          {canEdit && (
            <Button type="submit" className="w-full" disabled={assignValues.isPending}>
              {assignValues.isPending ? 'Đang lưu...' : 'Lưu'}
            </Button>
          )}
        </form>
      )}
    </Modal>
  )
}

/** Phase 7.5 Đợt 1 mục D — Employee (assignee) "trả task" đang giao cho mình kèm lý do, tạo đơn
 * `type=TASK_RETURN`. Manager xem + phê duyệt phù hợp/không phù hợp ở trang Đơn từ. */
function TaskReturnModal({
  taskId,
  taskTitle,
  onClose,
}: {
  taskId: string
  taskTitle: string
  onClose: () => void
}) {
  const [reason, setReason] = useState('')
  const createLeaveRequest = useCreateLeaveRequest()

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    createLeaveRequest.mutate(
      { type: 'TASK_RETURN', taskId, reason },
      { onSuccess: onClose },
    )
  }

  return (
    <Modal title={`Trả task — ${taskTitle}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Lý do trả task</label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} required />
        </div>
        <p className="text-xs text-gray-400">
          Manager sẽ xem lý do và đánh giá phù hợp/không phù hợp. Nếu "không phù hợp", việc này sẽ
          được tính vào hồ sơ năng lực của bạn.
        </p>
        {createLeaveRequest.isError && <ErrorBanner error={createLeaveRequest.error} />}
        <Button type="submit" className="w-full" disabled={createLeaveRequest.isPending}>
          {createLeaveRequest.isPending ? 'Đang gửi...' : 'Gửi yêu cầu trả task'}
        </Button>
      </form>
    </Modal>
  )
}

/** Phase 7.5 Đợt 3 (bổ sung sau test tay) — Manager/Admin đổi assignee của Task đang active, chỉ
 * chọn được trong số `project_members` của đúng project đó (đúng bug đã sửa ở dropdown tạo Task). */
function ReassignModal({
  projectId,
  taskId,
  taskTitle,
  currentAssigneeId,
  members,
  onClose,
}: {
  projectId: string
  taskId: string
  taskTitle: string
  currentAssigneeId: string | null
  members: ProjectMember[]
  onClose: () => void
}) {
  const [assigneeId, setAssigneeId] = useState(currentAssigneeId ?? '')
  const updateAssignee = useUpdateTaskAssignee(projectId)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!assigneeId) return
    updateAssignee.mutate({ taskId, assigneeId }, { onSuccess: onClose })
  }

  return (
    <Modal title={`Đổi assignee — ${taskTitle}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Assignee mới</label>
          <Select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} required>
            <option value="">-- Chọn thành viên --</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.user?.fullName ?? m.userId}
              </option>
            ))}
          </Select>
        </div>
        {updateAssignee.isError && <ErrorBanner error={updateAssignee.error} />}
        <Button type="submit" className="w-full" disabled={updateAssignee.isPending || !assigneeId}>
          {updateAssignee.isPending ? 'Đang lưu...' : 'Đổi assignee'}
        </Button>
      </form>
    </Modal>
  )
}

function CreateTaskModal({
  projectId,
  members,
  onClose,
}: {
  projectId: string
  members: ProjectMember[]
  onClose: () => void
}) {
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM')
  const [assigneeId, setAssigneeId] = useState('')
  const [deadline, setDeadline] = useState('')
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
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.user?.fullName ?? m.userId}
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
