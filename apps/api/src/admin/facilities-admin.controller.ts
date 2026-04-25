/**
 * POST /admin/facilities — create a facility tenant.
 * GET  /admin/facilities — list facilities (first 100).
 *
 * Admin-only. Facilities are the tenant root; every clinical row
 * references one via `facility_id`.
 */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { AuditService } from '../audit/audit.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { CurrentUserRow } from '../auth/current-user-row.decorator';
import type { AuthContext } from '../auth/auth-context';
import { DB_CLIENT, type PrimedDb } from '../db/db.module';
import { facilities, type Facility, type User } from '../db/schema';
import { Roles } from '../auth/roles.decorator';
import {
  createFacilitySchema,
  type CreateFacilityInput,
} from './dto/admin.schemas';
import { ZodBodyPipe } from './zod-body.pipe';
import { meta } from './audit-meta';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/facilities')
@Roles('admin')
export class FacilitiesAdminController {
  constructor(
    @Inject(DB_CLIENT) private readonly db: PrimedDb,
    private readonly audit: AuditService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a facility tenant' })
  async create(
    @Body(new ZodBodyPipe(createFacilitySchema)) input: CreateFacilityInput,
    @CurrentUser() ctx: AuthContext,
    @CurrentUserRow() me: User,
    @Req() req: FastifyRequest,
  ): Promise<Facility> {
    const [row] = await this.db
      .insert(facilities)
      .values({
        name: input.name,
        athenaPracticeId: input.athenaPracticeId ?? null,
        timezone: input.timezone,
        createdBy: me.id,
      })
      .returning();
    await this.audit.record(
      this.audit.fromContext(ctx, me),
      {
        action: 'create',
        resourceType: 'facility',
        resourceId: row!.id,
        targetFacilityId: row!.id,
        after: row,
      },
      meta(req),
    );
    return row!;
  }

  @Get()
  @ApiOperation({ summary: 'List facilities (capped at 100)' })
  async list(): Promise<readonly Facility[]> {
    return this.db.select().from(facilities).limit(100);
  }
}
