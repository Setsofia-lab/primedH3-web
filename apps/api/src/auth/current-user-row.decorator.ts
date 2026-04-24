/**
 * Inject the authenticated user's `users` row into a handler:
 *
 *   @Get('me/cases')
 *   myCases(@CurrentUserRow() me: User) { ... }
 *
 * Distinct from `@CurrentUser()` which returns the JWT-derived AuthContext
 * (Cognito identity); this returns the domain row.
 *
 * Throws 500 if the bootstrap step skipped — handlers that need this
 * are expected to have a row, and not having one is a bug, not an
 * authorisation failure.
 */
import { createParamDecorator, type ExecutionContext, InternalServerErrorException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { CURRENT_USER_KEY } from './jwt-auth.guard';
import type { User } from '../db/schema';

export const CurrentUserRow = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<FastifyRequest & Record<string, unknown>>();
  const user = (req as unknown as Record<string, unknown>)[CURRENT_USER_KEY] as User | undefined;
  if (!user) {
    throw new InternalServerErrorException('user row not bootstrapped');
  }
  return user;
});
