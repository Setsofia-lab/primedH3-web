/**
 * Helper to extract `requestId`, `ip`, and `user-agent` from a Fastify
 * request for the AuditService. Centralised so every controller does
 * the same thing.
 *
 * `requestId` comes from the pino-http genReqId (see app.module.ts) —
 * it's already attached as `req.id`.
 */
import type { FastifyRequest } from 'fastify';
import type { AuditRequestMeta } from '../audit/audit.service';

export function meta(req: FastifyRequest): AuditRequestMeta {
  const headers = req.headers ?? {};
  const fwd = headers['x-forwarded-for'];
  const ip =
    (Array.isArray(fwd) ? fwd[0] : fwd?.split(',')[0]?.trim()) ||
    req.ip ||
    null;
  const ua = (headers['user-agent'] as string | undefined) ?? null;
  return {
    requestId: (req.id as string | undefined) ?? null,
    ip,
    userAgent: ua,
  };
}
