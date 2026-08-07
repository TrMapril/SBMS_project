import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
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
import { useWorkflow, useWorkflowMutations } from '../features/workflow/useWorkflows'
import { StateNode, type StateNodeData } from '../features/workflow/StateNode'
import { StatePanel } from '../features/workflow/StatePanel'
import { TransitionPanel } from '../features/workflow/TransitionPanel'
import { computeInitialLayout, positionsFromStates } from '../features/workflow/layout'
import { Spinner } from '../components/ui/Spinner'
import { ErrorBanner } from '../components/ui/ErrorBanner'
import type { WorkflowState, WorkflowTransition } from '../lib/types'

const nodeTypes = { stateNode: StateNode }

type Selection =
  | { type: 'state'; state: WorkflowState }
  | { type: 'transition'; transition: WorkflowTransition }
  | { type: 'new-transition'; fromStateId: string; toStateId: string }
  | null

export function WorkflowBuilderPage() {
  const { id } = useParams<{ id: string }>()
  const { data: workflow, isLoading, error } = useWorkflow(id)

  if (isLoading) return <Spinner />
  if (error) return <ErrorBanner error={error} />
  if (!workflow) return null

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-gray-900">{workflow.name}</h1>
      <ReactFlowProvider>
        <BuilderCanvas workflowId={workflow.id} states={workflow.states} transitions={workflow.transitions} />
      </ReactFlowProvider>
    </div>
  )
}

function BuilderCanvas({
  workflowId,
  states,
  transitions,
}: {
  workflowId: string
  states: WorkflowState[]
  transitions: WorkflowTransition[]
}) {
  // Toạ độ "chốt" tính thuần từ props states — ưu tiên toạ độ đã lưu DB (position_x/position_y),
  // State chưa từng có toạ độ (dữ liệu cũ trước khi thêm cột này) dùng tạm auto-layout. Tính lại
  // mỗi khi `states` đổi (useMemo, không phải effect) để tránh cascading render.
  const knownPositions = useMemo(() => {
    const known = positionsFromStates(states)
    const missing = states.filter((s) => !known[s.id])
    return { ...known, ...computeInitialLayout(missing) }
  }, [states])

  // Toạ độ đang kéo dở (chưa kịp lưu DB) — CHỈ được set trực tiếp từ tương tác người dùng
  // (onNodesChange/handleDrop), không bao giờ set từ effect, để tránh setState-trong-effect gây
  // cascading render. `positions` hiển thị = knownPositions đè bởi dragOverrides nếu có.
  const [dragOverrides, setDragOverrides] = useState<Record<string, { x: number; y: number }>>({})
  const positions = useMemo(
    () => ({ ...knownPositions, ...dragOverrides }),
    [knownPositions, dragOverrides],
  )

  const [selection, setSelection] = useState<Selection>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition } = useReactFlow()
  const { createState, updateState } = useWorkflowMutations(workflowId)

  // Đồng bộ MỘT LẦN các State chưa có toạ độ trong DB (position_x/position_y null) lên backend
  // bằng vị trí auto-layout vừa tính ở trên — nếu không làm bước này, các State cũ (tạo trước khi
  // có cột position) sẽ bị xếp lại ngẫu nhiên mỗi lần tải trang vì computeInitialLayout luôn chạy
  // lại. `syncedIds` chặn gửi lặp lại cho cùng 1 State trong phiên làm việc hiện tại. Effect này
  // chỉ gọi mutate (side effect ra hệ thống ngoài), KHÔNG gọi setState cục bộ nào.
  const syncedIds = useRef<Set<string>>(new Set())
  useEffect(() => {
    states
      .filter(
        (s) => (s.positionX == null || s.positionY == null) && !syncedIds.current.has(s.id),
      )
      .forEach((s) => {
        syncedIds.current.add(s.id)
        const pos = knownPositions[s.id]
        if (!pos) return
        updateState.mutate({ stateId: s.id, positionX: pos.x, positionY: pos.y })
      })
  }, [states, knownPositions, updateState])

  const nodes: Node[] = states.map((state) => ({
    id: state.id,
    type: 'stateNode',
    position: positions[state.id] ?? { x: 0, y: 0 },
    data: { state } satisfies StateNodeData,
    selected: selection?.type === 'state' && selection.state.id === state.id,
  }))

  const edges: Edge[] = transitions.map((t) => ({
    id: t.id,
    source: t.fromStateId,
    target: t.toStateId,
    label: t.name,
    animated: false,
    style: t.isActive ? undefined : { opacity: 0.4, strokeDasharray: '4 4' },
    selected: selection?.type === 'transition' && selection.transition.id === t.id,
  }))

  // Chỉ xử lý change có type 'position' (kéo node) — ReactFlow còn tự phát nhiều change khác
  // (đo dimensions, select...) sau MỖI lần render; nếu cứ tạo object positions mới cho mọi
  // change (kể cả không đổi giá trị gì), sẽ set state liên tục → render lại → ReactFlow đo lại
  // → phát change tiếp → lặp vô hạn. Chỉ setPositions khi thực sự có toạ độ mới.
  // Chỉ gọi API lưu toạ độ khi `dragging === false` (kéo xong, thả chuột) — tránh gửi request
  // dồn dập cho từng pixel di chuyển trong lúc đang kéo.
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const positionChanges = changes.filter(
        (c): c is Extract<NodeChange, { type: 'position' }> =>
          c.type === 'position' && !!c.position,
      )
      if (positionChanges.length === 0) return
      setDragOverrides((prev) => {
        const next = { ...prev }
        positionChanges.forEach((c) => {
          next[c.id] = c.position!
        })
        return next
      })
      positionChanges
        .filter((c) => c.dragging === false)
        .forEach((c) => {
          syncedIds.current.add(c.id)
          updateState.mutate({
            stateId: c.id,
            positionX: c.position!.x,
            positionY: c.position!.y,
          })
        })
    },
    [updateState],
  )

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return
    setSelection({
      type: 'new-transition',
      fromStateId: connection.source,
      toStateId: connection.target,
    })
  }, [])

  const onNodeClick: NodeMouseHandler = useCallback((_, node) => {
    const state = states.find((s) => s.id === node.id)
    if (state) setSelection({ type: 'state', state })
     
  }, [states])

  const onEdgeClick: EdgeMouseHandler = useCallback((_, edge) => {
    const transition = transitions.find((t) => t.id === edge.id)
    if (transition) setSelection({ type: 'transition', transition })
     
  }, [transitions])

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    if (e.dataTransfer.getData('application/sbms-state') !== 'state') return
    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    createState.mutate(
      { name: 'State mới', positionX: position.x, positionY: position.y },
      {
        onSuccess: (newState) => {
          syncedIds.current.add(newState.id)
          setSelection({ type: 'state', state: newState })
        },
      },
    )
  }

  function stateName(id: string) {
    return states.find((s) => s.id === id)?.name ?? id
  }

  return (
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
        {selection?.type === 'state' && (
          <StatePanel
            // `key` bắt buộc phải theo đúng id đang chỉnh sửa — không có key, React coi đây vẫn
            // là CÙNG 1 instance khi click thẳng từ State này sang State khác (không qua click ra
            // nền trống), nên các useState nội bộ (name/isStart/isEnd/isActive) không tự re-init
            // theo props mới, giữ nguyên giá trị của State trước đó. `key` ép React unmount +
            // remount hẳn instance mới mỗi khi id đổi, đảm bảo state luôn khởi tạo lại đúng.
            key={selection.state.id}
            workflowId={workflowId}
            state={selection.state}
            onClose={() => setSelection(null)}
          />
        )}
        {selection?.type === 'transition' && (
          <TransitionPanel
            // Cùng lý do với StatePanel ở trên — bug thật đã xảy ra: click thẳng Transition A
            // sang B không qua nền trống, panel giữ nguyên allow_roles/condition/is_active của A.
            key={selection.transition.id}
            workflowId={workflowId}
            fromStateId={selection.transition.fromStateId}
            toStateId={selection.transition.toStateId}
            fromStateName={stateName(selection.transition.fromStateId)}
            toStateName={stateName(selection.transition.toStateId)}
            transition={selection.transition}
            onClose={() => setSelection(null)}
          />
        )}
        {selection?.type === 'new-transition' && (
          <TransitionPanel
            // Cùng lý do: kéo nối cặp State A→B rồi kéo nối tiếp cặp khác C→D (không qua nền
            // trống) cũng phải reset form nháp, không giữ lại dữ liệu đang gõ dở của cặp trước.
            key={`new-${selection.fromStateId}-${selection.toStateId}`}
            workflowId={workflowId}
            fromStateId={selection.fromStateId}
            toStateId={selection.toStateId}
            fromStateName={stateName(selection.fromStateId)}
            toStateName={stateName(selection.toStateId)}
            onClose={() => setSelection(null)}
          />
        )}
      </div>
    </div>
  )
}
