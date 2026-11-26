import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import type { LightMyRequestResponse } from 'fastify'
import { buildApp } from '../src/app.js'
import { prisma } from '../src/db.js'
import { hashPassword } from '../src/auth/password.js'

const PASSWORD = 'SenhaForte@123'

let app: FastifyInstance
let institutionA = ''
let institutionB = ''
let superToken = ''
let managerAToken = ''
let managerBToken = ''
let teacherAToken = ''

function refreshCookie(response: LightMyRequestResponse): string {
  const cookie = response.cookies.find((item) => item.name === 'vivass_rt')
  if (!cookie) throw new Error('Cookie de refresh ausente na resposta.')
  return `${cookie.name}=${cookie.value}`
}

async function login(email: string): Promise<{ token: string; response: LightMyRequestResponse }> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password: PASSWORD },
  })
  expect(response.statusCode).toBe(200)
  const body = response.json() as { accessToken: string }
  return { token: body.accessToken, response }
}

beforeAll(async () => {
  app = await buildApp()

  await prisma.auditLog.deleteMany()
  await prisma.activity.deleteMany()
  await prisma.project.deleteMany()
  await prisma.student.deleteMany()
  await prisma.schoolClass.deleteMany()
  await prisma.cycle.deleteMany()
  await prisma.refreshToken.deleteMany()
  await prisma.membership.deleteMany()
  await prisma.user.deleteMany()
  await prisma.institution.deleteMany()

  const institutionARow = await prisma.institution.create({
    data: {
      name: 'Escola Teste A',
      slug: 'escola-teste-a',
      kind: 'MUNICIPAL',
      city: 'Campinas',
      state: 'SP',
      isDemo: true,
    },
  })
  const institutionBRow = await prisma.institution.create({
    data: {
      name: 'Escola Teste B',
      slug: 'escola-teste-b',
      kind: 'ESTADUAL',
      city: 'Sorocaba',
      state: 'SP',
      isDemo: true,
    },
  })
  institutionA = institutionARow.id
  institutionB = institutionBRow.id

  const passwordHash = await hashPassword(PASSWORD)

  const superadmin = await prisma.user.create({
    data: {
      name: 'Super Admin',
      email: 'super@teste.local',
      passwordHash,
      platformRole: 'SUPERADMIN',
    },
  })

  const managerA = await prisma.user.create({
    data: {
      name: 'Gestora A',
      email: 'gestora.a@teste.local',
      passwordHash,
      platformRole: 'USER',
    },
  })
  await prisma.membership.create({
    data: { userId: managerA.id, institutionId: institutionA, role: 'SCHOOL_MANAGER' },
  })

  const managerB = await prisma.user.create({
    data: {
      name: 'Gestor B',
      email: 'gestor.b@teste.local',
      passwordHash,
      platformRole: 'USER',
    },
  })
  await prisma.membership.create({
    data: { userId: managerB.id, institutionId: institutionB, role: 'SCHOOL_MANAGER' },
  })

  const teacherA = await prisma.user.create({
    data: {
      name: 'Professor A',
      email: 'professor.a@teste.local',
      passwordHash,
      platformRole: 'USER',
    },
  })
  await prisma.membership.create({
    data: { userId: teacherA.id, institutionId: institutionA, role: 'TEACHER' },
  })

  await prisma.student.createMany({
    data: [
      { institutionId: institutionA, name: 'Aluno 1' },
      { institutionId: institutionA, name: 'Aluno 2' },
      { institutionId: institutionA, name: 'Aluno 3' },
      { institutionId: institutionB, name: 'Aluno 4' },
    ],
  })

  const project = await prisma.project.create({
    data: {
      institutionId: institutionA,
      name: 'Projeto de teste',
      axis: 'VIDA',
      dimension: 'BIO',
      status: 'ACTIVE',
    },
  })

  await prisma.activity.createMany({
    data: [
      {
        institutionId: institutionA,
        projectId: project.id,
        title: 'Atividade realizada',
        axis: 'VIDA',
        dimension: 'BIO',
        status: 'COMPLETED',
        scheduledAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        participants: 40,
      },
      {
        institutionId: institutionA,
        projectId: project.id,
        title: 'Atividade planejada',
        axis: 'VALORES',
        dimension: 'SOCIAL',
        status: 'PLANNED',
        scheduledAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        participants: 0,
      },
    ],
  })

  superToken = (await login(superadmin.email)).token
  managerAToken = (await login(managerA.email)).token
  managerBToken = (await login(managerB.email)).token
  teacherAToken = (await login(teacherA.email)).token
})

afterAll(async () => {
  await app.close()
  await prisma.$disconnect()
})

describe('saúde e autenticação', () => {
  it('responde ao health check', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/health' })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ status: 'ok', service: 'vivass-api' })
  })

  it('rejeita senha incorreta sem revelar se o e-mail existe', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'gestora.a@teste.local', password: 'senha-errada-123' },
    })
    expect(response.statusCode).toBe(401)
    expect(response.json().error.message).toBe('E-mail ou senha inválidos.')
  })

  it('autentica e devolve o usuário com vínculos e permissões', async () => {
    const { token } = await login('gestora.a@teste.local')
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.email).toBe('gestora.a@teste.local')
    expect(body.memberships).toHaveLength(1)
    expect(body.memberships[0].permissions).toContain('dashboard:read')
  })

  it('bloqueia rota autenticada sem token', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/institutions' })
    expect(response.statusCode).toBe(401)
  })
})

describe('isolamento entre instituições e RBAC', () => {
  it('lista apenas as instituições vinculadas ao usuário', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/institutions',
      headers: { authorization: `Bearer ${managerAToken}` },
    })
    expect(response.statusCode).toBe(200)
    const body = response.json() as Array<{ id: string }>
    expect(body.map((row) => row.id)).toEqual([institutionA])
  })

  it('nega acesso ao painel de outra instituição', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/institutions/${institutionB}/dashboard`,
      headers: { authorization: `Bearer ${managerAToken}` },
    })
    expect(response.statusCode).toBe(403)
  })

  it('nega listagem de equipe a perfil sem permissão', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/institutions/${institutionA}/members`,
      headers: { authorization: `Bearer ${teacherAToken}` },
    })
    expect(response.statusCode).toBe(403)
  })

  it('nega criação de instituição a gestor escolar', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/institutions',
      headers: { authorization: `Bearer ${managerAToken}` },
      payload: { name: 'Escola Indevida', kind: 'PRIVADA', city: 'Jundiaí', state: 'SP' },
    })
    expect(response.statusCode).toBe(403)
  })

  it('permite criação pelo superadministrador e registra auditoria', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/institutions',
      headers: { authorization: `Bearer ${superToken}` },
      payload: {
        name: 'Escola Criada em Teste',
        kind: 'PRIVADA',
        city: 'Jundiaí',
        state: 'SP',
      },
    })
    expect(response.statusCode).toBe(201)
    const body = response.json()
    expect(body.name).toBe('Escola Criada em Teste')
    expect(body.slug).toBe('escola-criada-em-teste')

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'INSTITUTION_CREATE', entityId: body.id },
    })
    expect(audit).not.toBeNull()
    expect(audit?.actorId).not.toBeNull()
  })
})

describe('painel institucional', () => {
  it('devolve indicadores calculados a partir do banco da instituição', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/institutions/${institutionA}/dashboard?days=90`,
      headers: { authorization: `Bearer ${managerAToken}` },
    })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.totals.students).toBe(3)
    expect(body.totals.activitiesTotal).toBe(2)
    expect(body.totals.activitiesCompleted).toBe(1)
    expect(body.totals.participants).toBe(40)
    expect(body.totals.completionRate).toBe(50)
    expect(body.byAxis).toHaveLength(5)
    expect(body.monthly).toHaveLength(6)
  })

  it('não vaza dados da instituição B no painel de A', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/institutions/${institutionA}/dashboard`,
      headers: { authorization: `Bearer ${managerAToken}` },
    })
    const body = response.json()
    expect(body.totals.students).toBe(3)
    expect(JSON.stringify(body)).not.toContain('Aluno 4')
  })
})

describe('sessão de refresh', () => {
  it('rotaciona o token e detecta reuso', async () => {
    const { response } = await login('gestor.b@teste.local')
    const firstCookie = refreshCookie(response)

    const firstRefresh = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      headers: { cookie: firstCookie },
    })
    expect(firstRefresh.statusCode).toBe(200)
    const rotatedCookie = refreshCookie(firstRefresh)
    expect(rotatedCookie).not.toBe(firstCookie)

    // Reutilizar o token antigo é tratado como roubo de sessão.
    const replay = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      headers: { cookie: firstCookie },
    })
    expect(replay.statusCode).toBe(401)

    const managerB = await prisma.user.findUnique({
      where: { email: 'gestor.b@teste.local' },
    })
    const activeTokens = await prisma.refreshToken.count({
      where: { userId: managerB!.id, revokedAt: null },
    })
    expect(activeTokens).toBe(0)
  })
})
