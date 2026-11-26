import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Info, Pencil, Plus, School } from 'lucide-react'
import type { ClassSummary } from '@vivass/shared'
import { SHIFTS, SHIFT_LABELS } from '@vivass/shared'
import { ApiError, apiFetch } from '../lib/api'
import { useInstitution } from '../lib/institution'
import { usePermissionChecker } from '../lib/permissions'
import { EmptyState, LoadingBlock, Modal, PageHeader } from '../components/ui'

const emptyForm = {
  name: '',
  year: new Date().getFullYear(),
  shift: 'MANHA' as (typeof SHIFTS)[number],
}

export function ClassesPage() {
  const { current, loading: institutionLoading } = useInstitution()
  const canManage = usePermissionChecker()('student:manage')
  const queryClient = useQueryClient()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ClassSummary | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const query = useQuery({
    queryKey: ['classes', current?.id],
    queryFn: () => apiFetch<ClassSummary[]>(`/institutions/${current?.id}/classes`),
    enabled: Boolean(current),
  })

  const save = useMutation({
    mutationFn: (input: typeof emptyForm & { id?: string }) =>
      input.id
        ? apiFetch<ClassSummary>(`/institutions/${current?.id}/classes/${input.id}`, {
            method: 'PATCH',
            body: JSON.stringify(input),
          })
        : apiFetch<ClassSummary>(`/institutions/${current?.id}/classes`, {
            method: 'POST',
            body: JSON.stringify(input),
          }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['classes'] })
      void queryClient.invalidateQueries({ queryKey: ['students'] })
      setModalOpen(false)
      setForm(emptyForm)
      setNotice('Turma salva com sucesso.')
    },
    onError: (error) => {
      setFormError(
        error instanceof ApiError ? error.message : 'Não foi possível salvar a turma.',
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

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)
    save.mutate({ ...form, id: editing?.id })
  }

  const items = query.data ?? []

  return (
    <div>
      <PageHeader
        title="Turmas"
        description={`Organização das turmas de ${current.name}.`}
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
              Nova turma
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
        {query.isLoading ? (
          <LoadingBlock label="Carregando turmas…" />
        ) : items.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={School}
              title="Nenhuma turma cadastrada"
              description="Crie as turmas para organizar estudantes e planos de aula."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="bg-sand-50 text-xs tracking-wide text-ink-500 uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Turma</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Ano</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Turno</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Estudantes</th>
                  {canManage ? (
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Ações</th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-200">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-sand-50/60">
                    <td className="px-4 py-3 font-semibold text-ink-900">{item.name}</td>
                    <td className="px-4 py-3 text-ink-700">{item.year}</td>
                    <td className="px-4 py-3 text-ink-700">{SHIFT_LABELS[item.shift]}</td>
                    <td className="px-4 py-3 text-right text-ink-700">{item.students}</td>
                    {canManage ? (
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          className="rounded-lg p-2 text-ink-600 transition hover:bg-sand-100"
                          onClick={() => {
                            setForm({
                              name: item.name,
                              year: item.year,
                              shift: item.shift,
                            })
                            setFormError(null)
                            setEditing(item)
                            setModalOpen(true)
                          }}
                          aria-label={`Editar ${item.name}`}
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
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar turma' : 'Nova turma'}
        description="Turmas organizam estudantes, planos e comunicados segmentados."
      >
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="class-name" className="label">Nome da turma</label>
            <input
              id="class-name"
              className="input"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="6º ano A"
              required
              autoFocus
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="class-year" className="label">Ano</label>
              <input
                id="class-year"
                type="number"
                min={2000}
                max={2100}
                className="input"
                value={form.year}
                onChange={(event) =>
                  setForm({ ...form, year: Number(event.target.value) })
                }
                required
              />
            </div>
            <div>
              <label htmlFor="class-shift" className="label">Turno</label>
              <select
                id="class-shift"
                className="input"
                value={form.shift}
                onChange={(event) =>
                  setForm({
                    ...form,
                    shift: event.target.value as (typeof SHIFTS)[number],
                  })
                }
              >
                {SHIFTS.map((shift) => (
                  <option key={shift} value={shift}>
                    {SHIFT_LABELS[shift]}
                  </option>
                ))}
              </select>
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

export default ClassesPage
