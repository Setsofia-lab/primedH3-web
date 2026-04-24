import { SetMetadata } from '@nestjs/common';
import type { Role } from './auth-context';

/**
 * Restrict a route to a specific set of app-level roles.
 *
 *   @Roles('surgeon', 'coordinator')
 *   @Get('cases')
 *   listCases(...) { ... }
 *
 * Used together with RolesGuard (see roles.guard.ts).
 */
export const ROLES_KEY = 'primedhealth:roles' as const;
export const Roles = (...roles: Role[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
