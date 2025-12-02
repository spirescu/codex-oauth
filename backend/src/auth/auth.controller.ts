import { Controller, Get, Inject, Param, Post } from '@nestjs/common'
import { AuthService, AuthSummary } from './auth.service'
import { RateLimitSnapshot } from './types'

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  /**
   * GET /auth
   *
   * Returns a summary of all auth files (dummy1, dummy2, …) including
   * email, plan, expiry, account id, last refresh, etc.
   */
  @Get()
  async list(): Promise<AuthSummary[]> {
    return this.authService.listAuthFiles()
  }

  /**
   * POST /auth/refresh/:id
   *
   * Example: /auth/refresh/dummy1
   * Refreshes the corresponding auth file using its refresh_token and
   * returns the updated summary.
   */
  @Post('refresh/:id')
  async refreshViaAuth(@Param('id') id: string): Promise<AuthSummary> {
    return this.authService.refreshAuthFile(id)
  }

  /**
   * GET /auth/current
   *
   * Returns the id of the currently activated Codex profile, or null
   * if none has been activated yet.
   */
  @Get('current')
  async current(): Promise<{ id: string | null }> {
    return this.authService.getCurrentProfileId()
  }

  /**
   * POST /auth/activate/:id
   *
   * Activates the given profile id by updating the .codex/auth.json
   * link and recording the current id in .codex/current.tmp.
   */
  @Post('activate/:id')
  async activate(@Param('id') id: string): Promise<{ id: string }> {
    return this.authService.activateProfile(id)
  }

  /**
   * GET /auth/:id/limits
   *
   * Returns the rate limit snapshot for the given auth file by calling
   * the ChatGPT `/wham/usage` endpoint with its access token.
   */
  @Get(':id/limits')
  async limits(@Param('id') id: string): Promise<RateLimitSnapshot> {
    return this.authService.getLimitsForAuth(id)
  }
}

@Controller()
export class LegacyRefreshController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  /**
   * Back-compat endpoint:
   * POST /refresh-token/:id
   *
   * Delegates to the same refresh logic as /auth/refresh/:id.
   */
  @Post('refresh-token/:id')
  async refresh(@Param('id') id: string): Promise<AuthSummary> {
    return this.authService.refreshAuthFile(id)
  }
}
