import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../lib/api-client'
import type { CompetencyProfile } from '../../lib/types'

export function useCompetencyProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ['competency-profiles', userId],
    queryFn: () => apiClient.get<CompetencyProfile>(`/competency-profiles/${userId}`),
    enabled: !!userId,
  })
}

export interface CreateCompetencyProfileInput {
  userId: string
  periodLabel: string
  overallRating: number
  managerNotes?: string
}

export function useCreateCompetencyProfileEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateCompetencyProfileInput) =>
      apiClient.post('/competency-profiles', input),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ['competency-profiles', variables.userId],
      })
    },
  })
}
