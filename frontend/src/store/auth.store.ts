import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { setAuthToken } from '../lib/api-client'
import { connectSocket, disconnectSocket } from '../lib/socket'
import type { User } from '../lib/types'

interface AuthState {
  accessToken: string | null
  user: User | null
  setSession: (accessToken: string, user: User) => void
  setUser: (user: User) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      setSession: (accessToken, user) => {
        setAuthToken(accessToken)
        connectSocket(accessToken)
        set({ accessToken, user })
      },
      setUser: (user) => set({ user }),
      logout: () => {
        setAuthToken(null)
        disconnectSocket()
        set({ accessToken: null, user: null })
      },
    }),
    {
      name: 'sbms-auth',
      onRehydrateStorage: () => (state) => {
        if (state?.accessToken) {
          setAuthToken(state.accessToken)
          connectSocket(state.accessToken)
        }
      },
    },
  ),
)
