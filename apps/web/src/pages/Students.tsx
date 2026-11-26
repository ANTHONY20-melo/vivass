import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2,
  Download,
  FileUp,
  Info,
  Pencil,
  ShieldCheck,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react'
import type {
  ClassSummary,
  ConsentSummary,
  ImportStudentsResult,
  StudentSummary,
} from '@vivass/shared'
import {
  CONSENT_TYPES,
  CONSENT_TYPE_LABELS,
  STUDENT_STATUS_LABELS,
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

const PAGE_SIZE = 12

const emptyForm = {
  name: '',
  birthDate: '',
  guardianName: '',
  guardianPhone: '',
  guardianEmail: '',
  classId: '',
  notes: '',
}

export function StudentsPage() {
  const { current, loading: institutionLoading } = useInstitution()
  const canManage = usePermissionChecker()('student:manage')
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [classId, setClassId] = useState('')
  const [editing, setEditing] = useState<StudentSummary | null>(null)
  const [studentModalOpen, setStudentModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [consentTarget, setConsentTarget] = useState<StudentSummary | null>(null)
  const [consentForm, setConsentForm] = useState({
    type: 'DATA' as (typeof CONSENT_TYPES)[number],
    grantedBy: '',
    expiresAt: '',
  })
  const [importOpen, setImportOpen] = useState(false)
  const [csv, setCsv] = useState('')
  const [importResult, setImportResult] = useState<ImportStudentsResult | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const query = useQuery({
    queryKey: ['students', current?.id, page, search, status, classId],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      })
      if (search) params.set('search', search)
      if (status) params.set('status', status)
      if (classId) params.set('classId', classId)
      return apiFetch<{
        items: StudentSummary[]
        total: number
        page: number
        pageSize: number
      }>(`/institutions/${current?.id}/students?${params.toString()}`)
    },
    enabled: Boolean(current),
  })

  const classes = useQuery({
    queryKey: ['classes', current?.id],
    queryFn: () => apiFetch<ClassSummary[]>(`/institutions/${current?.id}/classes`),
    enabled: Boolean(current),
  })

  const save = useMutation({
    mutationFn: (input: typeof emptyForm & { id?: string }) =>
      input.id
        ? apiFetch<StudentSummary>(`/institutions/${current?.id}/students/${input.id}`, {
            method: 'PATCH',
            body: JSON.stringify(input),
          })
        : apiFetch<StudentSummary>(`/institutions/${current?.id}/students`, {
            method: 'POST',
            body: JSON.stringify(input),
          }),
            onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['students'] })
      setStudentModalOpen(false)
      setForm(emptyForm)
      setNotice('Estudante salvo com sucesso.')
    },
    onError: (error) => {
      setFormError(
        error instanceof ApiError ? error.message : 'Não foi possível salvar o estudante.',
      )
    },
  })

  const deactivate = useMutation({
    mutationFn: (id: string) =>
      apiFetch<StudentSummary>(`/institutions/${current?.id}/students/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['students'] })
      setNotice('Estudante marcado como inativo. O histórico foi preservado.')
    },
    onError: (error) => {
      setNotice(
        error instanceof ApiError ? error.message : 'Não foi possível alterar o estudante.',
      )
    },
  })

  const consent = useMutation({
    mutationFn: (input: typeof consentForm & { studentId: string }) =>
      apiFetch<ConsentSummary>(
        `/institutions/${current?.id}/students/${input.studentId}/consents`,
        { method: 'POST', body: JSON.stringify(input) },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['students'] })
      setConsentForm({ type: 'DATA', grantedBy: '', expiresAt: '' })
      setNotice('Consentimento registrado.')
    },
    onError: (error) => {
      setFormError(
        error instanceof ApiError ? error.message : 'Não foi possível registrar o consentimento.',
      )
    },
  })

  const revokeConsent = useMutation({
    mutationFn: (consentId: string) =>
      apiFetch<ConsentSummary>(
        `/institutions/${current?.id}/students/${consentTarget?.id}/consents/${consentId}/revoke`,
        { method: 'POST' },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['students'] })
      setNotice('Consentimento revogado.')
    },
  })

  const importCsv = useMutation({
    mutationFn: () =>
      apiFetch<ImportStudentsResult>(`/institutions/${current?.id}/students/import`, {
        method: 'POST',
        body: JSON.stringify({ csv }),
      }),
    onSuccess: (result) => {
      setImportResult(result)
      void queryClient.invalidateQueries({ queryKey: ['students'] })
    },
    onError: (error) => {
      setImportResult({
        created: 0,
        skipped: 0,
        errors: [
          {
            line: 0,
            message:
              error instanceof ApiError ? error.message : 'Falha ao importar o arquivo.',
          },
        ],
      })
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

  const openCreate = () => {
    setForm(emptyForm)
    setFormError(null)
    setEditing(null)
    setStudentModalOpen(true)
  }

  const openEdit = (student: StudentSummary) => {
    setForm({
      name: student.name,
      birthDate: student.birthDate ? student.birthDate.slice(0, 10) : '',
      guardianName: student.guardianName ?? '',
      guardianPhone: student.guardianPhone ?? '',
      guardianEmail: student.guardianEmail ?? '',
      classId: student.classId ?? '',
      notes: student.notes ?? '',
    })
    setFormError(null)
    setEditing(student)
    setStudentModalOpen(true)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)
    save.mutate({ ...form, id: editing?.id })
  }

  return (
    <div>
      <PageHeader
        title="Estudantes"
        description={`Matrículas e consentimentos de ${current.name}. Dados sensíveis são restritos ao perfil autorizado.`}
        actions={
          canManage ? (
            <>
              <button type="button" className="btn-ghost" onClick={() => setImportOpen(true)}>
                <FileUp className="h-4 w-4" aria-hidden="true" />
                Importar CSV
              </button>
              <button type="button" className="btn-primary" onClick={openCreate}>
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                Novo estudante
              </button>
            </>
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
            placeholder="Buscar por nome do estudante ou responsável"
            className="input w-full lg:max-w-xs"
            aria-label="Buscar estudante"
          />
          <select
            value={classId}
            onChange={(event) => {
              setClassId(event.target.value)
              setPage(1)
            }}
            className="input w-full lg:max-w-[220px]"
            aria-label="Filtrar por turma"
          >
            <option value="">Todas as turmas</option>
            {(classes.data ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.year})
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value)
              setPage(1)
            }}
            className="input w-full lg:max-w-[180px]"
            aria-label="Filtrar por status"
          >
            <option value="">Ativos e inativos</option>
            <option value="ACTIVE">Somente ativos</option>
            <option value="INACTIVE">Somente inativos</option>
          </select>
          <p className="text-xs text-ink-600 lg:ml-auto">{total} estudante(s)</p>
        </div>

        {query.isLoading ? (
          <LoadingBlock label="Carregando estudantes…" />
        ) : items.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={Users}
              title="Nenhum estudante encontrado"
              description={
                search || status || classId
                  ? 'Ajuste os filtros para localizar estudantes.'
                  : 'Cadastre estudantes individualmente ou importe uma planilha CSV.'
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="bg-sand-50 text-xs tracking-wide text-ink-500 uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Estudante</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Turma</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Responsável</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Nascimento</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Consentimentos</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                  {canManage ? (
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Ações</th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-200">
                {items.map((student) => (
                  <tr key={student.id} className="hover:bg-sand-50/60">
                    <td className="px-4 py-3 font-semibold text-ink-900">{student.name}</td>
                    <td className="px-4 py-3 text-ink-700">{student.className ?? 'Sem turma'}</td>
                    <td className="px-4 py-3 text-ink-700">
                      {student.guardianName ?? '—'}
                      {student.guardianPhone ? (
                        <span className="block text-xs text-ink-400">{student.guardianPhone}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-ink-600">{formatDate(student.birthDate)}</td>
                    <td className="px-4 py-3">
                      <span className="text-ink-700">{student.consents.length}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={student.status === 'ACTIVE' ? 'success' : 'warning'}>
                        {STUDENT_STATUS_LABELS[student.status]}
                      </Badge>
                    </td>
                    {canManage ? (
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            className="rounded-lg p-2 text-ink-600 transition hover:bg-sand-100"
                            onClick={() => {
                              setConsentTarget(student)
                              setFormError(null)
                            }}
                            aria-label={`Consentimentos de ${student.name}`}
                            title="Consentimentos"
                          >
                            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="rounded-lg p-2 text-ink-600 transition hover:bg-sand-100"
                            onClick={() => openEdit(student)}
                            aria-label={`Editar ${student.name}`}
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </button>
                          {student.status === 'ACTIVE' ? (
                            <button
                              type="button"
                              className="rounded-lg p-2 text-red-600 transition hover:bg-red-50"
                              onClick={() => deactivate.mutate(student.id)}
                              aria-label={`Desativar ${student.name}`}
                              title="Desativar"
                            >
                              <XCircle className="h-4 w-4" aria-hidden="true" />
                            </button>
                          ) : null}
                        </div>
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
        open={studentModalOpen}
        onClose={() => setStudentModalOpen(false)}
        title={editing?.id ? 'Editar estudante' : 'Novo estudante'}
        description="Dados mínimos para gestão escolar. Não registre diagnóstico ou pontuação."
      >
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="student-name" className="label">Nome completo</label>
            <input
              id="student-name"
              className="input"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
              autoFocus
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="student-birth" className="label">Data de nascimento</label>
              <input
                id="student-birth"
                type="date"
                className="input"
                value={form.birthDate}
                onChange={(event) => setForm({ ...form, birthDate: event.target.value })}
              />
            </div>
            <div>
              <label htmlFor="student-class" className="label">Turma</label>
              <select
                id="student-class"
                className="input"
                value={form.classId}
                onChange={(event) => setForm({ ...form, classId: event.target.value })}
              >
                <option value="">Sem turma</option>
                {(classes.data ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.year})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="student-guardian" className="label">Responsável</label>
              <input
                id="student-guardian"
                className="input"
                value={form.guardianName}
                onChange={(event) => setForm({ ...form, guardianName: event.target.value })}
              />
            </div>
            <div>
              <label htmlFor="student-phone" className="label">Telefone do responsável</label>
              <input
                id="student-phone"
                className="input"
                value={form.guardianPhone}
                onChange={(event) => setForm({ ...form, guardianPhone: event.target.value })}
                placeholder="(19) 99999-0000"
              />
            </div>
          </div>

          <div>
            <label htmlFor="student-email" className="label">E-mail do responsável</label>
            <input
              id="student-email"
              type="email"
              className="input"
              value={form.guardianEmail}
              onChange={(event) => setForm({ ...form, guardianEmail: event.target.value })}
            />
          </div>

          <div>
            <label htmlFor="student-notes" className="label">Observações administrativas</label>
            <textarea
              id="student-notes"
              className="input min-h-24"
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              placeholder="Restrições de registro, contacts emergenciais, etc."
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
            <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={save.isPending}>
              {save.isPending ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(consentTarget)}
        onClose={() => setConsentTarget(null)}
        title="Consentimentos e termos"
        description={
          consentTarget
            ? `Registro de autorizações de ${consentTarget.name}.`
            : undefined
        }
      >
        <div className="space-y-5">
          <ul className="space-y-2">
            {(consentTarget?.consents ?? []).length === 0 ? (
              <li className="rounded-xl border border-dashed border-sand-300 px-4 py-6 text-center text-sm text-ink-600">
                Nenhum consentimento registrado.
              </li>
            ) : (
              (consentTarget?.consents ?? []).map((item) => (
                <li
                  key={item.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-sand-200 px-3 py-2.5"
                >
                  <div>
                    <p className="text-sm font-semibold text-ink-900">
                      {CONSENT_TYPE_LABELS[item.type]}
                    </p>
                    <p className="text-xs text-ink-600">
                      Concedido por {item.grantedBy} em {formatDateTime(item.grantedAt)}
                      {item.expiresAt ? ` · valida até ${formatDate(item.expiresAt)}` : ''}
                    </p>
                    <p className="text-xs text-ink-400">Versão do termo: {item.documentVersion}</p>
                  </div>
                  {item.revokedAt ? (
                    <Badge tone="danger">Revogado</Badge>
                  ) : canManage ? (
                    <button
                      type="button"
                      className="rounded-lg border border-sand-300 px-2 py-1 text-xs font-semibold text-red-700"
                      onClick={() => revokeConsent.mutate(item.id)}
                    >
                      Revogar
                    </button>
                  ) : (
                    <Badge tone="success">Ativo</Badge>
                  )}
                </li>
              ))
            )}
          </ul>

          {canManage ? (
            <form
              className="space-y-3 rounded-xl bg-sand-50 p-4"
              onSubmit={(event) => {
                event.preventDefault()
                if (!consentTarget) return
                consent.mutate({ ...consentForm, studentId: consentTarget.id })
              }}
            >
              <div>
                <label htmlFor="consent-type" className="label">Tipo</label>
                <select
                  id="consent-type"
                  className="input"
                  value={consentForm.type}
                  onChange={(event) =>
                    setConsentForm({
                      ...consentForm,
                      type: event.target.value as (typeof CONSENT_TYPES)[number],
                    })
                  }
                >
                  {CONSENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {CONSENT_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="consent-granted" className="label">Concedido por</label>
                <input
                  id="consent-granted"
                  className="input"
                  value={consentForm.grantedBy}
                  onChange={(event) =>
                    setConsentForm({ ...consentForm, grantedBy: event.target.value })
                  }
                  placeholder="Nome do responsável"
                  required
                />
              </div>
              <div>
                <label htmlFor="consent-expiry" className="label">Validade (opcional)</label>
                <input
                  id="consent-expiry"
                  type="date"
                  className="input"
                  value={consentForm.expiresAt}
                  onChange={(event) =>
                    setConsentForm({ ...consentForm, expiresAt: event.target.value })
                  }
                />
              </div>
              <button type="submit" className="btn-primary" disabled={consent.isPending}>
                {consent.isPending ? 'Registrando…' : 'Registrar consentimento'}
              </button>
            </form>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={importOpen}
        onClose={() => {
          setImportOpen(false)
          setImportResult(null)
        }}
        title="Importar estudantes (CSV)"
        description="Uma linha por estudante, separador ponto e vírgula."
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-sand-200 bg-sand-50 p-3 text-xs text-ink-600">
            <p className="font-semibold text-ink-700">Formato:</p>
            <p className="mt-1 font-mono">
              nome;data_nascimento;responsavel;telefone;turma
            </p>
            <p className="mt-2">
              A primeira linha pode ser o cabeçalho. Turmas devem existir previamente;
              estudantes sem turma válida são importados sem vínculo de turma.
            </p>
          </div>
          <textarea
            className="input min-h-40 font-mono text-xs"
            value={csv}
            onChange={(event) => setCsv(event.target.value)}
            placeholder={'Ana Souza;2013-05-10;Maria Souza;19989999999;6º ano A'}
            aria-label="Conteúdo CSV"
          />
          {importResult ? (
            <div className="rounded-xl border border-sand-200 p-3 text-sm">
              <p className="font-semibold text-forest-800">
                {importResult.created} importado(s), {importResult.skipped} ignorado(s).
              </p>
              {importResult.errors.length > 0 ? (
                <ul className="mt-2 space-y-1 text-xs text-red-700">
                  {importResult.errors.slice(0, 10).map((error, index) => (
                    <li key={`${error.line}-${index}`}>
                      Linha {error.line}: {error.message}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setImportOpen(false)
                setImportResult(null)
              }}
            >
              Fechar
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={!csv.trim() || importCsv.isPending}
              onClick={() => importCsv.mutate()}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              {importCsv.isPending ? 'Importando…' : 'Importar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default StudentsPage
