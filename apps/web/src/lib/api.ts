import type { ApiErrorBody, AuthResponse } from '@vivass/shared'

/**
 * Origem da API. Em produção com front e back em hosts diferentes (Vercel + Railway),
 * `VITE_API_URL` aponta para a API; sem a variável, usa o mesmo domínio (proxy do Vite
 * em dev e API servindo a SPA em produção).
 */
const API_ORIGIN = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '')
const BASE = `${API_ORIGIN}/api`

let accessToken: string | null = null
let refreshInFlight: Promise<AuthResponse | null> | null = null

export class ApiError extends Error {
  readonly status: number
  readonly code?: string
  readonly details?: unknown

  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export function setAccessToken(token: string | null): void {
  accessToken = token
}

export function getAccessToken(): string | null {
  return accessToken
}

async function requestRefresh(): Promise<AuthResponse | null> {
  const response = await fetch(`${BASE}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })

  if (!response.ok) {
    accessToken = null
    return null
  }

  const data = (await response.json()) as AuthResponse
  accessToken = data.accessToken
  return data
}

/**
 * Refresh com chamada única em voo: duas inicializações simultâneas (StrictMode)
 * não podem usar o mesmo token de refresh — o segundo uso seria tratado como reuso.
 */
export function refreshSession(): Promise<AuthResponse | null> {
  refreshInFlight ??= requestRefresh().finally(() => {
    refreshInFlight = null
  })
  return refreshInFlight
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }
  if (accessToken) {
    headers.set('authorization', `Bearer ${accessToken}`)
  }

  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  })

  if (response.status === 401 && retry && !path.startsWith('/auth/')) {
    const session = await refreshSession()
    if (session) return apiFetch<T>(path, init, false)
  }

  if (!response.ok) {
    let body: ApiErrorBody | null = null
    try {
      body = (await response.json()) as ApiErrorBody
    } catch {
      body = null
    }
    throw new ApiError(
      response.status,
      body?.error?.message ?? 'Não foi possível concluir a operação.',
      body?.error?.code,
      body?.error?.details,
    )
  }

  if (response.status === 204) return undefined as T

  return (await response.json()) as T
}

/** Baixa um arquivo binário (PDF/XLSX) usando a sessão atual. */
export async function apiDownload(path: string, filename: string): Promise<void> {
  const headers = new Headers()
  if (accessToken) headers.set('authorization', `Bearer ${accessToken}`)

  const response = await fetch(`${BASE}${path}`, {
    headers,
    credentials: 'include',
  })

  if (!response.ok) {
    throw new ApiError(response.status, 'Não foi possível gerar o arquivo.')
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
