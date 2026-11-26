import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { History, Info, Search } from 'lucide-react'
import type { AuditEntrySummary } from '@vivass/shared'
import { apiFetch } from '../lib/api'
import { useInstitution } from '../lib/institution'
import { usePermissionChecker } from '../lib/permissions'
import { formatDateTime } from '../lib/format'
import { Badge, EmptyState, LoadingBlock, PageHeader } from '../components/ui'

const PAGE_SIZE = 25

export function AuditPage() {
  const { current, loading: institutionLoading } = useInstitution()
  const canRead = usePermissionChecker()('audit:read')
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  const query = useQuery({
    queryKey: ['audit', current?.id, page, search],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      })
      if (search) params.set('search', search)
      return apiFetch<{
        items: AuditEntrySummary[]
        total: number
        page: number
        pageSize: number
      }>(`/institutions/${current?.id}/audit?${params.toString()}`)
    },
    enabled: Boolean(current && canRead),
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
        title="Sem permissão para auditoria"
        description="Seu perfil não permite consultar o registro de auditoria."
      />
    )
  }

  const items = query.data?.items ?? []
  const total = query.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div>
      <PageHeader
        title="Auditoria"
        description="Registro das ações sensíveis realizadas na instituição, com autor, data e endereço de origem."
      />

      <div className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-sand-200 p-4 sm:flex-row sm:items-center">
          <label className="relative w-full sm:max-w-xs">
            <span className="sr-only">Buscar por ação</span>
            <Search
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              placeholder="Buscar ação (ex.: STUDENT_)"
              className="input pl-9"
            />
          </label>
          <p className="text-xs text-ink-600 sm:ml-auto">{total} registro(s)</p>
        </div>

        {query.isLoading ? (
          <LoadingBlock label="Carregando auditoria…" />
        ) : items.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={History}
              title="Nenhum registro encontrado"
              description="As ações realizadas pela equipe aparecem aqui."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-sand-50 text-xs tracking-wide text-ink-500 uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Ação</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Entidade</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Autor</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Data</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Origem</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-200">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-sand-50/60">
                    <td className="px-4 py-3">
                      <Badge tone="neutral">{item.action}</Badge>
                    </td>
                    <td className="px-4 py-3 text-ink-700">{item.entity}</td>
                    <td className="px-4 py-3 text-ink-700">{item.actorName ?? 'Sistema'}</td>
                    <td className="px-4 py-3 text-xs text-ink-600">
                      {formatDateTime(item.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-600">{item.ip ?? '—'}</td>
                    <td className="max-w-[260px] px-4 py-3 text-xs text-ink-500">
                      <span className="block truncate">
                        {item.metadata ? JSON.stringify(item.metadata) : '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-sand-200 px-4 py-3">
            <p className="text-xs text-ink-600">
              Página {page} de {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-lg border border-sand-300 px-3 py-1.5 text-xs font-semibold text-ink-700 disabled:opacity-50"
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                disabled={page === 1}
              >
                Anterior
              </button>
              <button
                type="button"
                className="rounded-lg border border-sand-300 px-3 py-1.5 text-xs font-semibold text-ink-700 disabled:opacity-50"
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                disabled={page === totalPages}
              >
                Próxima
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default AuditPage
