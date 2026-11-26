import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileDown, FileSpreadsheet, Info, Loader2 } from 'lucide-react'
import type { AxisSummary } from '@vivass/shared'
import { AXIS_COLORS, AXIS_LABELS } from '@vivass/shared'
import { apiDownload, apiFetch } from '../lib/api'
import { useInstitution } from '../lib/institution'
import { usePermissionChecker } from '../lib/permissions'
import { formatNumber } from '../lib/format'
import { EmptyState, LoadingBlock, PageHeader } from '../components/ui'

const PERIODS = [
  { days: 30, label: '30 dias' },
  { days: 90, label: '90 dias' },
  { days: 180, label: '180 dias' },
  { days: 365, label: '12 meses' },
]

export function ReportsPage() {
  const { current, loading: institutionLoading } = useInstitution()
  const canRead = usePermissionChecker()('report:read')
  const [days, setDays] = useState(180)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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
  if (!canRead) {
    return (
      <EmptyState
        icon={Info}
        title="Sem permissão para relatórios"
        description="Seu perfil não permite gerar relatórios institucionais."
      />
    )
  }

  const download = async (format: 'pdf' | 'xlsx') => {
    setDownloading(format)
    setError(null)
    try {
      const safeName = current.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .toLowerCase()
      await apiDownload(
        `/institutions/${current.id}/reports/summary.${format}?days=${days}`,
        `vivass-relatorio-${safeName}.${format}`,
      )
    } catch {
      setError('Não foi possível gerar o arquivo. Tente novamente.')
    } finally {
      setDownloading(null)
    }
  }

  const axes = query.data ?? []

  return (
    <div>
      <PageHeader
        title="Relatórios institucionais"
        description={`Indicadores agregados de ${current.name}, prontos para download.`}
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

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          className="card flex items-center gap-4 p-5 text-left transition hover:border-forest-300"
          onClick={() => download('pdf')}
          disabled={downloading !== null}
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-forest-800 text-white">
            {downloading === 'pdf' ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            ) : (
              <FileDown className="h-5 w-5" aria-hidden="true" />
            )}
          </span>
          <span>
            <span className="block text-base font-semibold text-forest-950">
              Relatório em PDF
            </span>
            <span className="block text-xs text-ink-600">
              Identidade VIVASS, indicadores, eixos, projetos e atividades do período.
            </span>
          </span>
        </button>

        <button
          type="button"
          className="card flex items-center gap-4 p-5 text-left transition hover:border-forest-300"
          onClick={() => download('xlsx')}
          disabled={downloading !== null}
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-leaf-500 text-white">
            {downloading === 'xlsx' ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            ) : (
              <FileSpreadsheet className="h-5 w-5" aria-hidden="true" />
            )}
          </span>
          <span>
            <span className="block text-base font-semibold text-forest-950">
              Planilha Excel
            </span>
            <span className="block text-xs text-ink-600">
              Abas: Resumo, Eixos, Projetos e Atividades — pronto para análise.
            </span>
          </span>
        </button>
      </div>

      {error ? (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      ) : null}

      <section className="card p-5">
        <h2 className="mb-4 text-base font-semibold text-forest-950">
          Prévia do período selecionado
        </h2>
        {query.isLoading ? (
          <LoadingBlock label="Carregando indicadores…" />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {axes.map((axis) => (
              <li key={axis.axis} className="rounded-xl bg-sand-50 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-forest-950">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: AXIS_COLORS[axis.axis] }}
                    aria-hidden="true"
                  />
                  {AXIS_LABELS[axis.axis]}
                </p>
                <p className="mt-2 text-xs text-ink-600">
                  {formatNumber(axis.activities)} atividades ·{' '}
                  {formatNumber(axis.completed)} realizadas ·{' '}
                  {formatNumber(axis.participants)} participantes
                </p>
                <p className="mt-1 text-xs text-ink-400">
                  {formatNumber(axis.projects)} projeto(s) ·{' '}
                  {formatNumber(axis.upcoming)} programada(s)
                </p>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-ink-500">
          Os relatórios contêm apenas dados agregados. Nenhum arquivo individual de
          estudante é gerado ou exportado.
        </p>
      </section>
    </div>
  )
}

export default ReportsPage
