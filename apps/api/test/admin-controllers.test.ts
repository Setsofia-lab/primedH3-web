/**
 * Unit tests for the admin controllers.
 *
 * Covers the validation + delegation behaviour without spinning up the
 * full Nest app. We instantiate the controllers directly with fake
 * collaborators (db + hydration service).
 */
import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { CasesAdminController } from '../src/admin/cases-admin.controller';
import { FacilitiesAdminController } from '../src/admin/facilities-admin.controller';
import { PatientsAdminController } from '../src/admin/patients-admin.controller';
import { ZodBodyPipe } from '../src/admin/zod-body.pipe';
import {
  createCaseSchema,
  createFacilitySchema,
  hydratePatientSchema,
  listCasesQuerySchema,
} from '../src/admin/dto/admin.schemas';

const FACILITY_UUID = '550e8400-e29b-41d4-a716-446655440001';

function mkDb() {
  const inserted = {
    id: FACILITY_UUID,
    name: 'Primary Hospital',
    athenaPracticeId: '1128700',
    timezone: 'America/New_York',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const returning = vi.fn().mockResolvedValue([inserted]);
  const values = vi.fn(() => ({ returning }));
  const insert = vi.fn(() => ({ values }));
  const limit = vi.fn().mockResolvedValue([inserted]);
  const from = vi.fn(() => ({ limit }));
  const select = vi.fn(() => ({ from }));
  return { insert, select, _inserted: inserted };
}

describe('ZodBodyPipe', () => {
  it('returns parsed value on success', () => {
    const pipe = new ZodBodyPipe(hydratePatientSchema);
    const out = pipe.transform({
      facilityId: FACILITY_UUID,
      athenaResourceId: 'a-1.E-42',
    });
    expect(out.facilityId).toBe(FACILITY_UUID);
    expect(out.athenaResourceId).toBe('a-1.E-42');
  });

  it('throws BadRequest with structured issues on failure', () => {
    const pipe = new ZodBodyPipe(hydratePatientSchema);
    expect(() => pipe.transform({ facilityId: 'not-a-uuid' })).toThrow(
      BadRequestException,
    );
  });
});

// Mock audit service that swallows everything (and a fake req/ctx/user
// to pass through the controllers' new audit-aware signatures).
const fakeAudit = {
  record: vi.fn().mockResolvedValue(undefined),
  fromContext: vi.fn(() => ({})),
};
const fakeCtx = { sub: 'sub', email: 'a@b.c', pool: 'admins', role: 'admin', groups: [] } as never;
const fakeMe = { id: 'u1', email: 'a@b.c', role: 'admin' } as never;
const fakeReq = { id: 'req-1', headers: {}, ip: '127.0.0.1' } as never;

describe('FacilitiesAdminController', () => {
  it('inserts a facility and returns the row', async () => {
    const db = mkDb();
    const ctrl = new FacilitiesAdminController(db as never, fakeAudit as never);
    const out = await ctrl.create(
      { name: 'Primary Hospital', athenaPracticeId: '1128700', timezone: 'America/New_York' },
      fakeCtx,
      fakeMe,
      fakeReq,
    );
    expect(db.insert).toHaveBeenCalledOnce();
    expect(out.name).toBe('Primary Hospital');
    expect(fakeAudit.record).toHaveBeenCalled();
  });

  it('defaults timezone via the zod schema', () => {
    const parsed = createFacilitySchema.parse({ name: 'H' });
    expect(parsed.timezone).toBe('America/New_York');
  });

  it('lists facilities', async () => {
    const db = mkDb();
    const ctrl = new FacilitiesAdminController(db as never, fakeAudit as never);
    const out = await ctrl.list();
    expect(out).toHaveLength(1);
    expect(db.select).toHaveBeenCalledOnce();
  });
});

describe('PatientsAdminController', () => {
  function mkHydration() {
    return {
      hydrate: vi.fn().mockResolvedValue({
        row: { id: 'p1' },
        action: 'inserted',
        athenaVersion: 'v1',
      }),
    };
  }

  function mkPatientsDb(rows: unknown[]) {
    const offset = vi.fn(() => Promise.resolve(rows));
    const limit = vi.fn(() => ({ offset }));
    const orderBy = vi.fn(() => ({ limit }));
    const where = vi.fn(() => ({ orderBy }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    return { select, _calls: { orderBy, where, limit, offset } };
  }

  it('delegates hydrate() to PatientHydrationService', async () => {
    const hydration = mkHydration();
    const ctrl = new PatientsAdminController(
      hydration as never,
      {} as never,
      fakeAudit as never,
      {} as never,
    );
    const out = await ctrl.hydrate(
      {
        facilityId: FACILITY_UUID,
        athenaResourceId: 'a-1128700.E-14914',
        force: true,
      },
      fakeCtx,
      fakeMe,
      fakeReq,
    );
    expect(hydration.hydrate).toHaveBeenCalledWith({
      facilityId: FACILITY_UUID,
      athenaResourceId: 'a-1128700.E-14914',
      athenaPracticeId: undefined,
      force: true,
    });
    expect(out.action).toBe('inserted');
  });

  it('list() returns items + pagination echo', async () => {
    const db = mkPatientsDb([{ id: 'p1' }, { id: 'p2' }]);
    const ctrl = new PatientsAdminController(
      {} as never,
      {} as never,
      fakeAudit as never,
      db as never,
    );
    const out = await ctrl.list({
      facilityId: FACILITY_UUID,
      limit: 50,
      offset: 0,
    });
    expect(out.items).toHaveLength(2);
    expect(out.limit).toBe(50);
    expect(out.offset).toBe(0);
    expect(db.select).toHaveBeenCalledOnce();
  });
});

describe('CasesAdminController', () => {
  const PATIENT_UUID = '8e1a7ba2-5cf2-4c9f-9c56-ba6e25f2cd18';

  function mkInsertDb(row: unknown) {
    const returning = vi.fn().mockResolvedValue([row]);
    const values = vi.fn(() => ({ returning }));
    const insert = vi.fn(() => ({ values }));
    const offset = vi.fn(() => Promise.resolve([row]));
    const limit = vi.fn(() => ({ offset }));
    const orderBy = vi.fn(() => ({ limit }));
    const where = vi.fn(() => ({ orderBy }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    return { insert, select };
  }

  it('defaults status to "referral" on create', async () => {
    const db = mkInsertDb({ id: 'c1', status: 'referral', facilityId: FACILITY_UUID });
    const fakeIntake = { onCaseCreated: vi.fn().mockResolvedValue(undefined) };
    const ctrl = new CasesAdminController(
      db as never,
      fakeAudit as never,
      fakeIntake as never,
    );
    const out = await ctrl.create(
      { facilityId: FACILITY_UUID, patientId: PATIENT_UUID },
      fakeCtx,
      fakeMe,
      fakeReq,
    );
    expect(db.insert).toHaveBeenCalledOnce();
    expect(out.status).toBe('referral');
  });

  it('accepts explicit status from the enum', () => {
    const parsed = createCaseSchema.parse({
      facilityId: FACILITY_UUID,
      patientId: PATIENT_UUID,
      status: 'workup',
    });
    expect(parsed.status).toBe('workup');
  });

  it('rejects invalid status', () => {
    expect(() =>
      createCaseSchema.parse({
        facilityId: FACILITY_UUID,
        patientId: PATIENT_UUID,
        status: 'not-a-real-status',
      }),
    ).toThrow();
  });

  it('list() query schema applies pagination defaults', () => {
    const parsed = listCasesQuerySchema.parse({});
    expect(parsed.limit).toBe(50);
    expect(parsed.offset).toBe(0);
  });
});
