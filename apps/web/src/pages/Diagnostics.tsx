import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BarChart3, CheckCircle2, ClipboardList, Info, Lock, Plus } from 'lucide-react'
import type { DiagnosticResults, DiagnosticSummary } from '@vivass/shared'
import {
  AXIS_COLORS,
  AXIS_LABELS,
  DIAGNOSTIC_QUESTIONS,
  DIMENSION_LABELS,
} from '@vivass/shared'
import { ApiError, apiFetch } from '../lib/api'
import { useInstitution } from '../lib/institution'
import { usePermissionChecker } from '../lib/permissions'
import { formatDate, formatNumber } from '../lib/format'
import {
  Badge,
  EmptyState,
  LoadingBlock,
  Modal,
  PageHeader,
} from '../components/ui'

const SCALE = [
  { value: 1, label: '1 · Não ocorre' },
  { value: 2, label: '2 · Raramente' },
  { value: 3, label: '3 · Às vezes' },
  { value: 4, label: '4 · Frequentemente' },
  { value: 5, label: '5 · Sempre' },
]

export function DiagnosticsPage() {
  const { current, loading: institutionLoading } = useInstitution()
  const canManage = usePermissionChecker()('diagnostic:manage')
  const queryClient = useQueryClient()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ title: '', description: '' })
  const [formError, setFormError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const query = useQuery({
    queryKey: ['diagnostics', current?.id],
    queryFn: () =>
      apiFetch<DiagnosticSummary[]>(`/institutions/${current?.id}/diagnostics`),
    enabled: Boolean(current),
  })

  const results = useQuery({
    queryKey: ['diagnostic-results', current?.id, selectedId],
    queryFn: () =>
      apiFetch<DiagnosticResults>(
        `/institutions/${current?.id}/diagnostics/${selectedId}/results`,
      ),
    enabled: Boolean(current && selectedId),
  })

  const create = useMutation({
    mutationFn: (input: typeof form) =>
      apiFetch<DiagnosticSummary>(`/institutions/${current?.id}/diagnostics`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['diagnostics'] })
      setModalOpen(false)
      setForm({ title: '', description: '' })
      setNotice('Diagnóstico criado e disponível para resposta anônima.')
    },
    onError: (error) => {
      setFormError(
        error instanceof ApiError ? error.message : 'Não foi possível criar o diagnóstico.',
      )
    },
  })

  const submit = useMutation({
    mutationFn: () =>
      apiFetch<{ recorded: number }>(
        `/institutions/${current?.id}/diagnostics/${selectedId}/answers`,
        {
          method: 'POST',
          body: JSON.stringify({
            answers: Object.entries(answers).map(([questionKey, value]) => ({
              questionKey,
              value,
            })),
          }),
        },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['diagnostics'] })
      void queryClient.invalidateQueries({ queryKey: ['diagnostic-results'] })
      setAnswers({})
      setNotice('Respostas registradas de forma anônima.')
    },
    onError: (error) => {
      setFormError(
        error instanceof ApiError ? error.message : 'Não foi possível registrar as respostas.',
      )
    },
  })

  const close = useMutation({
    mutationFn: (id: string) =>
      apiFetch<DiagnosticSummary>(
        `/institutions/${current?.id}/diagnostics/${id}/close`,
        { method: 'PATCH' },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['diagnostics'] })
      void queryClient.invalidateQueries({ queryKey: ['diagnostic-results'] })
      setNotice('Diagnóstico encerrado.')
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

  const diagnostics = query.data ?? []
  const selected = diagnostics.find((item) => item.id === selectedId) ?? null
  const answeredCount = Object.keys(answers).length

  return (
    <div>
      <PageHeader
        title="Diagnóstico de percepção"
        description="Questionário anônimo sobre o cotidiano escolar. Nenhuma resposta é vinculada a estudante ou a servidor."
        actions={
          canManage ? (
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setForm({ title: '', description: '' })
                setFormError(null)
                setModalOpen(true)
              }}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Novo diagnóstico
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

      <div className="mb-5 flex items-start gap-3 rounded-2xl border border-forest-200 bg-leaf-100/60 px-4 py-3 text-sm text-forest-900">
        <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>
          Privacidade por desenho: as respostas são gravadas sem autor, sem turma e sem
          identificação. O relatório mostra apenas médias agregadas por eixo e dimensão.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <div className="card overflow-hidden">
          {query.isLoading ? (
            <LoadingBlock label="Carregando diagnósticos…" />
          ) : diagnostics.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={ClipboardList}
                title="Nenhum diagnóstico"
                description="Crie um diagnóstico para ouvir a comunidade escolar."
              />
            </div>
          ) : (
            <ul className="divide-y divide-sand-200">
              {diagnostics.map((diagnostic) => (
                <li key={diagnostic.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(diagnostic.id)
                      setAnswers({})
                      setFormError(null)
                    }}
                    className={`w-full px-4 py-3 text-left transition hover:bg-sand-50 ${
                      selectedId === diagnostic.id ? 'bg-leaf-100/60' : ''
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-ink-900">
                        {diagnostic.title}
                      </span>
                      <Badge
                        tone={diagnostic.status === 'OPEN' ? 'success' : 'neutral'}
                      >
                        {diagnostic.status === 'OPEN' ? 'Aberto' : 'Encerrado'}
                      </Badge>
                    </span>
                    <span className="mt-1 block text-xs text-ink-500">
                      {formatNumber(diagnostic.responses)} resposta(s) ·{' '}
                      {formatDate(diagnostic.createdAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-4">
          {!selected ? (
            <EmptyState
              icon={BarChart3}
              title="Selecione um diagnóstico"
              description="Escolha um questionário à esquerda para responder ou ver os resultados agregados."
            />
          ) : (
            <>
              <div className="card p-5">
                <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-forest-950">{selected.title}</h2>
                    {selected.description ? (
                      <p className="mt-1 text-sm text-ink-600">{selected.description}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-ink-400">
                      {formatNumber(selected.responses)} resposta(s) registrada(s)
                    </p>
                  </div>
                  {canManage && selected.status === 'OPEN' ? (
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => close.mutate(selected.id)}
                    >
                      Encerrar
                    </button>
                  ) : null}
                </header>

                {selected.status === 'OPEN' ? (
                  <form
                    className="space-y-4"
                    onSubmit={(event: FormEvent<HTMLFormElement>) => {
                      event.preventDefault()
                      setFormError(null)
                      submit.mutate()
                    }}
                  >
                    {DIAGNOSTIC_QUESTIONS.map((question) => (
                      <fieldset key={question.key} className="rounded-xl border border-sand-200 p-3">
                        <legend className="px-1 text-sm font-medium text-ink-800">
                          {question.text}
                        </legend>
                        <p className="mb-2 text-[11px] text-ink-400">
                          {AXIS_LABELS[question.axis]} ·{' '}
                          {DIMENSION_LABELS[question.dimension].split(' — ')[0]}
                        </p>
                        <div className="flex flex-wrap gap-3">
                          {SCALE.map((option) => (
                            <label
                              key={option.value}
                              className="flex items-center gap-1.5 text-xs text-ink-700"
                            >
                              <input
                                type="radio"
                                name={question.key}
                                value={option.value}
                                checked={answers[question.key] === option.value}
                                onChange={() =>
                                  setAnswers({ ...answers, [question.key]: option.value })
                                }
                                className="h-4 w-4 border-sand-300 text-forest-700 focus:ring-leaf-300"
                              />
                              {option.label}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    ))}

                    {formError ? (
                      <div
                        role="alert"
                        className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
                      >
                        {formError}
                      </div>
                    ) : null}

                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={answeredCount === 0 || submit.isPending}
                    >
                      {submit.isPending
                        ? 'Enviando…'
                        : `Enviar respostas anônimas (${answeredCount}/${DIAGNOSTIC_QUESTIONS.length})`}
                    </button>
                  </form>
                ) : (
                  <p className="rounded-xl bg-sand-50 px-4 py-3 text-sm text-ink-600">
                    Este diagnóstico está encerrado e não recebe novas respostas.
                  </p>
                )}
              </div>

              {results.data ? (
                <div className="card p-5">
                  <h3 className="mb-4 text-base font-semibold text-forest-950">
                    Resultados agregados
                  </h3>
                  {results.data.totalAnswers === 0 ? (
                    <p className="text-sm text-ink-600">
                      Ainda não há respostas registradas para este diagnóstico.
                    </p>
                  ) : (
                    <div className="space-y-5">
                      <div>
                        <p className="mb-2 text-xs font-semibold tracking-wide text-ink-500 uppercase">
                          Média por eixo (1 a 5)
                        </p>
                        <ul className="space-y-2">
                          {results.data.byAxis.map((entry) => (
                            <li key={entry.axis} className="flex items-center gap-3">
                              <span className="w-28 shrink-0 text-xs text-ink-700">
                                {AXIS_LABELS[entry.axis]}
                              </span>
                              <div className="h-2 flex-1 overflow-hidden rounded-full bg-sand-100">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${(entry.average / 5) * 100}%`,
                                    backgroundColor: AXIS_COLORS[entry.axis],
                                  }}
                                />
                              </div>
                              <span className="w-14 text-right text-xs font-semibold text-ink-700">
                                {entry.average} ({entry.answers})
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <p className="mb-2 text-xs font-semibold tracking-wide text-ink-500 uppercase">
                          Média por dimensão
                        </p>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                          {results.data.byDimension.map((entry) => (
                            <div key={entry.dimension} className="rounded-xl bg-sand-50 p-3">
                              <p className="text-[11px] font-semibold tracking-wide text-ink-400 uppercase">
                                {DIMENSION_LABELS[entry.dimension].split(' — ')[0]}
                              </p>
                              <p className="mt-1 text-xl font-bold text-forest-950">
                                {entry.average}
                              </p>
                              <p className="text-xs text-ink-500">{entry.answers} respostas</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="mb-2 text-xs font-semibold tracking-wide text-ink-500 uppercase">
                          Distribuição das respostas
                        </p>
                        <div className="flex items-end gap-3">
                          {results.data.distribution.map((entry) => {
                            const max = Math.max(
                              1,
                              ...results.data!.distribution.map((item) => item.count),
                            )
                            return (
                              <div key={entry.value} className="flex flex-1 flex-col items-center">
                                <span className="text-xs font-semibold text-ink-700">
                                  {entry.count}
                                </span>
                                <div
                                  className="mt-1 w-full rounded-t-lg bg-forest-600"
                                  style={{
                                    height: `${Math.max(4, (entry.count / max) * 70)}px`,
                                  }}
                                />
                                <span className="mt-1 text-xs text-ink-500">{entry.value}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Novo diagnóstico"
        description="O questionário padrão do VIVASS será disponibilizado com 10 itens anônimos."
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
            <label htmlFor="diagnostic-title" className="label">Título</label>
            <input
              id="diagnostic-title"
              className="input"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder="Percepção do cotidiano escolar 2026"
              required
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="diagnostic-description" className="label">Descrição</label>
            <textarea
              id="diagnostic-description"
              className="input min-h-20"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="Objetivo do questionário e prazo de resposta."
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
              {create.isPending ? 'Criando…' : 'Criar'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default DiagnosticsPage
