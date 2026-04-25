/**
 * Read-only patient list scoped to the caller's facility — for the
 * coordinator/anesthesia patient panels. Admin gets unscoped via
 * /admin/patients; this is the role-scoped sibling.
 */
import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { and, desc, eq, type SQL } from 'drizzle-orm';
import { Roles } from '../auth/roles.decorator';
import { CurrentUserRow } from '../auth/current-user-row.decorator';
import { DB_CLIENT, type PrimedDb } from '../db/db.module';
import { patients, type Patient, type User } from '../db/schema';
import {
  listPatientsQuerySchema,
  type ListPatientsQuery,
} from '../admin/dto/admin.schemas';
import { ZodQueryPipe } from '../admin/zod-query.pipe';

@ApiTags('patients')
@ApiBearerAuth()
@Controller('patients')
@Roles('admin', 'surgeon', 'anesthesia', 'coordinator', 'allied')
export class PatientsSelfController {
  constructor(@Inject(DB_CLIENT) private readonly db: PrimedDb) {}

  @Get()
  @ApiOperation({ summary: "List patients in the caller's facility" })
  async list(
    @CurrentUserRow() me: User,
    @Query(new ZodQueryPipe(listPatientsQuerySchema)) query: ListPatientsQuery,
  ): Promise<{ items: readonly Patient[]; limit: number; offset: number }> {
    const clauses: SQL[] = [];
    // Admin sees all; everyone else only their facility's patients.
    if (me.role !== 'admin' && me.facilityId) {
      clauses.push(eq(patients.facilityId, me.facilityId));
    }
    if (query.facilityId) clauses.push(eq(patients.facilityId, query.facilityId));
    const where = clauses.length > 0 ? and(...clauses) : undefined;

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
