/**
 * Shared types for authenticated requests.
 *
 * `Role` is our app-level role (Constitution §1.4). A Cognito pool
 * determines the top-level category (admin / provider / patient);
 * finer-grained provider roles (surgeon / anesthesia / coordinator /
 * allied) come from the Cognito `cognito:groups` claim within the
 * providers pool.
 */

export type PoolKind = 'admins' | 'providers' | 'patients';

export type Role =
  | 'admin'
  | 'surgeon'
  | 'anesthesia'
  | 'coordinator'
  | 'allied'
  | 'patient';

export interface AuthContext {
  /** Cognito `sub` — stable identifier across sessions. */
  readonly sub: string;
  /** Verified email from the token. */
  readonly email: string;
  /** Pool the token came from. */
  readonly pool: PoolKind;
  /** App-level role derived from pool + cognito:groups. */
  readonly role: Role;
  /** All Cognito groups on the token (for fine-grained checks). */
  readonly groups: readonly string[];
  /** Token's `iss` claim (the userpool issuer URL). */
  readonly issuer: string;
  /** Unix seconds when the token was issued. */
  readonly issuedAt: number;
  /** Unix seconds when the token expires. */
  readonly expiresAt: number;
}

/** Symbol used to attach AuthContext to the Fastify request. */
export const AUTH_CONTEXT_KEY = 'authContext' as const;
