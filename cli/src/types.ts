export interface RateLimitWindow {
  usedPercent: number
  windowMinutes?: number | null
  resetsAt?: number | null
}

export interface CreditsSnapshot {
  hasCredits: boolean
  unlimited: boolean
  balance?: string | null
}

export interface RateLimitSnapshot {
  planType?: string | null
  primary?: RateLimitWindow | null
  secondary?: RateLimitWindow | null
  credits?: CreditsSnapshot | null
}

export interface IdTokenDetails {
  aud?: string[]
  iss?: string
  sub?: string
  auth_provider?: string
  auth_time?: number
  iat?: number
  email?: string
  exp?: number
  rat?: number
  jti?: string
  sid?: string
  at_hash?: string
  email_verified?: boolean
  ['https://api.openai.com/auth']?: {
    chatgpt_plan_type?: string
    chatgpt_account_id?: string
    chatgpt_user_id?: string
    chatgpt_subscription_active_start?: string
    chatgpt_subscription_active_until?: string
    chatgpt_subscription_last_checked?: string
    groups?: unknown[]
    organizations?: {
      id?: string
      is_default?: boolean
      role?: string
      title?: string
    }[]
    user_id?: string
  }
}

export interface AccessTokenDetails {
  aud?: string[]
  iss?: string
  sub?: string
  client_id?: string
  iat?: number
  nbf?: number
  exp?: number
  jti?: string
  pwd_auth_time?: number
  scp?: string[]
  session_id?: string
  ['https://api.openai.com/auth']?: {
    chatgpt_account_id?: string
    chatgpt_account_user_id?: string
    chatgpt_compute_residency?: string
    chatgpt_plan_type?: string
    chatgpt_user_id?: string
    user_id?: string
  }
  ['https://api.openai.com/profile']?: {
    email?: string
    email_verified?: boolean
  }
}

export interface AuthSummary {
  id: string
  hasApiKey: boolean
  email?: string | null
  planType?: string | null
  expiresAt?: string | null
  accessTokenLast4?: string | null
  accountId?: string | null
  lastRefresh?: string | null
  openaiUserType?: string | null
  openaiUserSub?: string | null
  openaiApiKey?: string | null
  idToken?: IdTokenDetails | null
  accessToken?: AccessTokenDetails | null
}

export interface ActiveProfile {
  id: string | null
}
