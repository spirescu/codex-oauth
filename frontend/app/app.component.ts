import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core'
import type { HttpErrorResponse } from '@angular/common/http'
import { CommonModule } from '@angular/common'
import { Clipboard, ClipboardModule } from '@angular/cdk/clipboard'
import {
  AuthApiService,
  AuthSummary,
  RateLimitSnapshot,
  RateLimitWindow
} from './auth-api.service'

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, ClipboardModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.sass']
})
export class AppComponent implements OnInit {
  private readonly api = inject(AuthApiService)
  private readonly cdr = inject(ChangeDetectorRef)
  private readonly clipboard = inject(Clipboard)

  authEntries: AuthSummary[] = []
  limits: Record<string, RateLimitSnapshot | null> = {}
  loading = false
  error: string | null = null
  expanded: Record<string, boolean> = {}
  activeProfileId: string | null = null

  get sortedEntries(): AuthSummary[] {
    const copy = [...this.authEntries]
    copy.sort((a, b) => {
      const aValid = this.hasValidWeekly(a.id)
      const bValid = this.hasValidWeekly(b.id)
      if (aValid === bValid) {
        return 0
      }
      return aValid ? -1 : 1
    })
    return copy
  }

  ngOnInit(): void {
    this.loadCurrentProfile()
    this.load()
  }

  load(): void {
    this.loading = true
    this.error = null
    this.api.listAuth().subscribe({
      next: (entries) => {
        this.authEntries = entries
        this.loading = false
        for (const entry of entries) {
          this.loadLimits(entry.id)
        }
      },
      error: (err: HttpErrorResponse | unknown) => {
        const message =
          err && typeof err === 'object' && 'error' in err && (err as HttpErrorResponse).error?.message
            ? (err as HttpErrorResponse).error.message
            : err instanceof Error
              ? err.message
              : String(err)
        this.error = `Failed to load auth entries: ${message}`
        this.loading = false
      }
    })
  }

  loadCurrentProfile(): void {
    this.api.getCurrentProfile().subscribe({
      next: (profile) => {
        this.activeProfileId = profile.id
        this.cdr.detectChanges()
      },
      error: () => {
        this.activeProfileId = null
        this.cdr.detectChanges()
      }
    })
  }

  refresh(entry: AuthSummary): void {
    const confirmed = window.confirm(
      `Refresh tokens for ${entry.id}? This will contact auth.openai.com to rotate the stored tokens.`
    )
    if (!confirmed) {
      return
    }

    this.api.refresh(entry.id).subscribe({
      next: (updated) => {
        this.authEntries = this.authEntries.map((e) =>
          e.id === updated.id ? updated : e
        )
        this.loadLimits(updated.id)
      },
      error: (err: HttpErrorResponse | unknown) => {
        const message =
          err && typeof err === 'object' && 'error' in err && (err as HttpErrorResponse).error?.message
            ? (err as HttpErrorResponse).error.message
            : err instanceof Error
              ? err.message
              : String(err)
        this.error = `Failed to refresh ${entry.id}: ${message}`
      }
    })
  }

  activateProfile(entry: AuthSummary): void {
    this.api.activateProfile(entry.id).subscribe({
      next: (profile) => {
        this.activeProfileId = profile.id
        this.cdr.detectChanges()
      },
      error: (err: HttpErrorResponse | unknown) => {
        const message =
          err && typeof err === 'object' && 'error' in err && (err as HttpErrorResponse).error?.message
            ? (err as HttpErrorResponse).error.message
            : err instanceof Error
              ? err.message
              : String(err)
        this.error = `Failed to activate profile ${entry.id}: ${message}`
      }
    })
  }

  copyApiKey(entry: AuthSummary): void {
    if (!entry.openaiApiKey) {
      this.error = `No API key is configured for ${entry.id}.`
      return
    }
    const copied = this.clipboard.copy(entry.openaiApiKey)
    if (!copied) {
      this.error = `Failed to copy API key for ${entry.id}.`
    }
  }

  loadLimits(id: string): void {
    this.api.getLimits(id).subscribe({
      next: (snapshot) => {
        this.limits[id] = snapshot
        this.cdr.detectChanges()
      },
      error: () => {
        this.limits[id] = null
        this.cdr.detectChanges()
      }
    })
  }

  formatResetDateTime(epochSeconds: number | null | undefined): string {
    if (typeof epochSeconds !== 'number') {
      return ''
    }
    const date = new Date(epochSeconds * 1000)
    if (Number.isNaN(date.getTime())) {
      return ''
    }
    return this.formatDate(date)
  }

  formatResetTime(epochSeconds: number | null | undefined): string {
    if (typeof epochSeconds !== 'number') {
      return ''
    }
    const date = new Date(epochSeconds * 1000)
    if (Number.isNaN(date.getTime())) {
      return ''
    }
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    const seconds = date.getSeconds().toString().padStart(2, '0')
    return `${hours}:${minutes}:${seconds}`
  }

  formatRelativeDaysFromNowSeconds(value: number | null | undefined): string {
    if (typeof value !== 'number') {
      return ''
    }
    const target = new Date(value * 1000)
    if (Number.isNaN(target.getTime())) {
      return ''
    }
    const now = new Date()
    const diffMs = target.getTime() - now.getTime()
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
    if (diffDays === 0) {
      return 'today'
    }
    if (diffDays > 0) {
      return `in ${diffDays} days`
    }
    const daysAgo = Math.abs(diffDays)
    return `${daysAgo} days ago`
  }

  expiryRibbonClassFromSeconds(value: number | null | undefined): string {
    if (typeof value !== 'number') {
      return 'ribbon--green'
    }
    const target = new Date(value * 1000)
    if (Number.isNaN(target.getTime())) {
      return 'ribbon--green'
    }
    const now = new Date()
    const diffDays = (target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    if (diffDays <= 1) {
      return 'ribbon--red'
    }
    if (diffDays <= 4) {
      return 'ribbon--yellow'
    }
    return 'ribbon--green'
  }

  weeklyLimitFillClass(value: number | null | undefined): string {
    if (typeof value !== 'number') {
      return ''
    }
    if (value > 66) {
      return 'limit-bar__fill--red'
    }
    if (value > 33) {
      return 'limit-bar__fill--yellow'
    }
    return ''
  }

  timeProgressPercent(window: RateLimitWindow | null | undefined): number {
    if (!window) {
      return 0
    }
    const minutes = window.windowMinutes
    const resetsAt = window.resetsAt
    if (typeof minutes !== 'number' || minutes <= 0 || typeof resetsAt !== 'number') {
      return 0
    }
    const durationMs = minutes * 60 * 1000
    const endMs = resetsAt * 1000
    const startMs = endMs - durationMs
    const nowMs = Date.now()
    if (nowMs <= startMs) {
      return 0
    }
    if (nowMs >= endMs) {
      return 100
    }
    const ratio = (nowMs - startMs) / durationMs
    const percent = Math.round(ratio * 100)
    if (percent < 0) {
      return 0
    }
    if (percent > 100) {
      return 100
    }
    return percent
  }

  globalUsageSum(): number {
    const windows = this.weeklyWindows()
    if (!windows.length) {
      return 0
    }
    let total = 0
    for (const window of windows) {
      total += window.usedPercent
    }
    return Math.round(total)
  }

  globalUsageAverage(): number {
    const windows = this.weeklyWindows()
    const count = windows.length
    if (!count) {
      return 0
    }
    const sum = this.globalUsageSum()
    const avg = sum / count
    if (avg < 0) {
      return 0
    }
    if (avg > 100) {
      return 100
    }
    return Math.round(avg)
  }

  globalWeeklyElapsedTimeAverage(): number {
    const windows = this.weeklyWindows()
    const count = windows.length
    if (!count) {
      return 0
    }
    const sum = this.globalWeeklyElapsedTimeSum()
    const avg = sum / count
    if (avg < 0) {
      return 0
    }
    if (avg > 100) {
      return 100
    }
    return Math.round(avg)
  }

  globalWeeklyElapsedTimeSum(): number {
    const windows = this.weeklyWindows()
    if (!windows.length) {
      return 0
    }
    let totalElapsed = 0
    for (const weekly of windows) {
      const elapsed = this.timeProgressPercent(weekly)
      totalElapsed += elapsed
    }
    return Math.round(totalElapsed)
  }

  globalWeeklyAccountCount(): number {
    return this.weeklyWindows().length
  }

  private weeklyWindows(): RateLimitWindow[] {
    const windows: RateLimitWindow[] = []
    for (const entry of this.authEntries) {
      if (!this.hasValidWeekly(entry.id)) {
        continue
      }
      const weekly = this.limits[entry.id]?.secondary
      if (weekly) {
        windows.push(weekly)
      }
    }
    return windows
  }

  hasValidWeekly(id: string): boolean {
    const snapshot = this.limits[id]
    const weekly = snapshot?.secondary
    if (!weekly) {
      return false
    }
    if (typeof weekly.usedPercent !== 'number') {
      return false
    }
    if (typeof weekly.windowMinutes !== 'number') {
      return false
    }
    if (typeof weekly.resetsAt !== 'number') {
      return false
    }
    return true
  }

  toggleDetails(entry: AuthSummary): void {
    const current = this.expanded[entry.id] === true
    this.expanded[entry.id] = !current
    this.cdr.detectChanges()
  }

  formatIso(value: string | null | undefined): string {
    if (!value) {
      return '—'
    }
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
      return value
    }
    return this.formatDate(date)
  }

  formatUnixSeconds(value: number | null | undefined): string {
    if (typeof value !== 'number') {
      return '—'
    }
    const date = new Date(value * 1000)
    if (Number.isNaN(date.getTime())) {
      return String(value)
    }
    return this.formatDate(date)
  }

  formatUnixMillis(value: number | null | undefined): string {
    if (typeof value !== 'number') {
      return '—'
    }
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
      return String(value)
    }
    return this.formatDate(date)
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear().toString().padStart(4, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    const seconds = date.getSeconds().toString().padStart(2, '0')
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
  }
}
