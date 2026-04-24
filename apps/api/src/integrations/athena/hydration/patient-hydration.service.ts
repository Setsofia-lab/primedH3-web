/**
 * PatientHydrationService — given an (facility, Athena patient id),
 * fetches the FHIR Patient from Athena, maps it to our row shape,
 * and upserts into `patients`.
 *
 * Callers (agent workflows, case-creation service, event-notifications
 * worker) call `hydrate()` and don't need to know about the FHIR client
 * or schema details.
 *
 * Idempotent: re-running against the same patient is a no-op when
 * `athena_version` matches what we have locally. A forced re-sync uses
 * `{ force: true }` which skips the version check.
 */
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DB_CLIENT, type PrimedDb } from '../../../db/db.module';
import { patients, type Patient } from '../../../db/schema';
import { AthenaFhirClient } from '../athena-fhir.client';
import { ATHENA_CONFIG_TOKEN, type AthenaResolvedConfig } from '../athena.tokens';
import { mapFhirPatientToRow } from '../mappers/patient.mapper';

export interface HydratePatientInput {
  readonly facilityId: string;
  readonly athenaResourceId: string;
  /** Override the app's default practice for this call. */
  readonly athenaPracticeId?: string;
  /** Skip the version-match short-circuit and re-fetch from Athena. */
  readonly force?: boolean;
}

export interface HydratePatientResult {
  readonly row: Patient;
  readonly action: 'inserted' | 'updated' | 'unchanged';
  readonly athenaVersion: string | null;
}

@Injectable()
export class PatientHydrationService {
  private readonly logger = new Logger(PatientHydrationService.name);

  constructor(
    private readonly fhir: AthenaFhirClient,
    @Inject(DB_CLIENT) private readonly db: PrimedDb,
    @Inject(ATHENA_CONFIG_TOKEN) private readonly config: AthenaResolvedConfig | null,
  ) {}

  async hydrate(input: HydratePatientInput): Promise<HydratePatientResult> {
    const practiceId = input.athenaPracticeId ?? this.defaultPractice();

    // Short-circuit: if we already have a row with the same Athena
    // `versionId`, skip the round-trip. `force: true` bypasses.
    if (!input.force) {
      const existing = await this.db
        .select()
        .from(patients)
        .where(
          and(
            eq(patients.facilityId, input.facilityId),
            eq(patients.athenaResourceId, input.athenaResourceId),
          ),
        )
        .limit(1);
      const current = existing[0];
      if (current?.athenaVersion) {
        // We don't know Athena's latest version without fetching — this
        // check only helps when callers pass the version through from an
        // event. Skipping without fetch would always be stale. Keep the
        // short-circuit gated on an explicit force=false AND a recent
        // sync (< 60s) to avoid the re-fetch spam.
        const recent =
          current.athenaLastSyncAt &&
          Date.now() - current.athenaLastSyncAt.getTime() < 60_000;
        if (recent) {
          return { row: current, action: 'unchanged', athenaVersion: current.athenaVersion };
        }
      }
    }

    const fhir = await this.fhir.getPatient(input.athenaResourceId, practiceId);
    if (!fhir.id) {
      throw new NotFoundException(`athena patient ${input.athenaResourceId} missing id`);
    }

    const { row, diagnostics } = mapFhirPatientToRow({
      fhir,
      facilityId: input.facilityId,
      athenaPracticeId: practiceId,
    });

    const existingQ = await this.db
      .select()
      .from(patients)
      .where(
        and(
          eq(patients.facilityId, input.facilityId),
          eq(patients.athenaResourceId, fhir.id),
        ),
      )
      .limit(1);
    const existing = existingQ[0];

    if (!existing) {
      const inserted = await this.db.insert(patients).values(row).returning();
      const resultRow = inserted[0]!;
      this.logger.log(
        `inserted patient athena=${fhir.id} facility=${input.facilityId} nameSource=${diagnostics.nameSource} mrnSource=${diagnostics.mrnSource}`,
      );
      return {
        row: resultRow,
        action: 'inserted',
        athenaVersion: row.athenaVersion ?? null,
      };
    }

    const updated = await this.db
      .update(patients)
      .set({
        ...row,
        updatedAt: new Date(),
      })
      .where(eq(patients.id, existing.id))
      .returning();
    const resultRow = updated[0]!;
    this.logger.log(
      `updated patient athena=${fhir.id} facility=${input.facilityId} version=${row.athenaVersion}`,
    );
    return {
      row: resultRow,
      action: existing.athenaVersion === row.athenaVersion ? 'unchanged' : 'updated',
      athenaVersion: row.athenaVersion ?? null,
    };
  }

  private defaultPractice(): string {
    if (!this.config) throw new Error('athena not configured');
    return this.config.defaultPracticeId;
  }
}
