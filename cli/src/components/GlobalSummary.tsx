import React from 'react'
import { Box, Text, useStdout } from 'ink'
import type { AuthSummary, RateLimitSnapshot } from '../types'
import { ProgressBar } from './ProgressBar'
import {
  globalUsageAverage,
  globalUsageSum,
  globalWeeklyAccountCount,
  globalWeeklyElapsedTimeAverage,
  globalWeeklyElapsedTimeSum
} from '../global-summary'

interface GlobalSummaryProps {
  authEntries: AuthSummary[]
  limits: Record<string, RateLimitSnapshot | null>
}

export function GlobalSummary({ authEntries, limits }: GlobalSummaryProps): JSX.Element | null {
  if (authEntries.length === 0) {
    return null
  }

  const { stdout } = useStdout()
  const totalWidth = Math.max(60, stdout?.columns ?? 100)
  const paddingLeft = 3
  const usableWidth = Math.max(20, totalWidth - paddingLeft)
  const gap = 2
  const columnWidth = Math.max(20, Math.floor((usableWidth - gap) / 2))

  const usageAvg = globalUsageAverage(authEntries, limits)
  const usageSum = globalUsageSum(authEntries, limits)
  const accountCount = globalWeeklyAccountCount(authEntries, limits)
  const elapsedAvg = globalWeeklyElapsedTimeAverage(authEntries, limits)
  const elapsedSum = globalWeeklyElapsedTimeSum(authEntries, limits)

  const usageLabel = `Overall weekly usage (${usageSum}/${accountCount * 100})`
  const elapsedLabel = `Overall weekly elapsed (${elapsedSum}/${accountCount * 100})`

  return (
    <Box flexDirection="row" justifyContent="space-between" width={totalWidth} paddingLeft={paddingLeft}>
      <Box flexDirection="column" width={columnWidth}>
        <Text dimColor>{usageLabel}</Text>
        <ProgressBar value={usageAvg} color="green" availableWidth={columnWidth} />
      </Box>
      <Box width={gap} />
      <Box flexDirection="column" width={columnWidth}>
        <Text dimColor>{elapsedLabel}</Text>
        <ProgressBar value={elapsedAvg} color="blue" availableWidth={columnWidth} />
      </Box>
    </Box>
  )
}
