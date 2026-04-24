/**
 * AthenaJwkService — loads the private JWK from Secrets Manager once at
 * boot and caches the parsed signing key. Separated from AuthService so
 * it's easy to mock in tests.
 */
import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { createPrivateKey, type KeyObject } from 'node:crypto';
import { ATHENA_CONFIG_TOKEN, type AthenaResolvedConfig } from './athena.tokens';

interface JwkPrivateKey extends Record<string, unknown> {
  readonly kty: 'RSA';
  readonly alg: 'RS256';
  readonly kid: string;
  readonly n: string;
  readonly e: string;
  readonly d: string;
  readonly p?: string;
  readonly q?: string;
  readonly dp?: string;
  readonly dq?: string;
  readonly qi?: string;
}

@Injectable()
export class AthenaJwkService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(AthenaJwkService.name);
  private privateKey: KeyObject | null = null;
  private kid: string | null = null;
  private region: string;

  constructor(@Inject(ATHENA_CONFIG_TOKEN) private readonly config: AthenaResolvedConfig | null) {
    this.region = process.env.AWS_REGION ?? 'us-east-1';
  }

  async onModuleInit(): Promise<void> {
    if (!this.config) {
      this.logger.warn('Athena integration disabled — config not resolved.');
      return;
    }
    try {
      const client = new SecretsManagerClient({ region: this.region });
      const res = await client.send(
        new GetSecretValueCommand({ SecretId: this.config.jwkSecretArn }),
      );
      if (!res.SecretString) throw new Error('SecretString empty');
      const jwk = JSON.parse(res.SecretString) as JwkPrivateKey;
      if (jwk.kty !== 'RSA' || jwk.alg !== 'RS256') {
        throw new Error(`Unexpected JWK kty/alg: ${jwk.kty}/${jwk.alg}`);
      }
      // Node's createPrivateKey accepts a JWK directly.
      this.privateKey = createPrivateKey({ key: jwk, format: 'jwk' });
      this.kid = jwk.kid;
      this.logger.log(`Athena JWK loaded (kid=${this.kid})`);
    } catch (err) {
      this.logger.error(
        `Failed to load Athena JWK from ${this.config.jwkSecretArn}: ${
          err instanceof Error ? err.message : 'unknown'
        }`,
      );
      // Leave privateKey null — AthenaAuthService will throw on first use.
    }
  }

  onApplicationShutdown(): void {
    this.privateKey = null;
    this.kid = null;
  }

  /**
   * Throws if the JWK isn't loaded (config missing or SM failure).
   */
  get(): { privateKey: KeyObject; kid: string } {
    if (!this.privateKey || !this.kid) {
      throw new Error('Athena JWK not available — check ATHENA_JWK_SECRET_ARN + task role');
    }
    return { privateKey: this.privateKey, kid: this.kid };
  }

  isReady(): boolean {
    return this.privateKey !== null;
  }
}
