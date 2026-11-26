import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import type { MemberRole } from '@vivass/shared'
import { hashPassword } from '../src/auth/password.js'

const prisma = new PrismaClient()

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.now()
const ago = (days: number) => new Date(NOW - days * DAY)
const ahead = (days: number) => new Date(NOW + days * DAY)

const DEMO_PASSWORD = 'Vivass@2026'

interface PersonSeed {
  name: string
  email: string
  role: MemberRole | 'SUPERADMIN'
}

const PEOPLE: PersonSeed[] = [
  { name: 'Ana Ribeiro', email: 'admin@vivass.demo', role: 'SUPERADMIN' },
  { name: 'Marcos Tavares', email: 'gestor@vivass.demo', role: 'SCHOOL_MANAGER' },
  { name: 'Juliana Prado', email: 'coord@vivass.demo', role: 'COORDINATOR' },
  { name: 'Carlos Menezes', email: 'prof@vivass.demo', role: 'TEACHER' },
  { name: 'Patrícia Lopes', email: 'equipe@vivass.demo', role: 'MULTIDISCIPLINARY' },
  { name: 'Rosa Almeida', email: 'familia@vivass.demo', role: 'FAMILY' },
  { name: 'Lucas Almeida', email: 'aluno@vivass.demo', role: 'STUDENT' },
  { name: 'Eduardo Lima', email: 'gestor2@vivass.demo', role: 'SCHOOL_MANAGER' },
]

async function resetDatabase(): Promise<void> {
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
}

async function main(): Promise<void> {
  await resetDatabase()

  const passwordHash = await hashPassword(DEMO_PASSWORD)

  const school = await prisma.institution.create({
    data: {
      name: 'EMEF Professora Helena Duarte',
      slug: 'emef-professora-helena-duarte',
      kind: 'MUNICIPAL',
      city: 'Campinas',
      state: 'SP',
      isDemo: true,
    },
  })

  const college = await prisma.institution.create({
    data: {
      name: 'Colégio Estadual Vale Verde',
      slug: 'colegio-estadual-vale-verde',
      kind: 'ESTADUAL',
      city: 'Sorocaba',
      state: 'SP',
      isDemo: true,
    },
  })

  const users = new Map<string, { id: string }>()
  for (const person of PEOPLE) {
    const user = await prisma.user.create({
      data: {
        name: person.name,
        email: person.email,
        passwordHash,
        platformRole: person.role === 'SUPERADMIN' ? 'SUPERADMIN' : 'USER',
      },
    })
    users.set(person.email, user)

    if (person.role !== 'SUPERADMIN') {
      await prisma.membership.create({
        data: {
          userId: user.id,
          institutionId: person.email === 'gestor2@vivass.demo' ? college.id : school.id,
          role: person.role,
        },
      })
    }
  }

  await prisma.cycle.createMany({
    data: [
      {
        institutionId: school.id,
        name: 'Ciclo VIVASS 2026',
        startDate: ago(150),
        endDate: ahead(120),
        status: 'ACTIVE',
      },
      {
        institutionId: college.id,
        name: 'Ciclo VIVASS 2026',
        startDate: ago(90),
        endDate: ahead(180),
        status: 'ACTIVE',
      },
    ],
  })

  const classA = await prisma.schoolClass.create({
    data: { institutionId: school.id, name: '6º ano A', year: 2026, shift: 'MANHA' },
  })
  const classB = await prisma.schoolClass.create({
    data: { institutionId: school.id, name: '7º ano B', year: 2026, shift: 'TARDE' },
  })
  const classC = await prisma.schoolClass.create({
    data: { institutionId: school.id, name: '8º ano A', year: 2026, shift: 'MANHA' },
  })
  const classD = await prisma.schoolClass.create({
    data: { institutionId: college.id, name: '1º ano EM', year: 2026, shift: 'MANHA' },
  })

  const studentsA = [
    'Ana Beatriz Souza', 'Bruno Carvalho', 'Camila Nunes', 'Daniel Oliveira',
    'Elisa Martins', 'Felipe Ramos', 'Gabriela Dias', 'Henrique Costa',
    'Isabela Freitas', 'João Pedro Lima', 'Larissa Alves', 'Miguel Santos',
    'Natália Rocha', 'Otávio Pires',
  ]
  const studentsB = [
    'Rafael Gomes', 'Sofia Mendes', 'Théo Barbosa', 'Valentina Cruz',
    'William Teixeira', 'Yasmin Cardoso',
  ]

  await prisma.student.createMany({
    data: studentsA.map((name, index) => ({
      institutionId: school.id,
      classId: [classA.id, classB.id, classC.id][index % 3]!,
      name,
      birthDate: new Date(Date.UTC(2013, (index % 12), 10 + (index % 15))),
      guardianName: `Responsável de ${name.split(' ')[0]}`,
    })),
  })

  await prisma.student.createMany({
    data: studentsB.map((name, index) => ({
      institutionId: college.id,
      classId: classD.id,
      name,
      birthDate: new Date(Date.UTC(2009, (index % 12), 5 + index)),
      guardianName: `Responsável de ${name.split(' ')[0]}`,
    })),
  })

  interface ProjectSeed {
    institutionId: string
    name: string
    description: string
    axis: string
    dimension: string
    status: string
    startDate: Date
    endDate?: Date
    activities: Array<{
      title: string
      day: number
      status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED'
      participants: number
    }>
  }

  const projectSeeds: ProjectSeed[] = [
    {
      institutionId: school.id,
      name: 'Saúde em Movimento',
      description: 'Movimento, alimentação e rotinas saudáveis no cotidiano escolar.',
      axis: 'VIDA',
      dimension: 'BIO',
      status: 'ACTIVE',
      startDate: ago(140),
      activities: [
        { title: 'Circuito de movimento no pátio', day: 95, status: 'COMPLETED', participants: 86 },
        { title: 'Oficina de alimentação saudável', day: 60, status: 'COMPLETED', participants: 74 },
        { title: 'Roda de conversa sobre sono e rotina', day: 22, status: 'COMPLETED', participants: 58 },
        { title: 'Caminhada da família na escola', day: -12, status: 'PLANNED', participants: 0 },
      ],
    },
    {
      institutionId: school.id,
      name: 'Círculo de Valores',
      description: 'Convivência, empatia e cultura de paz com protagonismo estudantil.',
      axis: 'VALORES',
      dimension: 'SOCIAL',
      status: 'ACTIVE',
      startDate: ago(130),
      activities: [
        { title: 'Assembleia de líderes estudantis', day: 80, status: 'COMPLETED', participants: 42 },
        { title: 'Oficina de empatia e convivência', day: 45, status: 'COMPLETED', participants: 67 },
        { title: 'Campanha contra o bullying', day: 8, status: 'COMPLETED', participants: 120 },
        { title: 'Círculo de paz do bimestre', day: -18, status: 'PLANNED', participants: 0 },
      ],
    },
    {
      institutionId: school.id,
      name: 'Oficina de Educação Financeira',
      description: 'Orçamento pessoal, consumo consciente e projetos de vida.',
      axis: 'APRENDIZADO',
      dimension: 'PSICO',
      status: 'PLANNED',
      startDate: ago(10),
      activities: [
        { title: 'Primeiros passos do orçamento pessoal', day: -7, status: 'PLANNED', participants: 0 },
        { title: 'Feira do troco consciente', day: -28, status: 'PLANNED', participants: 0 },
      ],
    },
    {
      institutionId: school.id,
      name: 'Mente Saudável',
      description: 'Escuta ativa, regulação emocional e cuidado com a saúde mental.',
      axis: 'SAUDE',
      dimension: 'PSICO',
      status: 'ACTIVE',
      startDate: ago(100),
      activities: [
        { title: 'Escuta ativa com a equipe multidisciplinar', day: 70, status: 'COMPLETED', participants: 35 },
        { title: 'Oficina de respiração e foco', day: 30, status: 'COMPLETED', participants: 52 },
        { title: 'Palestra sobre saúde mental', day: -5, status: 'PLANNED', participants: 0 },
      ],
    },
    {
      institutionId: school.id,
      name: 'Horta Comunitária',
      description: 'Educação ambiental prática com envolvimento de famílias.',
      axis: 'SUSTENTABILIDADE',
      dimension: 'AMBIENTAL',
      status: 'COMPLETED',
      startDate: ago(200),
      endDate: ago(60),
      activities: [
        { title: 'Mutirão de preparo dos canteiros', day: 150, status: 'COMPLETED', participants: 64 },
        { title: 'Plantio de hortaliças', day: 120, status: 'COMPLETED', participants: 58 },
        { title: 'Colheita e degustação', day: 70, status: 'COMPLETED', participants: 90 },
      ],
    },
    {
      institutionId: school.id,
      name: 'Coleta Seletiva em Ação',
      description: 'Separação de resíduos, reciclagem e uso consciente de recursos.',
      axis: 'SUSTENTABILIDADE',
      dimension: 'AMBIENTAL',
      status: 'ACTIVE',
      startDate: ago(60),
      activities: [
        { title: 'Gincana da coleta seletiva', day: 1, status: 'IN_PROGRESS', participants: 70 },
        { title: 'Dia sem desperdício de água', day: 12, status: 'COMPLETED', participants: 95 },
        { title: 'Blitz da reciclagem', day: -9, status: 'PLANNED', participants: 0 },
      ],
    },
    {
      institutionId: college.id,
      name: 'Vida Ativa',
      description: 'Movimento, sono e alimentação no ensino médio.',
      axis: 'VIDA',
      dimension: 'BIO',
      status: 'ACTIVE',
      startDate: ago(60),
      activities: [
        { title: 'Tour de bicicleta no entorno', day: 55, status: 'COMPLETED', participants: 48 },
        { title: 'Oficina de lanches inteligentes', day: 25, status: 'COMPLETED', participants: 61 },
        { title: 'Desafio de passos da turma', day: -10, status: 'PLANNED', participants: 0 },
      ],
    },
    {
      institutionId: college.id,
      name: 'Paz na Escola',
      description: 'Mediação de conflitos e convivência respeitosa.',
      axis: 'VALORES',
      dimension: 'SOCIAL',
      status: 'ACTIVE',
      startDate: ago(50),
      activities: [
        { title: 'Formação de mediadores de conflito', day: 50, status: 'COMPLETED', participants: 32 },
        { title: 'Roda de conversa sobre respeito', day: -14, status: 'PLANNED', participants: 0 },
      ],
    },
  ]

  let createdProjects = 0
  let createdActivities = 0

  for (const seed of projectSeeds) {
    const project = await prisma.project.create({
      data: {
        institutionId: seed.institutionId,
        name: seed.name,
        description: seed.description,
        axis: seed.axis,
        dimension: seed.dimension,
        status: seed.status,
        startDate: seed.startDate,
        endDate: seed.endDate ?? null,
      },
    })
    createdProjects += 1

    for (const activity of seed.activities) {
      await prisma.activity.create({
        data: {
          institutionId: seed.institutionId,
          projectId: project.id,
          title: activity.title,
          axis: seed.axis,
          dimension: seed.dimension,
          status: activity.status,
          scheduledAt: activity.day >= 0 ? ago(activity.day) : ahead(-activity.day),
          completedAt: activity.status === 'COMPLETED' ? ago(activity.day) : null,
          participants: activity.participants,
        },
      })
      createdActivities += 1
    }
  }

  const [institutionCount, userCount, studentCount] = await Promise.all([
    prisma.institution.count(),
    prisma.user.count(),
    prisma.student.count(),
  ])

  console.log('\nVIVASS — dados de demonstração criados')
  console.log('--------------------------------------------------')
  console.log(`Instituições: ${institutionCount}`)
  console.log(`Usuários: ${userCount}`)
  console.log(`Estudantes: ${studentCount}`)
  console.log(`Projetos: ${createdProjects}`)
  console.log(`Atividades: ${createdActivities}`)
  console.log('--------------------------------------------------')
  console.log('ATENÇÃO: todos os registros são fictícios (isDemo = true).')
  console.log(`Senha única de demonstração: ${DEMO_PASSWORD}`)
  console.log('  admin@vivass.demo    → superadministrador (acesso a todas as escolas)')
  console.log('  gestor@vivass.demo   → gestor escolar (EMEF Helena Duarte)')
  console.log('  gestor2@vivass.demo  → gestor escolar (Colégio Vale Verde)')
  console.log('  coord@vivass.demo    → coordenador VIVASS')
  console.log('  prof@vivass.demo     → professor')
  console.log('  equipe@vivass.demo   → equipe multidisciplinar')
  console.log('  familia@vivass.demo  → família / responsável')
  console.log('  aluno@vivass.demo    → estudante')
  console.log('--------------------------------------------------\n')

  await seedExtraData(school, college, users)
}

async function seedExtraData(
  school: { id: string },
  college: { id: string },
  users: Map<string, { id: string }>,
): Promise<void> {
  const gestorId = users.get('gestor@vivass.demo')!.id
  const coordId = users.get('coord@vivass.demo')!.id
  const profId = users.get('prof@vivass.demo')!.id
  const familiaId = users.get('familia@vivass.demo')!.id
  const alunoId = users.get('aluno@vivass.demo')!.id

  const studentA = await prisma.student.findFirst({
    where: { institutionId: school.id, name: 'Ana Beatriz Souza' },
    select: { id: true },
  })
  const studentB = await prisma.student.findFirst({
    where: { institutionId: school.id, name: 'Bruno Carvalho' },
    select: { id: true },
  })

  if (studentA) {
    await prisma.consent.createMany({
      data: [
        {
          institutionId: school.id,
          studentId: studentA.id,
          type: 'DATA',
          grantedBy: 'Maria Souza',
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        },
        {
          institutionId: school.id,
          studentId: studentA.id,
          type: 'IMAGE',
          grantedBy: 'Maria Souza',
        },
      ],
    })
  }

  if (studentB) {
    await prisma.consent.create({
      data: {
        institutionId: school.id,
        studentId: studentB.id,
        type: 'DATA',
        grantedBy: 'João Carvalho',
      },
    })
  }

  await prisma.dataRequest.createMany({
    data: [
      {
        institutionId: school.id,
        requesterName: 'Maria Souza',
        requesterEmail: 'maria.souza@email.com',
        type: 'ACCESS',
        status: 'DONE',
        details: 'Solicito acesso a todos os dados da minha filha Ana Beatriz Souza.',
        resolution: 'Atendida em 25/11/2026. Dados enviados por e-mail.',
        createdById: gestorId,
      },
      {
        institutionId: school.id,
        requesterName: 'João Carvalho',
        requesterEmail: 'joao.carvalho@email.com',
        type: 'CORRECTION',
        status: 'IN_PROGRESS',
        details: 'Correção do telefone do responsável do estudante Bruno Carvalho.',
        createdById: gestorId,
      },
    ],
  })

  const projectSaude = await prisma.project.findFirst({
    where: { institutionId: school.id, name: 'Mente Saudável' },
    select: { id: true },
  })

  if (projectSaude) {
    await prisma.actionPlan.create({
      data: {
        institutionId: school.id,
        projectId: projectSaude.id,
        title: 'Expansão da escuta ativa',
        objective: 'Ampliar rodas de conversa semanais para todas as turmas do ensino fundamental.',
        axis: 'SAUDE',
        responsible: 'Juliana Prado',
        startDate: ago(30),
        dueDate: ahead(90),
        status: 'ACTIVE',
        progress: 30,
        createdById: coordId,
      },
    })
  }

  await prisma.diagnostic.createMany({
    data: [
      {
        institutionId: school.id,
        title: 'Percepção do cotidiano escolar 2026',
        description: 'Questionário anônimo aplicado a famílias e profissionais no 2º semestre.',
        status: 'OPEN',
        createdById: coordId,
      },
      {
        institutionId: college.id,
        title: 'Clima escolar - 1º bimestre',
        description: 'Diagnóstico rápido de convivência e participação.',
        status: 'CLOSED',
        createdById: coordId,
      },
    ],
  })

  await prisma.announcement.createMany({
    data: [
      {
        institutionId: school.id,
        title: 'Reunião de pais - 3º bimestre',
        body: 'Convidamos todas as famílias para a reunião do dia 15/12 às 18h30 no auditório.',
        audience: 'FAMILIES',
        createdById: gestorId,
        expiresAt: ahead(30),
      },
      {
        institutionId: school.id,
        title: 'Formação continuada - saúde mental',
        body: 'Professores e equipe multidisciplinar: capacitação em 20/11, 8h-12h.',
        audience: 'PROFESSIONALS',
        createdById: coordId,
      },
      {
        institutionId: college.id,
        title: 'Festa de encerramento do ano letivo',
        body: 'Evento aberto a toda a comunidade. Dia 20/12, 16h, quadra coberta.',
        audience: 'ALL',
        createdById: users.get('gestor2@vivass.demo')!.id,
        expiresAt: ahead(40),
      },
    ],
  })

  await prisma.libraryItem.createMany({
    data: [
      {
        institutionId: school.id,
        title: 'Guia de alimentação saudável na escola',
        description: 'Orientações práticas para lancheiras e refeições equilibradas.',
        category: 'VIDA',
        kind: 'TEXT',
        content: '1. Priorize frutas e vegetais.\n2. Evite ultraprocessados.\n3. Inclua fonte de proteína.\n4. Hidrate-se com água.\n5. Planeje a lancheira na véspera.',
        audience: 'FAMILIES',
        createdById: coordId,
      },
      {
        institutionId: school.id,
        title: 'BNCC e o eixo SUSTENTABILIDADE',
        description: 'Artigo sobre integração curricular.',
        category: 'SUSTENTABILIDADE',
        kind: 'LINK',
        url: 'https://exemplo.com/bncc-sustentabilidade',
        audience: 'PROFESSIONALS',
        createdById: profId,
      },
      {
        institutionId: college.id,
        title: 'Protocolo de mediação de conflitos',
        description: 'Passo a passo para mediadores estudantis.',
        category: 'VALORES',
        kind: 'FILE',
        url: 'https://exemplo.com/protocolo-mediacao.pdf',
        audience: 'STUDENTS',
        createdById: profId,
      },
    ],
  })
}

main()
  .catch((error) => {
    console.error('Falha ao popular o banco:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
