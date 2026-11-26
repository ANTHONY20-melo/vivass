import type { MemberRole, Permission, PlatformRole } from './roles.js'
import type {
  ActivityStatus,
  AnnouncementAudience,
  ConsentType,
  DataRequestStatus,
  DataRequestType,
  DiagnosticStatus,
  InstitutionKind,
  LibraryCategory,
  LibraryKind,
  PlanStatus,
  ProjectStatus,
  Shift,
  StudentStatus,
  VivassAxis,
  BiopsychosocialDimension,
} from './vivass.js'

export interface MembershipSummary {
  institutionId: string
  institutionName: string
  role: MemberRole
  permissions: Permission[]
}

export interface SessionUser {
  id: string
  name: string
  email: string
  platformRole: PlatformRole
  memberships: MembershipSummary[]
}

export interface InstitutionSummary {
  id: string
  name: string
  slug: string
  kind: InstitutionKind
  city: string
  state: string
  status: string
  isDemo: boolean
  createdAt: string
  counts: {
    members: number
    students: number
    projects: number
  }
}

export interface MemberSummary {
  membershipId: string
  userId: string
  name: string
  email: string
  role: MemberRole
  active: boolean
  lastLoginAt: string | null
}

export interface DashboardData {
  institution: {
    id: string
    name: string
    kind: InstitutionKind
    city: string
    state: string
    isDemo: boolean
  }
  period: { days: number; from: string }
  totals: {
    students: number
    professionals: number
    families: number
    projectsActive: number
    activitiesTotal: number
    activitiesCompleted: number
    activitiesPending: number
    participants: number
    completionRate: number
  }
  byAxis: Array<{ axis: VivassAxis; total: number; completed: number }>
  monthly: Array<{ month: string; label: string; total: number; completed: number }>
  projects: Array<{
    id: string
    name: string
    axis: VivassAxis
    status: ProjectStatus
    activities: number
    completion: number
  }>
  recentActivities: Array<{
    id: string
    title: string
    axis: VivassAxis
    status: ActivityStatus
    scheduledAt: string | null
    participants: number
  }>
}

export interface ApiErrorBody {
  error: {
    code: string
    message: string
    details?: unknown
  }
}

export interface AuthResponse {
  accessToken: string
  user: SessionUser
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

/* ------------------------------------------------------------------ *
 * Fase 2
 * ------------------------------------------------------------------ */

export interface ConsentSummary {
  id: string
  type: ConsentType
  grantedBy: string
  grantedAt: string
  expiresAt: string | null
  revokedAt: string | null
  documentVersion: string
}

export interface StudentSummary {
  id: string
  name: string
  birthDate: string | null
  guardianName: string | null
  guardianPhone: string | null
  guardianEmail: string | null
  notes: string | null
  status: StudentStatus
  classId: string | null
  className: string | null
  createdAt: string
  consents: ConsentSummary[]
}

export interface ClassSummary {
  id: string
  name: string
  year: number
  shift: Shift
  students: number
}

export interface DataRequestSummary {
  id: string
  requesterName: string
  requesterEmail: string
  type: DataRequestType
  status: DataRequestStatus
  details: string
  resolution: string | null
  createdAt: string
  updatedAt: string
}

export interface ImportStudentsResult {
  created: number
  skipped: number
  errors: Array<{ line: number; message: string }>
}

export interface AuditEntrySummary {
  id: string
  action: string
  entity: string
  entityId: string | null
  actorName: string | null
  ip: string | null
  createdAt: string
  metadata: Record<string, unknown> | null
}

/* ------------------------------------------------------------------ *
 * Fase 3
 * ------------------------------------------------------------------ */

export interface ProjectSummary {
  id: string
  name: string
  description: string | null
  objective: string | null
  axis: VivassAxis
  dimension: BiopsychosocialDimension
  status: ProjectStatus
  startDate: string | null
  endDate: string | null
  activityCount: number
  completedCount: number
}

export interface ActivitySummary {
  id: string
  title: string
  description: string | null
  projectId: string | null
  projectName: string | null
  axis: VivassAxis
  dimension: BiopsychosocialDimension
  status: ActivityStatus
  scheduledAt: string | null
  completedAt: string | null
  participants: number
}

export interface AxisSummary {
  axis: VivassAxis
  projects: number
  activities: number
  completed: number
  participants: number
  upcoming: number
  byDimension: Array<{ dimension: BiopsychosocialDimension; activities: number }>
}

/* ------------------------------------------------------------------ *
 * Fase 4
 * ------------------------------------------------------------------ */

export interface MilestoneSummary {
  id: string
  title: string
  dueDate: string | null
  done: boolean
}

export interface PlanSummary {
  id: string
  title: string
  objective: string
  axis: VivassAxis
  responsible: string
  projectId: string | null
  projectName: string | null
  startDate: string | null
  dueDate: string | null
  status: PlanStatus
  progress: number
  milestones: MilestoneSummary[]
  createdAt: string
}

export interface DiagnosticSummary {
  id: string
  title: string
  description: string | null
  status: DiagnosticStatus
  responses: number
  createdAt: string
}

export interface DiagnosticResults {
  diagnostic: DiagnosticSummary
  totalAnswers: number
  byAxis: Array<{ axis: VivassAxis; average: number; answers: number }>
  byDimension: Array<{
    dimension: BiopsychosocialDimension
    average: number
    answers: number
  }>
  distribution: Array<{ value: number; count: number }>
}

/* ------------------------------------------------------------------ *
 * Fase 5
 * ------------------------------------------------------------------ */

export interface AnnouncementSummary {
  id: string
  title: string
  body: string
  audience: AnnouncementAudience
  classId: string | null
  className: string | null
  publishedAt: string
  expiresAt: string | null
}

export interface LibraryItemSummary {
  id: string
  title: string
  description: string | null
  category: LibraryCategory
  kind: LibraryKind
  url: string | null
  content: string | null
  audience: AnnouncementAudience
  createdAt: string
}

export interface PortalData {
  institution: { id: string; name: string; isDemo: boolean }
  announcements: AnnouncementSummary[]
  upcomingActivities: Array<{
    id: string
    title: string
    axis: VivassAxis
    scheduledAt: string | null
    projectName: string | null
  }>
  library: LibraryItemSummary[]
}
