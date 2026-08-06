import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { WorkflowState } from '../../lib/types'

export interface StateNodeData {
  state: WorkflowState
  [key: string]: unknown
}

export function StateNode({ data, selected }: NodeProps) {
  const { state } = data as StateNodeData

  return (
    <div
      className={`min-w-[160px] rounded-lg border-2 bg-white px-3 py-2 shadow-sm ${
        selected ? 'border-indigo-500' : 'border-gray-300'
      } ${!state.isActive ? 'opacity-50' : ''}`}
    >
      <Handle type="target" position={Position.Left} className="!bg-gray-400" />
      <div className="text-sm font-medium text-gray-900">{state.name}</div>
      <div className="mt-1 flex gap-1">
        {state.isStart && (
          <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
            start
          </span>
        )}
        {state.isEnd && (
          <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
            end
          </span>
        )}
        {!state.isActive && (
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
            tắt
          </span>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-gray-400" />
    </div>
  )
}
