import { createParamDecorator, type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { AUTH_CONTEXT_KEY, type AuthContext } from './auth-context';

/**
 * Inject the authenticated user into a handler:
 *
 *   @Get('me')
 *   me(@CurrentUser() user: AuthContext) { return user; }
 */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<FastifyRequest & Record<string, unknown>>();
  const authContext = (req as unknown as Record<string, unknown>)[AUTH_CONTEXT_KEY] as
    | AuthContext
    | undefined;
  if (!authContext) {
    throw new UnauthorizedException('no auth context');
  }
  return authContext;
});
