/**
 * Slim provider directory — used by every shell that needs to render
 * "Dr. Lastname" or assignment dropdowns. Returns only public-safe
 * fields (no email, no last-seen, no Cognito sub).
 *
 * Scoped: the caller sees providers in their own facility (admins see
 * everyone). Patients explicitly excluded.
 */
import { Controller, Get, Inject } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { and, asc, eq, ne, type SQL } from 'drizzle-orm';
import { Roles } from '../auth/roles.decorator';
import { CurrentUserRow } from '../auth/current-user-row.decorator';
import { DB_CLIENT, type PrimedDb } from '../db/db.module';
import { users, type User } from '../db/schema';

interface PublicProvider {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  facilityId: string | null;
}

@ApiTags('providers')
@ApiBearerAuth()
@Controller('providers')
@Roles('admin', 'surgeon', 'anesthesia', 'coordinator', 'allied')
export class ProvidersSelfController {
  constructor(@Inject(DB_CLIENT) private readonly db: PrimedDb) {}

  @Get()
  @ApiOperation({ summary: 'List providers visible to the caller' })
  async list(@CurrentUserRow() me: User): Promise<{ items: readonly PublicProvider[] }> {
    const clauses: SQL[] = [ne(users.role, 'patient')];
    if (me.role !== 'admin' && me.facilityId) {
      clauses.push(eq(users.facilityId, me.facilityId));
    }
    const where = clauses.length > 0 ? and(...clauses) : undefined;

    const rows = await this.db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        facilityId: users.facilityId,
      })
      .from(users)
      .where(where)
      .orderBy(asc(users.lastName), asc(users.firstName))
      .limit(200);
    return { items: rows };
  }
}
