import { useQuery } from '@tanstack/react-query'
import { BookOpen, CalendarDays, ExternalLink, Info, Megaphone } from 'lucide-react'
import type { PortalData } from '@vivass/shared'
import { AXIS_COLORS, AXIS_LABELS } from '@vivass/shared'
import { apiFetch } from '../lib/api'
import { useInstitution } from '../lib/institution'
import { usePermissionChecker } from '../lib/permissions'
import { formatDate, formatDateTime } from '../lib/format'
import { Badge, EmptyState, LoadingBlock, PageHeader } from '../components/ui'

export function PortalPage() {
  const { current, loading: institutionLoading } = useInstitution()
  const hasPortal = usePermissionChecker()('portal:access')

  const query = useQuery({
    queryKey: ['portal', current?.id],
    queryFn: () => apiFetch<PortalData>(`/institutions/${current?.id}/portal`),
    enabled: Boolean(current && hasPortal),
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
  if (!hasPortal) {
    return (
      <EmptyState
        icon={Info}
        title="Portal restrito a famílias e estudantes"
        description="Este espaço reúne comunicados, agenda e materiais da comunidade. Use os módulos da gestão para o restante do trabalho."
      />
    )
  }

  const data = query.data

  return (
    <div>
      <PageHeader
        title={`Portal de ${current.name}`}
        description="Comunicados oficiais, agenda de atividades e materiais de apoio para a comunidade."
      />

      {data?.institution.isDemo ? (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Ambiente de demonstração.</strong> Os dados exibidos são fictícios e servem
          apenas para validar a plataforma.
        </div>
      ) : null}

      {query.isLoading ? (
        <LoadingBlock label="Carregando o portal…" />
      ) : !data ? (
        <EmptyState
          icon={Info}
          title="Portal indisponível"
          description="Não foi possível carregar os dados do portal."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="card p-5">
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-forest-950">
              <Megaphone className="h-5 w-5 text-forest-600" aria-hidden="true" />
              Comunicados
            </h2>
            {data.announcements.length === 0 ? (
              <p className="text-sm text-ink-600">Nenhum comunicado publicado até agora.</p>
            ) : (
              <ul className="space-y-4">
                {data.announcements.map((item) => (
                  <li key={item.id} className="border-l-2 border-leaf-300 pl-3">
                    <p className="text-sm font-semibold text-ink-900">{item.title}</p>
                    <p className="mt-1 text-sm whitespace-pre-line text-ink-700">{item.body}</p>
                    <p className="mt-1 text-xs text-ink-400">
                      {formatDateTime(item.publishedAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-5">
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-forest-950">
              <CalendarDays className="h-5 w-5 text-forest-600" aria-hidden="true" />
              Próximas atividades
            </h2>
            {data.upcomingActivities.length === 0 ? (
              <p className="text-sm text-ink-600">Nenhuma atividade programada.</p>
            ) : (
              <ul className="space-y-3">
                {data.upcomingActivities.map((item) => (
                  <li key={item.id} className="flex items-start gap-3">
                    <span
                      className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: AXIS_COLORS[item.axis] }}
                      aria-hidden="true"
                    />
                    <span>
                      <span className="block text-sm font-medium text-ink-900">
                        {item.title}
                      </span>
                      <span className="block text-xs text-ink-500">
                        {AXIS_LABELS[item.axis]} · {formatDate(item.scheduledAt)}
                        {item.projectName ? ` · ${item.projectName}` : ''}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-5 lg:col-span-2">
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-forest-950">
              <BookOpen className="h-5 w-5 text-forest-600" aria-hidden="true" />
              Materiais da biblioteca
            </h2>
            {data.library.length === 0 ? (
              <p className="text-sm text-ink-600">Nenhum material disponível.</p>
            ) : (
              <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {data.library.map((item) => (
                  <li key={item.id} className="rounded-xl border border-sand-200 p-4">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-ink-900">{item.title}</p>
                      <Badge tone="neutral">{item.category}</Badge>
                    </div>
                    {item.description ? (
                      <p className="text-xs text-ink-600">{item.description}</p>
                    ) : null}
                    {item.content ? (
                      <p className="mt-2 line-clamp-4 text-xs whitespace-pre-line text-ink-600">
                        {item.content}
                      </p>
                    ) : null}
                    {item.url ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-forest-700 hover:underline"
                      >
                        Abrir material
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

export default PortalPage
