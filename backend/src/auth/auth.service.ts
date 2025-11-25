import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common'
import * as fs from 'fs/promises'
import * as path from 'path'
import {
  AuthDotJson,
  CreditsSnapshot,
  RateLimitSnapshot,
  RateLimitWindow,
  TokenData
} from './types'

const AUTH_BASE_URL = 'https://auth.openai.com'
const CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann'
const REFRESH_TOKEN_URL_OVERRIDE_ENV_VAR = 'CODEX_REFRESH_TOKEN_URL_OVERRIDE'
const REFRESH_TOKEN_EXPIRED_MESSAGE =
  'Your access token could not be refreshed because your refresh token has expired. Please log out and sign in again.'
const REFRESH_TOKEN_REUSED_MESSAGE =
  'Your access token could not be refreshed because your refresh token was already used. Please log out and sign in again.'
const REFRESH_TOKEN_INVALIDATED_MESSAGE =
  'Your access token could not be refreshed because your refresh token was revoked. Please log out and sign in again.'
const REFRESH_TOKEN_UNKNOWN_MESSAGE =
  'Your access token could not be refreshed. Please log out and sign in again.'

function projectRoot(): string {
  const cwd = process.cwd()
  const base = path.basename(cwd)
  if (base === 'backend') {
    return path.dirname(cwd)
  }
  return cwd
}

function authDir(): string {
  return path.join(projectRoot(), '.codex')
}

function authFilePath(id: string): string {
  return path.join(authDir(), `${id}.auth.json`)
}

const CHATGPT_BASE_URL =
  process.env.CHATGPT_BASE_URL ?? 'https://chatgpt.com/backend-api'

function refreshPayloadDir(): string {
  return path.join(projectRoot(), 'auth-refresh-payloads')
}

async function persistRefreshPayload(id: string, payload: unknown): Promise<void> {
  try {
    const baseDir = refreshPayloadDir()
    const targetDir = path.join(baseDir, id)
    await fs.mkdir(targetDir, { recursive: true })
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filePath = path.join(targetDir, `${timestamp}.json`)
    const body = safeStringify(payload)
    await fs.writeFile(filePath, body, 'utf8')
  } catch {
  }
}

function safeStringify(value: unknown): string {
  const seen = new WeakSet<object>()
  return JSON.stringify(
    value,
    (_key, current) => {
      if (typeof current === 'function') {
        return `[Function ${current.name ?? 'anonymous'}]`
      }
      if (typeof current === 'object' && current !== null) {
        if (seen.has(current as object)) {
          return '[Circular]'
        }
        seen.add(current as object)
      }
      return current
    },
    2
  )
}

function serializeError(value: unknown): unknown {
  if (value instanceof Error) {
    const base: Record<string, unknown> = {
      name: value.name,
      message: value.message,
      stack: value.stack ?? null
    }
    for (const [key, val] of Object.entries(value)) {
      if (!(key in base)) {
        base[key] = val
      }
    }
    return base
  }
  if (typeof value === 'object' && value !== null) {
    return value
  }
  return { value }
}

interface IdTokenPayload {
  aud?: string[];
  iss?: string;
  sub?: string;
  auth_provider?: string;
  auth_time?: number;
  iat?: number;
  email?: string;
  exp?: number;
  rat?: number;
  jti?: string;
  sid?: string;
  at_hash?: string;
  email_verified?: boolean;
  ['https://api.openai.com/auth']?: {
    chatgpt_plan_type?: string;
    chatgpt_account_id?: string;
    chatgpt_user_id?: string;
    chatgpt_subscription_active_start?: string;
    chatgpt_subscription_active_until?: string;
    chatgpt_subscription_last_checked?: string;
    groups?: unknown[];
    organizations?: {
      id?: string;
      is_default?: boolean;
      role?: string;
      title?: string;
    }[];
    user_id?: string;
  };
}

interface AccessTokenPayload {
  aud?: string[];
  iss?: string;
  sub?: string;
  client_id?: string;
  iat?: number;
  nbf?: number;
  exp?: number;
  jti?: string;
  pwd_auth_time?: number;
  scp?: string[];
  session_id?: string;
  ['https://api.openai.com/auth']?: {
    chatgpt_account_id?: string;
    chatgpt_account_user_id?: string;
    chatgpt_compute_residency?: string;
    chatgpt_plan_type?: string;
    chatgpt_user_id?: string;
    user_id?: string;
  };
  ['https://api.openai.com/profile']?: {
    email?: string;
    email_verified?: boolean;
  };
}

export interface AuthSummary {
  id: string;
  hasApiKey: boolean;
  email?: string | null;
  planType?: string | null;
  expiresAt?: string | null;
  accessTokenLast4?: string | null;
  accountId?: string | null;
  lastRefresh?: string | null;
  openaiUserType?: string | null;
  openaiUserSub?: string | null;
   openaiApiKey?: string | null;
  idToken?: IdTokenPayload | null;
  accessToken?: AccessTokenPayload | null;
}

function decodeIdToken(idToken: string | undefined): IdTokenPayload | null {
  if (!idToken) {
    return null
  }
  const parts = idToken.split('.')
  if (parts.length !== 3) {
    return null
  }
  const payloadB64 = parts[1]
  try {
    const padded = payloadB64.padEnd(payloadB64.length + ((4 - (payloadB64.length % 4)) % 4), '=')
    const json = Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    return JSON.parse(json) as IdTokenPayload
  } catch {
    return null
  }
}

function decodeAccessToken(accessToken: string | undefined): AccessTokenPayload | null {
  if (!accessToken) {
    return null
  }
  const parts = accessToken.split('.')
  if (parts.length !== 3) {
    return null
  }
  const payloadB64 = parts[1]
  try {
    const padded = payloadB64.padEnd(payloadB64.length + ((4 - (payloadB64.length % 4)) % 4), '=')
    const json = Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    return JSON.parse(json) as AccessTokenPayload
  } catch {
    return null
  }
}

function summarizeAuth(id: string, auth: AuthDotJson): AuthSummary {
  const hasApiKey = Boolean(auth.OPENAI_API_KEY)
  const tokens = auth.tokens
  const idTokenPayload = tokens ? decodeIdToken(tokens.id_token) : null
  const accessTokenPayload = tokens ? decodeAccessToken(tokens.access_token) : null

  const email = idTokenPayload?.email ?? null
  const planType =
    idTokenPayload?.['https://api.openai.com/auth']?.chatgpt_plan_type ?? null

  const expSeconds = idTokenPayload?.exp
  const expiresAt =
    typeof expSeconds === 'number'
      ? new Date(expSeconds * 1000).toISOString()
      : null

  const accessTokenLast4 =
    tokens && tokens.access_token && tokens.access_token.length >= 4
      ? tokens.access_token.slice(-4)
      : null

  const accountId =
    tokens?.account_id ??
    idTokenPayload?.['https://api.openai.com/auth']?.chatgpt_account_id ??
    null

  const openaiUserSub = idTokenPayload?.sub ?? null
  const openaiUserType =
    typeof openaiUserSub === 'string' && openaiUserSub.includes('|')
      ? openaiUserSub.split('|')[0]
      : null

  return {
    id,
    hasApiKey,
    email,
    planType,
    expiresAt,
    accessTokenLast4,
    accountId,
    lastRefresh: auth.last_refresh ?? null,
    openaiUserType,
    openaiUserSub,
    openaiApiKey: auth.OPENAI_API_KEY ?? null,
    idToken: idTokenPayload,
    accessToken: accessTokenPayload
  }
}

interface BackendRateLimitWindowSnapshot {
  used_percent?: number;
  limit_window_seconds?: number;
  reset_at?: number;
}

interface BackendRateLimitStatusDetails {
  primary_window?: BackendRateLimitWindowSnapshot | null;
  secondary_window?: BackendRateLimitWindowSnapshot | null;
}

interface BackendCreditStatusDetails {
  has_credits: boolean;
  unlimited: boolean;
  balance?: string | null;
}

interface BackendRateLimitStatusPayload {
  plan_type?: string | null;
  rate_limit?: BackendRateLimitStatusDetails | null;
  credits?: BackendCreditStatusDetails | null;
}

function mapRateLimitWindow(
  snapshot: BackendRateLimitWindowSnapshot | null | undefined
): RateLimitWindow | null {
  if (!snapshot) {
    return null
  }
  const usedPercent = typeof snapshot.used_percent === 'number' ? snapshot.used_percent : 0
  const seconds =
    typeof snapshot.limit_window_seconds === 'number'
      ? snapshot.limit_window_seconds
      : 0
  const windowMinutes =
    seconds > 0 ? Math.floor((seconds + 59) / 60) : null
  const resetsAt =
    typeof snapshot.reset_at === 'number' ? snapshot.reset_at : null

  return {
    usedPercent,
    windowMinutes,
    resetsAt
  }
}

function mapCredits(details: BackendCreditStatusDetails | null | undefined): CreditsSnapshot | null {
  if (!details) {
    return null
  }
  return {
    hasCredits: details.has_credits,
    unlimited: details.unlimited,
    balance: details.balance ?? null
  }
}

function mapRateLimitSnapshot(payload: BackendRateLimitStatusPayload): RateLimitSnapshot {
  const primary = mapRateLimitWindow(payload.rate_limit?.primary_window ?? null)
  const secondary = mapRateLimitWindow(payload.rate_limit?.secondary_window ?? null)
  const credits = mapCredits(payload.credits ?? null)

  return {
    planType: payload.plan_type ?? null,
    primary,
    secondary,
    credits
  }
}

type RefreshTokenFailedReason = 'expired' | 'exhausted' | 'revoked' | 'other'

interface RefreshTokenFailedErrorShape {
  reason: RefreshTokenFailedReason;
  message: string;
}

function extractRefreshTokenErrorCode(body: string): string | null {
  if (!body.trim()) {
    return null
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') {
    return null
  }
  const root = parsed as Record<string, unknown>
  const errorField = root.error
  if (errorField && typeof errorField === 'object' && !Array.isArray(errorField)) {
    const obj = errorField as Record<string, unknown>
    const code = obj.code
    if (typeof code === 'string') {
      return code
    }
  }
  if (typeof errorField === 'string') {
    return errorField
  }
  const code = root.code
  if (typeof code === 'string') {
    return code
  }
  return null
}

function classifyRefreshTokenFailure(body: string): RefreshTokenFailedErrorShape {
  const code = extractRefreshTokenErrorCode(body)
  const normalized = code ? code.toLowerCase() : null
  let reason: RefreshTokenFailedReason
  switch (normalized) {
    case 'refresh_token_expired':
      reason = 'expired'
      break
    case 'refresh_token_reused':
      reason = 'exhausted'
      break
    case 'refresh_token_invalidated':
      reason = 'revoked'
      break
    default:
      reason = 'other'
      break
  }
  let message: string
  switch (reason) {
    case 'expired':
      message = REFRESH_TOKEN_EXPIRED_MESSAGE
      break
    case 'exhausted':
      message = REFRESH_TOKEN_REUSED_MESSAGE
      break
    case 'revoked':
      message = REFRESH_TOKEN_INVALIDATED_MESSAGE
      break
    default:
      message = REFRESH_TOKEN_UNKNOWN_MESSAGE
      break
  }
  return { reason, message }
}

function refreshTokenEndpoint(): string {
  const override = process.env[REFRESH_TOKEN_URL_OVERRIDE_ENV_VAR]
  if (override && override.length > 0) {
    return override
  }
  return `${AUTH_BASE_URL}/oauth/token`
}

@Injectable()
export class AuthService {
  private async loadAuthFile(id: string): Promise<{ auth: AuthDotJson; file: string }> {
    const file = authFilePath(id)

    let raw: string
    try {
      raw = await fs.readFile(file, 'utf8')
    } catch {
      throw new NotFoundException(`Auth file not found for id '${id}'`)
    }

    let auth: AuthDotJson
    try {
      auth = JSON.parse(raw) as AuthDotJson
    } catch (err) {
      throw new InternalServerErrorException(
        `Failed to parse auth JSON for '${id}': ${String(err)}`
      )
    }

    return { auth, file }
  }

  async listAuthFiles(): Promise<AuthSummary[]> {
    const dir = authDir()
    let entries: string[]
    try {
      entries = await fs.readdir(dir)
    } catch {
      return []
    }

    const summaries: AuthSummary[] = []
    for (const entry of entries) {
      if (!entry.endsWith('.auth.json')) {
        continue
      }
      const id = entry.replace(/\.auth\.json$/, '')
      try {
        const raw = await fs.readFile(path.join(dir, entry), 'utf8')
        const auth = JSON.parse(raw) as AuthDotJson
        summaries.push(summarizeAuth(id, auth))
      } catch {
        // Skip malformed files
      }
    }

    return summaries
  }

  async refreshAuthFile(id: string): Promise<AuthSummary> {
    const { auth, file } = await this.loadAuthFile(id)

    const refreshToken = auth.tokens?.refresh_token
    if (!refreshToken) {
      throw new InternalServerErrorException(
        `No refresh_token present in auth file for '${id}'.`
      )
    }

    const endpoint = refreshTokenEndpoint()
    let response: Response
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          client_id: CLIENT_ID,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          scope: 'openid profile email'
        })
      })
    } catch (err) {
      await persistRefreshPayload(id, {
        type: 'refresh-error',
        error: serializeError(err)
      })
      const rawMessage =
        err instanceof Error ? err.message : String(err)
      const hint = rawMessage.includes('400 Bad Request')
        ? ' The stored refresh token is likely invalid or expired. Please re-authenticate and generate a fresh auth.json for this id.'
        : ''
      throw new InternalServerErrorException(
        `Failed to refresh token for '${id}': ${rawMessage}.${hint}`
      )
    }

    if (response.status === 401) {
      const body = await response.text().catch(() => '')
      await persistRefreshPayload(id, {
        type: 'refresh-error',
        error: body || null
      })
      const failed = classifyRefreshTokenFailure(body)
      throw new InternalServerErrorException(failed.message)
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      await persistRefreshPayload(id, {
        type: 'refresh-error',
        error: text || null
      })
      throw new InternalServerErrorException(
        `Failed to refresh token: ${response.status} ${response.statusText}: ${text}`
      )
    }

    let refreshedToken: {
      id_token?: string;
      access_token?: string;
      refresh_token?: string;
      [key: string]: unknown;
    }
    try {
      refreshedToken = (await response.json()) as typeof refreshedToken
    } catch (err) {
      await persistRefreshPayload(id, {
        type: 'refresh-error',
        error: serializeError(err)
      })
      throw new InternalServerErrorException(
        `Failed to decode refreshed token payload for '${id}': ${String(err)}`
      )
    }

    const existingTokens: TokenData = auth.tokens ?? {
      id_token: '',
      access_token: '',
      refresh_token: refreshToken
    }

    const updatedTokens: TokenData = {
      ...existingTokens,
      id_token: refreshedToken.id_token ?? existingTokens.id_token,
      access_token: refreshedToken.access_token ?? existingTokens.access_token,
      refresh_token: refreshedToken.refresh_token ?? existingTokens.refresh_token,
      account_id: existingTokens.account_id
    }

    const updatedAuth: AuthDotJson = {
      ...auth,
      tokens: updatedTokens,
      last_refresh: new Date().toISOString()
    }

    await persistRefreshPayload(id, refreshedToken)
    await fs.writeFile(file, JSON.stringify(updatedAuth, null, 2), 'utf8')

    return summarizeAuth(id, updatedAuth)
  }

  async getLimitsForAuth(id: string): Promise<RateLimitSnapshot> {
    const { auth } = await this.loadAuthFile(id)

    const tokens = auth.tokens
    if (!tokens?.access_token) {
      throw new InternalServerErrorException(
        `No access_token present in auth file for '${id}'.`
      )
    }
    const accountId = tokens.account_id
    if (!accountId) {
      throw new InternalServerErrorException(
        `No account_id present in auth file for '${id}'.`
      )
    }

    const base = CHATGPT_BASE_URL.endsWith('/')
      ? CHATGPT_BASE_URL.slice(0, -1)
      : CHATGPT_BASE_URL
    const url = `${base}/wham/usage`

    let response: Response
    try {
      // Use global fetch (Node 18+) to call the ChatGPT backend.
      response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          'ChatGPT-Account-Id': accountId
        }
      })
    } catch (err) {
      throw new InternalServerErrorException(
        `Failed to fetch rate limits for '${id}': ${String(err)}`
      )
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new InternalServerErrorException(
        `Rate limits request failed for '${id}': ${response.status} ${response.statusText} ${body}`
      )
    }

    let payload: BackendRateLimitStatusPayload
    try {
      payload = (await response.json()) as BackendRateLimitStatusPayload
    } catch (err) {
      throw new InternalServerErrorException(
        `Failed to decode rate limits payload for '${id}': ${String(err)}`
      )
    }

    return mapRateLimitSnapshot(payload)
  }

  async getCurrentProfileId(): Promise<{ id: string | null }> {
    const dir = authDir()
    const file = path.join(dir, 'current.tmp')
    let raw: string
    try {
      raw = await fs.readFile(file, 'utf8')
    } catch {
      return { id: null }
    }
    const trimmed = raw.trim()
    if (!trimmed) {
      return { id: null }
    }
    return { id: trimmed }
  }

  async activateProfile(id: string): Promise<{ id: string }> {
    const dir = authDir()
    await fs.mkdir(dir, { recursive: true })
    const currentAuthPath = path.join(dir, 'auth.json')
    const currentTmpPath = path.join(dir, 'current.tmp')

    if (id === 'azure') {
      try {
        await fs.unlink(currentAuthPath)
      } catch {
        // ignore if missing
      }
      await fs.writeFile(currentTmpPath, id, 'utf8')
      return { id }
    }

    const sourcePath = authFilePath(id)
    try {
      await fs.access(sourcePath)
    } catch {
      throw new NotFoundException(`Auth file not found for id '${id}'`)
    }

    try {
      await fs.unlink(currentAuthPath)
    } catch {
      // ignore if missing
    }

    try {
      await fs.link(sourcePath, currentAuthPath)
    } catch (err) {
      throw new InternalServerErrorException(
        `Failed to activate profile '${id}': ${String(err)}`
      )
    }

    await fs.writeFile(currentTmpPath, id, 'utf8')
    return { id }
  }
}
