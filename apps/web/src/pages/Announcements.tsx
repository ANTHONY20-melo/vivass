import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Info, Megaphone, Plus } from 'lucide-react'
import type { AnnouncementSummary, ClassSummary } from '@vivass/shared'
import {
  ANNOUNCEMENT_AUDIENCES,
  ANNOUNCEMENT_AUDIENCE_LABELS,
} from '@vivass/shared'
import { ApiError, apiFetch } from '../lib/api'
import { useInstitution } from '../lib/institution'
import { usePermissionChecker } from '../lib/permissions'
import { formatDate, formatDateTime } from '../lib/format'
import {
  Badge,
  EmptyState,
  LoadingBlock,
  Modal,
  PageHeader,
} from '../components/ui'

const emptyForm = {
  title: '',
  body: '',
  audience: 'ALL' as (typeof ANNOUNCEMENT_AUDIENCES)[number],
  classId: '',
  expiresAt: '',
}

export function AnnouncementsPage() {
  const { current, loading: institutionLoading } = useInstitution()
  const canManage = usePermissionChecker()('communication:manage')
  const queryClient = useQueryClient()

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const query = useQuery({
    queryKey: ['announcements', current?.id],
    queryFn: () =>
      apiFetch<AnnouncementSummary[]>(`/institutions/${current?.id}/announcements`),
    enabled: Boolean(current),
  })

  const classes = useQuery({
    queryKey: ['classes', current?.id],
    queryFn: () => apiFetch<ClassSummary[]>(`/institutions/${current?.id}/classes`),
    enabled: Boolean(current),
  })

  const create = useMutation({
    mutationFn: (input: typeof emptyForm) =>
      apiFetch<AnnouncementSummary>(`/institutions/${current?.id}/announcements`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['announcements'] })
      setModalOpen(false)
      setForm(emptyForm)
      setNotice('Comunicado publicado.')
    },
    onError: (error) => {
      setFormError(
        error instanceof ApiError ? error.message : 'Não foi possível publicar o comunicado.',
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
        title="Comunicados"
        description={`Mensagens oficiais para a comunidade de ${current.name}, segmentadas por perfil.`}
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
              Novo comunicado
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
        <LoadingBlock label="Carregando comunicados…" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="Nenhum comunicado publicado"
          description="Publique avisos para toda a comunidade ou por perfil."
        />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {items.map((item) => (
            <li key={item.id} className="card p-5">
              <header className="mb-2 flex items-start justify-between gap-3">
                <h2 className="text-base font-semibold text-forest-950">{item.title}</h2>
                <Badge tone="info">{ANNOUNCEMENT_AUDIENCE_LABELS[item.audience]}</Badge>
              </header>
              <p className="text-sm whitespace-pre-line text-ink-700">{item.body}</p>
              <p className="mt-3 text-xs text-ink-400">
                Publicado em {formatDateTime(item.publishedAt)}
                {item.className ? ` · turma: ${item.className}` : ''}
                {item.expiresAt ? ` · válido até ${formatDate(item.expiresAt)}` : ''}
              </p>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Novo comunicado"
        description="O público é filtrado no portal da família e do estudante."
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
            <label htmlFor="announcement-title" className="label">Título</label>
            <input
              id="announcement-title"
              className="input"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              required
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="announcement-body" className="label">Conteúdo</label>
            <textarea
              id="announcement-body"
              className="input min-h-32"
              value={form.body}
              onChange={(event) => setForm({ ...form, body: event.target.value })}
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="announcement-audience" className="label">Público</label>
              <select
                id="announcement-audience"
                className="input"
                value={form.audience}
                onChange={(event) =>
                  setForm({
                    ...form,
                    audience: event.target.value as (typeof ANNOUNCEMENT_AUDIENCES)[number],
                  })
                }
              >
                {ANNOUNCEMENT_AUDIENCES.map((audience) => (
                  <option key={audience} value={audience}>
                    {ANNOUNCEMENT_AUDIENCE_LABELS[audience]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="announcement-class" className="label">Turma (opcional)</label>
              <select
                id="announcement-class"
                className="input"
                value={form.classId}
                onChange={(event) => setForm({ ...form, classId: event.target.value })}
              >
                <option value="">Toda a instituição</option>
                {(classes.data ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.year})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="announcement-expiry" className="label">Validade (opcional)</label>
            <input
              id="announcement-expiry"
              type="date"
              className="input"
              value={form.expiresAt}
              onChange={(event) => setForm({ ...form, expiresAt: event.target.value })}
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
              {create.isPending ? 'Publicando…' : 'Publicar'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default AnnouncementsPage
