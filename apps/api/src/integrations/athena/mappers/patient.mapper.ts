/**
 * FHIR Patient → our `patients` row mapper.
 *
 * The mapping is deliberately lossy: we only carry fields the pre-op
 * workflow needs (name, DOB, sex, MRN). Athena remains the source of
 * truth for everything else per ADR 0002 — the full FHIR resource is
 * always one `AthenaFhirClient.getPatient(id)` away.
 *
 * Name precedence: prefer `use === 'official'`, then first entry with
 * any `family`+`given`, then fall back to `text`.
 *
 * MRN resolution: Athena's FHIR Patient.identifier array includes an
 * entry with `type.coding[system=http://terminology.hl7.org/CodeSystem/v2-0203][code=MR]`
 * — that's the practice-scoped MRN. Fall through to the first
 * identifier with `use='usual'` if not present.
 */
import type { FhirPatient } from '../athena-fhir.client';
import type { NewPatient } from '../../../db/schema';

export interface PatientMapInput {
  readonly fhir: FhirPatient;
  readonly facilityId: string;
  readonly athenaPracticeId: string;
}

export interface MappedPatient {
  readonly row: NewPatient;
  /** For logging / replaying against a snapshot. */
  readonly diagnostics: {
    readonly nameSource: 'official' | 'first' | 'text' | 'missing';
    readonly mrnSource: 'MR' | 'usual' | 'first' | 'missing';
  };
}

const MR_SYSTEM = 'http://terminology.hl7.org/CodeSystem/v2-0203';

export function mapFhirPatientToRow(input: PatientMapInput): MappedPatient {
  const { fhir, facilityId, athenaPracticeId } = input;
  const name = pickName(fhir);
  const mrn = pickMrn(fhir);

  const row: NewPatient = {
    facilityId,
    source: 'athena',
    athenaResourceId: fhir.id,
    athenaPracticeId,
    athenaVersion: fhir.meta?.versionId ?? null,
    athenaLastSyncAt: new Date(),
    firstName: name.firstName,
    lastName: name.lastName,
    dob: fhir.birthDate ?? '1900-01-01', // NOT NULL column; fall back to a sentinel
    sex: fhir.gender ?? null,
    mrn: mrn.value,
  };

  return {
    row,
    diagnostics: {
      nameSource: name.source,
      mrnSource: mrn.source,
    },
  };
}

function pickName(fhir: FhirPatient): {
  firstName: string;
  lastName: string;
  source: 'official' | 'first' | 'text' | 'missing';
} {
  const names = fhir.name ?? [];
  const official = names.find((n) => n.use === 'official' && (n.family || n.given?.length));
  if (official) {
    return {
      firstName: official.given?.[0] ?? '',
      lastName: official.family ?? '',
      source: 'official',
    };
  }
  const anyWithParts = names.find((n) => n.family || n.given?.length);
  if (anyWithParts) {
    return {
      firstName: anyWithParts.given?.[0] ?? '',
      lastName: anyWithParts.family ?? '',
      source: 'first',
    };
  }
  const anyText = names.find((n) => n.text);
  if (anyText?.text) {
    const parts = anyText.text.split(/\s+/);
    return {
      firstName: parts[0] ?? '',
      lastName: parts.slice(1).join(' '),
      source: 'text',
    };
  }
  return { firstName: '(unknown)', lastName: '(unknown)', source: 'missing' };
}

interface IdentifierEntry {
  readonly value?: string;
  readonly system?: string;
  readonly use?: string;
  readonly type?: {
    readonly coding?: readonly { readonly system?: string; readonly code?: string }[];
  };
}

function pickMrn(fhir: FhirPatient): { value: string | null; source: 'MR' | 'usual' | 'first' | 'missing' } {
  const ids = (fhir.identifier as IdentifierEntry[] | undefined) ?? [];
  if (ids.length === 0) return { value: null, source: 'missing' };

  const mr = ids.find((i) =>
    i.type?.coding?.some((c) => c.system === MR_SYSTEM && c.code === 'MR'),
  );
  if (mr?.value) return { value: mr.value, source: 'MR' };

  const usual = ids.find((i) => i.use === 'usual' && i.value);
  if (usual?.value) return { value: usual.value, source: 'usual' };

  const first = ids.find((i) => !!i.value);
  if (first?.value) return { value: first.value, source: 'first' };

  return { value: null, source: 'missing' };
}
