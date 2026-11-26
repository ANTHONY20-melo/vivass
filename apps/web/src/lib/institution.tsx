import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useQuery } from '@tanstack/react-query'
import type { InstitutionSummary } from '@vivass/shared'
import { apiFetch } from './api'
import { useAuth } from './auth'

const STORAGE_KEY = 'vivass.institution'

interface InstitutionValue {
  institutions: InstitutionSummary[]
  current: InstitutionSummary | null
  setCurrentId: (id: string) => void
  loading: boolean
  reload: () => void
}

const InstitutionContext = createContext<InstitutionValue | null>(null)

export function InstitutionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const query = useQuery({
    queryKey: ['institutions', user?.id],
    queryFn: () => apiFetch<InstitutionSummary[]>('/institutions'),
    enabled: Boolean(user),
  })

  const [currentId, setCurrentIdState] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_KEY),
  )

  const institutions = query.data ?? []
  const current =
    institutions.find((institution) => institution.id === currentId) ??
    institutions[0] ??
    null

  useEffect(() => {
    if (current && current.id !== currentId) {
      setCurrentIdState(current.id)
      localStorage.setItem(STORAGE_KEY, current.id)
    }
  }, [current, currentId])

  const setCurrentId = (id: string) => {
    setCurrentIdState(id)
    localStorage.setItem(STORAGE_KEY, id)
  }

  const value = useMemo(
    () => ({
      institutions,
      current,
      setCurrentId,
      loading: query.isLoading,
      reload: () => void query.refetch(),
    }),
    [institutions, current, query],
  )

  return (
    <InstitutionContext.Provider value={value}>{children}</InstitutionContext.Provider>
  )
}

export function useInstitution(): InstitutionValue {
  const context = useContext(InstitutionContext)
  if (!context) {
    throw new Error('useInstitution deve ser usado dentro de InstitutionProvider.')
  }
  return context
}
