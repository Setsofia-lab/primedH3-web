/**
 * POST /admin/users/invite — provision a Cognito user + DB row.
 * GET  /admin/users        — list users (filter by role / facility).
 *
 * The invite path:
 *   1. AdminCreateUser in the right pool (admins for role=admin,
 *      providers for surgeon/anesthesia/coordinator/allied, patients
 *      for role=patient).
 *   2. Add to the role's Cognito group (auto-create the group on first
 *      use; the group is what the JWT verifier reads to derive role).
 *   3. Cognito emails the temp password.
 *   4. Insert a `users` row with cognito_sub linked.
 *
 * The user logs in, sets their MFA, and starts working — no extra
 * provisioning required.
 */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { and, asc, eq, type SQL } from 'drizzle-orm';
import { Roles } from '../auth/roles.decorator';
import { DB_CLIENT, type PrimedDb } from '../db/db.module';
import { users, type User } from '../db/schema';
import { CognitoInviteService } from './cognito-invite.service';
import {
  inviteUserSchema,
  listUsersQuerySchema,
  type InviteUserInput,
  type ListUsersQuery,
} from './dto/admin.schemas';
import { ZodBodyPipe } from './zod-body.pipe';
import { ZodQueryPipe } from './zod-query.pipe';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/users')
@Roles('admin')
export class UsersAdminController {
  constructor(
    private readonly inviter: CognitoInviteService,
    @Inject(DB_CLIENT) private readonly db: PrimedDb,
  ) {}

  @Post('invite')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Provision a Cognito user (with email invite) + DB row',
  })
  async invite(
    @Body(new ZodBodyPipe(inviteUserSchema)) input: InviteUserInput,
  ): Promise<{ user: User; cognitoSub: string; userStatus: string }> {
    return this.inviter.invite(input);
  }

  @Get()
  @ApiOperation({ summary: 'List users (filter by role / facility)' })
  async list(
    @Query(new ZodQueryPipe(listUsersQuerySchema)) query: ListUsersQuery,
  ): Promise<{ items: readonly User[]; limit: number; offset: number }> {
    const clauses: SQL[] = [];
    if (query.role) clauses.push(eq(users.role, query.role));
    if (query.facilityId) clauses.push(eq(users.facilityId, query.facilityId));
    const where = clauses.length > 0 ? and(...clauses) : undefined;

    const items = await this.db
      .select()
      .from(users)
      .where(where)
      .orderBy(asc(users.lastName), asc(users.firstName))
      .limit(query.limit)
      .offset(query.offset);
    return { items, limit: query.limit, offset: query.offset };
  }
}
