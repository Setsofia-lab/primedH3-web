import { describe, expect, it } from 'vitest';
import type { FhirPatient } from '../src/integrations/athena/athena-fhir.client';
import { mapFhirPatientToRow } from '../src/integrations/athena/mappers/patient.mapper';

const FACILITY_ID = '00000000-0000-0000-0000-000000000001';
const PRACTICE_ID = '1128700';

function baseFhir(overrides: Partial<FhirPatient> = {}): FhirPatient {
  return {
    resourceType: 'Patient',
    id: 'a-1128700.E-14914',
    ...overrides,
  } as FhirPatient;
}

describe('mapFhirPatientToRow', () => {
  it('copies identity fields and stamps athena mirror columns', () => {
    const { row, diagnostics } = mapFhirPatientToRow({
      fhir: baseFhir({
        name: [{ use: 'official', family: 'Rivera', given: ['Alex'] }],
        birthDate: '1980-06-15',
        gender: 'male',
        meta: { versionId: 'v7' },
        identifier: [
          {
            system: 'http://example.invalid',
            value: 'MRN-42',
            type: {
              coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0203', code: 'MR' }],
            },
          },
        ],
      }),
      facilityId: FACILITY_ID,
      athenaPracticeId: PRACTICE_ID,
    });
    expect(row.source).toBe('athena');
    expect(row.athenaResourceId).toBe('a-1128700.E-14914');
    expect(row.athenaPracticeId).toBe(PRACTICE_ID);
    expect(row.athenaVersion).toBe('v7');
    expect(row.firstName).toBe('Alex');
    expect(row.lastName).toBe('Rivera');
    expect(row.dob).toBe('1980-06-15');
    expect(row.sex).toBe('male');
    expect(row.mrn).toBe('MRN-42');
    expect(diagnostics.nameSource).toBe('official');
    expect(diagnostics.mrnSource).toBe('MR');
  });

  it('falls back to first non-official name, then text, then sentinel', () => {
    const fromFirst = mapFhirPatientToRow({
      fhir: baseFhir({ name: [{ family: 'Smith', given: ['Jane'] }] }),
      facilityId: FACILITY_ID,
      athenaPracticeId: PRACTICE_ID,
    });
    expect(fromFirst.diagnostics.nameSource).toBe('first');
    expect(fromFirst.row.firstName).toBe('Jane');

    const fromText = mapFhirPatientToRow({
      fhir: baseFhir({ name: [{ text: 'Mark Jones' }] }),
      facilityId: FACILITY_ID,
      athenaPracticeId: PRACTICE_ID,
    });
    expect(fromText.diagnostics.nameSource).toBe('text');
    expect(fromText.row.firstName).toBe('Mark');
    expect(fromText.row.lastName).toBe('Jones');

    const missing = mapFhirPatientToRow({
      fhir: baseFhir({}),
      facilityId: FACILITY_ID,
      athenaPracticeId: PRACTICE_ID,
    });
    expect(missing.diagnostics.nameSource).toBe('missing');
    expect(missing.row.firstName).toBe('(unknown)');
  });

  it('uses MR-typed identifier before use=usual before first', () => {
    const byUsual = mapFhirPatientToRow({
      fhir: baseFhir({
        identifier: [{ use: 'usual', value: 'U-1' }, { value: 'X-1' }],
      }),
      facilityId: FACILITY_ID,
      athenaPracticeId: PRACTICE_ID,
    });
    expect(byUsual.row.mrn).toBe('U-1');
    expect(byUsual.diagnostics.mrnSource).toBe('usual');

    const byFirst = mapFhirPatientToRow({
      fhir: baseFhir({ identifier: [{ value: 'X-1' }] }),
      facilityId: FACILITY_ID,
      athenaPracticeId: PRACTICE_ID,
    });
    expect(byFirst.row.mrn).toBe('X-1');
    expect(byFirst.diagnostics.mrnSource).toBe('first');

    const missing = mapFhirPatientToRow({
      fhir: baseFhir({}),
      facilityId: FACILITY_ID,
      athenaPracticeId: PRACTICE_ID,
    });
    expect(missing.row.mrn).toBeNull();
    expect(missing.diagnostics.mrnSource).toBe('missing');
  });

  it('uses sentinel DOB when Athena returns no birthDate', () => {
    const { row } = mapFhirPatientToRow({
      fhir: baseFhir({}),
      facilityId: FACILITY_ID,
      athenaPracticeId: PRACTICE_ID,
    });
    expect(row.dob).toBe('1900-01-01');
  });
});
