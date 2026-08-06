import { useState, type FormEvent } from 'react'
import type { WorkflowTransition } from '../../lib/types'
import { useWorkflowMutations } from './useWorkflows'
import { useRoles } from '../roles/useRoles'
import { useCustomFields } from '../custom-fields/useCustomFields'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { ErrorBanner } from '../../components/ui/ErrorBanner'

interface TransitionPanelProps {
  workflowId: string
  fromStateId: string
  toStateId: string
  fromStateName: string
  toStateName: string
  transition?: WorkflowTransition
  onClose: () => void
}

export function TransitionPanel({
  workflowId,
  fromStateId,
  toStateId,
  fromStateName,
  toStateName,
  transition,
  onClose,
}: TransitionPanelProps) {
  const isEdit = !!transition
  const [name, setName] = useState(transition?.name ?? '')
  const [allowRoles, setAllowRoles] = useState<string[]>(transition?.allowRoles ?? [])
  const [requireAssignee, setRequireAssignee] = useState(
    transition?.condition?.requireAssignee ?? false,
  )
  const [requireCustomFields, setRequireCustomFields] = useState<string[]>(
    transition?.condition?.requireCustomFields ?? [],
  )
  const [isActive, setIsActive] = useState(transition?.isActive ?? true)

  const { data: roles } = useRoles()
  const { data: customFields } = useCustomFields()
  const { createTransition, updateTransition, removeTransition } =
    useWorkflowMutations(workflowId)

  function toggle(list: string[], value: string): string[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
  }

  function buildCondition() {
    if (!requireAssignee && requireCustomFields.length === 0) return undefined
    return {
      ...(requireAssignee ? { requireAssignee: true } : {}),
      ...(requireCustomFields.length > 0 ? { requireCustomFields } : {}),
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (isEdit) {
      updateTransition.mutate(
        {
          transitionId: transition.id,
          name,
          allowRoles,
          condition: buildCondition(),
          isActive,
        },
        { onSuccess: onClose },
      )
    } else {
      createTransition.mutate(
        { name, fromStateId, toStateId, allowRoles, condition: buildCondition() },
        { onSuccess: onClose },
      )
    }
  }

  const mutation = isEdit ? updateTransition : createTransition

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">
          {isEdit ? 'Sửa Transition' : 'Tạo Transition'}
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          ✕
        </button>
      </div>
      <p className="text-xs text-gray-500">
        {fromStateName} → {toStateName}
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Tên transition</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            allow_roles (Custom Role được phép)
          </label>
          <div className="max-h-28 space-y-1 overflow-y-auto rounded border border-gray-200 p-2">
            {roles?.data.map((r) => (
              <label key={r.id} className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={allowRoles.includes(r.id)}
                  onChange={() => setAllowRoles(toggle(allowRoles, r.id))}
                />
                {r.name}
              </label>
            ))}
            {roles?.data.length === 0 && (
              <p className="text-xs text-gray-400">Chưa có Custom Role nào.</p>
            )}
          </div>
          <p className="mt-1 text-xs text-gray-400">Để trống = không giới hạn quyền.</p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">condition</label>
          <label className="mb-1 flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={requireAssignee}
              onChange={(e) => setRequireAssignee(e.target.checked)}
            />
            requireAssignee
          </label>
          <div className="max-h-24 space-y-1 overflow-y-auto rounded border border-gray-200 p-2">
            {customFields?.data.map((f) => (
              <label key={f.id} className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={requireCustomFields.includes(f.id)}
                  onChange={() =>
                    setRequireCustomFields(toggle(requireCustomFields, f.id))
                  }
                />
                {f.name}
              </label>
            ))}
            {customFields?.data.length === 0 && (
              <p className="text-xs text-gray-400">Chưa có Custom Field nào.</p>
            )}
          </div>
          <p className="mt-1 text-xs text-gray-400">
            requireCustomFields: các field bắt buộc phải có giá trị trước khi transition.
          </p>
        </div>

        {isEdit && (
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            is_active
          </label>
        )}

        {mutation.isError && <ErrorBanner error={mutation.error} />}

        <Button type="submit" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending ? 'Đang lưu...' : isEdit ? 'Lưu' : 'Tạo Transition'}
        </Button>
      </form>

      {isEdit && (
        <>
          {removeTransition.isError && <ErrorBanner error={removeTransition.error} />}
          <Button
            variant="danger"
            className="w-full"
            disabled={removeTransition.isPending}
            onClick={() => removeTransition.mutate(transition.id, { onSuccess: onClose })}
          >
            Xoá Transition
          </Button>
        </>
      )}
    </div>
  )
}
