import { Module } from '@nestjs/common'
import { AuthService } from './auth.service'
import { AuthController, LegacyRefreshController } from './auth.controller'

@Module({
  providers: [AuthService],
  controllers: [AuthController, LegacyRefreshController]
})
export class AuthModule {}

