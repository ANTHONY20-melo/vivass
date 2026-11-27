import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { Info, Radar, ArrowLeft } from 'lucide-react'
import type { AxisSummary } from '@vivass/shared'
import {
  AXIS_COLORS,
  AXIS_LABELS,
  AXIS_TAGLINES,
  DIMENSION_LABELS,
  VIVASS_AXES,
} from '@vivass/shared'
import { apiFetch } from '../lib/api'
import { useInstitution } from '../lib/institution'
import { formatNumber } from '../lib/format'
import { EmptyState, LoadingBlock, PageHeader } from '../components/ui'
import { NavLink } from 'react-router-dom'

export function AxesPage() {
  const { current, loading: institutionLoading } = useInstitution()
  const [searchParams] = useSearchParams()
  const axisFilter = searchParams.get('axis')

  const query = useQuery({
    queryKey: ['axes', current?.id],
    queryFn: () => apiFetch<AxisSummary[]>(`/institutions/${current?.id}/axes`),
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

  const axes = query.data ?? []
  const filteredAxes = axisFilter ? axes.filter((a) => a.axis === axisFilter) : axes
  const selectedAxis = axisFilter ? axes.find((a) => a.axis === axisFilter) : null

  const showBackLink = Boolean(axisFilter)

  return (
    <div>
      {showBackLink && (
        <NavLink
          to="/app/eixos"
          className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-forest-700 hover:text-forest-900"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Voltar aos eixos
        </NavLink>
      )}

      <PageHeader
        title={showBackLink ? AXIS_LABELS[axisFilter as keyof typeof AXIS_LABELS] : 'Eixos do VIVASS'}
        description={showBackLink
          ? AXIS_TAGLINES[axisFilter as keyof typeof AXIS_TAGLINES]
          : `Como as ações de ${current.name} se distribuem entre vida, valores, aprendizado, saúde e sustentabilidade.`}
      />

      <div className="mb-5 flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>
          Esta leitura cruza <strong>ações planejadas e realizadas</strong> por eixo e por
          dimensão biopsicossocial. Não há pontuação, ranking ou diagnóstico individual de
          estudante: o VIVASS mostra o que a escola fez, não o que o estudante é.
        </p>
      </div>

      {query.isLoading ? (
        <LoadingBlock label="Carregando eixos…" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filteredAxes.map((axis) => {
            const color = AXIS_COLORS[axis.axis]
            const max = Math.max(1, ...axis.byDimension.map((item) => item.activities))
            return (
              <article key={axis.axis} className="card p-5">
                <header className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="flex items-center gap-2 text-lg font-bold text-forest-950">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: color }}
                        aria-hidden="true"
                      />
                      {AXIS_LABELS[axis.axis]}
                    </h2>
                    <p className="mt-0.5 text-xs text-ink-600">{AXIS_TAGLINES[axis.axis]}</p>
                  </div>
                  <Radar className="h-5 w-5 text-ink-400" aria-hidden="true" />
                </header>

                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl bg-sand-50 p-3">
                    <dt className="text-[11px] font-semibold tracking-wide text-ink-400 uppercase">
                      Projetos
                    </dt>
                    <dd className="mt-1 text-xl font-bold text-forest-950">{axis.projects}</dd>
                  </div>
                  <div className="rounded-xl bg-sand-50 p-3">
                    <dt className="text-[11px] font-semibold tracking-wide text-ink-400 uppercase">
                      Atividades
                    </dt>
                    <dd className="mt-1 text-xl font-bold text-forest-950">{axis.activities}</dd>
                  </div>
                  <div className="rounded-xl bg-sand-50 p-3">
                    <dt className="text-[11px] font-semibold tracking-wide text-ink-400 uppercase">
                      Realizadas
                    </dt>
                    <dd className="mt-1 text-xl font-bold text-forest-950">{axis.completed}</dd>
                  </div>
                  <div className="rounded-xl bg-sand-50 p-3">
                    <dt className="text-[11px] font-semibold tracking-wide text-ink-400 uppercase">
                      Participantes
                    </dt>
                    <dd className="mt-1 text-xl font-bold text-forest-950">
                      {formatNumber(axis.participants)}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 space-y-2">
                  {axis.byDimension.map((item) => (
                    <div key={item.dimension} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 text-xs text-ink-600">
                        {DIMENSION_LABELS[item.dimension].split(' — ')[0]}
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-sand-100">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.round((item.activities / max) * 100)}%`,
                            backgroundColor: color,
                          }}
                        />
                      </div>
                      <span className="w-8 text-right text-xs font-semibold text-ink-700">
                        {item.activities}
                      </span>
                    </div>
                  ))}
                </div>

                <p className="mt-4 text-xs text-ink-500">
                  {axis.upcoming} atividade(s) programada(s) para as próximas semanas.
                </p>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default AxesPage
