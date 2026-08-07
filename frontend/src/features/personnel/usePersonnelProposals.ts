import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../lib/api-client'
import { toQuery } from '../../lib/query-string'
import type {
  PaginatedResponse,
  PersonnelProposal,
  PersonnelProposalStatus,
  PersonnelProposalType,
} from '../../lib/types'

const QUERY_KEY = ['personnel-proposals'] as const

export function usePersonnelProposals(status?: PersonnelProposalStatus) {
  return useQuery({
    queryKey: [...QUERY_KEY, status],
    queryFn: () =>
      apiClient.get<PaginatedResponse<PersonnelProposal>>(
        `/personnel-proposals?${toQuery({ status, limit: 100 })}`,
      ),
  })
}

export interface CreatePersonnelProposalInput {
  userId: string
  type: PersonnelProposalType
  description: string
}

export function useCreatePersonnelProposal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreatePersonnelProposalInput) =>
      apiClient.post('/personnel-proposals', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
}

export function useResolvePersonnelProposal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      status,
      comment,
    }: {
      id: string
      status: 'APPROVED' | 'REJECTED'
      comment?: string
    }) => apiClient.post(`/personnel-proposals/${id}/resolve`, { status, comment }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
}
