/**
 * DI tokens + shared type re-exports for the Athena module.
 */
export const ATHENA_CONFIG_TOKEN = Symbol('ATHENA_CONFIG_TOKEN');
export const ATHENA_REDIS_TOKEN = Symbol('ATHENA_REDIS_TOKEN');
export type { AthenaResolvedConfig } from './athena.config';
