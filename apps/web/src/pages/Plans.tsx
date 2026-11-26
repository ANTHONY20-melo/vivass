import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Flag, Info, Plus, Target } from 'lucide-react'
import type {
  BiopsychosocialDimension,
  PlanSummary,
  ProjectSummary,
  Paginated,
  VivassAxis,
} from '@vivass/shared'
import {
  AXIS_COLORS,
  AXIS_LABELS,
  PLAN_STATUS_LABELS,
  PROJECT_STATUS_LABELS,
} from '@vivass/shared'
import { ApiError, apiFetch } from '../lib/api'
import { useInstitution } from '../lib/institution'
import { usePermissionChecker } from '../lib/permissions'
import { formatDate } from '../lib/format'
import { AxisSelect, DimensionSelect } from '../components/selectors'
import {
  Badge,
  EmptyState,
  LoadingBlock,
  Modal,
  PageHeader,
} from '../components/ui'

const emptyForm = {
  title: '',
  objective: '',
  axis: 'VIDA' as VivassAxis,
  dimension: 'BIO' as BiopsychosocialDimension,
  responsible: '',
  projectId: '',
  startDate: '',
  dueDate: '',
}

export function PlansPage() {
  const { current, loading: institutionLoading } = useInstitution()
  const canManage = usePermissionChecker()('plan:manage')
  const queryClient = useQueryClient()

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [milestone, setMilestone] = useState<{ planId: string; title: string } | null>(null)

  const query = useQuery({
    queryKey: ['plans', current?.id],
    queryFn: () => apiFetch<PlanSummary[]>(`/institutions/${current?.id}/plans`),
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

  const create = useMutation({
    mutationFn: (input: typeof emptyForm) =>
      apiFetch<PlanSummary>(`/institutions/${current?.id}/plans`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['plans'] })
      setModalOpen(false)
      setForm(emptyForm)
      setNotice('Plano de ação criado.')
    },
    onError: (error) => {
      setFormError(
        error instanceof ApiError ? error.message : 'Não foi possível criar o plano.',
      )
    },
  })

  const updateStatus = useMutation({
    mutationFn: (input: { id: string; status: string }) =>
      apiFetch<PlanSummary>(`/institutions/${current?.id}/plans/${input.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: input.status }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['plans'] })
      setNotice('Status do plano atualizado.')
    },
  })

  const addMilestone = useMutation({
    mutationFn: (input: { planId: string; title: string }) =>
      apiFetch(`/institutions/${current?.id}/plans/${input.planId}/milestones`, {
        method: 'POST',
        body: JSON.stringify({ title: input.title }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['plans'] })
      setMilestone(null)
    },
    onError: (error) => {
      setFormError(
        error instanceof ApiError ? error.message : 'Não foi possível adicionar o marco.',
      )
    },
  })

  const toggleMilestone = useMutation({
    mutationFn: (input: { planId: string; milestoneId: string; done: boolean }) =>
      apiFetch(
        `/institutions/${current?.id}/plans/${input.planId}/milestones/${input.milestoneId}`,
        { method: 'PATCH', body: JSON.stringify({ done: input.done }) },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['plans'] })
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

  const plans = query.data ?? []

  return (
    <div>
      <PageHeader
        title="Planos de ação"
        description="Metas, responsáveis e marcos do planejamento VIVASS da instituição."
        actions={
          canManage ? (
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setForm(emptyForm)
                setFormError(null)
                setModalOpen(true)
              }}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Novo plano
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

      {query.isLoading ? (
        <LoadingBlock label="Carregando planos…" />
      ) : plans.length === 0 ? (
        <EmptyState
          icon={Target}
          title="Nenhum plano de ação cadastrado"
          description="Transforme o diagnóstico e os projetos em metas com responsáveis e prazos."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {plans.map((plan) => (
            <article key={plan.id} className="card p-5">
              <header className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="flex items-center gap-2 text-base font-bold text-forest-950">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: AXIS_COLORS[plan.axis] }}
                      aria-hidden="true"
                    />
                    <span className="truncate">{plan.title}</span>
                  </h2>
                  <p className="mt-1 text-xs text-ink-500">
                    {AXIS_LABELS[plan.axis]} · responsável: {plan.responsible}
                    {plan.projectName ? ` · projeto: ${plan.projectName}` : ''}
                  </p>
                </div>
                <Badge
                  tone={
                    plan.status === 'ACTIVE'
                      ? 'success'
                      : plan.status === 'COMPLETED'
                        ? 'info'
                        : plan.status === 'CANCELLED'
                          ? 'danger'
                          : 'neutral'
                  }
                >
                  {PLAN_STATUS_LABELS[plan.status]}
                </Badge>
              </header>

              <p className="text-sm text-ink-700">{plan.objective}</p>

              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between text-xs text-ink-600">
                  <span>Progresso</span>
                  <span className="font-semibold text-forest-800">{plan.progress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-sand-100">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${plan.progress}%`,
                      backgroundColor: AXIS_COLORS[plan.axis],
                    }}
                  />
                </div>
                <p className="mt-1 text-xs text-ink-400">
                  Prazo: {formatDate(plan.dueDate)}
                </p>
              </div>

              <div className="mt-4">
                <h3 className="mb-2 text-xs font-semibold tracking-wide text-ink-500 uppercase">
                  Marcos
                </h3>
                {plan.milestones.length === 0 ? (
                  <p className="text-xs text-ink-500">Nenhum marco definido.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {plan.milestones.map((item) => (
                      <li key={item.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-sand-300 text-forest-700 focus:ring-leaf-300"
                          checked={item.done}
                          disabled={!canManage}
                          onChange={(event) =>
                            toggleMilestone.mutate({
                              planId: plan.id,
                              milestoneId: item.id,
                              done: event.target.checked,
                            })
                          }
                          aria-label={`Marcar marco ${item.title}`}
                        />
                        <span
                          className={`text-sm ${
                            item.done ? 'text-ink-400 line-through' : 'text-ink-700'
                          }`}
                        >
                          {item.title}
                        </span>
                        {item.dueDate ? (
                          <span className="ml-auto text-xs text-ink-400">
                            {formatDate(item.dueDate)}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}

                {canManage ? (
                  <form
                    className="mt-3 flex gap-2"
                    onSubmit={(event) => {
                      event.preventDefault()
                      if (!milestone || milestone.planId !== plan.id) return
                      addMilestone.mutate(milestone)
                    }}
                  >
                    <input
                      className="input"
                      placeholder="Novo marco"
                      value={milestone?.planId === plan.id ? milestone.title : ''}
                      onChange={(event) =>
                        setMilestone({ planId: plan.id, title: event.target.value })
                      }
                      aria-label={`Novo marco para ${plan.title}`}
                    />
                    <button type="submit" className="btn-ghost" disabled={addMilestone.isPending}>
                      <Flag className="h-4 w-4" aria-hidden="true" />
                      Adicionar
                    </button>
                  </form>
                ) : null}
              </div>

              {canManage ? (
                <div className="mt-4 flex items-center gap-2">
                  <label className="text-xs font-medium text-ink-600" htmlFor={`plan-status-${plan.id}`}>
                    Status
                  </label>
                  <select
                    id={`plan-status-${plan.id}`}
                    className="input max-w-44"
                    value={plan.status}
                    onChange={(event) =>
                      updateStatus.mutate({ id: plan.id, status: event.target.value })
                    }
                  >
                    <option value="DRAFT">{PLAN_STATUS_LABELS.DRAFT}</option>
                    <option value="ACTIVE">{PLAN_STATUS_LABELS.ACTIVE}</option>
                    <option value="COMPLETED">{PLAN_STATUS_LABELS.COMPLETED}</option>
                    <option value="CANCELLED">{PLAN_STATUS_LABELS.CANCELLED}</option>
                  </select>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Novo plano de ação"
        description="Planos conectam diagnóstico, eixo e projeto com metas verificáveis."
      >
        <form
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault()
            setFormError(null)
            create.mutate(form)
          }}
          className="space-y-4"
          noValidate
        >
          <div>
            <label htmlFor="plan-title" className="label">Título do plano</label>
            <input
              id="plan-title"
              className="input"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              required
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="plan-objective" className="label">Objetivo</label>
            <textarea
              id="plan-objective"
              className="input min-h-24"
              value={form.objective}
              onChange={(event) => setForm({ ...form, objective: event.target.value })}
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="plan-axis" className="label">Eixo</label>
              <AxisSelect
                id="plan-axis"
                value={form.axis}
                onChange={(value) => setForm({ ...form, axis: value })}
              />
            </div>
            <div>
              <label htmlFor="plan-dimension" className="label">Dimensão</label>
              <DimensionSelect
                id="plan-dimension"
                value={form.dimension}
                onChange={(value) => setForm({ ...form, dimension: value })}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="plan-responsible" className="label">Responsável</label>
              <input
                id="plan-responsible"
                className="input"
                value={form.responsible}
                onChange={(event) => setForm({ ...form, responsible: event.target.value })}
                required
              />
            </div>
            <div>
              <label htmlFor="plan-project" className="label">Projeto vinculado</label>
              <select
                id="plan-project"
                className="input"
                value={form.projectId}
                onChange={(event) => setForm({ ...form, projectId: event.target.value })}
              >
                <option value="">Nenhum</option>
                {(projects.data?.items ?? []).map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name} · {PROJECT_STATUS_LABELS[project.status]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="plan-start" className="label">Início</label>
              <input
                id="plan-start"
                type="date"
                className="input"
                value={form.startDate}
                onChange={(event) => setForm({ ...form, startDate: event.target.value })}
              />
            </div>
            <div>
              <label htmlFor="plan-due" className="label">Prazo</label>
              <input
                id="plan-due"
                type="date"
                className="input"
                value={form.dueDate}
                onChange={(event) => setForm({ ...form, dueDate: event.target.value })}
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
            <button type="submit" className="btn-primary" disabled={create.isPending}>
              {create.isPending ? 'Criando…' : 'Criar plano'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default PlansPage
