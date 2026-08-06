import type { WorkflowState } from '../../lib/types'

/** Lấy toạ độ đã lưu (position_x/position_y) từ các State đã có trong DB — chỉ trả về State đã
 * từng được đồng bộ vị trí, State chưa có toạ độ (null) không xuất hiện trong kết quả. */
export function positionsFromStates(
  states: WorkflowState[],
): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {}
  states.forEach((state) => {
    if (state.positionX != null && state.positionY != null) {
      positions[state.id] = { x: state.positionX, y: state.positionY }
    }
  })
  return positions
}

/** Auto-layout đơn giản: xếp State theo orderIndex thành lưới — dùng làm vị trí khởi tạo cho
 * State chưa từng có toạ độ lưu ở DB (ví dụ dữ liệu seed cũ trước khi có cột position_x/y). */
export function computeInitialLayout(
  states: WorkflowState[],
): Record<string, { x: number; y: number }> {
  const columns = 4
  const spacingX = 220
  const spacingY = 140
  const sorted = [...states].sort((a, b) => a.orderIndex - b.orderIndex)

  const positions: Record<string, { x: number; y: number }> = {}
  sorted.forEach((state, index) => {
    const col = index % columns
    const row = Math.floor(index / columns)
    positions[state.id] = { x: col * spacingX + 40, y: row * spacingY + 40 }
  })
  return positions
}
