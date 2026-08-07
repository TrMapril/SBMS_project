import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../lib/api-client'
import type { Certification, EmployeeProfile } from '../../lib/types'

export function useEmployeeProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ['employee-profiles', userId],
    queryFn: () => apiClient.get<EmployeeProfile>(`/employee-profiles/${userId}`),
    enabled: !!userId,
  })
}

export interface UpdateEmployeeProfileInput {
  phone?: string
  address?: string
  bio?: string
  certifications?: Certification[]
}

export function useUpdateMyEmployeeProfile(myUserId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateEmployeeProfileInput) =>
      apiClient.patch<EmployeeProfile>('/employee-profiles/me', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['employee-profiles', myUserId] })
    },
  })
}
