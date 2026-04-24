/**
 * POST /admin/facilities — create a facility tenant.
 * GET  /admin/facilities — list facilities (first 100).
 *
 * Admin-only. Facilities are the tenant root; every clinical row
 * references one via `facility_id`. We keep this simple: no soft-delete,
 * no rename API — admins can update by running migrations for now.
 */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DB_CLIENT, type PrimedDb } from '../db/db.module';
import { facilities, type Facility } from '../db/schema';
import { Roles } from '../auth/roles.decorator';
import {
  createFacilitySchema,
  type CreateFacilityInput,
} from './dto/admin.schemas';
import { ZodBodyPipe } from './zod-body.pipe';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/facilities')
@Roles('admin')
export class FacilitiesAdminController {
  constructor(@Inject(DB_CLIENT) private readonly db: PrimedDb) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a facility tenant' })
  async create(
    @Body(new ZodBodyPipe(createFacilitySchema)) input: CreateFacilityInput,
  ): Promise<Facility> {
    const [row] = await this.db
      .insert(facilities)
      .values({
        name: input.name,
        athenaPracticeId: input.athenaPracticeId ?? null,
        timezone: input.timezone,
      })
      .returning();
    return row!;
  }

  @Get()
  @ApiOperation({ summary: 'List facilities (capped at 100)' })
  async list(): Promise<readonly Facility[]> {
    return this.db.select().from(facilities).limit(100);
  }
}
