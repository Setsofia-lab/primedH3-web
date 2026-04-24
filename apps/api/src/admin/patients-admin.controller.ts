/**
 * POST /admin/patients/hydrate — pull a patient from Athena into our mirror.
 *
 * Admin-only. This is the first real round-trip through the Athena
 * integration that's callable from outside the service. Body:
 *   {
 *     "facilityId": "<uuid of a row in facilities>",
 *     "athenaResourceId": "a-1128700.E-14914",
 *     "athenaPracticeId": "1128700" (optional, defaults to ATHENA_DEFAULT_PRACTICE_ID),
 *     "force": true (optional, re-fetch even if we synced recently)
 *   }
 *
 * Response: the upserted patient row + whether we inserted/updated/no-oped.
 * PHI-bearing — callers must be in the admins pool (role=admin).
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
import { and, desc, eq } from 'drizzle-orm';
import { Roles } from '../auth/roles.decorator';
import { DB_CLIENT, type PrimedDb } from '../db/db.module';
import { patients, type Patient } from '../db/schema';
import { PatientHydrationService } from '../integrations/athena/hydration/patient-hydration.service';
import type { HydratePatientResult } from '../integrations/athena/hydration/patient-hydration.service';
import {
  hydratePatientSchema,
  listPatientsQuerySchema,
  type HydratePatientInput,
  type ListPatientsQuery,
} from './dto/admin.schemas';
import { ZodBodyPipe } from './zod-body.pipe';
import { ZodQueryPipe } from './zod-query.pipe';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/patients')
@Roles('admin')
export class PatientsAdminController {
  constructor(
    private readonly hydration: PatientHydrationService,
    @Inject(DB_CLIENT) private readonly db: PrimedDb,
  ) {}

  @Post('hydrate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Fetch a patient from Athena and upsert the mirror row' })
  async hydrate(
    @Body(new ZodBodyPipe(hydratePatientSchema)) input: HydratePatientInput,
  ): Promise<HydratePatientResult> {
    return this.hydration.hydrate({
      facilityId: input.facilityId,
      athenaResourceId: input.athenaResourceId,
      athenaPracticeId: input.athenaPracticeId,
      force: input.force,
    });
  }

  @Get()
  @ApiOperation({ summary: 'List mirrored patients (optionally filter by facility)' })
  async list(
    @Query(new ZodQueryPipe(listPatientsQuerySchema)) query: ListPatientsQuery,
  ): Promise<{
    items: readonly Patient[];
    limit: number;
    offset: number;
  }> {
    const where = query.facilityId
      ? and(eq(patients.facilityId, query.facilityId))
      : undefined;
    const items = await this.db
      .select()
      .from(patients)
      .where(where)
      .orderBy(desc(patients.athenaLastSyncAt))
      .limit(query.limit)
      .offset(query.offset);
    return { items, limit: query.limit, offset: query.offset };
  }
}
