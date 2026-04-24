/**
 * AthenaModule — wires the Athena integration services.
 *
 * Exports:
 *  - AthenaAuthService: `getAccessToken()` for the token-caching flow
 *  - AthenaHttpService: `request<T>(path, opts)` authenticated fetch
 *  - (M5.4) AthenaFhirClient: typed FHIR read wrappers
 *
 * Consumed internally by other modules (PatientsModule, CasesModule)
 * as M7 cuts MSW handlers over to real data. No public HTTP controllers
 * are mounted here.
 */
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/config.module';
import { resolveAthenaConfig } from './athena.config';
import { ATHENA_CONFIG_TOKEN } from './athena.tokens';
import { AthenaJwkService } from './athena-jwk.service';
import { AthenaAuthService } from './athena-auth.service';
import { AthenaHttpService } from './athena-http.service';
import { AthenaFhirClient } from './athena-fhir.client';
import { AthenaOneClient } from './athenaone.client';

@Global()
@Module({
  providers: [
    {
      provide: ATHENA_CONFIG_TOKEN,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) =>
        resolveAthenaConfig({
          ATHENA_BASE_URL: config.get('ATHENA_BASE_URL', { infer: true }),
          ATHENA_TOKEN_URL: config.get('ATHENA_TOKEN_URL', { infer: true }),
          ATHENA_CLIENT_ID: config.get('ATHENA_CLIENT_ID', { infer: true }),
          ATHENA_JWK_SECRET_ARN: config.get('ATHENA_JWK_SECRET_ARN', { infer: true }),
          ATHENA_DEFAULT_PRACTICE_ID: config.get('ATHENA_DEFAULT_PRACTICE_ID', { infer: true }),
        }),
    },
    AthenaJwkService,
    AthenaAuthService,
    AthenaHttpService,
    AthenaFhirClient,
    AthenaOneClient,
  ],
  exports: [
    AthenaAuthService,
    AthenaHttpService,
    AthenaJwkService,
    AthenaFhirClient,
    AthenaOneClient,
    ATHENA_CONFIG_TOKEN,
  ],
})
export class AthenaModule {}
