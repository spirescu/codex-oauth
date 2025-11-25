import React from 'react'
import { Box, Text, useStdout } from 'ink'
import type { AuthSummary, RateLimitSnapshot, RateLimitWindow } from '../types'
import { ProgressBar } from './ProgressBar'
import { hasValidWeekly, timeProgressPercent } from '../usage-metrics'

interface AccountListProps {
  authEntries: AuthSummary[]
  limits: Record<string, RateLimitSnapshot | null>
  activeProfileId: string | null
  selectedId: string | null
  maxHeight?: number
  loading?: boolean
}

function fiveHourWindow(snapshot: RateLimitSnapshot | null): RateLimitWindow | null {
  return snapshot?.primary ?? null
}

function weeklyWindow(snapshot: RateLimitSnapshot | null): RateLimitWindow | null {
  return snapshot?.secondary ?? null
}

function classifyUsageColor(percent: number): 'green' | 'yellow' | 'red' {
  if (percent < 70) {
    return 'green'
  }
  if (percent < 90) {
    return 'yellow'
  }
  return 'red'
}

export function AccountList({ authEntries, limits, activeProfileId, selectedId, maxHeight, loading }: AccountListProps): JSX.Element {
  const { stdout } = useStdout()
  const columns = stdout?.columns
  const isWide = typeof columns === 'number' && columns >= 100
  const totalWidth = Math.max(60, columns ?? 100)
  const innerWidth = totalWidth - 2
  const cellPadding = 2
  const contentWidth = innerWidth - cellPadding * 2
  const barGap = 3
  const slotWidthWide = Math.max(18, Math.floor((contentWidth - 2 * barGap) / 3))
  const slotWidthStacked = contentWidth

  const entries = [...authEntries]
  entries.sort((a, b) => {
    const aValid = hasValidWeekly(limits, a.id)
    const bValid = hasValidWeekly(limits, b.id)
    if (aValid === bValid) {
      return 0
    }
    return aValid ? -1 : 1
  })

  const rowHeight = isWide ? 3 : 5

  const innerHeight = typeof maxHeight === 'number' ? Math.max(1, maxHeight - 2) : null
  const rowsSpace = innerHeight
    ? Math.max(1, innerHeight)
    : null

  const initialVisible = rowsSpace
    ? Math.max(1, Math.floor(rowsSpace / rowHeight))
    : entries.length
  const needsScroll = innerHeight !== null && entries.length > initialVisible

  const selectedIndex = entries.findIndex((entry) => entry.id === selectedId)
  const maxOffset = Math.max(0, entries.length - initialVisible)

  let scrollOffset = 0
  if (innerHeight && initialVisible < entries.length && selectedIndex >= 0) {
    scrollOffset = selectedIndex - Math.floor(initialVisible / 2)
    if (scrollOffset < 0) {
      scrollOffset = 0
    }
    if (scrollOffset > maxOffset) {
      scrollOffset = maxOffset
    }
  }

  let visibleEntries = rowsSpace
    ? entries.slice(scrollOffset, scrollOffset + initialVisible)
    : entries

  let showAboveHint = false
  let showBelowHint = false

  if (innerHeight !== null) {
    const potentialAboveHint = scrollOffset > 0
    const potentialBelowHint = scrollOffset + visibleEntries.length < entries.length

    showAboveHint = needsScroll && potentialAboveHint
    showBelowHint = needsScroll && potentialBelowHint

    const adjustedVisible = needsScroll
      ? Math.max(1, Math.floor(Math.max(1, rowsSpace ?? 1) / rowHeight))
      : entries.length
    const adjustedMaxOffset = Math.max(0, entries.length - adjustedVisible)
    let adjustedOffset = needsScroll ? scrollOffset : 0
    if (adjustedOffset > adjustedMaxOffset) {
      adjustedOffset = adjustedMaxOffset
    }
    visibleEntries = entries.slice(adjustedOffset, adjustedOffset + adjustedVisible)
    showAboveHint = needsScroll && adjustedOffset > 0 && showAboveHint
    showBelowHint = needsScroll && adjustedOffset + visibleEntries.length < entries.length && showBelowHint
  }

  const buildBorderLine = (kind: 'top' | 'bottom', label: string | null): string => {
    const start = kind === 'top' ? '╔' : '╚'
    const end = kind === 'top' ? '╗' : '╝'
    const fill = '═'
    const usable = Math.max(10, innerWidth)
    if (!label || label.length + 2 > usable) {
      return `${start}${fill.repeat(usable)}${end}`
    }
    const text = ` ${label} `
    const remaining = usable - text.length
    const left = Math.floor(remaining / 2)
    const right = remaining - left
    return `${start}${fill.repeat(left)}${text}${fill.repeat(right)}${end}`
  }

  const topBorder = buildBorderLine('top', showAboveHint ? '▲ more accounts' : null)
  const bottomBorder = buildBorderLine('bottom', showBelowHint ? '▼ more accounts' : null)

  const BorderLine = ({ children, pad = true }: { children: React.ReactNode; pad?: boolean }): JSX.Element => (
    <Box flexDirection="row" width={totalWidth}>
      <Text>║</Text>
      <Box flexDirection="row" width={innerWidth}>
        {pad ? (
          <Box flexDirection="row" width={innerWidth} paddingX={cellPadding}>
            <Box flexDirection="row" width={contentWidth}>
              {children}
            </Box>
          </Box>
        ) : (
          <Box flexDirection="row" width={innerWidth}>
            {children}
          </Box>
        )}
      </Box>
      <Text>║</Text>
    </Box>
  )

  if (loading) {
    return (
      <Box width={totalWidth} height={maxHeight ?? undefined} justifyContent="center" alignItems="center">
        <Box
          justifyContent="center"
          alignItems="center"
          borderStyle="round"
          borderColor="cyan"
          paddingX={2}
          paddingY={1}
        >
          <Text dimColor>Loading…</Text>
        </Box>
      </Box>
    )
  }

  if (entries.length === 0) {
    return (
      <Box
        width={totalWidth}
        height={maxHeight ?? undefined}
        justifyContent="center"
        alignItems="center"
        borderStyle="round"
        borderColor="yellow"
        paddingX={2}
        paddingY={1}
      >
        <Text dimColor>No auth files found.</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" width={totalWidth}>
      <Text>{topBorder}</Text>
      <Box flexDirection="column" width={totalWidth}>
      {visibleEntries.map((entry, index) => {
        const snapshot = limits[entry.id] ?? null
        const fiveHour = fiveHourWindow(snapshot)
        const weekly = weeklyWindow(snapshot)
        const selected = selectedId === entry.id
        const isActive = activeProfileId === entry.id
        const hasWeekly = hasValidWeekly(limits, entry.id)

        const fiveUsage = fiveHour?.usedPercent ?? 0
        const weeklyUsage = weekly?.usedPercent ?? 0
        const weeklyTimeProgress = weekly ? timeProgressPercent(weekly) : 0

        const fiveColor = classifyUsageColor(fiveUsage)
        const weeklyColor = classifyUsageColor(weeklyUsage)

        const planText = snapshot?.planType ?? entry.planType ?? '—'
        const displayNameBase =
          planText && planText !== '—'
            ? `${entry.id} (${planText})`
            : `${entry.id} (none)`

        const isSelected = selectedId === entry.id

        return (
          <React.Fragment key={entry.id}>
            <BorderLine>
              <Box flexDirection="row" paddingX={0} paddingY={0} width={contentWidth}>
                <Box width={28}>
                  <Text
                    color={isSelected ? 'whiteBright' : undefined}
                    bold={isSelected}
                  >
                    {displayNameBase}
                    {isActive ? (
                      <>
                        {' '}
                        <Text color="cyanBright" bold={isSelected}>[Active]</Text>
                      </>
                    ) : null}
                  </Text>
                </Box>
                <Box width={36}>
                  <Text
                    color={isSelected ? 'white' : undefined}
                    dimColor={!isSelected}
                    bold={isSelected}
                  >
                    {entry.email ?? '—'}
                  </Text>
                </Box>
                <Box flexGrow={1} alignItems="flex-end" flexDirection="row" justifyContent="flex-end" columnGap={2}>
                  {(() => {
                    const expSeconds = entry.accessToken?.exp ?? null
                    const expDate = expSeconds ? new Date(expSeconds * 1000) : null
                    const diffDays = expDate ? (expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24) : null
                    const expColor =
                      diffDays !== null && diffDays < 1
                        ? 'red'
                        : diffDays !== null && diffDays < 3
                          ? 'yellow'
                          : undefined
                    const expText = expDate
                      ? expDate.toISOString().replace('T', ' ').slice(0, 19)
                      : '—'
                    return (
                      <Text color={expColor} dimColor={!isSelected && !expColor} bold={isSelected}>
                        Expires at: {expText}
                      </Text>
                    )
                  })()}
                  <Text bold={isSelected}>
                    {entry.hasApiKey ? 'API key configured' : 'No API key'}
                  </Text>
                </Box>
              </Box>
            </BorderLine>
            <BorderLine>
              <Box flexDirection="row" paddingX={0} width={contentWidth}>

                {isWide ? (
                  <Box flexDirection="row">
                    <Box width={slotWidthWide} marginRight={barGap}>
                      {fiveHour ? (
                        <ProgressBar
                          label="5h limit"
                          value={fiveUsage}
                          color={fiveColor}
                          bold={isSelected}
                          availableWidth={slotWidthWide}
                        />
                      ) : (
                        <Text dimColor bold={isSelected}>5h limit —</Text>
                      )}
                    </Box>
                    <Box width={slotWidthWide} marginRight={barGap}>
                      {weekly ? (
                        <ProgressBar
                          label="Weekly limit"
                          value={weeklyUsage}
                          color={weeklyColor}
                          bold={isSelected}
                          availableWidth={slotWidthWide}
                        />
                      ) : (
                        <Text dimColor bold={isSelected}>Weekly limit —</Text>
                      )}
                    </Box>
                    <Box width={slotWidthWide}>
                      {weekly ? (
                        <ProgressBar
                          label="Weekly elapsed"
                          value={weeklyTimeProgress}
                          color="blue"
                          bold={isSelected}
                          availableWidth={slotWidthWide}
                        />
                      ) : (
                        <Text dimColor bold={isSelected}>Weekly elapsed —</Text>
                      )}
                    </Box>
                  </Box>
                ) : (
                  <>
                    {fiveHour ? (
                        <ProgressBar
                          label="5h limit"
                          value={fiveUsage}
                          color={fiveColor}
                          bold={isSelected}
                          availableWidth={slotWidthStacked}
                        />
                    ) : (
                      <Text dimColor bold={isSelected}>5h limit —</Text>
                    )}
                    {weekly ? (
                        <ProgressBar
                          label="Weekly limit"
                          value={weeklyUsage}
                          color={weeklyColor}
                          bold={isSelected}
                          availableWidth={slotWidthStacked}
                        />
                      ) : (
                        <Text dimColor bold={isSelected}>Weekly limit —</Text>
                      )}
                    {weekly ? (
                        <ProgressBar
                          label="Weekly elapsed"
                          value={weeklyTimeProgress}
                          color="blue"
                          bold={isSelected}
                          availableWidth={slotWidthStacked}
                        />
                      ) : (
                        <Text dimColor bold={isSelected}>Weekly elapsed —</Text>
                      )}
                  </>
                )}
              </Box>
            </BorderLine>
            {index < visibleEntries.length - 1 ? (
              <BorderLine pad={false}>
                <Text dimColor>
                  {'─'.repeat(Math.max(10, innerWidth))}
                </Text>
              </BorderLine>
            ) : null}
          </React.Fragment>
        )
      })}
      </Box>
      <Text>{bottomBorder}</Text>
    </Box>
  )
}
