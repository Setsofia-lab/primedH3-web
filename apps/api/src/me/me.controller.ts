/**
 * /me — patient-self endpoints.
 *
 * Patients can't list other people's data, so they don't get the
 * provider /cases /patients /providers surface. Instead they read
 * their own resolved scope here:
 *
 *   GET /me/patient   — the patients row linked to the caller (404 if
 *                       no link exists yet — admin must run the patient
 *                       invite with patientId set).
 *   GET /me/cases     — cases for the linked patient.
 *   GET /me/tasks     — tasks on those cases where assignee_role='patient'
 *                       OR assignee_user_id = me.
 *
 * Provider roles can call these too — they all return the caller's own
 * scope. Useful for letting a coordinator see "what would this patient
 * see?" without role-switching.
 */
import { Controller, Get, Inject, NotFoundException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { and, desc, eq, inArray, isNull, or } from 'drizzle-orm';
import { Roles } from '../auth/roles.decorator';
import { CurrentUserRow } from '../auth/current-user-row.decorator';
import { DB_CLIENT, type PrimedDb } from '../db/db.module';
import { cases, patients, tasks, type Case, type Patient, type Task, type User } from '../db/schema';

@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
@Roles('admin', 'surgeon', 'anesthesia', 'coordinator', 'allied', 'patient')
export class MeController {
  constructor(@Inject(DB_CLIENT) private readonly db: PrimedDb) {}

  @Get('patient')
  @ApiOperation({ summary: 'The patient row linked to the caller (if any)' })
  async myPatient(@CurrentUserRow() me: User): Promise<Patient> {
    const [row] = await this.db
      .select()
      .from(patients)
      .where(eq(patients.userId, me.id))
      .limit(1);
    if (!row) {
      throw new NotFoundException(
        'No patient record linked to this user. Ask an admin to link your account.',
      );
    }
    return row;
  }

  @Get('cases')
  @ApiOperation({ summary: 'Cases for the caller’s linked patient (or empty)' })
  async myCases(@CurrentUserRow() me: User): Promise<{ items: readonly Case[] }> {
    const linked = await this.db
      .select({ id: patients.id })
      .from(patients)
      .where(eq(patients.userId, me.id));
    const patientIds = linked.map((r) => r.id);
    if (patientIds.length === 0) return { items: [] };
    const items = await this.db
      .select()
      .from(cases)
      .where(inArray(cases.patientId, patientIds))
      .orderBy(desc(cases.createdAt));
    return { items };
  }

  @Get('tasks')
  @ApiOperation({ summary: 'Tasks on the caller’s linked cases assigned to them' })
  async myTasks(@CurrentUserRow() me: User): Promise<{ items: readonly Task[] }> {
    // Tasks can be "mine" two ways:
    //   1. assignee_user_id = me (explicit assignment)
    //   2. assignee_role = 'patient' AND case visible (linked patient case)
    const linked = await this.db
      .select({ id: patients.id })
      .from(patients)
      .where(eq(patients.userId, me.id));
    const patientIds = linked.map((r) => r.id);
    const visibleCases = patientIds.length
      ? await this.db
          .select({ id: cases.id })
          .from(cases)
          .where(inArray(cases.patientId, patientIds))
      : [];
    const caseIds = visibleCases.map((r) => r.id);

    const conditions = [eq(tasks.assigneeUserId, me.id)];
    if (caseIds.length > 0) {
      const inCases = and(
        eq(tasks.assigneeRole, 'patient'),
        inArray(tasks.caseId, caseIds),
        isNull(tasks.assigneeUserId),
      );
      if (inCases) conditions.push(inCases);
    }
    const where = or(...conditions);
    if (!where) return { items: [] };

    const items = await this.db
      .select()
      .from(tasks)
      .where(where)
      .orderBy(desc(tasks.createdAt));
    return { items };
  }
}
