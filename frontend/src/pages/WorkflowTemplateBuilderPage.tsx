import { useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  useReactFlow,
  type Node,
  type Edge,
  type NodeChange,
  type Connection,
  type NodeMouseHandler,
  type EdgeMouseHandler,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  useUpdateWorkflowTemplate,
  useWorkflowTemplate,
} from '../features/workflow/useWorkflows'
import { StateNode, type StateNodeData } from '../features/workflow/StateNode'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { ErrorBanner } from '../components/ui/ErrorBanner'
import { Spinner } from '../components/ui/Spinner'
import type { TransitionCondition, WorkflowState } from '../lib/types'

const nodeTypes = { stateNode: StateNode }

interface LocalState {
  tempId: string
  name: string
  isStart: boolean
  isEnd: boolean
  orderIndex: number
  x: number
  y: number
}

interface LocalTransition {
  localId: string
  name: string
  fromTempId: string
  toTempId: string
  condition?: TransitionCondition
}

type Selection =
  | { type: 'state'; tempId: string }
  | { type: 'transition'; localId: string }
  | { type: 'new-transition'; fromTempId: string; toTempId: string }
  | null

function autoLayoutPosition(index: number): { x: number; y: number } {
  const columns = 4
  const spacingX = 220
  const spacingY = 140
  const col = index % columns
  const row = Math.floor(index / columns)
  return { x: col * spacingX + 40, y: row * spacingY + 40 }
}

function toFakeWorkflowState(s: LocalState): WorkflowState {
  return {
    id: s.tempId,
    workflowId: '',
    name: s.name,
    isStart: s.isStart,
    isEnd: s.isEnd,
    isActive: true,
    orderIndex: s.orderIndex,
    positionX: null,
    positionY: null,
    createdAt: '',
    updatedAt: '',
  }
}

/**
 * Phase 7.5 Đợt 5 mục 6 — canvas kéo-thả để Super Admin xây đồ thị (states/transitions) của 1
 * Workflow Template, tận dụng lại @xyflow/react + `StateNode` đã có từ Giai đoạn 4. Khác hẳn
 * `WorkflowBuilderPage.tsx` (Workflow THẬT của tenant): TOÀN BỘ chỉnh sửa chỉ tồn tại trong state
 * React cục bộ cho tới khi bấm "Lưu" (1 lần PATCH duy nhất ghi đè cả `definition`) — không có
 * optimistic locking/audit trail/vị trí lưu DB vì Template không có Task/Project tham chiếu, và
 * không có khái niệm allow_roles (chỉ gán được sau khi import vào 1 tenant thật).
 */
export function WorkflowTemplateBuilderPage() {
  const { id } = useParams<{ id: string }>()
  const { data: template, isLoading, error } = useWorkflowTemplate(id)

  if (isLoading) return <Spinner />
  if (error) return <ErrorBanner error={error} />
  if (!template) return null

  return (
    <div>
      <ReactFlowProvider>
        {/* `key` remount lại toàn bộ canvas nếu chuyển sang sửa Template khác trong cùng phiên
            (điều hướng list -> builder -> list -> builder khác) — tránh state cũ lẫn vào. */}
        <BuilderCanvas key={template.id} templateId={template.id} name={template.name} description={template.description} definition={template.definition} />
      </ReactFlowProvider>
    </div>
  )
}

function BuilderCanvas({
  templateId,
  name,
  description,
  definition,
}: {
  templateId: string
  name: string
  description: string | null
  definition: { states: { tempId: string; name: string; isStart?: boolean; isEnd?: boolean; orderIndex?: number }[]; transitions: { name: string; fromTempId: string; toTempId: string; condition?: TransitionCondition }[] }
}) {
  const navigate = useNavigate()
  const updateTemplate = useUpdateWorkflowTemplate(templateId)

  const [templateName, setTemplateName] = useState(name)
  const [templateDescription, setTemplateDescription] = useState(description ?? '')

  const [states, setStates] = useState<LocalState[]>(() =>
    [...definition.states]
      .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
      .map((s, index) => ({
        tempId: s.tempId,
        name: s.name,
        isStart: s.isStart ?? false,
        isEnd: s.isEnd ?? false,
        orderIndex: s.orderIndex ?? index,
        ...autoLayoutPosition(index),
      })),
  )
  const [transitions, setTransitions] = useState<LocalTransition[]>(() =>
    definition.transitions.map((t) => ({
      localId: crypto.randomUUID(),
      name: t.name,
      fromTempId: t.fromTempId,
      toTempId: t.toTempId,
      condition: t.condition,
    })),
  )

  const [selection, setSelection] = useState<Selection>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition } = useReactFlow()

  const nodes: Node[] = states.map((s) => ({
    id: s.tempId,
    type: 'stateNode',
    position: { x: s.x, y: s.y },
    data: { state: toFakeWorkflowState(s) } satisfies StateNodeData,
    selected: selection?.type === 'state' && selection.tempId === s.tempId,
  }))

  const edges: Edge[] = transitions.map((t) => ({
    id: t.localId,
    source: t.fromTempId,
    target: t.toTempId,
    label: t.name,
    selected: selection?.type === 'transition' && selection.localId === t.localId,
  }))

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    const positionChanges = changes.filter(
      (c): c is Extract<NodeChange, { type: 'position' }> => c.type === 'position' && !!c.position,
    )
    if (positionChanges.length === 0) return
    setStates((prev) =>
      prev.map((s) => {
        const change = positionChanges.find((c) => c.id === s.tempId)
        return change ? { ...s, x: change.position!.x, y: change.position!.y } : s
      }),
    )
  }, [])

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return
    setSelection({ type: 'new-transition', fromTempId: connection.source, toTempId: connection.target })
  }, [])

  const onNodeClick: NodeMouseHandler = useCallback((_, node) => {
    setSelection({ type: 'state', tempId: node.id })
  }, [])

  const onEdgeClick: EdgeMouseHandler = useCallback((_, edge) => {
    setSelection({ type: 'transition', localId: edge.id })
  }, [])

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    if (e.dataTransfer.getData('application/sbms-state') !== 'state') return
    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    const tempId = crypto.randomUUID()
    setStates((prev) => [
      ...prev,
      { tempId, name: 'State mới', isStart: false, isEnd: false, orderIndex: prev.length, ...position },
    ])
    setSelection({ type: 'state', tempId })
  }

  function stateName(tempId: string) {
    return states.find((s) => s.tempId === tempId)?.name ?? tempId
  }

  function handleSave() {
    updateTemplate.mutate({
      name: templateName,
      description: templateDescription || undefined,
      definition: {
        states: states.map((s) => ({
          tempId: s.tempId,
          name: s.name,
          isStart: s.isStart,
          isEnd: s.isEnd,
          orderIndex: s.orderIndex,
        })),
        transitions: transitions.map((t) => ({
          name: t.name,
          fromTempId: t.fromTempId,
          toTempId: t.toTempId,
          condition: t.condition,
        })),
      },
    })
  }

  const selectedState = selection?.type === 'state' ? states.find((s) => s.tempId === selection.tempId) : undefined
  const selectedTransition =
    selection?.type === 'transition' ? transitions.find((t) => t.localId === selection.localId) : undefined

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <button
          onClick={() => navigate('/workflow-templates')}
          className="text-sm text-gray-500 hover:text-gray-800"
        >
          ← Danh sách Template
        </button>
        <Button onClick={handleSave} disabled={updateTemplate.isPending}>
          {updateTemplate.isPending ? 'Đang lưu...' : 'Lưu Template'}
        </Button>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Tên Template</label>
          <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Mô tả</label>
          <Input value={templateDescription} onChange={(e) => setTemplateDescription(e.target.value)} />
        </div>
      </div>

      {updateTemplate.isError && <ErrorBanner error={updateTemplate.error} />}
      {updateTemplate.isSuccess && <p className="mb-3 text-sm text-green-700">Đã lưu Template.</p>}

      <div className="flex gap-4">
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-3">
            <div
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/sbms-state', 'state')
                e.dataTransfer.effectAllowed = 'move'
              }}
              className="cursor-grab select-none rounded-md border border-dashed border-indigo-400 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700"
            >
              ⠿ Kéo để tạo State
            </div>
            <p className="text-xs text-gray-400">
              Kéo khối này thả vào canvas để tạo State mới. Kéo từ cạnh phải 1 State sang cạnh
              trái State khác để tạo Transition.
            </p>
          </div>

          <div
            ref={wrapperRef}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="h-[560px] rounded-lg border border-gray-200 bg-white"
          >
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              onEdgeClick={onEdgeClick}
              onPaneClick={() => setSelection(null)}
              fitView
            >
              <Background />
              <Controls />
            </ReactFlow>
          </div>
        </div>

        <div className="w-80 shrink-0 rounded-lg border border-gray-200 bg-white p-4">
          {!selection && (
            <p className="text-sm text-gray-400">
              Chọn 1 State hoặc Transition để chỉnh sửa, hoặc kéo-thả để tạo mới.
            </p>
          )}

          {selection?.type === 'state' && selectedState && (
            <StateEditPanel
              state={selectedState}
              onUpdate={(patch) =>
                setStates((prev) => prev.map((s) => (s.tempId === selectedState.tempId ? { ...s, ...patch } : s)))
              }
              onDelete={() => {
                setStates((prev) => prev.filter((s) => s.tempId !== selectedState.tempId))
                setTransitions((prev) =>
                  prev.filter((t) => t.fromTempId !== selectedState.tempId && t.toTempId !== selectedState.tempId),
                )
                setSelection(null)
              }}
              onClose={() => setSelection(null)}
            />
          )}

          {selection?.type === 'transition' && selectedTransition && (
            <TransitionEditPanel
              // `key` bắt buộc — TransitionEditPanel giữ state nội bộ nháp (localName/
              // localRequireAssignee) trước khi bấm "Cập nhật", nên cần remount khi click thẳng
              // từ Transition này sang Transition khác (không qua nền trống), cùng lớp bug đã gặp
              // ở WorkflowBuilderPage.tsx thật — xem DECISIONS.md mục 24.
              key={selectedTransition.localId}
              fromStateName={stateName(selectedTransition.fromTempId)}
              toStateName={stateName(selectedTransition.toTempId)}
              name={selectedTransition.name}
              requireAssignee={selectedTransition.condition?.requireAssignee ?? false}
              onSave={(patch) =>
                setTransitions((prev) =>
                  prev.map((t) =>
                    t.localId === selectedTransition.localId
                      ? { ...t, name: patch.name, condition: patch.requireAssignee ? { requireAssignee: true } : undefined }
                      : t,
                  ),
                )
              }
              onDelete={() => {
                setTransitions((prev) => prev.filter((t) => t.localId !== selectedTransition.localId))
                setSelection(null)
              }}
              onClose={() => setSelection(null)}
            />
          )}

          {selection?.type === 'new-transition' && (
            <TransitionEditPanel
              key={`new-${selection.fromTempId}-${selection.toTempId}`}
              fromStateName={stateName(selection.fromTempId)}
              toStateName={stateName(selection.toTempId)}
              name=""
              requireAssignee={false}
              isNew
              onSave={(patch) => {
                setTransitions((prev) => [
                  ...prev,
                  {
                    localId: crypto.randomUUID(),
                    name: patch.name,
                    fromTempId: selection.fromTempId,
                    toTempId: selection.toTempId,
                    condition: patch.requireAssignee ? { requireAssignee: true } : undefined,
                  },
                ])
                setSelection(null)
              }}
              onDelete={() => setSelection(null)}
              onClose={() => setSelection(null)}
            />
          )}
        </div>
      </div>
    </div>
  )
}

/** Panel hoàn toàn "controlled" — không giữ state nội bộ nào, đọc/ghi trực tiếp vào state của
 * `BuilderCanvas` qua props (mỗi lần gõ áp dụng ngay). Không cần `key` remount vì không có gì để
 * "giữ nguyên" — khác `TransitionEditPanel` bên dưới (giữ nháp nội bộ trước khi bấm "Cập nhật",
 * cần `key` đúng như `WorkflowBuilderPage.tsx` thật — xem DECISIONS.md mục 24). */
function StateEditPanel({
  state,
  onUpdate,
  onDelete,
  onClose,
}: {
  state: LocalState
  onUpdate: (patch: Partial<Pick<LocalState, 'name' | 'isStart' | 'isEnd'>>) => void
  onDelete: () => void
  onClose: () => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Sửa State</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Đóng">
          ✕
        </button>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Tên</label>
        <Input value={state.name} onChange={(e) => onUpdate({ name: e.target.value })} />
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={state.isStart} onChange={(e) => onUpdate({ isStart: e.target.checked })} />
        State bắt đầu (is_start)
      </label>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={state.isEnd} onChange={(e) => onUpdate({ isEnd: e.target.checked })} />
        State kết thúc (is_end)
      </label>
      <Button variant="danger" className="w-full" onClick={onDelete}>
        Xoá State
      </Button>
    </div>
  )
}

function TransitionEditPanel({
  fromStateName,
  toStateName,
  name,
  requireAssignee,
  isNew,
  onSave,
  onDelete,
  onClose,
}: {
  fromStateName: string
  toStateName: string
  name: string
  requireAssignee: boolean
  isNew?: boolean
  onSave: (patch: { name: string; requireAssignee: boolean }) => void
  onDelete: () => void
  onClose: () => void
}) {
  const [localName, setLocalName] = useState(name)
  const [localRequireAssignee, setLocalRequireAssignee] = useState(requireAssignee)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">
          {fromStateName} → {toStateName}
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Đóng">
          ✕
        </button>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Tên Transition</label>
        <Input value={localName} onChange={(e) => setLocalName(e.target.value)} autoFocus />
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={localRequireAssignee}
          onChange={(e) => setLocalRequireAssignee(e.target.checked)}
        />
        Yêu cầu Task đã có assignee (condition.requireAssignee)
      </label>
      <p className="text-xs text-gray-400">
        Template không có khái niệm allow_roles/Custom Field — chỉ gán được sau khi Admin tenant
        import Template này thành Workflow thật.
      </p>
      <Button
        className="w-full"
        disabled={!localName.trim()}
        onClick={() => onSave({ name: localName.trim(), requireAssignee: localRequireAssignee })}
      >
        {isNew ? 'Tạo Transition' : 'Cập nhật'}
      </Button>
      {!isNew && (
        <Button variant="danger" className="w-full" onClick={onDelete}>
          Xoá Transition
        </Button>
      )}
    </div>
  )
}
