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
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { and, desc, eq } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { CurrentUserRow } from '../auth/current-user-row.decorator';
import { Roles } from '../auth/roles.decorator';
import type { AuthContext } from '../auth/auth-context';
import { DB_CLIENT, type PrimedDb } from '../db/db.module';
import { patients, type Patient, type User } from '../db/schema';
import { AthenaFhirClient, type FhirPatient } from '../integrations/athena/athena-fhir.client';
import { PatientHydrationService } from '../integrations/athena/hydration/patient-hydration.service';
import type { HydratePatientResult } from '../integrations/athena/hydration/patient-hydration.service';
import { meta } from './audit-meta';
import {
  hydratePatientSchema,
  listPatientsQuerySchema,
  searchAthenaPatientsSchema,
  type HydratePatientInput,
  type ListPatientsQuery,
  type SearchAthenaPatientsQuery,
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
    private readonly fhir: AthenaFhirClient,
    private readonly audit: AuditService,
    @Inject(DB_CLIENT) private readonly db: PrimedDb,
  ) {}

  @Post('hydrate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Fetch a patient from Athena and upsert the mirror row' })
  async hydrate(
    @Body(new ZodBodyPipe(hydratePatientSchema)) input: HydratePatientInput,
    @CurrentUser() ctx: AuthContext,
    @CurrentUserRow() me: User,
    @Req() req: FastifyRequest,
  ): Promise<HydratePatientResult> {
    const result = await this.hydration.hydrate({
      facilityId: input.facilityId,
      athenaResourceId: input.athenaResourceId,
      athenaPracticeId: input.athenaPracticeId,
      force: input.force,
    });
    await this.audit.record(
      this.audit.fromContext(ctx, me),
      {
        action: 'hydrate',
        resourceType: 'patient',
        resourceId: result.row.id,
        targetFacilityId: result.row.facilityId,
        after: {
          athenaResourceId: result.row.athenaResourceId,
          action: result.action,
          athenaVersion: result.athenaVersion,
        },
      },
      meta(req),
    );
    return result;
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

  /**
   * Search Athena's FHIR Patient endpoint by name + birthdate / gender
   * etc. without writing anything to our DB. Used by the admin Athena
   * page to preview candidates before clicking "hydrate".
   *
   * Athena requires one of these parameter combinations:
   *   [_id], [identifier], [name], [family,birthdate], [family,gender],
   *   [family,given]. If the wrong combo lands at Athena it returns
   *   FHIR OperationOutcome 403 which we surface as 502.
   */
  @Get('search')
  @ApiOperation({ summary: 'Live FHIR Patient search against Athena (no writes)' })
  async search(
    @Query(new ZodQueryPipe(searchAthenaPatientsSchema)) query: SearchAthenaPatientsQuery,
  ): Promise<{ items: FhirPatient[]; alreadyMirrored: Record<string, string> }> {
    const { practiceId, ...athenaParams } = query;
    const params = Object.fromEntries(
      Object.entries(athenaParams).filter(([, v]) => v !== undefined),
    ) as Record<string, string>;
    // Athena requires _count on multi-result searches; cap to a sane page.
    if (!('_count' in params)) params._count = '20';

    const page = await this.fhir.searchPatients(params, practiceId);

    // Cross-reference against our mirror so the UI can show "already
    // imported" indicators. Cheap: one IN-list query.
    const ids = page.resources.map((p) => p.id);
    const mirrored = ids.length
      ? await this.db
          .select({ id: patients.id, athenaResourceId: patients.athenaResourceId })
          .from(patients)
          .where(eq(patients.athenaPracticeId, practiceId ?? '1128700'))
      : [];
    const map: Record<string, string> = {};
    for (const m of mirrored) {
      if (m.athenaResourceId && ids.includes(m.athenaResourceId)) map[m.athenaResourceId] = m.id;
    }
    return { items: page.resources, alreadyMirrored: map };
  }
}
