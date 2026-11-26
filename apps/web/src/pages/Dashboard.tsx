import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  CalendarCheck,
  FolderKanban,
  GraduationCap,
  HeartHandshake,
  Info,
  Target,
  Users,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ActivityStatus, DashboardData } from '@vivass/shared'
import {
  ACTIVITY_STATUS_LABELS,
  AXIS_COLORS,
  AXIS_LABELS,
  PROJECT_STATUS_LABELS,
} from '@vivass/shared'
import { apiFetch } from '../lib/api'
import { useInstitution } from '../lib/institution'
import { formatDate, formatNumber } from '../lib/format'
import { Badge, EmptyState, LoadingBlock, PageHeader, StatCard, type Tone } from '../components/ui'

const PERIODS = [
  { days: 30, label: '30 dias' },
  { days: 90, label: '90 dias' },
  { days: 180, label: '180 dias' },
  { days: 365, label: '12 meses' },
]

const STATUS_TONES: Record<ActivityStatus, Tone> = {
  COMPLETED: 'success',
  IN_PROGRESS: 'info',
  PLANNED: 'neutral',
  CANCELLED: 'danger',
}

export function DashboardPage() {
  const { current, loading } = useInstitution()
  const [days, setDays] = useState(90)

  const query = useQuery({
    queryKey: ['dashboard', current?.id, days],
    queryFn: () =>
      apiFetch<DashboardData>(`/institutions/${current?.id}/dashboard?days=${days}`),
    enabled: Boolean(current),
  })

  if (loading) return <LoadingBlock label="Carregando instituição…" />

  if (!current) {
    return (
      <EmptyState
        icon={Info}
        title="Nenhuma instituição disponível"
        description="Seu usuário ainda não possui vínculo ativo com uma instituição. Peça ao gestor escolar para cadastrar seu acesso."
      />
    )
  }

  if (query.isLoading) return <LoadingBlock label="Carregando indicadores…" />

  if (query.isError || !query.data) {
    return (
      <EmptyState
        icon={Info}
        title="Não foi possível carregar o painel"
        description="Falha ao consultar os indicadores desta instituição. Tente novamente."
        action={
          <button type="button" className="btn-ghost" onClick={() => query.refetch()}>
            Tentar novamente
          </button>
        }
      />
    )
  }

  const data = query.data
  const { totals } = data

  return (
    <div>
      <PageHeader
        title="Painel da instituição"
        description={`Indicadores de ${data.institution.name} nos últimos ${days} dias.`}
        actions={
          <label className="flex items-center gap-2 text-sm">
            <span className="text-ink-600">Período</span>
            <select
              value={days}
              onChange={(event) => setDays(Number(event.target.value))}
              className="rounded-xl border border-sand-300 bg-white px-3 py-2 text-sm font-medium text-ink-900 focus:border-forest-600 focus:outline-none"
            >
              {PERIODS.map((period) => (
                <option key={period.days} value={period.days}>
                  {period.label}
                </option>
              ))}
            </select>
          </label>
        }
      />

      {data.institution.isDemo ? (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            <strong>Ambiente de demonstração.</strong> Todos os estudantes, profissionais,
            projetos e atividades desta instituição são fictícios e existem apenas para
            validar a plataforma. Nenhum dado real de aluno é exibido.
          </p>
        </div>
      ) : null}

      <section aria-label="Indicadores principais" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Estudantes ativos"
          value={formatNumber(totals.students)}
          hint="Matrículas ativas na instituição"
          icon={GraduationCap}
        />
        <StatCard
          label="Profissionais envolvidos"
          value={formatNumber(totals.professionals)}
          hint={`Famílias com acesso: ${formatNumber(totals.families)}`}
          icon={Users}
        />
        <StatCard
          label="Projetos ativos"
          value={formatNumber(totals.projectsActive)}
          hint="Em execução neste ciclo"
          icon={FolderKanban}
        />
        <StatCard
          label="Atividades realizadas"
          value={formatNumber(totals.activitiesCompleted)}
          hint={`${formatNumber(totals.activitiesTotal)} planejadas no período`}
          icon={CalendarCheck}
        />
        <StatCard
          label="Participação registrada"
          value={formatNumber(totals.participants)}
          hint="Somatório de participantes nas atividades"
          icon={HeartHandshake}
        />
        <StatCard
          label="Execução do planejamento"
          value={`${totals.completionRate}%`}
          hint={`${formatNumber(totals.activitiesPending)} atividades pendentes`}
          icon={Target}
        />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2" aria-label="Gráficos">
        <div className="card p-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-forest-950">Ações por eixo VIVASS</h2>
            <p className="text-xs text-ink-600">Atividades no período, por eixo.</p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byAxis} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e3d6" vertical={false} />
                <XAxis
                  dataKey="axis"
                  tickFormatter={(axis) =>
                    AXIS_LABELS[axis as keyof typeof AXIS_LABELS] ?? String(axis)
                  }
                  tick={{ fontSize: 11, fill: '#4e6259' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#7d8f86' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value) => [formatNumber(Number(value)), 'Atividades']}
                  contentStyle={{ borderRadius: 12, borderColor: '#e7e3d6', fontSize: 12 }}
                />
                <Bar dataKey="total" radius={[8, 8, 0, 0]}>
                  {data.byAxis.map((entry) => (
                    <Cell key={entry.axis} fill={AXIS_COLORS[entry.axis]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-forest-950">Evolução mensal</h2>
            <p className="text-xs text-ink-600">Atividades e realizações nos últimos 6 meses.</p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.monthly} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
                <defs>
                  <linearGradient id="fillTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3fae7f" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#3fae7f" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e3d6" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#4e6259' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#7d8f86' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value) => [formatNumber(Number(value)), 'Atividades']}
                  contentStyle={{ borderRadius: 12, borderColor: '#e7e3d6', fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area
                  type="monotone"
                  dataKey="total"
                  name="Planejadas"
                  stroke="#1f7a5b"
                  fill="url(#fillTotal)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="completed"
                  name="Realizadas"
                  stroke="#8fdbb4"
                  fill="transparent"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2" aria-label="Projetos e atividades">
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-forest-950">Projetos e execução</h2>
              <p className="text-xs text-ink-600">
                Percentual de atividades realizadas por projeto no período.
              </p>
            </div>
            <FolderKanban className="h-5 w-5 text-forest-600" aria-hidden="true" />
          </div>

          {data.projects.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-600">
              Nenhum projeto cadastrado para esta instituição.
            </p>
          ) : (
            <ul className="space-y-4">
              {data.projects.slice(0, 5).map((project) => (
                <li key={project.id}>
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink-900">
                        {project.name}
                      </p>
                      <p className="text-xs text-ink-400">
                        {AXIS_LABELS[project.axis]} · {PROJECT_STATUS_LABELS[project.status]} ·{' '}
                        {project.activities} atividade(s)
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-forest-800">
                      {project.completion}%
                    </span>
                  </div>
                  <div
                    className="mt-2 h-2 overflow-hidden rounded-full bg-sand-100"
                    role="progressbar"
                    aria-valuenow={project.completion}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Execução de ${project.name}`}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${project.completion}%`,
                        backgroundColor: AXIS_COLORS[project.axis],
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-forest-950">Atividades recentes</h2>
              <p className="text-xs text-ink-600">Últimos registros do período selecionado.</p>
            </div>
            <Activity className="h-5 w-5 text-forest-600" aria-hidden="true" />
          </div>

          {data.recentActivities.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-600">
              Nenhuma atividade registrada neste período.
            </p>
          ) : (
            <ul className="divide-y divide-sand-200">
              {data.recentActivities.map((activity) => (
                <li key={activity.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <span
                    className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: AXIS_COLORS[activity.axis] }}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink-900">{activity.title}</p>
                    <p className="text-xs text-ink-400">
                      {AXIS_LABELS[activity.axis]} · {formatDate(activity.scheduledAt)} ·{' '}
                      {formatNumber(activity.participants)} participante(s)
                    </p>
                  </div>
                  <Badge tone={STATUS_TONES[activity.status]}>
                    {ACTIVITY_STATUS_LABELS[activity.status]}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}

export default DashboardPage
