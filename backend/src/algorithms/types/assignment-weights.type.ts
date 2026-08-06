export interface AssignmentWeights {
  workload: number;
  onTimeRate: number;
  stepSpeed: number;
  returnRate: number;
}

/** Khớp default trong migration (`tenant_config.assignment_weights`) — dùng khi tenant_config
 * chưa có giá trị (không nên xảy ra vì cột có default ở DB, nhưng vẫn phòng hờ). */
export const DEFAULT_ASSIGNMENT_WEIGHTS: AssignmentWeights = {
  workload: 0.3,
  onTimeRate: 0.3,
  stepSpeed: 0.25,
  returnRate: 0.15,
};
