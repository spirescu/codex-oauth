export interface TokenData {
  id_token: string;
  access_token: string;
  refresh_token: string;
  account_id?: string | null;
}

export interface AuthDotJson {
  OPENAI_API_KEY?: string | null;
  tokens?: TokenData | null;
  last_refresh?: string | null;
}

export interface RateLimitWindow {
  usedPercent: number;
  windowMinutes?: number | null;
  resetsAt?: number | null;
}

export interface CreditsSnapshot {
  hasCredits: boolean;
  unlimited: boolean;
  balance?: string | null;
}

export interface RateLimitSnapshot {
  planType?: string | null;
  primary?: RateLimitWindow | null;
  secondary?: RateLimitWindow | null;
  credits?: CreditsSnapshot | null;
}
