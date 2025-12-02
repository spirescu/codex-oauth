import React from 'react'
import { Box, Text } from 'ink'
import type { AuthSummary } from '../types.js'

interface AccountDetailsProps {
  entry: AuthSummary
  height: number
  width: number
  scrollOffset: number
  onMaxOffsetChange: (value: number) => void
}

function formatUnixSeconds(value: number | null | undefined): string {
  if (typeof value !== 'number') {
    return '—'
  }
  const date = new Date(value * 1000)
  if (Number.isNaN(date.getTime())) {
    return String(value)
  }
  const year = date.getFullYear().toString().padStart(4, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const seconds = date.getSeconds().toString().padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

function formatUnixMillis(value: number | null | undefined): string {
  if (typeof value !== 'number') {
    return '—'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return String(value)
  }
  const year = date.getFullYear().toString().padStart(4, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const seconds = date.getSeconds().toString().padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

function formatIso(value: string | null | undefined): string {
  if (!value) {
    return '—'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  const year = date.getFullYear().toString().padStart(4, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const seconds = date.getSeconds().toString().padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

export function AccountDetails({ entry, height, width, scrollOffset, onMaxOffsetChange }: AccountDetailsProps): JSX.Element {
  const idt = entry.idToken
  const at = entry.accessToken

  const twoColumn = width >= 80
  const gapWidth = twoColumn ? 2 : 0
  const columnWidth = twoColumn ? Math.floor((width - gapWidth) / 2) : width
  const labelWidth = 16
  const valueWidth = Math.max(4, columnWidth - labelWidth - 1)

  const idLines: JSX.Element[] = []
  const atLines: JSX.Element[] = []

  const truncate = (value: string, max: number): string => {
    if (value.length <= max) {
      return value
    }
    if (max <= 3) {
      return value.slice(0, max)
    }
    return `${value.slice(0, max - 3)}...`
  }

  const field = (label: string, value: string, maxValueWidth: number): JSX.Element => (
    <Text key={label} wrap="truncate-end">
      <Text dimColor>{label.padEnd(labelWidth, ' ')}</Text>{' '}
      <Text>{truncate(value, Math.max(1, maxValueWidth))}</Text>
    </Text>
  )

  if (idt) {
    idLines.push(<Text key="idt-header" color="yellow" bold>ID token</Text>)
    idLines.push(field('Issuer', idt.iss ?? '—', valueWidth))
    idLines.push(field('Audience', idt.aud?.join(', ') ?? '—', valueWidth))
    idLines.push(field('Subject', idt.sub ?? '—', valueWidth))
    idLines.push(field('Provider', idt.auth_provider ?? '—', valueWidth))
    idLines.push(field('Auth time', formatUnixSeconds(idt.auth_time), valueWidth))
    idLines.push(field('Issued at', formatUnixSeconds(idt.iat), valueWidth))
    idLines.push(field('Expires at', formatUnixSeconds(idt.exp), valueWidth))
    idLines.push(field('Refresh-at', formatUnixSeconds(idt.rat), valueWidth))
    idLines.push(field('JWT ID', idt.jti ?? '—', valueWidth))
    idLines.push(field('Session ID', idt.sid ?? '—', valueWidth))
    idLines.push(field('At hash', idt.at_hash ?? '—', valueWidth))
    idLines.push(field('Email', idt.email ?? '—', valueWidth))
    idLines.push(field('Email verified', idt.email_verified === true ? 'yes' : 'no', valueWidth))
    idLines.push(field('ChatGPT user', idt['https://api.openai.com/auth']?.chatgpt_user_id ?? '—', valueWidth))
    idLines.push(field('ChatGPT account', idt['https://api.openai.com/auth']?.chatgpt_account_id ?? '—', valueWidth))
    idLines.push(field('Plan', idt['https://api.openai.com/auth']?.chatgpt_plan_type ?? '—', valueWidth))
    idLines.push(field('Sub start', formatIso(idt['https://api.openai.com/auth']?.chatgpt_subscription_active_start ?? null), valueWidth))
    idLines.push(field('Sub until', formatIso(idt['https://api.openai.com/auth']?.chatgpt_subscription_active_until ?? null), valueWidth))
    idLines.push(field('Sub checked', formatIso(idt['https://api.openai.com/auth']?.chatgpt_subscription_last_checked ?? null), valueWidth))
    idLines.push(field('Org', idt['https://api.openai.com/auth']?.organizations?.[0]?.title ?? '—', valueWidth))
  } else {
    idLines.push(<Text key="no-idt" dimColor>No ID token details present.</Text>)
  }

  if (at) {
    atLines.push(<Text key="at-header" color="yellow" bold>Access token</Text>)
    atLines.push(field('Issuer', at.iss ?? '—', valueWidth))
    atLines.push(field('Audience', at.aud?.join(', ') ?? '—', valueWidth))
    atLines.push(field('Session', at.session_id ?? '—', valueWidth))
    atLines.push(field('Client', at.client_id ?? '—', valueWidth))
    atLines.push(field('Issued at', formatUnixSeconds(at.iat), valueWidth))
    atLines.push(field('Not before', formatUnixSeconds(at.nbf), valueWidth))
    atLines.push(field('Expires at', formatUnixSeconds(at.exp), valueWidth))
    atLines.push(field('JWT ID', at.jti ?? '—', valueWidth))
    atLines.push(field('Pwd auth time', formatUnixMillis(at.pwd_auth_time), valueWidth))
    atLines.push(field('Scopes', at.scp && at.scp.length > 0 ? at.scp.join(', ') : '—', valueWidth))
    atLines.push(field('ChatGPT account', at['https://api.openai.com/auth']?.chatgpt_account_id ?? '—', valueWidth))
    atLines.push(field('Account user', at['https://api.openai.com/auth']?.chatgpt_account_user_id ?? '—', valueWidth))
    atLines.push(field('Residency', at['https://api.openai.com/auth']?.chatgpt_compute_residency ?? '—', valueWidth))
    atLines.push(field('Plan', at['https://api.openai.com/auth']?.chatgpt_plan_type ?? '—', valueWidth))
    atLines.push(field('ChatGPT user', at['https://api.openai.com/auth']?.chatgpt_user_id ?? '—', valueWidth))
    atLines.push(field('User ID', at['https://api.openai.com/auth']?.user_id ?? '—', valueWidth))
    atLines.push(field('Profile email', at['https://api.openai.com/profile']?.email ?? '—', valueWidth))
    atLines.push(field('Profile verified', at['https://api.openai.com/profile']?.email_verified === true ? 'yes' : 'no', valueWidth))
  } else {
    atLines.push(<Text key="no-at" dimColor>No access token details present.</Text>)
  }

  const titleLine = (
    <Text key="title" wrap="truncate-end">
      {truncate(`Details for ${entry.id}`, width)}
    </Text>
  )

  const apiLine = entry.hasApiKey && entry.openaiApiKey
    ? (
      <Text key="api" wrap="truncate-end">
        API key: <Text color="yellow">{truncate(entry.openaiApiKey, Math.max(4, width - 8))}</Text>
      </Text>
    )
    : null

  const rows: JSX.Element[] = []

  if (twoColumn) {
    const maxLen = Math.max(idLines.length, atLines.length)
    for (let i = 0; i < maxLen; i += 1) {
      const left = idLines[i] ?? <Text key={`empty-left-${i}`}> </Text>
      const right = atLines[i] ?? <Text key={`empty-right-${i}`}> </Text>
      rows.push(
        <Box key={`row-${i}`} flexDirection="row">
          <Box width={columnWidth}>{left}</Box>
          <Box width={gapWidth}>{gapWidth ? <Text>{' '.repeat(gapWidth)}</Text> : null}</Box>
          <Box width={columnWidth}>{right}</Box>
        </Box>
      )
    }
  } else {
    rows.push(...idLines)
    rows.push(...atLines)
  }

  const lines: JSX.Element[] = [titleLine, ...rows]
  if (apiLine) {
    lines.push(apiLine)
  }

  const visibleHeight = Math.max(1, height)
  const maxOffset = Math.max(0, lines.length - visibleHeight)
  const clampedOffset = Math.min(scrollOffset, maxOffset)
  const visibleLines = lines.slice(clampedOffset, clampedOffset + visibleHeight)

  React.useEffect(() => {
    onMaxOffsetChange(maxOffset)
  }, [maxOffset, onMaxOffsetChange])

  return (
    <Box flexDirection="column" height={height} width={width}>
      {visibleLines}
    </Box>
  )
}
