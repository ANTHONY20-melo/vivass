import type { FastifyInstance } from 'fastify'
import ExcelJS from 'exceljs'
import PDFDocument from 'pdfkit'
import {
  ACTIVITY_STATUS_LABELS,
  AXIS_LABELS,
  PROFESSIONAL_ROLES,
  PROJECT_STATUS_LABELS,
  VIVASS_AXES,
  reportQuerySchema,
} from '@vivass/shared'
import { prisma } from '../db.js'
import { notFound } from '../lib/errors.js'
import { parseInput } from '../lib/validate.js'
import { recordAudit } from '../lib/audit.js'
import { assertInstitutionAccess, requireAuth } from '../lib/tenancy.js'

const DAY_MS = 24 * 60 * 60 * 1000

interface ReportData {
  institution: {
    name: string
    kind: string
    city: string
    state: string
    isDemo: boolean
  }
  period: { days: number; from: Date }
  totals: {
    students: number
    professionals: number
    families: number
    projects: number
    activities: number
    completed: number
    participants: number
    completionRate: number
  }
  byAxis: Array<{ axis: string; total: number; completed: number }>
  projects: Array<{
    name: string
    axis: string
    status: string
    activities: number
    completion: number
  }>
  activities: Array<{
    title: string
    axis: string
    status: string
    scheduledAt: Date | null
    participants: number
  }>
}

async function collectReportData(
  institutionId: string,
  days: number,
): Promise<ReportData> {
  const institution = await prisma.institution.findUnique({
    where: { id: institutionId },
    select: { name: true, kind: true, city: true, state: true, isDemo: true },
  })
  if (!institution) throw notFound('Instituição não encontrada.')

  const from = new Date(Date.now() - days * DAY_MS)

  const [students, memberships, projects, activities] = await Promise.all([
    prisma.student.count({ where: { institutionId, status: 'ACTIVE' } }),
    prisma.membership.findMany({
      where: { institutionId, active: true },
      select: { role: true },
    }),
    prisma.project.findMany({
      where: { institutionId },
      select: { id: true, name: true, axis: true, status: true },
      orderBy: { name: 'asc' },
    }),
    prisma.activity.findMany({
      where: { institutionId, scheduledAt: { gte: from } },
      select: {
        title: true,
        axis: true,
        status: true,
        scheduledAt: true,
        participants: true,
        projectId: true,
      },
      orderBy: { scheduledAt: 'desc' },
    }),
  ])

  const professionals = memberships.filter((membership) =>
    (PROFESSIONAL_ROLES as readonly string[]).includes(membership.role),
  ).length
  const families = memberships.filter((membership) => membership.role === 'FAMILY').length
  const completed = activities.filter((activity) => activity.status === 'COMPLETED').length
  const participants = activities.reduce((total, activity) => total + activity.participants, 0)

  const projectRows = projects.map((project) => {
    const projectActivities = activities.filter(
      (activity) => activity.projectId === project.id,
    )
    const done = projectActivities.filter(
      (activity) => activity.status === 'COMPLETED',
    ).length
    return {
      name: project.name,
      axis: project.axis,
      status: project.status,
      activities: projectActivities.length,
      completion:
        projectActivities.length === 0
          ? 0
          : Math.round((done / projectActivities.length) * 100),
    }
  })

  return {
    institution,
    period: { days, from },
    totals: {
      students,
      professionals,
      families,
      projects: projects.length,
      activities: activities.length,
      completed,
      participants,
      completionRate:
        activities.length === 0 ? 0 : Math.round((completed / activities.length) * 100),
    },
    byAxis: VIVASS_AXES.map((axis) => {
      const axisActivities = activities.filter((activity) => activity.axis === axis)
      return {
        axis,
        total: axisActivities.length,
        completed: axisActivities.filter((activity) => activity.status === 'COMPLETED').length,
      }
    }),
    projects: projectRows,
    activities: activities.map((activity) => ({
      title: activity.title,
      axis: activity.axis,
      status: activity.status,
      scheduledAt: activity.scheduledAt,
      participants: activity.participants,
    })),
  }
}

function formatDate(date: Date | null): string {
  if (!date) return '-'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

async function buildPdf(data: ReportData): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 48 })
  const chunks: Buffer[] = []
  doc.on('data', (chunk: Buffer) => chunks.push(chunk))
  const finished = new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
  })

  const forest = '#0b3a2c'
  const ink = '#15211c'
  const muted = '#4e6259'
  const line = '#e7e3d6'

  doc.rect(0, 0, doc.page.width, 96).fill(forest)
  doc.fillColor('#ffffff').fontSize(24).font('Helvetica-Bold').text('VIVASS', 48, 32)
  doc
    .fontSize(10)
    .font('Helvetica')
    .fillColor('#c3eeda')
    .text('Educacao integrada para transformar vidas', 48, 62)
  doc
    .fontSize(9)
    .font('Helvetica')
    .fillColor('#c3eeda')
    .text(
      `Relatorio institucional - gerado em ${formatDate(new Date())}`,
      300,
      62,
      { align: 'right', width: 245 },
    )

  doc.fillColor(ink).fontSize(18).font('Helvetica-Bold').text(data.institution.name, 48, 124)
  doc
    .fontSize(10)
    .font('Helvetica')
    .fillColor(muted)
    .text(
      `${data.institution.city} - ${data.institution.state} | Periodo: ultimos ${data.period.days} dias (desde ${formatDate(data.period.from)})`,
      48,
      150,
    )

  if (data.institution.isDemo) {
    doc
      .fontSize(9)
      .fillColor('#8a5a00')
      .text('AMBIENTE DE DEMONSTRACAO - todos os dados sao ficticios.', 48, 168)
  }

  let y = data.institution.isDemo ? 192 : 178

  doc.fontSize(12).font('Helvetica-Bold').fillColor(forest).text('Indicadores', 48, y)
  y += 22

  const metrics: Array<[string, string]> = [
    ['Estudantes ativos', String(data.totals.students)],
    ['Profissionais', String(data.totals.professionals)],
    ['Familias com acesso', String(data.totals.families)],
    ['Projetos', String(data.totals.projects)],
    ['Atividades no periodo', String(data.totals.activities)],
    ['Atividades realizadas', String(data.totals.completed)],
    ['Participantes (somatorio)', String(data.totals.participants)],
    ['Execucao do planejamento', `${data.totals.completionRate}%`],
  ]

  const boxWidth = (doc.page.width - 96 - 24) / 4
  metrics.forEach(([label, value], index) => {
    const column = index % 4
    const row = Math.floor(index / 4)
    const x = 48 + column * (boxWidth + 8)
    const top = y + row * 56
    doc.roundedRect(x, top, boxWidth, 46, 6).fillAndStroke('#fbfaf6', line)
    doc.fontSize(8).font('Helvetica').fillColor(muted).text(label.toUpperCase(), x + 10, top + 8, {
      width: boxWidth - 20,
    })
    doc.fontSize(16).font('Helvetica-Bold').fillColor(ink).text(value, x + 10, top + 22)
  })

  y += Math.ceil(metrics.length / 4) * 56 + 12

  doc.fontSize(12).font('Helvetica-Bold').fillColor(forest).text('Acoes por eixo', 48, y)
  y += 20
  doc.moveTo(48, y).lineTo(doc.page.width - 48, y).stroke(line)
  y += 10

  for (const entry of data.byAxis) {
    if (y > doc.page.height - 80) {
      doc.addPage()
      y = 60
    }
    const label = AXIS_LABELS[entry.axis as keyof typeof AXIS_LABELS] ?? entry.axis
    doc.fontSize(10).font('Helvetica').fillColor(ink).text(label, 48, y, { width: 180 })
    doc
      .fontSize(10)
      .fillColor(muted)
      .text(`${entry.completed} realizadas de ${entry.total}`, 230, y, { width: 140 })
    const barWidth = 180
    doc.roundedRect(380, y + 1, barWidth, 8, 4).fill('#f1efe6')
    if (entry.total > 0) {
      const filled = Math.max(4, Math.round((entry.completed / entry.total) * barWidth))
      doc.roundedRect(380, y + 1, filled, 8, 4).fill('#1f7a5b')
    }
    y += 20
  }

  y += 10
  doc.fontSize(12).font('Helvetica-Bold').fillColor(forest).text('Projetos', 48, y)
  y += 20

  for (const project of data.projects) {
    if (y > doc.page.height - 80) {
      doc.addPage()
      y = 60
    }
    const label = AXIS_LABELS[project.axis as keyof typeof AXIS_LABELS] ?? project.axis
    const status =
      PROJECT_STATUS_LABELS[project.status as keyof typeof PROJECT_STATUS_LABELS] ??
      project.status
    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .fillColor(ink)
      .text(project.name, 48, y, { width: 230 })
    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor(muted)
      .text(`${label} | ${status}`, 48, y + 13, { width: 230 })
    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor(ink)
      .text(`${project.activities} atividade(s)`, 290, y, { width: 120 })
    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .fillColor(forest)
      .text(`${project.completion}% executado`, 410, y, { width: 140, align: 'right' })
    y += 32
  }

  y += 6
  doc.fontSize(12).font('Helvetica-Bold').fillColor(forest).text('Atividades do periodo', 48, y)
  y += 20

  for (const activity of data.activities) {
    if (y > doc.page.height - 70) {
      doc.addPage()
      y = 60
    }
    const label = AXIS_LABELS[activity.axis as keyof typeof AXIS_LABELS] ?? activity.axis
    const status =
      ACTIVITY_STATUS_LABELS[activity.status as keyof typeof ACTIVITY_STATUS_LABELS] ??
      activity.status
    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor(ink)
      .text(activity.title, 48, y, { width: 250 })
    doc
      .fontSize(9)
      .fillColor(muted)
      .text(`${label} | ${status}`, 48, y + 13, { width: 250 })
    doc.fontSize(9).fillColor(muted).text(formatDate(activity.scheduledAt), 310, y + 4, {
      width: 90,
    })
    doc
      .fontSize(9)
      .fillColor(muted)
      .text(`${activity.participants} participante(s)`, 400, y + 4, { width: 150, align: 'right' })
    y += 28
  }

  doc
    .fontSize(8)
    .fillColor(muted)
    .text(
      'Documento gerado pelo VIVASS. Indicadores agregados: nao ha score nem diagnostico individual de estudante.',
      48,
      doc.page.height - 52,
      { width: doc.page.width - 96 },
    )

  doc.end()
  return finished
}

async function buildWorkbook(data: ReportData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'VIVASS'
  workbook.created = new Date()

  const summary = workbook.addWorksheet('Resumo')
  summary.columns = [
    { header: 'Indicador', key: 'label', width: 34 },
    { header: 'Valor', key: 'value', width: 18 },
  ]
  summary.addRows([
    { label: 'Instituição', value: data.institution.name },
    { label: 'Cidade / UF', value: `${data.institution.city} - ${data.institution.state}` },
    { label: 'Período (dias)', value: data.period.days },
    { label: 'Início do período', value: formatDate(data.period.from) },
    { label: 'Ambiente de demonstração', value: data.institution.isDemo ? 'Sim' : 'Não' },
    { label: 'Estudantes ativos', value: data.totals.students },
    { label: 'Profissionais', value: data.totals.professionals },
    { label: 'Famílias com acesso', value: data.totals.families },
    { label: 'Projetos', value: data.totals.projects },
    { label: 'Atividades no período', value: data.totals.activities },
    { label: 'Atividades realizadas', value: data.totals.completed },
    { label: 'Participantes (somatório)', value: data.totals.participants },
    { label: 'Execução do planejamento (%)', value: data.totals.completionRate },
  ])
  summary.getRow(1).font = { bold: true }

  const axes = workbook.addWorksheet('Eixos')
  axes.columns = [
    { header: 'Eixo', key: 'axis', width: 22 },
    { header: 'Atividades', key: 'total', width: 14 },
    { header: 'Realizadas', key: 'completed', width: 14 },
  ]
  axes.addRows(
    data.byAxis.map((entry) => ({
      axis: AXIS_LABELS[entry.axis as keyof typeof AXIS_LABELS] ?? entry.axis,
      total: entry.total,
      completed: entry.completed,
    })),
  )
  axes.getRow(1).font = { bold: true }

  const projects = workbook.addWorksheet('Projetos')
  projects.columns = [
    { header: 'Projeto', key: 'name', width: 38 },
    { header: 'Eixo', key: 'axis', width: 20 },
    { header: 'Status', key: 'status', width: 16 },
    { header: 'Atividades', key: 'activities', width: 12 },
    { header: 'Execução (%)', key: 'completion', width: 14 },
  ]
  projects.addRows(
    data.projects.map((project) => ({
      name: project.name,
      axis: AXIS_LABELS[project.axis as keyof typeof AXIS_LABELS] ?? project.axis,
      status:
        PROJECT_STATUS_LABELS[project.status as keyof typeof PROJECT_STATUS_LABELS] ??
        project.status,
      activities: project.activities,
      completion: project.completion,
    })),
  )
  projects.getRow(1).font = { bold: true }

  const activities = workbook.addWorksheet('Atividades')
  activities.columns = [
    { header: 'Atividade', key: 'title', width: 42 },
    { header: 'Eixo', key: 'axis', width: 20 },
    { header: 'Status', key: 'status', width: 16 },
    { header: 'Data', key: 'date', width: 14 },
    { header: 'Participantes', key: 'participants', width: 16 },
  ]
  activities.addRows(
    data.activities.map((activity) => ({
      title: activity.title,
      axis: AXIS_LABELS[activity.axis as keyof typeof AXIS_LABELS] ?? activity.axis,
      status:
        ACTIVITY_STATUS_LABELS[activity.status as keyof typeof ACTIVITY_STATUS_LABELS] ??
        activity.status,
      date: formatDate(activity.scheduledAt),
      participants: activity.participants,
    })),
  )
  activities.getRow(1).font = { bold: true }

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

export async function reportRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/institutions/:institutionId/reports/summary.pdf',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const auth = requireAuth(request)
      const { institutionId } = request.params as { institutionId: string }
      assertInstitutionAccess(auth, institutionId, 'report:read')

      const { days } = parseInput(reportQuerySchema, request.query)
      const data = await collectReportData(institutionId, days)
      const buffer = await buildPdf(data)
      const filename = `vivass-relatorio-${data.institution.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .toLowerCase()}.pdf`

      await recordAudit({
        actorId: auth.user.id,
        institutionId,
        action: 'REPORT_EXPORT_PDF',
        entity: 'Institution',
        entityId: institutionId,
        metadata: { days },
        ip: request.ip,
      })

      return reply
        .header('content-type', 'application/pdf')
        .header('content-disposition', `attachment; filename="${filename}"`)
        .header('content-length', String(buffer.length))
        .send(buffer)
    },
  )

  app.get(
    '/institutions/:institutionId/reports/summary.xlsx',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const auth = requireAuth(request)
      const { institutionId } = request.params as { institutionId: string }
      assertInstitutionAccess(auth, institutionId, 'report:read')

      const { days } = parseInput(reportQuerySchema, request.query)
      const data = await collectReportData(institutionId, days)
      const buffer = await buildWorkbook(data)
      const filename = `vivass-relatorio-${data.institution.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .toLowerCase()}.xlsx`

      await recordAudit({
        actorId: auth.user.id,
        institutionId,
        action: 'REPORT_EXPORT_XLSX',
        entity: 'Institution',
        entityId: institutionId,
        metadata: { days },
        ip: request.ip,
      })

      return reply
        .header(
          'content-type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        .header('content-disposition', `attachment; filename="${filename}"`)
        .header('content-length', String(buffer.length))
        .send(buffer)
    },
  )
}
