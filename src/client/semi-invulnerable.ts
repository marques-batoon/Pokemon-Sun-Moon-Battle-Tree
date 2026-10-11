// Two-turn moves that take the user out of reach for a turn (Dig, Fly, Dive, Phantom Force...):
// @pkmn/client doesn't track them, so the battle screen does, to show where the Pokémon went.
import type { Battle as ClientBattle, Pokemon } from '@pkmn/client';
import type { ID } from '@pkmn/data';

export type SemiInvulnerable = 'underground' | 'sky' | 'underwater' | 'phantom';

/** Moves whose charging turn hides the user, and where (Bounce and Sky Drop go up like Fly). */
export const SEMI_INVULNERABLE_MOVES: Record<string, SemiInvulnerable> = {
  dig: 'underground', fly: 'sky', bounce: 'sky', skydrop: 'sky', dive: 'underwater', phantomforce: 'phantom', shadowforce: 'phantom',
};

const toID = (s: string | undefined) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Applies a protocol line's effect on the hidden state, after the client has applied the line:
 * `-prepare` (the charging turn) hides the Pokémon until it next moves (a "move"-long volatile,
 * cleared by the client when it uses its next move: the attack). It comes back early if it can't
 * move (`cant`) or when a Power Herb skips the charge.
 */
export function trackSemiInvulnerable(battle: ClientBattle, args: readonly string[]): void {
  const kind = args[0];
  if (kind !== '-prepare' && kind !== 'cant' && kind !== '-enditem') return;
  const poke = args[1] ? battle.getPokemon(args[1] as never) : null;
  if (!poke) return;
  if (kind === '-prepare') {
    const id = toID(args[2]);
    if (SEMI_INVULNERABLE_MOVES[id]) poke.addVolatile(id as ID, { duration: 'move' } as never);
    return;
  }
  if (kind === '-enditem' && toID(args[2]) !== 'powerherb') return;
  for (const id of Object.keys(SEMI_INVULNERABLE_MOVES)) if (id in poke.volatiles) poke.removeVolatile(id as ID);
}

/** Where a Pokémon is hiding this turn, if it is. */
export function semiInvulnerableOf(pokemon: Pokemon): SemiInvulnerable | null {
  for (const [id, where] of Object.entries(SEMI_INVULNERABLE_MOVES)) if (id in pokemon.volatiles) return where;
  return null;
}
