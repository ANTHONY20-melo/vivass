import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Info, Scale, Plus } from 'lucide-react'
import type { DataRequestSummary } from '@vivass/shared'
import {
  DATA_REQUEST_STATUSES,
  DATA_REQUEST_STATUS_LABELS,
  DATA_REQUEST_TYPES,
  DATA_REQUEST_TYPE_LABELS,
} from '@vivass/shared'
import { ApiError, apiFetch } from '../lib/api'
import { useInstitution } from '../lib/institution'
import { usePermissionChecker } from '../lib/permissions'
import { formatDateTime } from '../lib/format'
import {
  Badge,
  EmptyState,
  LoadingBlock,
  Modal,
  PageHeader,
} from '../components/ui'

const emptyForm = {
  requesterName: '',
  requesterEmail: '',
  type: 'ACCESS' as (typeof DATA_REQUEST_TYPES)[number],
  details: '',
}

export function RequestsPage() {
  const { current, loading: institutionLoading } = useInstitution()
  const canManage = usePermissionChecker()('request:manage')
  const queryClient = useQueryClient()

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [resolving, setResolving] = useState<DataRequestSummary | null>(null)
  const [resolution, setResolution] = useState('')

  const query = useQuery({
    queryKey: ['requests', current?.id],
    queryFn: () =>
      apiFetch<DataRequestSummary[]>(`/institutions/${current?.id}/requests`),
    enabled: Boolean(current),
  })

  const create = useMutation({
    mutationFn: (input: typeof emptyForm) =>
      apiFetch<DataRequestSummary>(`/institutions/${current?.id}/requests`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['requests'] })
      setModalOpen(false)
      setForm(emptyForm)
      setNotice('Solicitação registrada.')
    },
    onError: (error) => {
      setFormError(
        error instanceof ApiError ? error.message : 'Não foi possível registrar a solicitação.',
      )
    },
  })

  const update = useMutation({
    mutationFn: (input: { id: string; status: string; resolution: string }) =>
      apiFetch<DataRequestSummary>(`/institutions/${current?.id}/requests/${input.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: input.status, resolution: input.resolution }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['requests'] })
      setResolving(null)
      setResolution('')
      setNotice('Solicitação atualizada.')
    },
    onError: (error) => {
      setFormError(
        error instanceof ApiError ? error.message : 'Não foi possível atualizar a solicitação.',
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

  const items = query.data ?? []

  return (
    <div>
      <PageHeader
        title="Solicitações de dados (LGPD)"
        description="Canal de atendimento aos direitos do titular: acesso, correção, exclusão e portabilidade."
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
              Nova solicitação
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
        <LoadingBlock label="Carregando solicitações…" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Scale}
          title="Nenhuma solicitação registrada"
          description="As solicitações dos titulares ficam registradas e auditadas."
        />
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="card p-5">
              <header className="mb-2 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold text-forest-950">
                    {DATA_REQUEST_TYPE_LABELS[item.type]}
                  </h2>
                  <p className="text-xs text-ink-500">
                    {item.requesterName} · {item.requesterEmail} · aberta em{' '}
                    {formatDateTime(item.createdAt)}
                  </p>
                </div>
                <Badge
                  tone={
                    item.status === 'DONE'
                      ? 'success'
                      : item.status === 'REJECTED'
                        ? 'danger'
                        : item.status === 'IN_PROGRESS'
                          ? 'info'
                          : 'warning'
                  }
                >
                  {DATA_REQUEST_STATUS_LABELS[item.status]}
                </Badge>
              </header>
              <p className="text-sm text-ink-700">{item.details}</p>
              {item.resolution ? (
                <p className="mt-2 rounded-xl bg-sand-50 px-3 py-2 text-sm text-ink-700">
                  <strong>Resposta registrada:</strong> {item.resolution}
                </p>
              ) : null}
              {canManage && item.status !== 'DONE' && item.status !== 'REJECTED' ? (
                <button
                  type="button"
                  className="btn-ghost mt-3"
                  onClick={() => {
                    setResolving(item)
                    setResolution('')
                    setFormError(null)
                  }}
                >
                  Atualizar atendimento
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Nova solicitação de titular"
        description="Registre a demanda e acompanhe o atendimento até a resposta formal."
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="request-name" className="label">Nome do titular</label>
              <input
                id="request-name"
                className="input"
                value={form.requesterName}
                onChange={(event) => setForm({ ...form, requesterName: event.target.value })}
                required
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="request-email" className="label">E-mail</label>
              <input
                id="request-email"
                type="email"
                className="input"
                value={form.requesterEmail}
                onChange={(event) =>
                  setForm({ ...form, requesterEmail: event.target.value })
                }
                required
              />
            </div>
          </div>
          <div>
            <label htmlFor="request-type" className="label">Tipo de solicitação</label>
            <select
              id="request-type"
              className="input"
              value={form.type}
              onChange={(event) =>
                setForm({
                  ...form,
                  type: event.target.value as (typeof DATA_REQUEST_TYPES)[number],
                })
              }
            >
              {DATA_REQUEST_TYPES.map((type) => (
                <option key={type} value={type}>
                  {DATA_REQUEST_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="request-details" className="label">Descrição</label>
            <textarea
              id="request-details"
              className="input min-h-24"
              value={form.details}
              onChange={(event) => setForm({ ...form, details: event.target.value })}
              required
            />
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
              {create.isPending ? 'Registrando…' : 'Registrar'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(resolving)}
        onClose={() => setResolving(null)}
        title="Atualizar atendimento"
        description={
          resolving
            ? `${DATA_REQUEST_TYPE_LABELS[resolving.type]} · ${resolving.requesterName}`
            : undefined
        }
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="resolution-status" className="label">Situação</label>
            <select
              id="resolution-status"
              className="input"
              defaultValue="IN_PROGRESS"
            >
              {DATA_REQUEST_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {DATA_REQUEST_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="resolution-text" className="label">
              Resposta ao titular (obrigatória ao encerrar)
            </label>
            <textarea
              id="resolution-text"
              className="input min-h-24"
              value={resolution}
              onChange={(event) => setResolution(event.target.value)}
            />
          </div>
          {formError ? (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
            >
              {formError}
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setResolving(null)}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={update.isPending || !resolving}
              onClick={() => {
                if (!resolving) return
                const select = document.getElementById(
                  'resolution-status',
                ) as HTMLSelectElement | null
                update.mutate({
                  id: resolving.id,
                  status: select?.value ?? 'IN_PROGRESS',
                  resolution,
                })
              }}
            >
              {update.isPending ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default RequestsPage
