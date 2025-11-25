import React from 'react'
import { Box, Text } from 'ink'

interface ProgressBarProps {
  label?: string
  value: number
  width?: number
  availableWidth?: number
  color?: 'green' | 'yellow' | 'red' | 'blue' | 'dim'
  bold?: boolean
}

function clamp(value: number): number {
  if (Number.isNaN(value)) {
    return 0
  }
  if (value < 0) {
    return 0
  }
  if (value > 100) {
    return 100
  }
  return Math.round(value)
}

function colorize(text: string, color: ProgressBarProps['color'], bold?: boolean): JSX.Element {
  if (!color || color === 'dim') {
    return <Text dimColor bold={bold}>{text}</Text>
  }
  return <Text color={color} bold={bold}>{text}</Text>
}

export function ProgressBar({ label, value, width, availableWidth, color = 'green', bold }: ProgressBarProps): JSX.Element {
  const clamped = clamp(value)
  const labelLength = label ? label.length : 0
  const percentText = `${clamped}%`.padStart(4, ' ')
  const gaps = (label ? 1 : 0) + 1 // one space after label if present, one space before percent
  const computedWidth = width ?? (availableWidth
    ? Math.max(3, availableWidth - labelLength - percentText.length - gaps)
    : 24)

  const filledCount = Math.round((clamped / 100) * computedWidth)
  const emptyCount = computedWidth - filledCount
  const filled = '█'.repeat(filledCount)
  const empty = '░'.repeat(emptyCount)
  const percentTextPadded = percentText

  return (
    <Box flexDirection="row" alignItems="center">
      {label ? (
        <>
          <Text dimColor bold={bold}>{label}</Text>
          <Text> </Text>
        </>
      ) : null}
      <Box>
        {colorize(filled, color, bold)}
        <Text dimColor bold={bold}>{empty}</Text>
      </Box>
      <Text> </Text>
      <Text bold={bold}>{percentTextPadded}</Text>
    </Box>
  )
}
