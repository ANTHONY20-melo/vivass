import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react'
import { AXIS_COLORS, AXIS_LABELS, VIVASS_AXES } from '@vivass/shared'
import { ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import { Logo, LogoMark } from '../components/Logo'

const DEMO_ACCOUNTS = [
  { email: 'admin@vivass.demo', label: 'Superadministrador' },
  { email: 'gestor@vivass.demo', label: 'Gestor escolar' },
  { email: 'coord@vivass.demo', label: 'Coordenador VIVASS' },
  { email: 'prof@vivass.demo', label: 'Professor' },
  { email: 'equipe@vivass.demo', label: 'Equipe multidisciplinar' },
]

export function LoginPage() {
  const { user, loading, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  if (!loading && user) {
    const hasDashboard = user.memberships.some(m => m.permissions.includes('dashboard:read'))
    const hasPortal = user.memberships.some(m => m.permissions.includes('portal:access'))
    const defaultTarget = hasDashboard ? '/app/painel' : hasPortal ? '/app/portal' : '/app/painel'
    const redirectTo = (location.state as { from?: string } | null)?.from ?? defaultTarget
    return <Navigate to={redirectTo} replace />
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setPending(true)
    try {
      await login(email.trim(), password)
      const { user } = useAuth()
      const hasDashboard = user?.memberships.some(m => m.permissions.includes('dashboard:read'))
      const hasPortal = user?.memberships.some(m => m.permissions.includes('portal:access'))
      const target = hasDashboard ? '/app/painel' : hasPortal ? '/app/portal' : '/app/painel'
      navigate(target, { replace: true })
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Não foi possível entrar. Verifique sua conexão e tente novamente.',
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1.05fr_1fr]">
      <section className="relative overflow-hidden bg-forest-950 px-6 py-10 text-white sm:px-10 lg:flex lg:flex-col lg:justify-between lg:px-14 lg:py-12">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              'radial-gradient(60rem 40rem at 80% 0%, rgba(63,174,127,0.28), transparent 60%), radial-gradient(40rem 30rem at 0% 100%, rgba(143,219,180,0.16), transparent 60%)',
          }}
          aria-hidden="true"
        />
        <div className="relative">
          <Logo variant="light" />
          <h1 className="mt-10 max-w-xl text-3xl font-extrabold tracking-tight sm:text-4xl lg:mt-16 lg:text-[2.6rem] lg:leading-tight">
            Biopsicossocial integrado para transformar vidas.
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-leaf-100/80 sm:text-base">
            Uma única estrutura para planejar, executar e avaliar ações de vida, valores,
            aprendizado, saúde e sustentabilidade na escola.
          </p>

          <ul className="mt-8 grid max-w-lg gap-2 sm:grid-cols-2">
            {VIVASS_AXES.map((axis) => (
              <li
                key={axis}
                className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-leaf-100/90"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: AXIS_COLORS[axis] }}
                  aria-hidden="true"
                />
                {AXIS_LABELS[axis]}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mt-10 flex items-center gap-3 text-xs text-leaf-100/60">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          Dados separados por instituição · acesso por perfil · auditoria de ações
        </div>
      </section>

      <section className="flex items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <LogoMark className="h-10 w-10" />
            <div>
              <p className="text-lg font-extrabold tracking-[0.22em] text-forest-900">VIVASS</p>
              <p className="text-[11px] text-ink-600">Biopsicossocial integrado</p>
            </div>
          </div>

          <div className="card p-6 sm:p-8">
            <h2 className="text-xl font-bold text-forest-950">Acessar a plataforma</h2>
            <p className="mt-1 text-sm text-ink-600">
              Use o e-mail institucional cadastrado pela sua escola.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
              <div>
                <label htmlFor="email" className="label">
                  E-mail
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="input"
                  placeholder="nome@escola.edu.br"
                />
              </div>

              <div>
                <label htmlFor="password" className="label">
                  Senha
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="input pr-11"
                    placeholder="Sua senha"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-ink-400 transition hover:text-ink-700"
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              {error ? (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
                >
                  {error}
                </div>
              ) : null}

              <button type="submit" className="btn-primary w-full" disabled={pending}>
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                )}
                {pending ? 'Entrando…' : 'Entrar'}
              </button>
            </form>

            {import.meta.env.DEV ? (
              <details className="mt-6 rounded-xl border border-sand-200 bg-sand-50 p-3 text-sm">
                <summary className="cursor-pointer font-semibold text-ink-700">
                  Contas de demonstração
                </summary>
                <p className="mt-2 text-xs text-ink-600">
                  Ambiente local com dados fictícios. Senha única:{' '}
                  <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-forest-800">
                    Vivass@2026
                  </code>
                </p>
                <ul className="mt-2 space-y-1 text-xs text-ink-700">
                  {DEMO_ACCOUNTS.map((account) => (
                    <li key={account.email} className="flex justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEmail(account.email)
                          setPassword('Vivass@2026')
                        }}
                        className="font-mono text-[11px] text-forest-700 underline-offset-2 hover:underline"
                      >
                        {account.email}
                      </button>
                      <span className="text-ink-400">{account.label}</span>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>

          <p className="mt-6 text-center text-xs text-ink-400">
            VIVASS · Vida, Valores, Aprendizado, Saúde e Sustentabilidade
          </p>
        </div>
      </section>
    </div>
  )
}
