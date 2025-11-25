import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core'
import { provideHttpClient, withFetch } from '@angular/common/http'

export const appBaseUrl = '/api'

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(withFetch())
  ]
}

