import { useEffect, useRef, useState } from 'react'
import type { ActiveProfile, AuthSummary, RateLimitSnapshot } from './types'
import { AuthClient } from './api'
import { hasValidWeekly } from './usage-metrics'

interface UseAuthDataState {
  authEntries: AuthSummary[]
  limits: Record<string, RateLimitSnapshot | null>
  activeProfileId: string | null
  loading: boolean
  error: string | null
  selectedId: string | null
}

export interface UseAuthDataResult extends UseAuthDataState {
  selectNext: () => void
  selectPrevious: () => void
  openDetailsForSelected: () => AuthSummary | null
  activateSelected: () => Promise<void>
  refreshAll: () => Promise<void>
}

export function useAuthData(): UseAuthDataResult {
  const [state, setState] = useState<UseAuthDataState>({
    authEntries: [],
    limits: {},
    activeProfileId: null,
    loading: true,
    error: null,
    selectedId: null
  })
  const [client] = useState(() => new AuthClient())
  const hasLoadedOnceRef = useRef(false)

  const sortEntries = (entries: AuthSummary[], limits: Record<string, RateLimitSnapshot | null>): AuthSummary[] => {
    const copy = [...entries]
    copy.sort((a, b) => {
      const aValid = hasValidWeekly(limits, a.id)
      const bValid = hasValidWeekly(limits, b.id)
      if (aValid !== bValid) {
        return aValid ? -1 : 1
      }
      return a.id.localeCompare(b.id)
    })
    return copy
  }

  useEffect(() => {
    if (hasLoadedOnceRef.current) {
      return
    }
    hasLoadedOnceRef.current = true
    void refreshAllInternal()
  }, [])

  async function refreshAllInternal(): Promise<void> {
    setState((prev) => ({
      ...prev,
      loading: true,
      error: null
    }))

    let entries: AuthSummary[]
    let current: ActiveProfile

    try {
      ;[entries, current] = await Promise.all([
        client.listAuth(),
        client.getCurrentProfile()
      ])
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : String(err)
      }))
      return
    }

    const limits: Record<string, RateLimitSnapshot | null> = {}

    await Promise.all(
      entries.map(async (entry) => {
        try {
          const snapshot = await client.getLimits(entry.id)
          limits[entry.id] = snapshot
        } catch {
          limits[entry.id] = null
        }
      })
    )

    setState((prev) => {
      const nextEntries = entries
      const sorted = sortEntries(nextEntries, limits)
      const nextSelectedId =
        prev.selectedId && sorted.some((entry) => entry.id === prev.selectedId)
          ? prev.selectedId
          : sorted[0]?.id ?? null

      return {
        ...prev,
        authEntries: nextEntries,
        activeProfileId: current.id,
        limits,
        loading: false,
        error: null,
        selectedId: nextSelectedId
      }
    })
  }

  const openDetailsForSelected = (): AuthSummary | null => {
    const entries = sortEntries(state.authEntries, state.limits)
    if (entries.length === 0) {
      return null
    }
    const selectedId = state.selectedId
    if (!selectedId) {
      return entries[0]
    }
    const found = entries.find((entry) => entry.id === selectedId)
    if (found) {
      return found
    }
    return entries[0]
  }

  const selectNext = (): void => {
    setState((prev) => {
      const entries = sortEntries(prev.authEntries, prev.limits)
      if (entries.length === 0) {
        return prev
      }
      const currentId = prev.selectedId
      const currentIndex = currentId
        ? entries.findIndex((entry) => entry.id === currentId)
        : -1
      const nextIndex = currentIndex < 0 ? 0 : Math.min(entries.length - 1, currentIndex + 1)
      const nextId = entries[nextIndex]?.id ?? null
      return {
        ...prev,
        selectedId: nextId
      }
    })
  }

  const selectPrevious = (): void => {
    setState((prev) => {
      const entries = sortEntries(prev.authEntries, prev.limits)
      if (entries.length === 0) {
        return prev
      }
      const currentId = prev.selectedId
      const currentIndex = currentId
        ? entries.findIndex((entry) => entry.id === currentId)
        : -1
      const nextIndex = currentIndex <= 0 ? 0 : currentIndex - 1
      const nextId = entries[nextIndex]?.id ?? null
      return {
        ...prev,
        selectedId: nextId
      }
    })
  }

  const activateSelected = async (): Promise<void> => {
    const entry = openDetailsForSelected()
    if (!entry) {
      return
    }
    let profile: ActiveProfile
    try {
      profile = await client.activateProfile(entry.id)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const friendly =
        /enoent|no such file or directory/i.test(message)
          ? `Auth file for profile "${entry.id}" is missing on the backend. Export or refresh it, then try again.`
          : message
      setState((prev) => ({
        ...prev,
        error: friendly
      }))
      return
    }
    setState((prev) => ({
      ...prev,
      activeProfileId: profile.id
    }))
  }

  return {
    ...state,
    selectNext,
    selectPrevious,
    openDetailsForSelected,
    activateSelected,
    refreshAll: refreshAllInternal
  }
}
