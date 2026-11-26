import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, ChevronLeft, ChevronRight, Info } from 'lucide-react'
import type { ActivitySummary, Paginated } from '@vivass/shared'
import { ACTIVITY_STATUS_LABELS, AXIS_COLORS, AXIS_LABELS } from '@vivass/shared'
import { apiFetch } from '../lib/api'
import { useInstitution } from '../lib/institution'
import { formatDate, formatNumber } from '../lib/format'
import { Badge, EmptyState, LoadingBlock, PageHeader } from '../components/ui'

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function CalendarPage() {
  const { current, loading: institutionLoading } = useInstitution()
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  const { from, to, days } = useMemo(() => {
    const start = new Date(Date.UTC(year, month, 1))
    const end = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59))
    return { from: toIso(start), to: toIso(end), days: end.getUTCDate() }
  }, [year, month])

  const query = useQuery({
    queryKey: ['calendar', current?.id, from, to],
    queryFn: () => {
      const params = new URLSearchParams({
        page: '1',
        pageSize: '100',
        from,
        to,
      })
      return apiFetch<Paginated<ActivitySummary>>(
        `/institutions/${current?.id}/activities?${params.toString()}`,
      )
    },
    enabled: Boolean(current),
  })

  if (institutionLoading) return <LoadingBlock label="Carregando instituição…" />
  if (!current) {
    return (
      <EmptyState
        icon={Info}
        title="Nenhuma instituição disponível"
        description="Seu usuário ainda não possui vínculo ativo com uma instituição."
      />
    )
  }

  const activities = query.data?.items ?? []
  const byDay = new Map<string, ActivitySummary[]>()
  for (const activity of activities) {
    if (!activity.scheduledAt) continue
    const key = activity.scheduledAt.slice(0, 10)
    const list = byDay.get(key) ?? []
    list.push(activity)
    byDay.set(key, list)
  }

  const firstWeekday = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7
  const cells: Array<{ key: string; day: number | null; iso: string }> = []
  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push({ key: `empty-${index}`, day: null, iso: '' })
  }
  for (let day = 1; day <= days; day += 1) {
    const iso = toIso(new Date(Date.UTC(year, month, day)))
    cells.push({ key: iso, day, iso })
  }

  const shift = (delta: number) => {
    const date = new Date(Date.UTC(year, month + delta, 1))
    setYear(date.getUTCFullYear())
    setMonth(date.getUTCMonth())
  }

  return (
    <div>
      <PageHeader
        title="Calendário institucional"
        description="Cronograma consolidado das atividades de VIDA, VALORES, APRENDIZADO, SAÚDE e SUSTENTABILIDADE."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-lg border border-sand-300 p-2 text-ink-700 transition hover:bg-sand-100"
              onClick={() => shift(-1)}
              aria-label="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <span className="min-w-40 text-center text-sm font-semibold text-forest-950">
              {MONTH_NAMES[month]} {year}
            </span>
            <button
              type="button"
              className="rounded-lg border border-sand-300 p-2 text-ink-700 transition hover:bg-sand-100"
              onClick={() => shift(1)}
              aria-label="Próximo mês"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        }
      />

      <div className="card p-4">
        <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold tracking-wide text-ink-400 uppercase">
          {WEEKDAYS.map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        {query.isLoading ? (
          <LoadingBlock label="Carregando calendário…" />
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell) => {
              const dayActivities = byDay.get(cell.iso) ?? []
              const isToday = cell.iso === toIso(new Date())
              return (
                <div
                  key={cell.key}
                  className={`min-h-24 rounded-xl border p-1.5 text-xs sm:min-h-28 ${
                    isToday
                      ? 'border-leaf-400 bg-leaf-100/60'
                      : 'border-sand-200 bg-white'
                  }`}
                >
                  {cell.day ? (
                    <>
                      <span
                        className={`block text-right font-semibold ${
                          isToday ? 'text-forest-800' : 'text-ink-500'
                        }`}
                      >
                        {cell.day}
                      </span>
                      <ul className="mt-1 space-y-1">
                        {dayActivities.slice(0, 3).map((activity) => (
                          <li key={activity.id}>
                            <span
                              className="block truncate rounded-md px-1 py-0.5 text-[10px] font-medium text-ink-700"
                              style={{
                                backgroundColor: `${AXIS_COLORS[activity.axis]}1f`,
                              }}
                              title={`${activity.title} · ${AXIS_LABELS[activity.axis]}`}
                            >
                              {activity.title}
                            </span>
                          </li>
                        ))}
                        {dayActivities.length > 3 ? (
                          <li className="px-1 text-[10px] text-ink-400">
                            +{dayActivities.length - 3} outras
                          </li>
                        ) : null}
                      </ul>
                    </>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <section className="mt-6">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-forest-950">
          <CalendarDays className="h-5 w-5 text-forest-600" aria-hidden="true" />
          Agenda de {MONTH_NAMES[month]}
        </h2>
        {activities.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="Nenhuma atividade neste mês"
            description="Planeje atividades ou navegue até outro período."
          />
        ) : (
          <ul className="card divide-y divide-sand-200 overflow-hidden">
            {activities
              .slice()
              .sort(
                (a, b) => {
                  const at = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0
                  const bt = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0
                  return at - bt
                },
              )
              .map((activity) => (
                <li key={activity.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="w-24 shrink-0 text-xs font-semibold text-ink-600">
                    {formatDate(activity.scheduledAt)}
                  </span>
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: AXIS_COLORS[activity.axis] }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink-900">
                      {activity.title}
                    </span>
                    <span className="block text-xs text-ink-400">
                      {AXIS_LABELS[activity.axis]}
                      {activity.projectName ? ` · ${activity.projectName}` : ''}
                    </span>
                  </span>
                  <span className="text-xs text-ink-500">
                    {formatNumber(activity.participants)} participante(s)
                  </span>
                  <Badge
                    tone={
                      activity.status === 'COMPLETED'
                        ? 'success'
                        : activity.status === 'IN_PROGRESS'
                          ? 'info'
                          : 'neutral'
                    }
                  >
                    {ACTIVITY_STATUS_LABELS[activity.status]}
                  </Badge>
                </li>
              ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export default CalendarPage
