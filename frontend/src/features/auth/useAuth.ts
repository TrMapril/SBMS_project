import { useMutation } from '@tanstack/react-query'
import { apiClient } from '../../lib/api-client'
import type { User } from '../../lib/types'
import { useAuthStore } from '../../store/auth.store'

interface LoginResponse {
  accessToken: string
  user: User
}

export function useLogin() {
  const setSession = useAuthStore((s) => s.setSession)
  return useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      apiClient.post<LoginResponse>('/auth/login', input),
    onSuccess: (data) => setSession(data.accessToken, data.user),
  })
}

export function useChangePassword() {
  const setUser = useAuthStore((s) => s.setUser)
  return useMutation({
    mutationFn: (input: { currentPassword: string; newPassword: string }) =>
      apiClient.patch<User>('/auth/change-password', input),
    onSuccess: (user) => setUser(user),
  })
}
