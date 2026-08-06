import { useState, type FormEvent } from 'react'
import type { WorkflowState } from '../../lib/types'
import { useWorkflowMutations } from './useWorkflows'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { ErrorBanner } from '../../components/ui/ErrorBanner'

export function StatePanel({
  workflowId,
  state,
  onClose,
}: {
  workflowId: string
  state: WorkflowState
  onClose: () => void
}) {
  const [name, setName] = useState(state.name)
  const [isStart, setIsStart] = useState(state.isStart)
  const [isEnd, setIsEnd] = useState(state.isEnd)
  const [isActive, setIsActive] = useState(state.isActive)
  const { updateState, removeState } = useWorkflowMutations(workflowId)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    updateState.mutate({ stateId: state.id, name, isStart, isEnd, isActive })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Sửa State</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          ✕
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Tên</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={isStart}
            onChange={(e) => setIsStart(e.target.checked)}
          />
          is_start (trạng thái bắt đầu)
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={isEnd} onChange={(e) => setIsEnd(e.target.checked)} />
          is_end (trạng thái kết thúc)
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          is_active
        </label>

        {updateState.isError && <ErrorBanner error={updateState.error} />}

        <Button type="submit" className="w-full" disabled={updateState.isPending}>
          {updateState.isPending ? 'Đang lưu...' : 'Lưu'}
        </Button>
      </form>

      {removeState.isError && <ErrorBanner error={removeState.error} />}
      <Button
        variant="danger"
        className="w-full"
        disabled={removeState.isPending}
        onClick={() => removeState.mutate(state.id, { onSuccess: onClose })}
      >
        Xoá State
      </Button>
    </div>
  )
}
