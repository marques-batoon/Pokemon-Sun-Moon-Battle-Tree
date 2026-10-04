import type { Battle, PRNG, SideID } from '@pkmn/sim';
import type { SimRequest } from '../engine/sim-types';

export interface AIContext {
  /** The request the simulator sent to this AI's side. */
  request: SimRequest;
  /**
   * Full simulator state, read-only. The in-game AI knows the player's team,
   * so the AI may inspect both sides. Never mutate it.
   */
  battle: Battle;
  side: SideID;
  /** Seeded RNG owned by the AI, independent from the battle's RNG. */
  prng: PRNG;
}

/**
 * An opponent controller. Implementations return a Showdown choice string
 * ("team 213", "move 2 mega", "switch 3", ...). Returning an invalid choice is
 * a bug: the session falls back to "default" and logs a warning.
 */
export interface BattleAI {
  readonly name: string;
  choose(ctx: AIContext): string;
}
