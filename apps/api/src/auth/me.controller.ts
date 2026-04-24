import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from './current-user.decorator';
import type { AuthContext } from './auth-context';

@ApiTags('auth')
@ApiBearerAuth()
@Controller('auth')
export class MeController {
  /**
   * Returns the authenticated user's identity. Useful for the web app
   * to verify the session is live without poking a domain endpoint.
   */
  @Get('me')
  @ApiOperation({ summary: 'Echo the authenticated user' })
  me(@CurrentUser() user: AuthContext): {
    sub: string;
    email: string;
    pool: AuthContext['pool'];
    role: AuthContext['role'];
    groups: readonly string[];
    expiresAt: number;
  } {
    return {
      sub: user.sub,
      email: user.email,
      pool: user.pool,
      role: user.role,
      groups: user.groups,
      expiresAt: user.expiresAt,
    };
  }
}
