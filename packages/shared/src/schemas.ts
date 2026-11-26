import { z } from 'zod'
import {
  ANNOUNCEMENT_AUDIENCES,
  CONSENT_TYPES,
  DATA_REQUEST_STATUSES,
  DATA_REQUEST_TYPES,
  DIAGNOSTIC_QUESTIONS,
  INSTITUTION_KINDS,
  LIBRARY_CATEGORIES,
  LIBRARY_KINDS,
  PLAN_STATUSES,
  SHIFTS,
  STUDENT_STATUSES,
  UF_LIST,
  VIVASS_AXES,
  BIOPSYCHOSOCIAL_DIMENSIONS,
} from './vivass.js'
import { MEMBER_ROLES } from './roles.js'

/** Entrada de login. A senha nunca é aparada nem normalizada. */
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Informe um e-mail válido.'),
  password: z.string().min(8, 'A senha deve ter ao menos 8 caracteres.').max(200),
})

export const institutionKindSchema = z.enum(INSTITUTION_KINDS)
export const memberRoleSchema = z.enum(MEMBER_ROLES)
export const axisSchema = z.enum(VIVASS_AXES)
export const dimensionSchema = z.enum(BIOPSYCHOSOCIAL_DIMENSIONS)

export const createInstitutionSchema = z.object({
  name: z.string().trim().min(3, 'Informe o nome da instituição.').max(120),
  kind: institutionKindSchema,
  city: z.string().trim().min(2, 'Informe a cidade.').max(80),
  state: z.enum(UF_LIST),
  isDemo: z.boolean().optional().default(false),
})

export const createMemberSchema = z.object({
  name: z.string().trim().min(3, 'Informe o nome completo.').max(120),
  email: z.string().trim().toLowerCase().email('Informe um e-mail válido.'),
  password: z
    .string()
    .min(10, 'A senha provisória deve ter ao menos 10 caracteres.')
    .max(200),
  role: memberRoleSchema,
})

export const dashboardQuerySchema = z.object({
  days: z.coerce.number().int().min(7).max(730).default(90),
})

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
})

/** Data em formato ISO (aceita `YYYY-MM-DD` e ISO completo). */
const dateInput = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Data inválida.')

/* ------------------------------------------------------------------ *
 * Fase 2 — estudantes, turmas, consentimento e LGPD
 * ------------------------------------------------------------------ */

export const studentQuerySchema = paginationQuerySchema.extend({
  status: z.enum(STUDENT_STATUSES).optional(),
  classId: z.string().trim().min(1).optional(),
})

export const createStudentSchema = z.object({
  name: z.string().trim().min(3, 'Informe o nome do estudante.').max(140),
  birthDate: dateInput.optional().nullable(),
  guardianName: z.string().trim().max(140).optional().nullable(),
  guardianPhone: z.string().trim().max(40).optional().nullable(),
  guardianEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email('Informe um e-mail válido.')
    .optional()
    .nullable()
    .or(z.literal('')),
  classId: z.string().trim().min(1).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
})

export const updateStudentSchema = createStudentSchema.partial().extend({
  status: z.enum(STUDENT_STATUSES).optional(),
})

export const importStudentsSchema = z.object({
  csv: z.string().min(1, 'Envie o conteúdo do arquivo CSV.').max(200_000),
})

export const createClassSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome da turma.').max(80),
  year: z.coerce.number().int().min(2000).max(2100),
  shift: z.enum(SHIFTS),
})

export const updateClassSchema = createClassSchema.partial()

export const createConsentSchema = z.object({
  type: z.enum(CONSENT_TYPES),
  grantedBy: z.string().trim().min(3, 'Informe quem concedeu o consentimento.').max(140),
  expiresAt: dateInput.optional().nullable(),
  documentVersion: z.string().trim().max(20).optional(),
})

export const createDataRequestSchema = z.object({
  requesterName: z.string().trim().min(3, 'Informe o nome do solicitante.').max(140),
  requesterEmail: z.string().trim().toLowerCase().email('Informe um e-mail válido.'),
  type: z.enum(DATA_REQUEST_TYPES),
  details: z.string().trim().min(10, 'Descreva a solicitação.').max(4000),
})

export const updateDataRequestSchema = z.object({
  status: z.enum(DATA_REQUEST_STATUSES),
  resolution: z.string().trim().max(4000).optional().nullable(),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Informe a senha atual.').max(200),
  newPassword: z
    .string()
    .min(10, 'A nova senha deve ter ao menos 10 caracteres.')
    .max(200)
    .regex(/[A-Za-z]/, 'A nova senha deve conter letras.')
    .regex(/[0-9]/, 'A nova senha deve conter números.'),
})

/* ------------------------------------------------------------------ *
 * Fase 3 — projetos e atividades
 * ------------------------------------------------------------------ */

export const projectQuerySchema = paginationQuerySchema.extend({
  axis: axisSchema.optional(),
  status: z.enum(['PLANNED', 'ACTIVE', 'COMPLETED', 'SUSPENDED']).optional(),
})

export const createProjectSchema = z.object({
  name: z.string().trim().min(3, 'Informe o nome do projeto.').max(140),
  description: z.string().trim().max(4000).optional().nullable(),
  objective: z.string().trim().max(4000).optional().nullable(),
  axis: axisSchema,
  dimension: dimensionSchema,
  status: z.enum(['PLANNED', 'ACTIVE', 'COMPLETED', 'SUSPENDED']).optional(),
  startDate: dateInput.optional().nullable(),
  endDate: dateInput.optional().nullable(),
})

export const updateProjectSchema = createProjectSchema.partial()

export const activityQuerySchema = paginationQuerySchema.extend({
  axis: axisSchema.optional(),
  status: z.enum(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  projectId: z.string().trim().min(1).optional(),
  from: dateInput.optional(),
  to: dateInput.optional(),
})

export const createActivitySchema = z.object({
  title: z.string().trim().min(3, 'Informe o título da atividade.').max(160),
  description: z.string().trim().max(4000).optional().nullable(),
  projectId: z.string().trim().min(1).optional().nullable(),
  axis: axisSchema,
  dimension: dimensionSchema,
  status: z.enum(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  scheduledAt: dateInput.optional().nullable(),
  completedAt: dateInput.optional().nullable(),
  participants: z.coerce.number().int().min(0).max(100_000).optional(),
})

export const updateActivitySchema = createActivitySchema.partial()

/* ------------------------------------------------------------------ *
 * Fase 4 — planos de ação e diagnóstico
 * ------------------------------------------------------------------ */

export const createPlanSchema = z.object({
  title: z.string().trim().min(3, 'Informe o título do plano.').max(160),
  objective: z.string().trim().min(10, 'Descreva o objetivo do plano.').max(4000),
  axis: axisSchema,
  responsible: z.string().trim().min(3, 'Informe o responsável.').max(140),
  projectId: z.string().trim().min(1).optional().nullable(),
  startDate: dateInput.optional().nullable(),
  dueDate: dateInput.optional().nullable(),
})

export const updatePlanSchema = createPlanSchema.partial().extend({
  status: z.enum(PLAN_STATUSES).optional(),
  progress: z.coerce.number().int().min(0).max(100).optional(),
})

export const createMilestoneSchema = z.object({
  title: z.string().trim().min(3, 'Informe o marco.').max(160),
  dueDate: dateInput.optional().nullable(),
})

export const updateMilestoneSchema = z.object({
  title: z.string().trim().min(3).max(160).optional(),
  dueDate: dateInput.optional().nullable(),
  done: z.boolean().optional(),
})

export const createDiagnosticSchema = z.object({
  title: z.string().trim().min(3, 'Informe o título do diagnóstico.').max(160),
  description: z.string().trim().max(2000).optional().nullable(),
})

export const submitDiagnosticSchema = z.object({
  answers: z
    .array(
      z.object({
        questionKey: z.string().trim().min(1),
        value: z.coerce.number().int().min(1).max(5),
      }),
    )
    .min(1, 'Responda ao menos uma questão.')
    .max(DIAGNOSTIC_QUESTIONS.length),
})

/* ------------------------------------------------------------------ *
 * Fase 5 — comunicados, biblioteca e relatórios
 * ------------------------------------------------------------------ */

export const createAnnouncementSchema = z.object({
  title: z.string().trim().min(3, 'Informe o título do comunicado.').max(160),
  body: z.string().trim().min(10, 'Escreva o conteúdo do comunicado.').max(8000),
  audience: z.enum(ANNOUNCEMENT_AUDIENCES),
  classId: z.string().trim().min(1).optional().nullable(),
  expiresAt: dateInput.optional().nullable(),
})

export const updateAnnouncementSchema = createAnnouncementSchema.partial()

export const createLibraryItemSchema = z.object({
  title: z.string().trim().min(3, 'Informe o título.').max(160),
  description: z.string().trim().max(2000).optional().nullable(),
  category: z.enum(LIBRARY_CATEGORIES),
  kind: z.enum(LIBRARY_KINDS),
  url: z.string().trim().url('Informe uma URL válida.').optional().nullable(),
  content: z.string().trim().max(20_000).optional().nullable(),
  audience: z.enum(ANNOUNCEMENT_AUDIENCES),
})

export const updateLibraryItemSchema = createLibraryItemSchema.partial()

export const reportQuerySchema = z.object({
  days: z.coerce.number().int().min(7).max(730).default(180),
})

export type LoginInput = z.infer<typeof loginSchema>
export type CreateInstitutionInput = z.infer<typeof createInstitutionSchema>
export type CreateMemberInput = z.infer<typeof createMemberSchema>
export type DashboardQuery = z.infer<typeof dashboardQuerySchema>
export type CreateStudentInput = z.infer<typeof createStudentSchema>
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>
export type CreateClassInput = z.infer<typeof createClassSchema>
export type CreateProjectInput = z.infer<typeof createProjectSchema>
export type CreateActivityInput = z.infer<typeof createActivitySchema>
export type CreatePlanInput = z.infer<typeof createPlanSchema>
export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>
export type CreateLibraryItemInput = z.infer<typeof createLibraryItemSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
