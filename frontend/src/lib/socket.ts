import { io, Socket } from 'socket.io-client'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api'
// Socket.io phục vụ trên cùng HTTP server NestJS nhưng KHÔNG đi qua global prefix '/api' (chỉ
// áp dụng cho route REST) — bỏ hậu tố '/api' để lấy đúng origin server.
const SOCKET_URL = API_URL.replace(/\/api\/?$/, '')

let socket: Socket | null = null

/** Gọi khi đăng nhập thành công (hoặc rehydrate session có sẵn token) — join room
 * `tenant:{tenantId}:user:{userId}` được xử lý phía server dựa trên JWT gửi kèm handshake. */
export function connectSocket(token: string): Socket {
  if (socket) {
    socket.disconnect()
  }
  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
  })
  return socket
}

export function disconnectSocket() {
  socket?.disconnect()
  socket = null
}

export function getSocket(): Socket | null {
  return socket
}
