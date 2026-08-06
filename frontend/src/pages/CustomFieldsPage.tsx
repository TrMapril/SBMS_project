import { useState, type FormEvent } from 'react'
import {
  useCreateCustomField,
  useCustomFields,
  useDeleteCustomField,
} from '../features/custom-fields/useCustomFields'
import type { CustomFieldType } from '../lib/types'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Modal } from '../components/ui/Modal'
import { ErrorBanner } from '../components/ui/ErrorBanner'
import { Spinner } from '../components/ui/Spinner'

export function CustomFieldsPage() {
  const { data, isLoading, error } = useCustomFields()
  const deleteField = useDeleteCustomField()
  const [showCreate, setShowCreate] = useState(false)

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Custom Fields</h1>
        <Button onClick={() => setShowCreate(true)}>+ Tạo field</Button>
      </div>

      {error && <ErrorBanner error={error} />}
      {deleteField.isError && <ErrorBanner error={deleteField.error} />}
      {isLoading && <Spinner />}

      {data && (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Tên</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Kiểu</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Bắt buộc</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Mặc định</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.data.map((f) => (
                <tr key={f.id}>
                  <td className="px-4 py-2 text-gray-900">{f.name}</td>
                  <td className="px-4 py-2 text-gray-600">{f.fieldType}</td>
                  <td className="px-4 py-2 text-gray-600">{f.isRequired ? 'Có' : 'Không'}</td>
                  <td className="px-4 py-2 text-gray-600">{f.defaultValue ?? '—'}</td>
                  <td className="px-4 py-2 text-right">
                    <Button
                      variant="danger"
                      className="px-2 py-1 text-xs"
                      disabled={deleteField.isPending}
                      onClick={() => deleteField.mutate(f.id)}
                    >
                      Xoá
                    </Button>
                  </td>
                </tr>
              ))}
              {data.data.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                    Chưa có Custom Field nào
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <CreateCustomFieldModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}

function CreateCustomFieldModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [fieldType, setFieldType] = useState<CustomFieldType>('TEXT')
  const [isRequired, setIsRequired] = useState(false)
  const [defaultValue, setDefaultValue] = useState('')
  const createField = useCreateCustomField()

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    createField.mutate(
      { name, fieldType, isRequired, defaultValue: defaultValue || undefined },
      { onSuccess: onClose },
    )
  }

  return (
    <Modal title="Tạo Custom Field" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Tên field</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Kiểu dữ liệu</label>
          <Select
            value={fieldType}
            onChange={(e) => setFieldType(e.target.value as CustomFieldType)}
          >
            <option value="TEXT">TEXT</option>
            <option value="NUMBER">NUMBER</option>
            <option value="DATE">DATE</option>
            <option value="BOOLEAN">BOOLEAN</option>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Giá trị mặc định (tuỳ chọn)
          </label>
          <Input value={defaultValue} onChange={(e) => setDefaultValue(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={isRequired}
            onChange={(e) => setIsRequired(e.target.checked)}
          />
          Bắt buộc
        </label>

        {createField.isError && <ErrorBanner error={createField.error} />}

        <Button type="submit" className="w-full" disabled={createField.isPending}>
          {createField.isPending ? 'Đang tạo...' : 'Tạo field'}
        </Button>
      </form>
    </Modal>
  )
}
