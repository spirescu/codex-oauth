import type { AuthSummary, RateLimitSnapshot } from './types'
import {
  globalUsageAverage as computeUsageAverage,
  globalUsageSum as computeUsageSum,
  globalWeeklyElapsedTimeAverage as computeElapsedAverage,
  globalWeeklyElapsedTimeSum as computeElapsedSum
} from './usage-metrics'

export function globalWeeklyAccountCount(authEntries: AuthSummary[], limits: Record<string, RateLimitSnapshot | null>): number {
  let count = 0
  for (const entry of authEntries) {
    const snapshot = limits[entry.id]
    const secondary = snapshot?.secondary
    if (!secondary) {
      continue
    }
    if (typeof secondary.usedPercent !== 'number') {
      continue
    }
    if (typeof secondary.windowMinutes !== 'number') {
      continue
    }
    if (typeof secondary.resetsAt !== 'number') {
      continue
    }
    count += 1
  }
  return count
}

export function globalUsageAverage(authEntries: AuthSummary[], limits: Record<string, RateLimitSnapshot | null>): number {
  return computeUsageAverage(authEntries, limits)
}

export function globalUsageSum(authEntries: AuthSummary[], limits: Record<string, RateLimitSnapshot | null>): number {
  return computeUsageSum(authEntries, limits)
}

export function globalWeeklyElapsedTimeAverage(authEntries: AuthSummary[], limits: Record<string, RateLimitSnapshot | null>): number {
  return computeElapsedAverage(authEntries, limits)
}

export function globalWeeklyElapsedTimeSum(authEntries: AuthSummary[], limits: Record<string, RateLimitSnapshot | null>): number {
  return computeElapsedSum(authEntries, limits)
}
