import type { ActiveProfile, AuthSummary, RateLimitSnapshot } from './types'

const DEFAULT_BASE_URL = 'http://localhost/api'

function resolveBaseUrl(): string {
  const fromEnv = process.env.CODEX_OAUTH_BASE_URL
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv.replace(/\/$/, '')
  }
  return DEFAULT_BASE_URL
}

export class AuthClient {
  private readonly baseUrl: string

  constructor(baseUrl?: string) {
    this.baseUrl = (baseUrl ?? resolveBaseUrl()).replace(/\/$/, '')
  }

  private async requestJson<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`
    let response: Response
    try {
      response = await fetch(url, init)
    } catch (err) {
      throw new Error(`Request to ${url} failed: ${String(err)}`)
    }

    if (!response.ok) {
      let message = `${response.status} ${response.statusText}`
      try {
        const body = (await response.json()) as unknown
        if (body && typeof body === 'object' && 'message' in body) {
          const msg = (body as { message?: unknown }).message
          if (typeof msg === 'string') {
            message = `${message}: ${msg}`
          } else if (Array.isArray(msg) && typeof msg[0] === 'string') {
            message = `${message}: ${msg[0]}`
          }
        }
      } catch {
      }
      throw new Error(message)
    }

    try {
      return (await response.json()) as T
    } catch (err) {
      throw new Error(`Failed to decode response from ${url}: ${String(err)}`)
    }
  }

  listAuth(): Promise<AuthSummary[]> {
    return this.requestJson<AuthSummary[]>('/auth', {
      method: 'GET'
    })
  }

  refresh(id: string): Promise<AuthSummary> {
    const encoded = encodeURIComponent(id)
    return this.requestJson<AuthSummary>(`/auth/refresh/${encoded}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    })
  }

  getLimits(id: string): Promise<RateLimitSnapshot> {
    const encoded = encodeURIComponent(id)
    return this.requestJson<RateLimitSnapshot>(`/auth/${encoded}/limits`, {
      method: 'GET'
    })
  }

  getCurrentProfile(): Promise<ActiveProfile> {
    return this.requestJson<ActiveProfile>('/auth/current', {
      method: 'GET'
    })
  }

  activateProfile(id: string): Promise<ActiveProfile> {
    const encoded = encodeURIComponent(id)
    return this.requestJson<ActiveProfile>(`/auth/activate/${encoded}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    })
  }
}
