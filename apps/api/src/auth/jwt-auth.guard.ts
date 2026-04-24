/**
 * JwtAuthGuard — default guard for authenticated routes.
 *
 * Extracts `Authorization: Bearer <token>` from the Fastify request,
 * verifies it via JwtVerifierService, and attaches the resulting
 * AuthContext to `request.authContext` for downstream use.
 *
 * Mark a route as public (no auth) with `@Public()` (see `public.ts`).
 */
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { AUTH_CONTEXT_KEY } from './auth-context';
import { IS_PUBLIC_KEY } from './public.decorator';
import { JwtVerifierService } from './jwt-verifier.service';
import { UserBootstrapService } from './user-bootstrap.service';

export const CURRENT_USER_KEY = 'currentUser' as const;

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly verifier: JwtVerifierService,
    private readonly bootstrap: UserBootstrapService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<FastifyRequest & Record<string, unknown>>();
    const header = req.headers['authorization'];
    if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('missing bearer token');
    }
    const token = header.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException('empty bearer token');
    }

    const authContext = await this.verifier.verify(token);
    (req as unknown as Record<string, unknown>)[AUTH_CONTEXT_KEY] = authContext;

    // Bootstrap or refresh the users row. Failures here should not
    // surface as 401 — we logged and continue with just AuthContext;
    // only handlers that actually need a User row (most domain ones)
    // will fail later with a 500 we can pinpoint.
    try {
      const user = await this.bootstrap.ensure(authContext);
      (req as unknown as Record<string, unknown>)[CURRENT_USER_KEY] = user;
    } catch (err) {
      this.logger.error(`user bootstrap failed for sub=${authContext.sub}`, err as Error);
    }

    return true;
  }
}
