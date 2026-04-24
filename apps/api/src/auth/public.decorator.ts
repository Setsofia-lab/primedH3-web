import { SetMetadata } from '@nestjs/common';

/**
 * Mark a route or controller as public. JwtAuthGuard skips it.
 * Use sparingly — only for /health, /ready, /docs, and webhook
 * endpoints that authenticate via their own mechanism (HMAC etc.).
 *
 * Usage:
 *   @Public()
 *   @Get('health')
 *   health() { ... }
 */
export const IS_PUBLIC_KEY = 'primedhealth:isPublic' as const;
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true);
