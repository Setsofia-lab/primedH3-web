/**
 * Unit tests for the admin controllers.
 *
 * Covers the validation + delegation behaviour without spinning up the
 * full Nest app. We instantiate the controllers directly with fake
 * collaborators (db + hydration service).
 */
import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { FacilitiesAdminController } from '../src/admin/facilities-admin.controller';
import { PatientsAdminController } from '../src/admin/patients-admin.controller';
import { ZodBodyPipe } from '../src/admin/zod-body.pipe';
import {
  createFacilitySchema,
  hydratePatientSchema,
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

describe('FacilitiesAdminController', () => {
  it('inserts a facility and returns the row', async () => {
    const db = mkDb();
    const ctrl = new FacilitiesAdminController(db as never);
    const out = await ctrl.create({
      name: 'Primary Hospital',
      athenaPracticeId: '1128700',
      timezone: 'America/New_York',
    });
    expect(db.insert).toHaveBeenCalledOnce();
    expect(out.name).toBe('Primary Hospital');
  });

  it('defaults timezone via the zod schema', () => {
    const parsed = createFacilitySchema.parse({ name: 'H' });
    expect(parsed.timezone).toBe('America/New_York');
  });

  it('lists facilities', async () => {
    const db = mkDb();
    const ctrl = new FacilitiesAdminController(db as never);
    const out = await ctrl.list();
    expect(out).toHaveLength(1);
    expect(db.select).toHaveBeenCalledOnce();
  });
});

describe('PatientsAdminController', () => {
  it('delegates to PatientHydrationService with body inputs', async () => {
    const hydrate = vi.fn().mockResolvedValue({
      row: { id: 'p1' },
      action: 'inserted',
      athenaVersion: 'v1',
    });
    const ctrl = new PatientsAdminController({ hydrate } as never);
    const out = await ctrl.hydrate({
      facilityId: FACILITY_UUID,
      athenaResourceId: 'a-1128700.E-14914',
      force: true,
    });
    expect(hydrate).toHaveBeenCalledWith({
      facilityId: FACILITY_UUID,
      athenaResourceId: 'a-1128700.E-14914',
      athenaPracticeId: undefined,
      force: true,
    });
    expect(out.action).toBe('inserted');
  });
});
