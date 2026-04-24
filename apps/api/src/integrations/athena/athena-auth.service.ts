/**
 * AthenaAuthService — OAuth 2.0 client-credentials with RS256
 * client-assertion JWT (per RFC 7523).
 *
 * Flow per request:
 *  1. Try cached access_token from Redis (`athena:token:<env>`).
 *  2. If miss or expiring within 60s: build a client_assertion JWT
 *     signed with our private JWK, POST to ATHENA_TOKEN_URL with
 *     grant_type=client_credentials, cache, return.
 *  3. If >1 caller misses simultaneously: in-process mutex guarantees
 *     a single token fetch across the event loop.
 *
 * The client_assertion JWT claims follow Athena's doc pattern:
 *   iss = clientId
 *   sub = clientId
 *   aud = tokenUrl
 *   jti = uuid
 *   iat = now
 *   exp = now + 5 min   (Athena rejects > 5 min horizon)
 *   kid = JWK header
 *   alg = RS256
 */
import {
  Inject,
  Injectable,
  Logger,
  OnApplicationShutdown,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID, createSign } from 'node:crypto';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { AthenaJwkService } from './athena-jwk.service';
import { ATHENA_CONFIG_TOKEN, type AthenaResolvedConfig } from './athena.tokens';

interface AccessTokenResponse {
  readonly access_token: string;
  readonly token_type: 'Bearer' | string;
  readonly expires_in: number;
  readonly scope?: string;
}

interface CachedToken {
  readonly token: string;
  /** unix seconds when the token expires */
  readonly expiresAt: number;
}

/** Fetch with a timeout — Athena should respond in well under 5s. */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctl.signal });
  } finally {
    clearTimeout(t);
  }
}

function base64UrlEncode(buf: Buffer | string): string {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

@Injectable()
export class AthenaAuthService implements OnApplicationShutdown {
  private readonly logger = new Logger(AthenaAuthService.name);
  /** Single-flight mutex — avoids thundering-herd token refreshes. */
  private inflight: Promise<string> | null = null;

  constructor(
    @Inject(ATHENA_CONFIG_TOKEN) private readonly config: AthenaResolvedConfig | null,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly jwk: AthenaJwkService,
  ) {}

  /**
   * Return a valid access_token. Caches in Redis so concurrent tasks /
   * multiple api replicas share a single token per env.
   */
  async getAccessToken(): Promise<string> {
    if (!this.config) {
      throw new UnauthorizedException('athena not configured');
    }
    // Redis-cached?
    try {
      const cached = await this.redis.get(this.cacheKey());
      if (cached) {
        const parsed = JSON.parse(cached) as CachedToken;
        if (parsed.expiresAt - 60 > nowSec()) {
          return parsed.token;
        }
      }
    } catch (err) {
      this.logger.warn(`Redis read failed for athena token: ${String(err)}`);
    }
    // Single-flight per process.
    if (this.inflight) return this.inflight;
    this.inflight = this.refreshToken().finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  onApplicationShutdown(): void {
    this.inflight = null;
  }

  // ---- internals ----

  private cacheKey(): string {
    const env = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';
    return `athena:token:${env}`;
  }

  private async refreshToken(): Promise<string> {
    if (!this.config) throw new UnauthorizedException('athena not configured');
    const assertion = this.buildClientAssertion();

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      client_assertion: assertion,
      // Request all scopes on the app; Athena returns the grantable subset.
      scope: 'system/*.r system/*.rs system/*.s system/Subscription.read system/Subscription.write system/SubscriptionTopic.read',
    });

    const started = Date.now();
    let res: Response;
    try {
      res = await fetchWithTimeout(
        this.config.tokenUrl,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        },
        5_000,
      );
    } catch (err) {
      this.logger.error(`Athena token fetch network error: ${String(err)}`);
      throw new UnauthorizedException('athena token fetch failed');
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(`Athena token ${res.status}: ${text.slice(0, 400)}`);
      throw new UnauthorizedException(`athena token ${res.status}`);
    }
    const payload = (await res.json()) as AccessTokenResponse;
    if (!payload.access_token || !payload.expires_in) {
      throw new UnauthorizedException('athena token response malformed');
    }

    const expiresAt = nowSec() + payload.expires_in;
    const toCache: CachedToken = { token: payload.access_token, expiresAt };
    try {
      // Expire 60s early so refresh kicks in before a live token is used.
      const ttl = Math.max(payload.expires_in - 60, 30);
      await this.redis.set(this.cacheKey(), JSON.stringify(toCache), 'EX', ttl);
    } catch (err) {
      this.logger.warn(`Redis write failed for athena token: ${String(err)}`);
    }

    this.logger.log(
      `Athena token refreshed in ${Date.now() - started}ms, ttl=${payload.expires_in}s`,
    );
    return payload.access_token;
  }

  private buildClientAssertion(): string {
    if (!this.config) throw new UnauthorizedException('athena not configured');
    const { privateKey, kid } = this.jwk.get();
    const now = nowSec();
    const header = { alg: 'RS256', typ: 'JWT', kid };
    const claims = {
      iss: this.config.clientId,
      sub: this.config.clientId,
      aud: this.config.tokenUrl,
      jti: randomUUID(),
      iat: now,
      exp: now + 5 * 60, // Athena caps at 5 minutes per their doc
      nbf: now - 5, // small clock-skew tolerance
    };
    const headerB64 = base64UrlEncode(JSON.stringify(header));
    const claimsB64 = base64UrlEncode(JSON.stringify(claims));
    const signingInput = `${headerB64}.${claimsB64}`;

    const signer = createSign('RSA-SHA256');
    signer.update(signingInput);
    signer.end();
    const signature = signer.sign(privateKey);
    return `${signingInput}.${base64UrlEncode(signature)}`;
  }
}

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}
