import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Info, UserPlus, Users } from 'lucide-react'
import type { MemberRole, MemberSummary } from '@vivass/shared'
import { MEMBER_ROLES, ROLE_LABELS } from '@vivass/shared'
import { ApiError, apiFetch } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useInstitution } from '../lib/institution'
import { formatDateTime } from '../lib/format'
import { Badge, EmptyState, LoadingBlock, Modal, PageHeader } from '../components/ui'

const initialForm = {
  name: '',
  email: '',
  password: '',
  role: 'TEACHER' as MemberRole,
}

export function MembersPage() {
  const { user } = useAuth()
  const { current, loading } = useInstitution()
  const queryClient = useQueryClient()

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(initialForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const membership = user?.memberships.find(
    (item) => item.institutionId === current?.id,
  )
  const canManage =
    user?.platformRole === 'SUPERADMIN' ||
    Boolean(membership?.permissions.includes('user:manage'))

  const query = useQuery({
    queryKey: ['members', current?.id],
    queryFn: () => apiFetch<MemberSummary[]>(`/institutions/${current?.id}/members`),
    enabled: Boolean(current),
  })

  const mutation = useMutation({
    mutationFn: (input: typeof initialForm) =>
      apiFetch<MemberSummary>(`/institutions/${current?.id}/members`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: (member) => {
      void queryClient.invalidateQueries({ queryKey: ['members', current?.id] })
      void queryClient.invalidateQueries({ queryKey: ['institutions'] })
      setModalOpen(false)
      setForm(initialForm)
      setSuccess(`Vínculo de ${member.name} criado com o perfil ${ROLE_LABELS[member.role]}.`)
    },
    onError: (error) => {
      setFormError(
        error instanceof ApiError ? error.message : 'Não foi possível criar o vínculo.',
      )
    },
  })

  if (loading) return <LoadingBlock label="Carregando instituição…" />

  if (!current) {
    return (
      <EmptyState
        icon={Info}
        title="Nenhuma instituição selecionada"
        description="Selecione uma instituição para consultar a equipe."
      />
    )
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)
    mutation.mutate(form)
  }

  return (
    <div>
      <PageHeader
        title="Equipe e vínculos"
        description={`Perfis com acesso aos dados de ${current.name}.`}
        actions={
          canManage ? (
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setFormError(null)
                setSuccess(null)
                setModalOpen(true)
              }}
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Novo vínculo
            </button>
          ) : null
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
        {query.isLoading ? (
          <LoadingBlock label="Carregando equipe…" />
        ) : query.isError ? (
          <div className="p-4">
            <EmptyState
              icon={Info}
              title="Não foi possível carregar a equipe"
              description="Tente novamente em instantes."
              action={
                <button type="button" className="btn-ghost" onClick={() => query.refetch()}>
                  Tentar novamente
                </button>
              }
            />
          </div>
        ) : (query.data?.length ?? 0) === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={Users}
              title="Nenhum vínculo cadastrado"
              description="Cadastre gestores, professores e equipe multidisciplinar para começar."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-sand-50 text-xs tracking-wide text-ink-500 uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Pessoa</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Perfil</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Último acesso</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-200">
                {(query.data ?? []).map((member) => (
                  <tr key={member.membershipId} className="hover:bg-sand-50/60">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-ink-900">{member.name}</p>
                      <p className="text-xs text-ink-400">{member.email}</p>
                    </td>
                    <td className="px-4 py-3 text-ink-700">{ROLE_LABELS[member.role]}</td>
                    <td className="px-4 py-3 text-ink-600">
                      {formatDateTime(member.lastLoginAt)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={member.active ? 'success' : 'warning'}>
                        {member.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="mt-4 flex items-start gap-2 text-xs text-ink-500">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        A senha provisória deve ser entregue por canal seguro. A troca de senha pelo próprio
        usuário entra na Fase 2; até lá, o gestor responde pela credencial criada aqui.
      </p>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Novo vínculo"
        description={`Concede acesso restrito aos dados de ${current.name}.`}
      >
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="member-name" className="label">
              Nome completo
            </label>
            <input
              id="member-name"
              className="input"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="member-email" className="label">
              E-mail
            </label>
            <input
              id="member-email"
              type="email"
              className="input"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              placeholder="nome@escola.edu.br"
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="member-role" className="label">
                Perfil de acesso
              </label>
              <select
                id="member-role"
                className="input"
                value={form.role}
                onChange={(event) =>
                  setForm({ ...form, role: event.target.value as MemberRole })
                }
              >
                {MEMBER_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="member-password" className="label">
                Senha provisória
              </label>
              <input
                id="member-password"
                type="password"
                className="input"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                minLength={10}
                required
                autoComplete="new-password"
              />
              <p className="mt-1 text-[11px] text-ink-400">Mínimo de 10 caracteres.</p>
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
            <button type="submit" className="btn-primary" disabled={mutation.isPending}>
              {mutation.isPending ? 'Criando…' : 'Criar vínculo'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default MembersPage
