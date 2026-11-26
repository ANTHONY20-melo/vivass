import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, FolderKanban, Info, Pencil, Plus } from 'lucide-react'
import type {
  BiopsychosocialDimension,
  Paginated,
  ProjectStatus,
  ProjectSummary,
  VivassAxis,
} from '@vivass/shared'
import {
  AXIS_COLORS,
  AXIS_LABELS,
  DIMENSION_LABELS,
  PROJECT_STATUS_LABELS,
  VIVASS_AXES,
} from '@vivass/shared'
import { ApiError, apiFetch } from '../lib/api'
import { useInstitution } from '../lib/institution'
import { usePermissionChecker } from '../lib/permissions'
import { formatDate } from '../lib/format'
import {
  AxisSelect,
  DimensionSelect,
  ProjectStatusSelect,
} from '../components/selectors'
import {
  Badge,
  EmptyState,
  LoadingBlock,
  Modal,
  PageHeader,
} from '../components/ui'

const PAGE_SIZE = 12

const emptyForm = {
  name: '',
  description: '',
  objective: '',
  axis: 'VIDA' as VivassAxis,
  dimension: 'BIO' as BiopsychosocialDimension,
  status: 'PLANNED' as ProjectStatus,
  startDate: '',
  endDate: '',
}

export function ProjectsPage() {
  const { current, loading: institutionLoading } = useInstitution()
  const canManage = usePermissionChecker()('project:manage')
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [axis, setAxis] = useState('')
  const [status, setStatus] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ProjectSummary | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const query = useQuery({
    queryKey: ['projects', current?.id, page, search, axis, status],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      })
      if (search) params.set('search', search)
      if (axis) params.set('axis', axis)
      if (status) params.set('status', status)
      return apiFetch<Paginated<ProjectSummary>>(
        `/institutions/${current?.id}/projects?${params.toString()}`,
      )
    },
    enabled: Boolean(current),
  })

  const save = useMutation({
    mutationFn: (input: typeof emptyForm & { id?: string }) =>
      input.id
        ? apiFetch<ProjectSummary>(`/institutions/${current?.id}/projects/${input.id}`, {
            method: 'PATCH',
            body: JSON.stringify(input),
          })
        : apiFetch<ProjectSummary>(`/institutions/${current?.id}/projects`, {
            method: 'POST',
            body: JSON.stringify(input),
          }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setModalOpen(false)
      setForm(emptyForm)
      setNotice('Projeto salvo com sucesso.')
    },
    onError: (error) => {
      setFormError(
        error instanceof ApiError ? error.message : 'Não foi possível salvar o projeto.',
      )
    },
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

  const items = query.data?.items ?? []
  const total = query.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)
    save.mutate({ ...form, id: editing?.id })
  }

  return (
    <div>
      <PageHeader
        title="Projetos"
        description={`Ações estruturadas por eixo do VIVASS em ${current.name}.`}
        actions={
          canManage ? (
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setForm(emptyForm)
                setFormError(null)
                setEditing(null)
                setModalOpen(true)
              }}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Novo projeto
            </button>
          ) : null
        }
      />

      {notice ? (
        <div
          role="status"
          className="mb-4 flex items-center gap-2 rounded-xl border border-leaf-200 bg-leaf-100 px-4 py-3 text-sm text-forest-800"
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          {notice}
        </div>
      ) : null}

      <div className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-sand-200 p-4 lg:flex-row lg:items-center">
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder="Buscar projeto"
            className="input w-full lg:max-w-xs"
            aria-label="Buscar projeto"
          />
          <select
            value={axis}
            onChange={(event) => {
              setAxis(event.target.value)
              setPage(1)
            }}
            className="input w-full lg:max-w-[200px]"
            aria-label="Filtrar por eixo"
          >
            <option value="">Todos os eixos</option>
            {VIVASS_AXES.map((item) => (
              <option key={item} value={item}>
                {AXIS_LABELS[item]}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value)
              setPage(1)
            }}
            className="input w-full lg:max-w-[200px]"
            aria-label="Filtrar por status"
          >
            <option value="">Todos os status</option>
            <option value="PLANNED">Planejado</option>
            <option value="ACTIVE">Em andamento</option>
            <option value="COMPLETED">Concluído</option>
            <option value="SUSPENDED">Suspenso</option>
          </select>
          <p className="text-xs text-ink-600 lg:ml-auto">{total} projeto(s)</p>
        </div>

        {query.isLoading ? (
          <LoadingBlock label="Carregando projetos…" />
        ) : items.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={FolderKanban}
              title="Nenhum projeto encontrado"
              description="Crie projetos para organizar atividades por eixo e dimensão."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="bg-sand-50 text-xs tracking-wide text-ink-500 uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Projeto</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Eixo</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Dimensão</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Período</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Execução</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                  {canManage ? (
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Ações</th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-200">
                {items.map((project) => {
                  const completion =
                    project.activityCount === 0
                      ? 0
                      : Math.round((project.completedCount / project.activityCount) * 100)
                  return (
                    <tr key={project.id} className="hover:bg-sand-50/60">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-ink-900">{project.name}</p>
                        {project.description ? (
                          <p className="max-w-md truncate text-xs text-ink-400">
                            {project.description}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2 text-ink-700">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: AXIS_COLORS[project.axis] }}
                            aria-hidden="true"
                          />
                          {AXIS_LABELS[project.axis]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-ink-700">
                        {DIMENSION_LABELS[project.dimension].split(' — ')[0]}
                      </td>
                      <td className="px-4 py-3 text-xs text-ink-600">
                        {formatDate(project.startDate)} → {formatDate(project.endDate)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 overflow-hidden rounded-full bg-sand-100">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${completion}%`,
                                backgroundColor: AXIS_COLORS[project.axis],
                              }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-ink-700">
                            {completion}%
                          </span>
                        </div>
                        <p className="text-xs text-ink-400">
                          {project.completedCount}/{project.activityCount} atividades
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          tone={
                            project.status === 'ACTIVE'
                              ? 'success'
                              : project.status === 'SUSPENDED'
                                ? 'danger'
                                : 'neutral'
                          }
                        >
                          {PROJECT_STATUS_LABELS[project.status]}
                        </Badge>
                      </td>
                      {canManage ? (
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            className="rounded-lg p-2 text-ink-600 transition hover:bg-sand-100"
                            onClick={() => {
                              setForm({
                                name: project.name,
                                description: project.description ?? '',
                                objective: project.objective ?? '',
                                axis: project.axis,
                                dimension: project.dimension,
                                status: project.status,
                                startDate: project.startDate?.slice(0, 10) ?? '',
                                endDate: project.endDate?.slice(0, 10) ?? '',
                              })
                              setFormError(null)
                              setEditing(project)
                              setModalOpen(true)
                            }}
                            aria-label={`Editar ${project.name}`}
                          >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  )
                })}
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

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar projeto' : 'Novo projeto'}
        description="Cada projeto pertence a um eixo e a uma dimensão do VIVASS."
      >
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="project-name" className="label">Nome do projeto</label>
            <input
              id="project-name"
              className="input"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="project-description" className="label">Descrição</label>
            <textarea
              id="project-description"
              className="input min-h-20"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </div>
          <div>
            <label htmlFor="project-objective" className="label">Objetivo</label>
            <textarea
              id="project-objective"
              className="input min-h-20"
              value={form.objective}
              onChange={(event) => setForm({ ...form, objective: event.target.value })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="project-axis" className="label">Eixo</label>
              <AxisSelect
                id="project-axis"
                value={form.axis}
                onChange={(value) => setForm({ ...form, axis: value })}
              />
            </div>
            <div>
              <label htmlFor="project-dimension" className="label">Dimensão</label>
              <DimensionSelect
                id="project-dimension"
                value={form.dimension}
                onChange={(value) => setForm({ ...form, dimension: value })}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="project-status" className="label">Status</label>
              <ProjectStatusSelect
                id="project-status"
                value={form.status}
                onChange={(value) => setForm({ ...form, status: value })}
              />
            </div>
            <div>
              <label htmlFor="project-start" className="label">Início</label>
              <input
                id="project-start"
                type="date"
                className="input"
                value={form.startDate}
                onChange={(event) => setForm({ ...form, startDate: event.target.value })}
              />
            </div>
            <div>
              <label htmlFor="project-end" className="label">Fim</label>
              <input
                id="project-end"
                type="date"
                className="input"
                value={form.endDate}
                onChange={(event) => setForm({ ...form, endDate: event.target.value })}
              />
            </div>
          </div>
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
            <button type="submit" className="btn-primary" disabled={save.isPending}>
              {save.isPending ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default ProjectsPage
