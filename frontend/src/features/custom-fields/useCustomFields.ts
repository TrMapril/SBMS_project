import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../lib/api-client'
import type { CustomField, CustomFieldType, PaginatedResponse } from '../../lib/types'

export interface CreateCustomFieldInput {
  name: string
  fieldType: CustomFieldType
  isRequired?: boolean
  defaultValue?: string
}

export function useCustomFields() {
  return useQuery({
    queryKey: ['custom-fields'],
    queryFn: () =>
      apiClient.get<PaginatedResponse<CustomField>>('/custom-fields?limit=100'),
  })
}

export function useCreateCustomField() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateCustomFieldInput) =>
      apiClient.post<CustomField>('/custom-fields', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['custom-fields'] })
    },
  })
}

export function useUpdateCustomField() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Partial<CreateCustomFieldInput>) =>
      apiClient.patch<CustomField>(`/custom-fields/${id}`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['custom-fields'] })
    },
  })
}

export function useDeleteCustomField() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/custom-fields/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['custom-fields'] })
    },
  })
}
