import { useMemo, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, CheckCircle2, Info, Plus, Search } from 'lucide-react'
import {
  INSTITUTION_KINDS,
  INSTITUTION_KIND_LABELS,
  UF_LIST,
  type InstitutionKind,
} from '@vivass/shared'
import { ApiError, apiFetch } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useInstitution } from '../lib/institution'
import { formatDate, formatNumber } from '../lib/format'
import { Badge, EmptyState, Modal, PageHeader } from '../components/ui'

const PAGE_SIZE = 8

const initialForm = {
  name: '',
  kind: 'MUNICIPAL' as InstitutionKind,
  city: '',
  state: 'SP' as (typeof UF_LIST)[number],
  isDemo: false,
}

export function InstitutionsPage() {
  const { user } = useAuth()
  const { institutions, reload, loading } = useInstitution()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(initialForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const isSuperadmin = user?.platformRole === 'SUPERADMIN'

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return institutions
    return institutions.filter((institution) =>
      [institution.name, institution.city, institution.state]
        .join(' ')
        .toLowerCase()
        .includes(term),
    )
  }, [institutions, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const mutation = useMutation({
    mutationFn: (input: typeof initialForm) =>
      apiFetch('/institutions', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['institutions'] })
      setModalOpen(false)
      setForm(initialForm)
      setSuccess('Instituição cadastrada com sucesso.')
      setPage(1)
    },
    onError: (error) => {
      setFormError(
        error instanceof ApiError ? error.message : 'Não foi possível cadastrar a instituição.',
      )
    },
  })

  if (!isSuperadmin) {
    return <Navigate to="/app/painel" replace />
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)
    mutation.mutate(form)
  }

  return (
    <div>
      <PageHeader
        title="Instituições de ensino"
        description="Escolas e redes autorizadas a operar o VIVASS nesta instalação."
        actions={
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setFormError(null)
              setSuccess(null)
              setModalOpen(true)
            }}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nova instituição
          </button>
        }
      />

      {success ? (
        <div
          role="status"
          className="mb-4 flex items-center gap-2 rounded-xl border border-leaf-200 bg-leaf-100 px-4 py-3 text-sm text-forest-800"
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          {success}
        </div>
      ) : null}

      <div className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-sand-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="relative w-full sm:max-w-xs">
            <span className="sr-only">Buscar instituição</span>
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
              placeholder="Buscar por nome, cidade ou UF"
              className="input pl-9"
            />
          </label>
          <p className="text-xs text-ink-600">
            {formatNumber(filtered.length)} instituição(ões) · {formatNumber(institutions.length)} no
            total
          </p>
        </div>

        {loading ? (
          <p className="px-4 py-10 text-center text-sm text-ink-600">Carregando instituições…</p>
        ) : visible.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={Building2}
              title={search ? 'Nenhuma instituição encontrada' : 'Nenhuma instituição cadastrada'}
              description={
                search
                  ? 'Ajuste o termo de busca para encontrar a instituição desejada.'
                  : 'Cadastre a primeira escola para começar a operar o VIVASS.'
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-sand-50 text-xs tracking-wide text-ink-500 uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Instituição</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Rede</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Localidade</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Equipe</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Estudantes</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Projetos</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Criada em</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-200">
                {visible.map((institution) => (
                  <tr key={institution.id} className="hover:bg-sand-50/60">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-ink-900">{institution.name}</p>
                      <p className="text-xs text-ink-400">{institution.slug}</p>
                    </td>
                    <td className="px-4 py-3 text-ink-700">
                      {INSTITUTION_KIND_LABELS[institution.kind]}
                    </td>
                    <td className="px-4 py-3 text-ink-700">
                      {institution.city} · {institution.state}
                    </td>
                    <td className="px-4 py-3 text-right text-ink-700">
                      {formatNumber(institution.counts.members)}
                    </td>
                    <td className="px-4 py-3 text-right text-ink-700">
                      {formatNumber(institution.counts.students)}
                    </td>
                    <td className="px-4 py-3 text-right text-ink-700">
                      {formatNumber(institution.counts.projects)}
                    </td>
                    <td className="px-4 py-3 text-ink-600">{formatDate(institution.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <Badge tone={institution.status === 'ACTIVE' ? 'success' : 'warning'}>
                          {institution.status === 'ACTIVE' ? 'Ativa' : 'Suspensa'}
                        </Badge>
                        {institution.isDemo ? <Badge tone="info">Demonstração</Badge> : null}
                      </div>
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
              Página {currentPage} de {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-lg border border-sand-300 px-3 py-1.5 text-xs font-semibold text-ink-700 disabled:opacity-50"
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                disabled={currentPage === 1}
              >
                Anterior
              </button>
              <button
                type="button"
                className="rounded-lg border border-sand-300 px-3 py-1.5 text-xs font-semibold text-ink-700 disabled:opacity-50"
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                disabled={currentPage === totalPages}
              >
                Próxima
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <p className="mt-4 flex items-start gap-2 text-xs text-ink-500">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Cada instituição é um espaço de dados isolado. Nenhuma consulta cruza informações entre
        escolas, exceto indicadores agregados do superadministrador.
      </p>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Nova instituição"
        description="A escola passa a existir com espaço de dados próprio e isolado."
      >
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="institution-name" className="label">
              Nome da instituição
            </label>
            <input
              id="institution-name"
              className="input"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="EMEF Professora Helena Duarte"
              required
              autoFocus
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="institution-kind" className="label">
                Rede
              </label>
              <select
                id="institution-kind"
                className="input"
                value={form.kind}
                onChange={(event) =>
                  setForm({ ...form, kind: event.target.value as InstitutionKind })
                }
              >
                {INSTITUTION_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {INSTITUTION_KIND_LABELS[kind]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="institution-state" className="label">
                UF
              </label>
              <select
                id="institution-state"
                className="input"
                value={form.state}
                onChange={(event) =>
                  setForm({ ...form, state: event.target.value as (typeof UF_LIST)[number] })
                }
              >
                {UF_LIST.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="institution-city" className="label">
              Cidade
            </label>
            <input
              id="institution-city"
              className="input"
              value={form.city}
              onChange={(event) => setForm({ ...form, city: event.target.value })}
              placeholder="Campinas"
              required
            />
          </div>

          <label className="flex items-start gap-3 rounded-xl border border-sand-200 bg-sand-50 p-3 text-sm text-ink-700">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-sand-300 text-forest-700 focus:ring-leaf-300"
              checked={form.isDemo}
              onChange={(event) => setForm({ ...form, isDemo: event.target.checked })}
            />
            <span>
              Marcar como ambiente de demonstração
              <span className="mt-0.5 block text-xs text-ink-500">
                A interface sinaliza que os dados são fictícios. Use apenas em instâncias de
                avaliação.
              </span>
            </span>
          </label>

          {formError ? (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
            >
              {formError}
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={() => setModalOpen(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={mutation.isPending}>
              {mutation.isPending ? 'Cadastrando…' : 'Cadastrar instituição'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default InstitutionsPage
