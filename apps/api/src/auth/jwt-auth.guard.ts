/**
 * JwtAuthGuard — default guard for authenticated routes.
 *
 * Extracts `Authorization: Bearer <token>` from the Fastify request,
 * verifies it via JwtVerifierService, and attaches the resulting
 * AuthContext to `request.authContext` for downstream use.
 *
 * Mark a route as public (no auth) with `@Public()` (see `public.ts`).
 */
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { AUTH_CONTEXT_KEY } from './auth-context';
import { IS_PUBLIC_KEY } from './public.decorator';
import { JwtVerifierService } from './jwt-verifier.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly verifier: JwtVerifierService,
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
    return true;
  }
}
