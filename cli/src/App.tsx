import React, { useEffect, useState } from 'react'
import { Box, Text, useApp, useInput, useStdout } from 'ink'
import { useAuthData } from './useAuthData'
import { GlobalSummary } from './components/GlobalSummary'
import { AccountList } from './components/AccountList'
import { AccountDetails } from './components/AccountDetails'
import { HotkeysBar } from './components/HotkeysBar'

export function App(): JSX.Element {
  const interactive = Boolean(process.stdin?.isTTY)
  const { exit } = useApp()
  const {
    authEntries,
    limits,
    activeProfileId,
    loading,
    error,
    selectedId,
    selectNext,
    selectPrevious,
    openDetailsForSelected,
    activateSelected,
    refreshAll
  } = useAuthData()
  const { stdout } = useStdout()
  const [terminalRows, setTerminalRows] = useState(stdout?.rows ?? 40)
  const [terminalColumns, setTerminalColumns] = useState(stdout?.columns ?? 80)

  useEffect(() => {
    if (!stdout) {
      return
    }
    const onResize = (): void => {
      setTerminalRows(stdout.rows ?? 40)
      setTerminalColumns(stdout.columns ?? 80)
    }
    stdout.on('resize', onResize)
    return () => {
      stdout.off('resize', onResize)
    }
  }, [stdout])

  const [showDetails, setShowDetails] = useState(false)
  const [detailsOffset, setDetailsOffset] = useState(0)
  const [detailsMaxOffset, setDetailsMaxOffset] = useState(0)
  const [launching, setLaunching] = useState(false)
  const [launchError, setLaunchError] = useState<string | null>(null)

  const errorHeight = (error ? 1 : 0) + (launchError ? 1 : 0)
  const headerLines = 1 // title row
  const summaryLines = 2 // two progress rows
  const headerHeight = headerLines + summaryLines + errorHeight
  const footerHeight = 1
  const availableContent = Math.max(1, terminalRows - headerHeight - footerHeight)
  const overlayHeight = Math.max(5, availableContent)
  const listHeight = availableContent
  const enterLabelActive = '[Enter] Activate'
  const enterIsDisabled = Boolean(selectedId && selectedId === activeProfileId)

  useInput(
    (input, key) => {
      if (key.escape || input?.toLowerCase() === 'q' || (key.ctrl && input === 'c')) {
        exit()
        return
      }
      if (showDetails) {
        if (key.downArrow) {
          setDetailsOffset((prev) => Math.min(detailsMaxOffset, prev + 1))
          return
        }
        if (key.upArrow) {
          setDetailsOffset((prev) => Math.max(0, prev - 1))
          return
        }
        if (input === ' ' || input === 'x' || input === 'X') {
          setShowDetails(false)
          setDetailsOffset(0)
        }
        return
      }
      if (key.downArrow) {
        selectNext()
        return
      }
      if (key.upArrow) {
        selectPrevious()
        return
      }
      if (key.return) {
        const selectedEntry = openDetailsForSelected()
        if (!selectedEntry) {
          return
        }
        if (selectedEntry.id === activeProfileId) {
          return
        }
        void activateSelected()
        return
      }
      if (input === ' ') {
        const entry = openDetailsForSelected()
        if (entry) {
          setShowDetails(true)
          setDetailsOffset(0)
        }
        return
      }
      if (input === 'a' || input === 'A') {
        void activateSelected()
        return
      }
      if (input === 'r' || input === 'R') {
        void refreshAll()
        return
      }
      if (input === 'x' || input === 'X') {
        setShowDetails(false)
      }
    },
    { isActive: interactive }
  )

  const backendUnreachable = Boolean(error && error.toLowerCase().includes('fetch failed'))
  const userError = backendUnreachable ? null : error
  const overlayError = userError || launchError

  return (
    <Box flexDirection="column" height={terminalRows} width={terminalColumns}>
      <Box flexDirection="column" flexShrink={0}>
        <Box flexDirection="row" justifyContent="space-between" width="100%">
          <Text>
            {'   '}
            <Text color="cyan">Codex OAuth</Text> – Dashboard
          </Text>
        </Box>

        <GlobalSummary authEntries={authEntries} limits={limits} />
      </Box>

      <Box flexDirection="column" flexGrow={1} minHeight={0}>
        {backendUnreachable ? (
          <Box flexGrow={1} alignItems="center" justifyContent="center">
            <Box borderStyle="round" borderColor="red" paddingX={2} paddingY={1}>
              <Text color="red">Backend could not be reached.</Text>
            </Box>
          </Box>
        ) : overlayError ? (
          <Box flexGrow={1} alignItems="center" justifyContent="center">
            <Box borderStyle="round" borderColor="red" paddingX={2} paddingY={1}>
              <Text color="red">{overlayError}</Text>
            </Box>
          </Box>
        ) : showDetails ? (() => {
          const entry = openDetailsForSelected()
          if (!entry) {
            return null
          }
          const overlayWidth = Math.max(40, terminalColumns - 4)
          const contentHeight = Math.max(3, overlayHeight - 2)
          const hasScroll = detailsMaxOffset > 0
          const showAboveHint = hasScroll && detailsOffset > 0
          const showBelowHint = hasScroll && detailsOffset < detailsMaxOffset

          const buildBorderLine = (kind: 'top' | 'bottom', label: string | null): string => {
            const start = kind === 'top' ? '╭' : '╰'
            const end = kind === 'top' ? '╮' : '╯'
            const fill = '─'
            const usable = Math.max(10, overlayWidth - 2)
            if (!label || label.length + 2 > usable) {
              return `${start}${fill.repeat(usable)}${end}`
            }
            const text = ` ${label} `
            const remaining = usable - text.length
            const left = Math.floor(remaining / 2)
            const right = remaining - left
            return `${start}${fill.repeat(left)}${text}${fill.repeat(right)}${end}`
          }

          const usableOverlayWidth = overlayWidth - 2
          const topBorder = buildBorderLine('top', showAboveHint ? '▲ scroll' : null)
          const bottomBorder = buildBorderLine('bottom', showBelowHint ? '▼ scroll' : null)

          return (
        <Box flexDirection="column" height={overlayHeight} alignItems="flex-start" justifyContent="center" paddingLeft={1}>
          <Text>{topBorder}</Text>
          <Box width={overlayWidth} height={contentHeight} flexDirection="row">
            <Text>│</Text>
            <Box width={usableOverlayWidth} height={contentHeight} paddingX={1}>
              <AccountDetails
                entry={entry}
                height={contentHeight}
                width={usableOverlayWidth}
                scrollOffset={detailsOffset}
                    onMaxOffsetChange={setDetailsMaxOffset}
                  />
                </Box>
                <Text>│</Text>
              </Box>
              <Text>{bottomBorder}</Text>
            </Box>
          )
        })() : (
          <AccountList
            authEntries={authEntries}
            limits={limits}
            activeProfileId={activeProfileId}
            selectedId={selectedId}
            maxHeight={listHeight}
            loading={loading}
          />
        )}
      </Box>

      <Box flexShrink={0}>
        <HotkeysBar enterLabel={enterLabelActive} enterDisabled={enterIsDisabled} />
      </Box>
    </Box>
  )
}
