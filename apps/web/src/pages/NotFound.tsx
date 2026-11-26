import { Link } from 'react-router-dom'
import { LogoMark } from '../components/Logo'

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-sand-50 px-6 text-center">
      <LogoMark className="h-14 w-14" />
      <p className="text-xs font-semibold tracking-[0.2em] text-forest-700 uppercase">
        Erro 404
      </p>
      <h1 className="text-2xl font-bold text-forest-950">Página não encontrada</h1>
      <p className="max-w-md text-sm text-ink-600">
        O endereço acessado não existe nesta instalação do VIVASS.
      </p>
      <Link to="/app/painel" className="btn-primary mt-2">
        Voltar ao painel
      </Link>
    </div>
  )
}
