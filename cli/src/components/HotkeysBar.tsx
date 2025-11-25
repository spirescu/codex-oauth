import React from 'react'
import { Box, Text, useStdout } from 'ink'

interface HotkeysBarProps {
  enterLabel: string
  enterDisabled?: boolean
}

export function HotkeysBar({ enterLabel, enterDisabled }: HotkeysBarProps): JSX.Element {
  const { stdout } = useStdout()
  const columns = stdout?.columns ?? 80

  const label =
    `[↑/↓] Move  [Space] Details  ${enterLabel}  [R] Refresh  [Q] Quit`
  const padded = `   ${label}`.padEnd(columns, ' ')

  return (
    <Box>
      <Text color="whiteBright" backgroundColor="gray">
        {padded.replace(enterLabel, '')}
        <Text dimColor={enterDisabled}>{enterLabel}</Text>
      </Text>
    </Box>
  )
}
