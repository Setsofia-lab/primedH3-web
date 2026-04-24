/**
 * JwtVerifierService — multi-pool Cognito JWT verification.
 *
 * Each of our three Cognito pools (admins / providers / patients)
 * issues its own JWTs, signed with its own JWKS. We maintain one
 * `CognitoJwtVerifier` instance per pool. On incoming request:
 *
 *   1. Parse the token header and match it against the known pools
 *      (issuer-to-pool map).
 *   2. Delegate to that pool's verifier, which:
 *      - Validates signature via JWKS (cached in-memory).
 *      - Validates `iss`, `aud`/`client_id`, `token_use=access`,
 *        `exp`, `nbf`.
 *   3. Return a typed `AuthContext` with derived role.
 *
 * Failures raise a `UnauthorizedException` with no detail beyond
 * "invalid token" — we don't leak whether the token was expired,
 * unknown issuer, or signature-bad, to avoid aiding enumeration.
 */
import { Injectable, Logger, UnauthorizedException, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import type { CognitoAccessTokenPayload } from 'aws-jwt-verify/jwt-model';
import type { AppConfig } from '../config/config.module';
import type { AuthContext, PoolKind, Role } from './auth-context';

type Verifier = ReturnType<typeof CognitoJwtVerifier.create<{
  userPoolId: string;
  clientId: string;
  tokenUse: 'access';
}>>;

interface PoolEntry {
  readonly kind: PoolKind;
  readonly poolId: string;
  readonly clientId: string;
  readonly verifier: Verifier;
  readonly issuer: string;
}

@Injectable()
export class JwtVerifierService implements OnModuleInit {
  private readonly logger = new Logger(JwtVerifierService.name);
  private pools: PoolEntry[] = [];

  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  onModuleInit(): void {
    const region = this.config.get('COGNITO_REGION', { infer: true });
    if (!region) {
      this.logger.warn('COGNITO_REGION is not set — JWT verification disabled.');
      return;
    }

    const specs: Array<{ kind: PoolKind; poolEnv: string; clientEnv: string }> = [
      { kind: 'admins', poolEnv: 'COGNITO_ADMINS_POOL_ID', clientEnv: 'COGNITO_ADMINS_CLIENT_ID' },
      { kind: 'providers', poolEnv: 'COGNITO_PROVIDERS_POOL_ID', clientEnv: 'COGNITO_PROVIDERS_CLIENT_ID' },
      { kind: 'patients', poolEnv: 'COGNITO_PATIENTS_POOL_ID', clientEnv: 'COGNITO_PATIENTS_CLIENT_ID' },
    ];

    for (const s of specs) {
      const poolId = this.config.get(s.poolEnv as keyof AppConfig, { infer: true });
      const clientId = this.config.get(s.clientEnv as keyof AppConfig, { infer: true });
      if (!poolId || !clientId) {
        this.logger.warn(`${s.kind} pool not configured (${s.poolEnv} or ${s.clientEnv} missing)`);
        continue;
      }
      const verifier = CognitoJwtVerifier.create({
        userPoolId: String(poolId),
        clientId: String(clientId),
        tokenUse: 'access',
      });
      this.pools.push({
        kind: s.kind,
        poolId: String(poolId),
        clientId: String(clientId),
        verifier,
        issuer: `https://cognito-idp.${region}.amazonaws.com/${poolId}`,
      });
    }

    this.logger.log(`JWT verifier initialised for ${this.pools.length} pool(s).`);
  }

  /**
   * Verify a bearer token from any of the configured pools. Returns
   * a typed AuthContext on success; throws `UnauthorizedException` on
   * any failure.
   */
  async verify(token: string): Promise<AuthContext> {
    if (this.pools.length === 0) {
      throw new UnauthorizedException('auth not configured');
    }
    // aws-jwt-verify needs the right pool up-front (the issuer).
    // We race: the first pool whose verifier accepts the token wins.
    // Token `iss` identifies the pool but reading the header means
    // parsing the JWT, which aws-jwt-verify doesn't expose as a
    // side-effect-free helper — we decode it ourselves.
    const issuer = this.issuerOf(token);
    const pool = this.pools.find((p) => p.issuer === issuer);
    if (!pool) {
      throw new UnauthorizedException('invalid token');
    }
    try {
      const payload = (await pool.verifier.verify(token)) as CognitoAccessTokenPayload;
      return this.toAuthContext(payload, pool);
    } catch {
      throw new UnauthorizedException('invalid token');
    }
  }

  private issuerOf(token: string): string | null {
    // token = header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    try {
      const payloadRaw = Buffer.from(parts[1]!, 'base64url').toString('utf8');
      const payload = JSON.parse(payloadRaw) as { iss?: string };
      return typeof payload.iss === 'string' ? payload.iss : null;
    } catch {
      return null;
    }
  }

  private toAuthContext(payload: CognitoAccessTokenPayload, pool: PoolEntry): AuthContext {
    const groups = (payload['cognito:groups'] as string[] | undefined) ?? [];
    return {
      sub: payload.sub,
      email: (payload['email'] as string | undefined) ?? '',
      pool: pool.kind,
      role: deriveRole(pool.kind, groups),
      groups,
      issuer: pool.issuer,
      issuedAt: payload.iat,
      expiresAt: payload.exp,
    };
  }
}

/**
 * Derive the app-level Role from pool + groups.
 *
 * - admins pool → always `admin`.
 * - patients pool → always `patient`.
 * - providers pool → read from cognito:groups; defaults to `allied`
 *   if no specific role group is attached (safest default — narrowest
 *   permissions).
 */
export function deriveRole(pool: PoolKind, groups: readonly string[]): Role {
  if (pool === 'admins') return 'admin';
  if (pool === 'patients') return 'patient';
  const known: Role[] = ['surgeon', 'anesthesia', 'coordinator', 'allied'];
  for (const g of groups) {
    const match = known.find((r) => r === g);
    if (match) return match;
  }
  return 'allied';
}
