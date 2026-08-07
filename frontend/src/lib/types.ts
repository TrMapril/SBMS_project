export type SystemRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'EMPLOYEE'
export type UserStatus = 'ACTIVE' | 'LOCKED' | 'PENDING'
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
export type CustomFieldType = 'TEXT' | 'NUMBER' | 'DATE' | 'BOOLEAN'

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
}

export interface User {
  id: string
  tenantId: string | null
  email: string
  fullName: string
  systemRole: SystemRole
  status: UserStatus
  mustChangePassword: boolean
  createdAt: string
  updatedAt: string
}

export interface Role {
  id: string
  tenantId: string
  name: string
  createdAt: string
  updatedAt: string
}

export interface RoleMember {
  id: string
  userId: string
  roleId: string
  createdAt: string
  user: Pick<User, 'id' | 'email' | 'fullName' | 'systemRole'>
}

export interface RoleDetail extends Role {
  userRoles: RoleMember[]
}

export interface Workflow {
  id: string
  tenantId: string
  name: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface WorkflowState {
  id: string
  workflowId: string
  name: string
  isStart: boolean
  isEnd: boolean
  isActive: boolean
  orderIndex: number
  positionX: number | null
  positionY: number | null
  createdAt: string
  updatedAt: string
}

export interface TransitionCondition {
  requireCustomFields?: string[]
  requireAssignee?: boolean
}

export interface WorkflowTransition {
  id: string
  workflowId: string
  fromStateId: string
  toStateId: string
  name: string
  allowRoles: string[]
  condition: TransitionCondition | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface WorkflowDetail extends Workflow {
  states: WorkflowState[]
  transitions: WorkflowTransition[]
}

export interface WorkflowTemplateDefinitionState {
  tempId: string
  name: string
  isStart?: boolean
  isEnd?: boolean
  orderIndex?: number
}

export interface WorkflowTemplateDefinitionTransition {
  name: string
  fromTempId: string
  toTempId: string
  condition?: TransitionCondition
}

export interface WorkflowTemplate {
  id: string
  name: string
  description: string | null
  definition: {
    states: WorkflowTemplateDefinitionState[]
    transitions: WorkflowTemplateDefinitionTransition[]
  }
  createdAt: string
  updatedAt: string
}

export interface Project {
  id: string
  tenantId: string
  workflowId: string
  name: string
  createdAt: string
  updatedAt: string
}

export interface ProjectMember {
  id: string
  projectId: string
  userId: string
  createdAt: string
  user?: Pick<User, 'id' | 'email' | 'fullName' | 'systemRole' | 'status'>
}

export interface ProjectDetail extends Project {
  members: ProjectMember[]
}

export interface AssignmentWeights {
  workload: number
  onTimeRate: number
  stepSpeed: number
  returnRate: number
}

export interface TenantConfig {
  id: string
  tenantId: string
  systemName: string | null
  primaryColor: string | null
  logoUrl: string | null
  enabledModules: string[]
  assignmentWeights: AssignmentWeights
  introText: string | null
  bannerImages: string[]
  address: string | null
  contactPhone: string | null
  contactEmail: string | null
  socialLinks: Record<string, string>
  createdAt: string
  updatedAt: string
}

export interface CustomField {
  id: string
  tenantId: string
  name: string
  fieldType: CustomFieldType
  isRequired: boolean
  defaultValue: string | null
  createdAt: string
  updatedAt: string
}

export interface CustomFieldValue {
  id: string
  taskId: string
  customFieldId: string
  value: string
  createdAt: string
  updatedAt: string
}

export interface Task {
  id: string
  tenantId: string
  projectId: string
  title: string
  description: string | null
  currentStateId: string
  assigneeId: string | null
  priority: TaskPriority
  version: number
  deadline: string | null
  riskScore: number | null
  riskScoreUpdatedAt: string | null
  createdAt: string
  updatedAt: string
  customFieldValues?: CustomFieldValue[]
}

export interface TaskHistoryEntry {
  id: string
  taskId: string
  fromStateId: string | null
  toStateId: string
  transitionId: string | null
  actionBy: string
  actionAt: string
  comment: string | null
}

export interface TaskDetail extends Task {
  currentState: WorkflowState
  history: TaskHistoryEntry[]
}

export interface AssignmentSuggestion {
  userId: string
  fullName: string
  email: string
  score: number
  breakdown: AssignmentWeights
}

export interface RiskAlertTask extends Task {
  assignee: Pick<User, 'id' | 'fullName'> | null
  project: Pick<Project, 'id' | 'name'>
  currentState: Pick<WorkflowState, 'id' | 'name'>
}

export interface BottleneckStateStat {
  stateId: string
  stateName: string
  avgDwellHours: number | null
  taskCount: number
  deltaHoursVsPrevious: number | null
}

export interface BottleneckTransitionStat {
  transitionId: string
  name: string
  fromStateId: string
  fromStateName: string
  toStateId: string
  toStateName: string
  isBackward: boolean
  count: number
}

export interface BottleneckSnapshot {
  id: string
  tenantId: string
  workflowId: string
  computedAt: string
  windowDays: number
  stateStats: BottleneckStateStat[]
  transitionStats: BottleneckTransitionStat[]
  overallBackwardRate: number
  deltaBackwardRateVsPrevious: number | null
}

/** Đúng 4 event liệt kê ở Mục "Quy ước Socket.io" plan.md. */
export type NotificationEventType =
  | 'task:assigned'
  | 'task:state-changed'
  | 'task:risk-alert'
  | 'leave-request:resolved'

export interface AppNotification {
  id: string
  tenantId: string
  userId: string
  type: NotificationEventType
  data: Record<string, unknown>
  isRead: boolean
  createdAt: string
}

// ---------- Giai đoạn 7 ----------

export interface PublicTenant {
  slug: string
  name: string
  systemName: string | null
  logoUrl: string | null
  primaryColor: string | null
  introText: string | null
  bannerImages: string[]
  address: string | null
  contactPhone: string | null
  contactEmail: string | null
  socialLinks: Record<string, string>
}

export type LeaveRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface LeaveRequest {
  id: string
  tenantId: string
  userId: string
  startDate: string
  endDate: string
  reason: string
  attachmentUrl: string | null
  status: LeaveRequestStatus
  reviewedBy: string | null
  reviewedAt: string | null
  reviewComment: string | null
  createdAt: string
  updatedAt: string
  user?: Pick<User, 'id' | 'fullName' | 'email'>
  reviewer?: Pick<User, 'id' | 'fullName'> | null
}

export interface CompetencyAutoMetrics {
  totalCompletedTasks: number
  onTimeRate: number | null
  returnCount: number
  avgProcessingHours: number | null
}

export interface CompetencyProfileEntry {
  id: string
  tenantId: string
  userId: string
  periodLabel: string
  overallRating: number
  managerNotes: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
  createdByUser?: Pick<User, 'id' | 'fullName'>
}

export interface CompetencyProfile {
  autoMetrics: CompetencyAutoMetrics
  entries: CompetencyProfileEntry[]
}

export type PersonnelProposalType = 'PROMOTION' | 'RAISE' | 'WARNING' | 'AWARD'
export type PersonnelProposalStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface PersonnelProposal {
  id: string
  tenantId: string
  userId: string
  type: PersonnelProposalType
  description: string
  status: PersonnelProposalStatus
  proposedBy: string
  reviewedBy: string | null
  reviewedAt: string | null
  reviewComment: string | null
  createdAt: string
  updatedAt: string
  user?: Pick<User, 'id' | 'fullName'>
  proposedByUser?: Pick<User, 'id' | 'fullName'>
  reviewer?: Pick<User, 'id' | 'fullName'> | null
}

export interface Certification {
  name: string
  issuer?: string
  year?: number
}

export interface EmployeeProfile {
  userId: string
  fullName: string
  email: string
  systemRole: SystemRole
  phone: string | null
  address: string | null
  bio: string | null
  certifications: Certification[]
  completedTaskCount: number
}
