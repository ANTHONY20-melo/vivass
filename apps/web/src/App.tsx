import React, { type ReactNode, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from './lib/auth'
import { InstitutionProvider } from './lib/institution'
import { AppShell } from './components/Shell'
import { LoginPage } from './pages/Login'
import { NotFoundPage } from './pages/NotFound'

// Code-split all page components
const DashboardPage = React.lazy(() => import('./pages/Dashboard'))
const InstitutionsPage = React.lazy(() => import('./pages/Institutions'))
const MembersPage = React.lazy(() => import('./pages/Members'))
const StudentsPage = React.lazy(() => import('./pages/Students'))
const ClassesPage = React.lazy(() => import('./pages/Classes'))
const ProjectsPage = React.lazy(() => import('./pages/Projects'))
const ActivitiesPage = React.lazy(() => import('./pages/Activities'))
const AxesPage = React.lazy(() => import('./pages/Axes'))
const PlansPage = React.lazy(() => import('./pages/Plans'))
const DiagnosticsPage = React.lazy(() => import('./pages/Diagnostics'))
const AnnouncementsPage = React.lazy(() => import('./pages/Announcements'))
const LibraryPage = React.lazy(() => import('./pages/Library'))
const CalendarPage = React.lazy(() => import('./pages/Calendar'))
const ReportsPage = React.lazy(() => import('./pages/Reports'))
const PortalPage = React.lazy(() => import('./pages/Portal'))
const RequestsPage = React.lazy(() => import('./pages/Requests'))
const AuditPage = React.lazy(() => import('./pages/Audit'))

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sand-50">
        <div className="flex items-center gap-3 text-sm text-ink-600">
          <Loader2 className="h-5 w-5 animate-spin text-forest-600" aria-hidden="true" />
          Carregando sessão…
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  return <>{children}</>
}

function PageWrapper({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-ink-600">
          <Loader2 className="h-5 w-5 animate-spin text-forest-600" aria-hidden="true" />
          Carregando página…
        </div>
      </div>
    }>
      {children}
    </Suspense>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/app/painel" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/app"
        element={
          <RequireAuth>
            <InstitutionProvider>
              <AppShell />
            </InstitutionProvider>
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="painel" replace />} />
        <Route path="painel" element={<PageWrapper><DashboardPage /></PageWrapper>} />
        <Route path="instituicoes" element={<PageWrapper><InstitutionsPage /></PageWrapper>} />
        <Route path="equipe" element={<PageWrapper><MembersPage /></PageWrapper>} />
        <Route path="estudantes" element={<PageWrapper><StudentsPage /></PageWrapper>} />
        <Route path="turmas" element={<PageWrapper><ClassesPage /></PageWrapper>} />
        <Route path="projetos" element={<PageWrapper><ProjectsPage /></PageWrapper>} />
        <Route path="atividades" element={<PageWrapper><ActivitiesPage /></PageWrapper>} />
        <Route path="eixos" element={<PageWrapper><AxesPage /></PageWrapper>} />
        <Route path="planos" element={<PageWrapper><PlansPage /></PageWrapper>} />
        <Route path="diagnosticos" element={<PageWrapper><DiagnosticsPage /></PageWrapper>} />
        <Route path="comunicados" element={<PageWrapper><AnnouncementsPage /></PageWrapper>} />
        <Route path="biblioteca" element={<PageWrapper><LibraryPage /></PageWrapper>} />
        <Route path="calendario" element={<PageWrapper><CalendarPage /></PageWrapper>} />
        <Route path="relatorios" element={<PageWrapper><ReportsPage /></PageWrapper>} />
        <Route path="portal" element={<PageWrapper><PortalPage /></PageWrapper>} />
        <Route path="solicitacoes" element={<PageWrapper><RequestsPage /></PageWrapper>} />
        <Route path="auditoria" element={<PageWrapper><AuditPage /></PageWrapper>} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}