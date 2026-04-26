/**
 * PromptRegistryService — looks up the active prompt version for an
 * agent kind. Returns `null` if no row exists (e.g. seed never ran),
 * which lets the agent fall back to its hardcoded defaults.
 *
 * The lookup is cheap (indexed on agent_id + is_active) but we still
 * cache for 60s to keep per-message overhead negligible. Cache is
 * busted automatically when admins promote a new active version
 * because the next miss reloads — at most 60s of staleness is
 * acceptable for prompt rollouts.
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import { DB_CLIENT, type WorkerDb } from '../db/db.module';
import { agentPrompts, agents } from '../db/schema-ref';
import type { AgentId, ModelId } from './agent.interface';

export interface ActivePrompt {
  readonly id: string;
  readonly version: number;
  readonly systemPrompt: string;
  readonly model: ModelId;
  readonly temperature: number;
}

interface CacheEntry {
  readonly value: ActivePrompt | null;
  readonly expiresAt: number;
}

const TTL_MS = 60_000;

@Injectable()
export class PromptRegistryService {
  private readonly logger = new Logger(PromptRegistryService.name);
  private readonly cache = new Map<AgentId, CacheEntry>();

  constructor(@Inject(DB_CLIENT) private readonly db: WorkerDb) {}

  async getActive(agentKey: AgentId): Promise<ActivePrompt | null> {
    const cached = this.cache.get(agentKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const rows = await this.db
      .select({
        id: agentPrompts.id,
        version: agentPrompts.version,
        systemPrompt: agentPrompts.systemPrompt,
        model: agentPrompts.model,
        temperature: agentPrompts.temperature,
      })
      .from(agentPrompts)
      .innerJoin(agents, eq(agents.id, agentPrompts.agentId))
      .where(and(eq(agents.key, agentKey), eq(agentPrompts.isActive, true)))
      .limit(1);

    const value: ActivePrompt | null = rows[0]
      ? {
          id: rows[0].id,
          version: rows[0].version,
          systemPrompt: rows[0].systemPrompt,
          model: rows[0].model as ModelId,
          temperature: rows[0].temperature,
        }
      : null;

    if (!value) {
      this.logger.warn(
        `no active prompt for agent=${agentKey}; agent will use hardcoded defaults`,
      );
    }
    this.cache.set(agentKey, { value, expiresAt: Date.now() + TTL_MS });
    return value;
  }
}
