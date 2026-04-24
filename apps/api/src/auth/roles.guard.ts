import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { AUTH_CONTEXT_KEY, type AuthContext, type Role } from './auth-context';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const allowed = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!allowed || allowed.length === 0) return true;

    const req = ctx.switchToHttp().getRequest<FastifyRequest & Record<string, unknown>>();
    const authContext = (req as unknown as Record<string, unknown>)[AUTH_CONTEXT_KEY] as
      | AuthContext
      | undefined;
    if (!authContext) {
      // JwtAuthGuard should run first and attach context. Bail closed
      // if it didn't (mis-ordered guards are better as 403 than 500).
      throw new ForbiddenException('not authenticated');
    }
    if (!allowed.includes(authContext.role)) {
      throw new ForbiddenException(`role ${authContext.role} not permitted`);
    }
    return true;
  }
}
