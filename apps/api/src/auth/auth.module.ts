/**
 * AuthModule — JWT verification + guard wiring.
 *
 * JwtAuthGuard is registered as an APP_GUARD, which means every route
 * requires a valid Cognito JWT by default. Mark public routes with
 * `@Public()`.
 *
 * RolesGuard runs after JwtAuthGuard; it's opt-in per-route via
 * `@Roles('surgeon', ...)`.
 */
import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtVerifierService } from './jwt-verifier.service';
import { MeController } from './me.controller';
import { RolesGuard } from './roles.guard';

@Global()
@Module({
  controllers: [MeController],
  providers: [
    JwtVerifierService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [JwtVerifierService],
})
export class AuthModule {}
