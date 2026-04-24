/**
 * POST /admin/cases — create a case linked to a mirrored patient.
 * GET  /admin/cases — list (filter by facility / patient / status).
 *
 * Admin-only. Cases are the primary domain object (Constitution §3.4
 * coordinator board) — every other workflow resource hangs off one.
 * Keep writes narrow for now; assignment + status transitions move
 * to dedicated endpoints in M7.3+ when we introduce audit events.
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
import { and, desc, eq, type SQL } from 'drizzle-orm';
import { Roles } from '../auth/roles.decorator';
import { DB_CLIENT, type PrimedDb } from '../db/db.module';
import { cases, type Case } from '../db/schema';
import {
  createCaseSchema,
  listCasesQuerySchema,
  type CreateCaseInput,
  type ListCasesQuery,
} from './dto/admin.schemas';
import { ZodBodyPipe } from './zod-body.pipe';
import { ZodQueryPipe } from './zod-query.pipe';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/cases')
@Roles('admin')
export class CasesAdminController {
  constructor(@Inject(DB_CLIENT) private readonly db: PrimedDb) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a case for a mirrored patient' })
  async create(
    @Body(new ZodBodyPipe(createCaseSchema)) input: CreateCaseInput,
  ): Promise<Case> {
    const [row] = await this.db
      .insert(cases)
      .values({
        facilityId: input.facilityId,
        patientId: input.patientId,
        surgeonId: input.surgeonId ?? null,
        coordinatorId: input.coordinatorId ?? null,
        procedureCode: input.procedureCode ?? null,
        procedureDescription: input.procedureDescription ?? null,
        status: input.status ?? 'referral',
        surgeryDate: input.surgeryDate ? new Date(input.surgeryDate) : null,
      })
      .returning();
    return row!;
  }

  @Get()
  @ApiOperation({ summary: 'List cases (filter by facility / patient / status)' })
  async list(
    @Query(new ZodQueryPipe(listCasesQuerySchema)) query: ListCasesQuery,
  ): Promise<{
    items: readonly Case[];
    limit: number;
    offset: number;
  }> {
    const clauses: SQL[] = [];
    if (query.facilityId) clauses.push(eq(cases.facilityId, query.facilityId));
    if (query.patientId) clauses.push(eq(cases.patientId, query.patientId));
    if (query.status) clauses.push(eq(cases.status, query.status));
    const where = clauses.length > 0 ? and(...clauses) : undefined;

    const items = await this.db
      .select()
      .from(cases)
      .where(where)
      .orderBy(desc(cases.createdAt))
      .limit(query.limit)
      .offset(query.offset);
    return { items, limit: query.limit, offset: query.offset };
  }
}
