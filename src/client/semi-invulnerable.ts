// Two-turn moves that take the user out of reach for a turn (Dig, Fly, Dive, Phantom Force...):
// @pkmn/client doesn't track them, so the battle screen does, to show where the Pokémon went.
import type { Battle as ClientBattle, Pokemon } from '@pkmn/client';
import type { ID } from '@pkmn/data';

/** `carried`: the target of Sky Drop, taken up into the sky by its user and out of the battle until dropped. */
export type SemiInvulnerable = 'underground' | 'sky' | 'underwater' | 'phantom' | 'carried';

/** The battle screen's own volatile for a Pokémon carried off by Sky Drop (the client doesn't track it). */
export const CARRIED = 'skydropped';
/** The last move used in each battle (Sky Drop's attack drops the Pokémon it carried). */
const lastMove = new WeakMap<ClientBattle, string>();

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
export function trackSemiInvulnerable(battle: ClientBattle, args: readonly string[], kwArgs: Record<string, unknown> = {}): void {
  const kind = args[0];
  if (kind === 'move') lastMove.set(battle, toID(args[2]));
  if (kind !== '-prepare' && kind !== 'cant' && kind !== '-enditem' && kind !== '-end' && kind !== '-damage') return;
  const poke = args[1] ? battle.getPokemon(args[1] as never) : null;
  if (!poke) return;
  if (kind === '-prepare') {
    const id = toID(args[2]);
    if (SEMI_INVULNERABLE_MOVES[id]) poke.addVolatile(id as ID, { duration: 'move' } as never);
    // Sky Drop takes its target up too ("-prepare|user|Sky Drop|target"), until "-end|target|Sky Drop" (dropped, or
    // freed when its user can't go on).
    const carried = id === 'skydrop' && args[3] ? battle.getPokemon(args[3] as never) : null;
    if (carried) carried.addVolatile(CARRIED as ID);
    return;
  }
  if (kind === '-end') {
    if (toID(args[2]) === 'skydrop' && CARRIED in poke.volatiles) poke.removeVolatile(CARRIED as ID);
    return;
  }
  // Sky Drop's attack lands: it's dropped to the ground (the battle screen shows the fall first; "-end" follows,
  // unless the drop knocked it out).
  if (kind === '-damage') {
    if (!('from' in kwArgs) && lastMove.get(battle) === 'skydrop' && CARRIED in poke.volatiles) poke.removeVolatile(CARRIED as ID);
    return;
  }
  if (kind === '-enditem' && toID(args[2]) !== 'powerherb') return;
  for (const id of Object.keys(SEMI_INVULNERABLE_MOVES)) if (id in poke.volatiles) poke.removeVolatile(id as ID);
}

/** Where a Pokémon is hiding this turn, if it is. */
export function semiInvulnerableOf(pokemon: Pokemon): SemiInvulnerable | null {
  if (CARRIED in pokemon.volatiles) return 'carried';
  for (const [id, where] of Object.entries(SEMI_INVULNERABLE_MOVES)) if (id in pokemon.volatiles) return where;
  return null;
}
