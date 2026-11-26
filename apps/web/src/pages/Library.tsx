import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpen, CheckCircle2, ExternalLink, FileText, Info, Plus } from 'lucide-react'
import type { LibraryItemSummary } from '@vivass/shared'
import {
  ANNOUNCEMENT_AUDIENCES,
  ANNOUNCEMENT_AUDIENCE_LABELS,
  LIBRARY_CATEGORIES,
  LIBRARY_CATEGORY_LABELS,
  LIBRARY_KINDS,
  LIBRARY_KIND_LABELS,
} from '@vivass/shared'
import { ApiError, apiFetch } from '../lib/api'
import { useInstitution } from '../lib/institution'
import { usePermissionChecker } from '../lib/permissions'
import { formatDate } from '../lib/format'
import {
  Badge,
  EmptyState,
  LoadingBlock,
  Modal,
  PageHeader,
} from '../components/ui'

const emptyForm = {
  title: '',
  description: '',
  category: 'GERAL' as (typeof LIBRARY_CATEGORIES)[number],
  kind: 'LINK' as (typeof LIBRARY_KINDS)[number],
  url: '',
  content: '',
  audience: 'ALL' as (typeof ANNOUNCEMENT_AUDIENCES)[number],
}

export function LibraryPage() {
  const { current, loading: institutionLoading } = useInstitution()
  const canManage = usePermissionChecker()('library:manage')
  const queryClient = useQueryClient()

  const [category, setCategory] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const query = useQuery({
    queryKey: ['library', current?.id],
    queryFn: () => apiFetch<LibraryItemSummary[]>(`/institutions/${current?.id}/library`),
    enabled: Boolean(current),
  })

  const create = useMutation({
    mutationFn: (input: typeof emptyForm) =>
      apiFetch<LibraryItemSummary>(`/institutions/${current?.id}/library`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['library'] })
      setModalOpen(false)
      setForm(emptyForm)
      setNotice('Item adicionado à biblioteca.')
    },
    onError: (error) => {
      setFormError(
        error instanceof ApiError ? error.message : 'Não foi possível adicionar o item.',
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

  const items = (query.data ?? []).filter(
    (item) => !category || item.category === category,
  )

  return (
    <div>
      <PageHeader
        title="Biblioteca digital"
        description={`Materiais de apoio por eixo, com controle de acesso por perfil.`}
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
              Novo item
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

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
            category === ''
              ? 'bg-forest-800 text-white'
              : 'bg-white text-ink-700 ring-1 ring-sand-300'
          }`}
          onClick={() => setCategory('')}
        >
          Todas
        </button>
        {LIBRARY_CATEGORIES.map((item) => (
          <button
            key={item}
            type="button"
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              category === item
                ? 'bg-forest-800 text-white'
                : 'bg-white text-ink-700 ring-1 ring-sand-300'
            }`}
            onClick={() => setCategory(item)}
          >
            {LIBRARY_CATEGORY_LABELS[item]}
          </button>
        ))}
      </div>

      {query.isLoading ? (
        <LoadingBlock label="Carregando biblioteca…" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Nenhum material disponível"
          description="Adicione links, textos de leitura e arquivos por eixo do VIVASS."
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <li key={item.id} className="card flex flex-col p-5">
              <header className="mb-2 flex items-start justify-between gap-2">
                <h2 className="text-base font-semibold text-forest-950">{item.title}</h2>
                <Badge tone="neutral">{LIBRARY_CATEGORY_LABELS[item.category]}</Badge>
              </header>
              {item.description ? (
                <p className="text-sm text-ink-600">{item.description}</p>
              ) : null}
              {item.kind === 'TEXT' && item.content ? (
                <p className="mt-2 line-clamp-4 text-sm whitespace-pre-line text-ink-700">
                  {item.content}
                </p>
              ) : null}
              <div className="mt-auto flex items-center justify-between gap-2 pt-4">
                <span className="text-xs text-ink-400">
                  {LIBRARY_KIND_LABELS[item.kind]} ·{' '}
                  {ANNOUNCEMENT_AUDIENCE_LABELS[item.audience]}
                </span>
                {item.url ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-forest-700 hover:underline"
                  >
                    Abrir
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-ink-400">
                    <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                    {formatDate(item.createdAt)}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Novo item da biblioteca"
        description="Links, textos de leitura e arquivos ficam organizados por eixo do VIVASS."
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
            <label htmlFor="library-title" className="label">Título</label>
            <input
              id="library-title"
              className="input"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              required
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="library-description" className="label">Descrição</label>
            <input
              id="library-description"
              className="input"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="library-category" className="label">Categoria</label>
              <select
                id="library-category"
                className="input"
                value={form.category}
                onChange={(event) =>
                  setForm({
                    ...form,
                    category: event.target.value as (typeof LIBRARY_CATEGORIES)[number],
                  })
                }
              >
                {LIBRARY_CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {LIBRARY_CATEGORY_LABELS[item]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="library-kind" className="label">Tipo</label>
              <select
                id="library-kind"
                className="input"
                value={form.kind}
                onChange={(event) =>
                  setForm({
                    ...form,
                    kind: event.target.value as (typeof LIBRARY_KINDS)[number],
                  })
                }
              >
                {LIBRARY_KINDS.map((item) => (
                  <option key={item} value={item}>
                    {LIBRARY_KIND_LABELS[item]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="library-url" className="label">URL (links e arquivos)</label>
            <input
              id="library-url"
              className="input"
              value={form.url}
              onChange={(event) => setForm({ ...form, url: event.target.value })}
              placeholder="https://..."
            />
          </div>
          <div>
            <label htmlFor="library-content" className="label">Conteúdo (texto de leitura)</label>
            <textarea
              id="library-content"
              className="input min-h-24"
              value={form.content}
              onChange={(event) => setForm({ ...form, content: event.target.value })}
            />
          </div>
          <div>
            <label htmlFor="library-audience" className="label">Público</label>
            <select
              id="library-audience"
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
              {create.isPending ? 'Adicionando…' : 'Adicionar'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default LibraryPage
