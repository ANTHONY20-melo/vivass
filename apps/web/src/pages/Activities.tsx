import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarCheck, CheckCircle2, Info, Pencil, Plus } from 'lucide-react'
import type {
  ActivityStatus,
  ActivitySummary,
  BiopsychosocialDimension,
  Paginated,
  ProjectSummary,
  VivassAxis,
} from '@vivass/shared'
import {
  ACTIVITY_STATUS_LABELS,
  AXIS_COLORS,
  AXIS_LABELS,
  DIMENSION_LABELS,
  VIVASS_AXES,
} from '@vivass/shared'
import { ApiError, apiFetch } from '../lib/api'
import { useInstitution } from '../lib/institution'
import { usePermissionChecker } from '../lib/permissions'
import { formatDate, formatNumber } from '../lib/format'
import {
  ActivityStatusSelect,
  AxisSelect,
  DimensionSelect,
} from '../components/selectors'
import {
  Badge,
  EmptyState,
  LoadingBlock,
  Modal,
  PageHeader,
} from '../components/ui'

const PAGE_SIZE = 15

const emptyForm = {
  title: '',
  description: '',
  projectId: '',
  axis: 'VIDA' as VivassAxis,
  dimension: 'BIO' as BiopsychosocialDimension,
  status: 'PLANNED' as ActivityStatus,
  scheduledAt: '',
  participants: '0',
}

export function ActivitiesPage() {
  const { current, loading: institutionLoading } = useInstitution()
  const canManage = usePermissionChecker()('activity:manage')
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [axis, setAxis] = useState('')
  const [status, setStatus] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ActivitySummary | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const query = useQuery({
    queryKey: ['activities', current?.id, page, search, axis, status],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      })
      if (search) params.set('search', search)
      if (axis) params.set('axis', axis)
      if (status) params.set('status', status)
      return apiFetch<Paginated<ActivitySummary>>(
        `/institutions/${current?.id}/activities?${params.toString()}`,
      )
    },
    enabled: Boolean(current),
  })

  const projects = useQuery({
    queryKey: ['projects', current?.id, 'all'],
    queryFn: () =>
      apiFetch<Paginated<ProjectSummary>>(
        `/institutions/${current?.id}/projects?page=1&pageSize=100`,
      ),
    enabled: Boolean(current),
  })

  const save = useMutation({
    mutationFn: (input: typeof emptyForm & { id?: string }) =>
      input.id
        ? apiFetch<ActivitySummary>(
            `/institutions/${current?.id}/activities/${input.id}`,
            { method: 'PATCH', body: JSON.stringify(input) },
          )
        : apiFetch<ActivitySummary>(`/institutions/${current?.id}/activities`, {
            method: 'POST',
            body: JSON.stringify(input),
          }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['activities'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      void queryClient.invalidateQueries({ queryKey: ['axes'] })
      setModalOpen(false)
      setForm(emptyForm)
      setNotice('Atividade salva com sucesso.')
    },
    onError: (error) => {
      setFormError(
        error instanceof ApiError ? error.message : 'Não foi possível salvar a atividade.',
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
        title="Atividades"
        description="Execuções planejadas e realizadas, vinculadas aos projetos e eixos do VIVASS."
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
              Nova atividade
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
            placeholder="Buscar atividade"
            className="input w-full lg:max-w-xs"
            aria-label="Buscar atividade"
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
            <option value="PLANNED">Planejada</option>
            <option value="IN_PROGRESS">Em execução</option>
            <option value="COMPLETED">Realizada</option>
            <option value="CANCELLED">Cancelada</option>
          </select>
          <p className="text-xs text-ink-600 lg:ml-auto">{total} atividade(s)</p>
        </div>

        {query.isLoading ? (
          <LoadingBlock label="Carregando atividades…" />
        ) : items.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={CalendarCheck}
              title="Nenhuma atividade encontrada"
              description="Registre as ações planejadas e realizadas pela equipe."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="bg-sand-50 text-xs tracking-wide text-ink-500 uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Atividade</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Eixo</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Projeto</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Data</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Participantes</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                  {canManage ? (
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Ações</th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-200">
                {items.map((activity) => (
                  <tr key={activity.id} className="hover:bg-sand-50/60">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-ink-900">{activity.title}</p>
                      <p className="text-xs text-ink-400">
                        {DIMENSION_LABELS[activity.dimension].split(' — ')[0]}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2 text-ink-700">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: AXIS_COLORS[activity.axis] }}
                          aria-hidden="true"
                        />
                        {AXIS_LABELS[activity.axis]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-700">{activity.projectName ?? 'Avulsa'}</td>
                    <td className="px-4 py-3 text-ink-600">{formatDate(activity.scheduledAt)}</td>
                    <td className="px-4 py-3 text-right text-ink-700">
                      {formatNumber(activity.participants)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        tone={
                          activity.status === 'COMPLETED'
                            ? 'success'
                            : activity.status === 'IN_PROGRESS'
                              ? 'info'
                              : activity.status === 'CANCELLED'
                                ? 'danger'
                                : 'neutral'
                        }
                      >
                        {ACTIVITY_STATUS_LABELS[activity.status]}
                      </Badge>
                    </td>
                    {canManage ? (
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          className="rounded-lg p-2 text-ink-600 transition hover:bg-sand-100"
                          onClick={() => {
                            setForm({
                              title: activity.title,
                              description: activity.description ?? '',
                              projectId: activity.projectId ?? '',
                              axis: activity.axis,
                              dimension: activity.dimension,
                              status: activity.status,
                              scheduledAt: activity.scheduledAt?.slice(0, 10) ?? '',
                              participants: String(activity.participants),
                            })
                            setFormError(null)
                            setEditing(activity)
                            setModalOpen(true)
                          }}
                          aria-label={`Editar ${activity.title}`}
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </td>
                    ) : null}
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

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar atividade' : 'Nova atividade'}
        description="Atividades registram o que a escola faz, quando e com quanta participação."
      >
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="activity-title" className="label">Título</label>
            <input
              id="activity-title"
              className="input"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              required
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="activity-description" className="label">Descrição</label>
            <textarea
              id="activity-description"
              className="input min-h-20"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </div>
          <div>
            <label htmlFor="activity-project" className="label">Projeto (opcional)</label>
            <select
              id="activity-project"
              className="input"
              value={form.projectId}
              onChange={(event) => setForm({ ...form, projectId: event.target.value })}
            >
              <option value="">Atividade avulsa</option>
              {(projects.data?.items ?? []).map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name} · {AXIS_LABELS[project.axis]}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="activity-axis" className="label">Eixo</label>
              <AxisSelect
                id="activity-axis"
                value={form.axis}
                onChange={(value) => setForm({ ...form, axis: value })}
              />
            </div>
            <div>
              <label htmlFor="activity-dimension" className="label">Dimensão</label>
              <DimensionSelect
                id="activity-dimension"
                value={form.dimension}
                onChange={(value) => setForm({ ...form, dimension: value })}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="activity-status" className="label">Status</label>
              <ActivityStatusSelect
                id="activity-status"
                value={form.status}
                onChange={(value) => setForm({ ...form, status: value })}
              />
            </div>
            <div>
              <label htmlFor="activity-date" className="label">Data</label>
              <input
                id="activity-date"
                type="date"
                className="input"
                value={form.scheduledAt}
                onChange={(event) => setForm({ ...form, scheduledAt: event.target.value })}
              />
            </div>
            <div>
              <label htmlFor="activity-participants" className="label">Participantes</label>
              <input
                id="activity-participants"
                type="number"
                min={0}
                className="input"
                value={form.participants}
                onChange={(event) =>
                  setForm({ ...form, participants: event.target.value })
                }
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

export default ActivitiesPage
