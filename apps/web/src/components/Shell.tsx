import { useState, type ReactNode } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  BookOpen,
  Building2,
  CalendarDays,
  ClipboardList,
  FileDown,
  FileSpreadsheet,
  FolderKanban,
  HeartPulse,
  History,
  LayoutDashboard,
  Leaf,
  LibraryBig,
  LogOut,
  Menu,
  Megaphone,
  Scale,
  ShieldCheck,
  Stethoscope,
  Target,
  Users,
  X,
} from 'lucide-react'
import type { Permission } from '@vivass/shared'
import { AXIS_COLORS, AXIS_LABELS, ROLE_LABELS, VIVASS_AXES } from '@vivass/shared'
import { useAuth } from '../lib/auth'
import { useInstitution } from '../lib/institution'
import { usePermissionChecker } from '../lib/permissions'
import { initials, todayLong } from '../lib/format'
import { Badge } from './ui'
import { Logo } from './Logo'

const AXIS_ICONS = {
  VIDA: HeartPulse,
  VALORES: Scale,
  APRENDIZADO: BookOpen,
  SAUDE: Stethoscope,
  SUSTENTABILIDADE: Leaf,
} as const

interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
  permission?: Permission
  end?: boolean
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth()
  const { current, institutions, setCurrentId } = useInstitution()
  const can = usePermissionChecker()
  const navigate = useNavigate()

  const membership = user?.memberships.find(
    (item) => item.institutionId === current?.id,
  )
  const isSuperadmin = user?.platformRole === 'SUPERADMIN'

  const navItems: NavItem[] = [{ to: '/app/painel', label: 'Painel', icon: LayoutDashboard }]
  if (isSuperadmin) {
    navItems.push({ to: '/app/instituicoes', label: 'Instituições', icon: Building2 })
  }
  if (can('user:read')) {
    navItems.push({ to: '/app/equipe', label: 'Equipe e vínculos', icon: Users })
  }
  if (can('student:read')) {
    navItems.push({ to: '/app/estudantes', label: 'Estudantes', icon: Users })
    navItems.push({ to: '/app/turmas', label: 'Turmas', icon: LibraryBig })
  }

  const roleLabel = isSuperadmin
    ? ROLE_LABELS.SUPERADMIN
    : membership
      ? ROLE_LABELS[membership.role]
      : 'Sem vínculo ativo'

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-full flex-col bg-forest-950 text-white">
      <div className="px-5 pt-6 pb-5">
        <Logo variant="light" />
      </div>

      {isSuperadmin && institutions.length > 1 ? (
        <div className="px-4 pb-4">
          <label htmlFor="institution-switch-sidebar" className="sr-only">
            Instituição ativa
          </label>
          <select
            id="institution-switch-sidebar"
            value={current?.id ?? ''}
            onChange={(event) => {
              setCurrentId(event.target.value)
              onNavigate?.()
            }}
            className="w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-white focus:border-leaf-300 focus:outline-none"
          >
            {institutions.map((institution) => (
              <option key={institution.id} value={institution.id} className="text-ink-900">
                {institution.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Navegação principal">
        <p className="px-2 pt-1 pb-2 text-[11px] font-semibold tracking-[0.16em] text-leaf-200/60">
          GESTÃO
        </p>
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    isActive
                      ? 'bg-white/12 text-white'
                      : 'text-leaf-100/75 hover:bg-white/8 hover:text-white'
                  }`
                }
              >
                <item.icon className="h-[18px] w-[18px]" aria-hidden="true" />
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>

        <p className="px-2 pt-6 pb-2 text-[11px] font-semibold tracking-[0.16em] text-leaf-200/60">
          MÓDULOS VIVASS
        </p>
        <ul className="space-y-1">
          {VIVASS_AXES.map((axis) => {
            const Icon = AXIS_ICONS[axis]
            return (
              <li
                key={axis}
                className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-leaf-100/50"
                aria-disabled="true"
              >
                <Icon
                  className="h-[18px] w-[18px]"
                  style={{ color: AXIS_COLORS[axis] }}
                  aria-hidden="true"
                />
                <span className="flex-1">{AXIS_LABELS[axis]}</span>
              </li>
            )
          })}
        </ul>

        {can('project:read') && (
          <>
            <p className="px-2 pt-6 pb-2 text-[11px] font-semibold tracking-[0.16em] text-leaf-200/60">
              PROJETOS E EXECUÇÃO
            </p>
            <ul className="space-y-1">
              <li>
                <NavLink
                  to="/app/projetos"
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                      isActive
                        ? 'bg-white/12 text-white'
                        : 'text-leaf-100/75 hover:bg-white/8 hover:text-white'
                    }`
                  }
                >
                  <FolderKanban className="h-[18px] w-[18px]" aria-hidden="true" />
                  Projetos
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/app/atividades"
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                      isActive
                        ? 'bg-white/12 text-white'
                        : 'text-leaf-100/75 hover:bg-white/8 hover:text-white'
                    }`
                  }
                >
                  <ClipboardList className="h-[18px] w-[18px]" aria-hidden="true" />
                  Atividades
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/app/eixos"
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                      isActive
                        ? 'bg-white/12 text-white'
                        : 'text-leaf-100/75 hover:bg-white/8 hover:text-white'
                    }`
                  }
                >
                  <Scale className="h-[18px] w-[18px]" aria-hidden="true" />
                  Eixos e dimensões
                </NavLink>
              </li>
            </ul>
          </>
        )}

        {can('plan:read') && (
          <>
            <p className="px-2 pt-6 pb-2 text-[11px] font-semibold tracking-[0.16em] text-leaf-200/60">
              PLANEJAMENTO
            </p>
            <ul className="space-y-1">
              <li>
                <NavLink
                  to="/app/planos"
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                      isActive
                        ? 'bg-white/12 text-white'
                        : 'text-leaf-100/75 hover:bg-white/8 hover:text-white'
                    }`
                  }
                >
                  <Target className="h-[18px] w-[18px]" aria-hidden="true" />
                  Planos de ação
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/app/diagnosticos"
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                      isActive
                        ? 'bg-white/12 text-white'
                        : 'text-leaf-100/75 hover:bg-white/8 hover:text-white'
                    }`
                  }
                >
                  <ClipboardList className="h-[18px] w-[18px]" aria-hidden="true" />
                  Diagnóstico
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/app/calendario"
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                      isActive
                        ? 'bg-white/12 text-white'
                        : 'text-leaf-100/75 hover:bg-white/8 hover:text-white'
                    }`
                  }
                >
                  <CalendarDays className="h-[18px] w-[18px]" aria-hidden="true" />
                  Calendário
                </NavLink>
              </li>
            </ul>
          </>
        )}

        {can('communication:read') && (
          <>
            <p className="px-2 pt-6 pb-2 text-[11px] font-semibold tracking-[0.16em] text-leaf-200/60">
              COMUNICAÇÃO E RECURSOS
            </p>
            <ul className="space-y-1">
              <li>
                <NavLink
                  to="/app/comunicados"
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                      isActive
                        ? 'bg-white/12 text-white'
                        : 'text-leaf-100/75 hover:bg-white/8 hover:text-white'
                    }`
                  }
                >
                  <Megaphone className="h-[18px] w-[18px]" aria-hidden="true" />
                  Comunicados
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/app/biblioteca"
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                      isActive
                        ? 'bg-white/12 text-white'
                        : 'text-leaf-100/75 hover:bg-white/8 hover:text-white'
                    }`
                  }
                >
                  <LibraryBig className="h-[18px] w-[18px]" aria-hidden="true" />
                  Biblioteca
                </NavLink>
              </li>
            </ul>
          </>
        )}

        {can('report:read') && (
          <>
            <p className="px-2 pt-6 pb-2 text-[11px] font-semibold tracking-[0.16em] text-leaf-200/60">
              INTELIGÊNCIA
            </p>
            <ul className="space-y-1">
              <li>
                <NavLink
                  to="/app/relatorios"
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                      isActive
                        ? 'bg-white/12 text-white'
                        : 'text-leaf-100/75 hover:bg-white/8 hover:text-white'
                    }`
                  }
                >
                  <FileDown className="h-[18px] w-[18px]" aria-hidden="true" />
                  Relatórios PDF/Excel
                </NavLink>
              </li>
            </ul>
          </>
        )}

        {can('portal:access') && (
          <>
            <p className="px-2 pt-6 pb-2 text-[11px] font-semibold tracking-[0.16em] text-leaf-200/60">
              PORTAL
            </p>
            <ul className="space-y-1">
              <li>
                <NavLink
                  to="/app/portal"
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                      isActive
                        ? 'bg-white/12 text-white'
                        : 'text-leaf-100/75 hover:bg-white/8 hover:text-white'
                    }`
                  }
                >
                  <BookOpen className="h-[18px] w-[18px]" aria-hidden="true" />
                  Portal da comunidade
                </NavLink>
              </li>
            </ul>
          </>
        )}

        {can('request:read') && (
          <>
            <p className="px-2 pt-6 pb-2 text-[11px] font-semibold tracking-[0.16em] text-leaf-200/60">
              LGPD E AUDITORIA
            </p>
            <ul className="space-y-1">
              <li>
                <NavLink
                  to="/app/solicitacoes"
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                      isActive
                        ? 'bg-white/12 text-white'
                        : 'text-leaf-100/75 hover:bg-white/8 hover:text-white'
                    }`
                  }
                >
                  <ShieldCheck className="h-[18px] w-[18px]" aria-hidden="true" />
                  Solicitações de dados
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/app/auditoria"
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                      isActive
                        ? 'bg-white/12 text-white'
                        : 'text-leaf-100/75 hover:bg-white/8 hover:text-white'
                    }`
                  }
                >
                  <History className="h-[18px] w-[18px]" aria-hidden="true" />
                  Auditoria
                </NavLink>
              </li>
            </ul>
          </>
        )}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-leaf-400/20 text-xs font-bold text-leaf-200">
            {user ? initials(user.name) : '—'}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{user?.name}</p>
            <p className="truncate text-[11px] text-leaf-200/70">{roleLabel}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg p-2 text-leaf-200/70 transition hover:bg-white/10 hover:text-white"
            aria-label="Sair da plataforma"
            title="Sair"
          >
            <LogOut className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
}

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user } = useAuth()
  const { current, institutions, setCurrentId } = useInstitution()
  const isSuperadmin = user?.platformRole === 'SUPERADMIN'

  let headerRight: ReactNode = null
  if (isSuperadmin && institutions.length > 0) {
    headerRight = (
      <label className="flex items-center gap-2 text-sm">
        <span className="hidden text-ink-600 sm:inline">Instituição</span>
        <select
          value={current?.id ?? ''}
          onChange={(event) => setCurrentId(event.target.value)}
          className="max-w-[240px] rounded-xl border border-sand-300 bg-white px-3 py-2 text-sm font-medium text-ink-900 focus:border-forest-600 focus:outline-none"
        >
          {institutions.map((institution) => (
            <option key={institution.id} value={institution.id}>
              {institution.name}
            </option>
          ))}
        </select>
      </label>
    )
  } else if (current) {
    headerRight = (
      <div className="hidden text-right sm:block">
        <p className="text-sm font-semibold text-forest-950">{current.name}</p>
        <p className="text-xs text-ink-600">
          {current.city} · {current.state}
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-sand-50 lg:grid lg:grid-cols-[18rem_1fr]">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-forest-900 focus:px-3 focus:py-2 focus:text-sm focus:text-white"
      >
        Pular para o conteúdo
      </a>

      <aside className="hidden lg:block">
        <div className="fixed inset-y-0 left-0 w-72">
          <SidebarContent />
        </div>
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-forest-950/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            role="presentation"
          />
          <div className="absolute inset-y-0 left-0 w-72 shadow-2xl">
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="flex min-h-screen flex-col lg:col-start-2">
        <header className="sticky top-0 z-30 border-b border-sand-200 bg-sand-50/90 backdrop-blur">
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-10">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="rounded-lg p-2 text-ink-700 transition hover:bg-sand-200 lg:hidden"
                aria-label="Abrir menu"
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
              </button>
              <div className="hidden text-xs text-ink-600 sm:block">{todayLong()}</div>
            </div>
            <div className="flex items-center gap-3">
              {current?.isDemo ? (
                <Badge tone="warning">Ambiente de demonstração</Badge>
              ) : null}
              {headerRight}
            </div>
          </div>
        </header>

        <main id="conteudo" className="flex-1 px-4 py-6 sm:px-6 lg:px-10">
          <Outlet />
        </main>

        <footer className="border-t border-sand-200 px-4 py-4 text-xs text-ink-400 sm:px-6 lg:px-10">
          VIVASS v0.1.0 · Fases 1–6 implementadas · dados de demonstração identificados
        </footer>
      </div>

      {mobileOpen ? (
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="fixed top-4 right-4 z-50 rounded-full bg-white p-2 text-ink-700 shadow-lg lg:hidden"
          aria-label="Fechar menu"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  )
}