/** Eixos, dimensões e estados do VIVASS — fonte única para API e interface. */

export const VIVASS_AXES = [
  'VIDA',
  'VALORES',
  'APRENDIZADO',
  'SAUDE',
  'SUSTENTABILIDADE',
] as const
export type VivassAxis = (typeof VIVASS_AXES)[number]

export const AXIS_LABELS: Record<VivassAxis, string> = {
  VIDA: 'Vida',
  VALORES: 'Valores',
  APRENDIZADO: 'Aprendizado',
  SAUDE: 'Saúde',
  SUSTENTABILIDADE: 'Sustentabilidade',
}

export const AXIS_TAGLINES: Record<VivassAxis, string> = {
  VIDA: 'Saúde, qualidade de vida e bem-estar',
  VALORES: 'Formação humana, cidadania e convivência',
  APRENDIZADO: 'Desenvolvimento educacional e competências',
  SAUDE: 'Escola, saúde e comunidade integradas',
  SUSTENTABILIDADE: 'Educação ambiental e responsabilidade socioambiental',
}

export const AXIS_COLORS: Record<VivassAxis, string> = {
  VIDA: '#1b6a4b',
  VALORES: '#6d5bd0',
  APRENDIZADO: '#2f6fb3',
  SAUDE: '#c2603f',
  SUSTENTABILIDADE: '#5b8a2e',
}

export const BIOPSYCHOSOCIAL_DIMENSIONS = ['BIO', 'PSICO', 'SOCIAL', 'AMBIENTAL'] as const
export type BiopsychosocialDimension = (typeof BIOPSYCHOSOCIAL_DIMENSIONS)[number]

export const DIMENSION_LABELS: Record<BiopsychosocialDimension, string> = {
  BIO: 'Bio — saúde física e hábitos',
  PSICO: 'Psico — emocional e aprendizagem',
  SOCIAL: 'Social — família, comunidade e cidadania',
  AMBIENTAL: 'Ambiental — território e sustentabilidade',
}

export const INSTITUTION_KINDS = ['MUNICIPAL', 'ESTADUAL', 'PRIVADA', 'COMUNITARIA'] as const
export type InstitutionKind = (typeof INSTITUTION_KINDS)[number]

export const INSTITUTION_KIND_LABELS: Record<InstitutionKind, string> = {
  MUNICIPAL: 'Rede municipal',
  ESTADUAL: 'Rede estadual',
  PRIVADA: 'Rede privada',
  COMUNITARIA: 'Comunitária',
}

export const PROJECT_STATUSES = ['PLANNED', 'ACTIVE', 'COMPLETED', 'SUSPENDED'] as const
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  PLANNED: 'Planejado',
  ACTIVE: 'Em andamento',
  COMPLETED: 'Concluído',
  SUSPENDED: 'Suspenso',
}

export const ACTIVITY_STATUSES = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number]

export const ACTIVITY_STATUS_LABELS: Record<ActivityStatus, string> = {
  PLANNED: 'Planejada',
  IN_PROGRESS: 'Em execução',
  COMPLETED: 'Realizada',
  CANCELLED: 'Cancelada',
}

export const UF_LIST = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const

/* ------------------------------------------------------------------ *
 * Fase 2 — gestão institucional
 * ------------------------------------------------------------------ */

export const SHIFTS = ['MANHA', 'TARDE', 'INTEGRAL', 'NOITE'] as const
export type Shift = (typeof SHIFTS)[number]

export const SHIFT_LABELS: Record<Shift, string> = {
  MANHA: 'Manhã',
  TARDE: 'Tarde',
  INTEGRAL: 'Integral',
  NOITE: 'Noite',
}

export const STUDENT_STATUSES = ['ACTIVE', 'INACTIVE'] as const
export type StudentStatus = (typeof STUDENT_STATUSES)[number]

export const STUDENT_STATUS_LABELS: Record<StudentStatus, string> = {
  ACTIVE: 'Ativo',
  INACTIVE: 'Inativo',
}

export const CONSENT_TYPES = ['DATA', 'IMAGE', 'HEALTH'] as const
export type ConsentType = (typeof CONSENT_TYPES)[number]

export const CONSENT_TYPE_LABELS: Record<ConsentType, string> = {
  DATA: 'Tratamento de dados pessoais',
  IMAGE: 'Uso de imagem',
  HEALTH: 'Dados de saúde (sensível)',
}

export const DATA_REQUEST_TYPES = ['ACCESS', 'CORRECTION', 'DELETION', 'PORTABILITY'] as const
export type DataRequestType = (typeof DATA_REQUEST_TYPES)[number]

export const DATA_REQUEST_TYPE_LABELS: Record<DataRequestType, string> = {
  ACCESS: 'Acesso aos dados',
  CORRECTION: 'Correção de dados',
  DELETION: 'Exclusão de dados',
  PORTABILITY: 'Portabilidade',
}

export const DATA_REQUEST_STATUSES = ['OPEN', 'IN_PROGRESS', 'DONE', 'REJECTED'] as const
export type DataRequestStatus = (typeof DATA_REQUEST_STATUSES)[number]

export const DATA_REQUEST_STATUS_LABELS: Record<DataRequestStatus, string> = {
  OPEN: 'Aberta',
  IN_PROGRESS: 'Em análise',
  DONE: 'Atendida',
  REJECTED: 'Indeferida',
}

/* ------------------------------------------------------------------ *
 * Fase 4 — planejamento
 * ------------------------------------------------------------------ */

export const PLAN_STATUSES = ['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED'] as const
export type PlanStatus = (typeof PLAN_STATUSES)[number]

export const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
  DRAFT: 'Rascunho',
  ACTIVE: 'Em execução',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
}

export const DIAGNOSTIC_STATUSES = ['OPEN', 'CLOSED'] as const
export type DiagnosticStatus = (typeof DIAGNOSTIC_STATUSES)[number]

export const DIAGNOSTIC_STATUS_LABELS: Record<DiagnosticStatus, string> = {
  OPEN: 'Aberto',
  CLOSED: 'Encerrado',
}

/**
 * Questionário fixo de percepção institucional.
 * Nunca é aplicado a um estudante identificado: a resposta é anônima e o
 * resultado só existe de forma agregada por eixo/dimensão.
 */
export const DIAGNOSTIC_QUESTIONS = [
  { key: 'vida_rotina', axis: 'VIDA', dimension: 'BIO', text: 'A escola promove rotinas saudáveis (sono, alimentação, movimento).' },
  { key: 'vida_acolhimento', axis: 'VIDA', dimension: 'SOCIAL', text: 'Estudantes se sentem acolhidos no cotidiano escolar.' },
  { key: 'valores_convivencia', axis: 'VALORES', dimension: 'SOCIAL', text: 'A convivência respeitosa é praticada e mediada pela escola.' },
  { key: 'valores_participacao', axis: 'VALORES', dimension: 'SOCIAL', text: 'Estudantes participam das decisões que afetam a turma.' },
  { key: 'aprendizado_apoio', axis: 'APRENDIZADO', dimension: 'PSICO', text: 'Há apoio pedagógico para quem apresenta dificuldade.' },
  { key: 'aprendizado_projetos', axis: 'APRENDIZADO', dimension: 'PSICO', text: 'Os projetos pedagógicos dialogam com a realidade dos estudantes.' },
  { key: 'saude_escuta', axis: 'SAUDE', dimension: 'PSICO', text: 'Existe escuta qualificada para questões emocionais.' },
  { key: 'saude_encaminhamento', axis: 'SAUDE', dimension: 'BIO', text: 'A escola articula encaminhamentos de saúde com a rede pública.' },
  { key: 'sustentabilidade_praticas', axis: 'SUSTENTABILIDADE', dimension: 'AMBIENTAL', text: 'A escola desenvolve práticas ambientais concretas.' },
  { key: 'sustentabilidade_territorio', axis: 'SUSTENTABILIDADE', dimension: 'AMBIENTAL', text: 'A comunidade participa das ações ambientais da escola.' },
] as const

export type DiagnosticQuestion = (typeof DIAGNOSTIC_QUESTIONS)[number]

/* ------------------------------------------------------------------ *
 * Fase 5 — comunicação, biblioteca e portal
 * ------------------------------------------------------------------ */

export const ANNOUNCEMENT_AUDIENCES = ['ALL', 'PROFESSIONALS', 'FAMILIES', 'STUDENTS'] as const
export type AnnouncementAudience = (typeof ANNOUNCEMENT_AUDIENCES)[number]

export const ANNOUNCEMENT_AUDIENCE_LABELS: Record<AnnouncementAudience, string> = {
  ALL: 'Toda a comunidade',
  PROFESSIONALS: 'Equipe profissional',
  FAMILIES: 'Famílias e responsáveis',
  STUDENTS: 'Estudantes',
}

export const LIBRARY_KINDS = ['LINK', 'TEXT', 'FILE'] as const
export type LibraryKind = (typeof LIBRARY_KINDS)[number]

export const LIBRARY_KIND_LABELS: Record<LibraryKind, string> = {
  LINK: 'Link externo',
  TEXT: 'Texto de leitura',
  FILE: 'Arquivo',
}

export const LIBRARY_CATEGORIES = [...VIVASS_AXES, 'GERAL'] as const
export type LibraryCategory = (typeof LIBRARY_CATEGORIES)[number]

export const LIBRARY_CATEGORY_LABELS: Record<LibraryCategory, string> = {
  VIDA: 'Vida',
  VALORES: 'Valores',
  APRENDIZADO: 'Aprendizado',
  SAUDE: 'Saúde',
  SUSTENTABILIDADE: 'Sustentabilidade',
  GERAL: 'Geral',
}
