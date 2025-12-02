import type { AuthSummary, RateLimitSnapshot, RateLimitWindow } from './types.js'

function weeklyWindowForSnapshot(snapshot: RateLimitSnapshot | null | undefined): RateLimitWindow | null {
  if (!snapshot) {
    return null
  }
  return snapshot.secondary ?? null
}

export function hasValidWeekly(limits: Record<string, RateLimitSnapshot | null>, id: string): boolean {
  const snapshot = limits[id]
  const weekly = weeklyWindowForSnapshot(snapshot)
  if (!weekly) {
    return false
  }
  if (typeof weekly.usedPercent !== 'number') {
    return false
  }
  if (typeof weekly.windowMinutes !== 'number') {
    return false
  }
  if (typeof weekly.resetsAt !== 'number') {
    return false
  }
  return true
}

export function timeProgressPercent(window: RateLimitWindow | null | undefined): number {
  if (!window || typeof window.windowMinutes !== 'number' || typeof window.resetsAt !== 'number') {
    return 0
  }

  const nowMs = Date.now()
  const durationMinutes = window.windowMinutes
  if (durationMinutes <= 0) {
    return 0
  }

  const durationMs = durationMinutes * 60 * 1000
  const resetAtMs = window.resetsAt * 1000
  const startMs = resetAtMs - durationMs
  if (nowMs <= startMs) {
    return 0
  }
  if (nowMs >= resetAtMs) {
    return 100
  }

  const elapsed = nowMs - startMs
  const percent = (elapsed / durationMs) * 100
  if (percent < 0) {
    return 0
  }
  if (percent > 100) {
    return 100
  }
  return Math.round(percent)
}

function weeklyWindows(authEntries: AuthSummary[], limits: Record<string, RateLimitSnapshot | null>): RateLimitWindow[] {
  const windows: RateLimitWindow[] = []
  for (const entry of authEntries) {
    if (!hasValidWeekly(limits, entry.id)) {
      continue
    }
    const weekly = weeklyWindowForSnapshot(limits[entry.id])
    if (weekly) {
      windows.push(weekly)
    }
  }
  return windows
}

export function globalUsageSum(authEntries: AuthSummary[], limits: Record<string, RateLimitSnapshot | null>): number {
  const windows = weeklyWindows(authEntries, limits)
  if (!windows.length) {
    return 0
  }
  let total = 0
  for (const window of windows) {
    total += window.usedPercent
  }
  return Math.round(total)
}

export function globalUsageAverage(authEntries: AuthSummary[], limits: Record<string, RateLimitSnapshot | null>): number {
  const windows = weeklyWindows(authEntries, limits)
  const count = windows.length
  if (!count) {
    return 0
  }
  const sum = globalUsageSum(authEntries, limits)
  const avg = sum / count
  if (avg < 0) {
    return 0
  }
  if (avg > 100) {
    return 100
  }
  return Math.round(avg)
}

export function globalWeeklyElapsedTimeSum(authEntries: AuthSummary[], limits: Record<string, RateLimitSnapshot | null>): number {
  const windows = weeklyWindows(authEntries, limits)
  if (!windows.length) {
    return 0
  }
  let totalElapsed = 0
  for (const weekly of windows) {
    const elapsed = timeProgressPercent(weekly)
    totalElapsed += elapsed
  }
  return Math.round(totalElapsed)
}

export function globalWeeklyElapsedTimeAverage(authEntries: AuthSummary[], limits: Record<string, RateLimitSnapshot | null>): number {
  const windows = weeklyWindows(authEntries, limits)
  const count = windows.length
  if (!count) {
    return 0
  }
  const sum = globalWeeklyElapsedTimeSum(authEntries, limits)
  const avg = sum / count
  if (avg < 0) {
    return 0
  }
  if (avg > 100) {
    return 100
  }
  return Math.round(avg)
}
