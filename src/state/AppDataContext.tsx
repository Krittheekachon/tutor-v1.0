import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { loadAllData } from '../lib/api'
import { toThaiError } from '../lib/errors'
import type { AppData } from '../lib/types'

interface AppDataContextValue {
  data: AppData | null
  ownerId: string
  loading: boolean
  refreshing: boolean
  error: string | null
  refresh: () => Promise<boolean>
  clearError: () => void
}

const AppDataContext = createContext<AppDataContextValue | null>(null)

export function AppDataProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [data, setData] = useState<AppData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    setData(null)

    loadAllData(userId)
      .then((next) => {
        if (!active) return
        setData(next)
      })
      .catch((loadError: unknown) => {
        if (!active) return
        setError(toThaiError(loadError))
      })
      .finally(() => {
        if (!active) return
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [userId])

  const refresh = useCallback(async (): Promise<boolean> => {
    setRefreshing(true)
    setError(null)
    try {
      const next = await loadAllData(userId)
      setData(next)
      return true
    } catch (refreshError) {
      setError(toThaiError(refreshError))
      return false
    } finally {
      setRefreshing(false)
    }
  }, [userId])

  const clearError = useCallback(() => setError(null), [])

  const value = useMemo(
    () => ({ data, ownerId: userId, loading, refreshing, error, refresh, clearError }),
    [data, userId, loading, refreshing, error, refresh, clearError],
  )

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

export function useAppData(): AppDataContextValue {
  const context = useContext(AppDataContext)
  if (!context) throw new Error('useAppData ต้องใช้ภายใน AppDataProvider')
  return context
}
