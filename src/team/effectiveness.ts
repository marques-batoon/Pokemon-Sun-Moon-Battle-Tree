import type { TypeName } from '@pkmn/data';
import { DIGIMON_MOVES } from '../data/custom/digimon';
import { gen7 } from './dex';

const toId = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
/** Moves that also count as a second type against the target's types: Flying Press (Flying), Lightning Joust (Electric). */
const SECOND_TYPES: Record<string, string> = {
  flyingpress: 'Flying',
  ...Object.fromEntries(DIGIMON_MOVES.filter(m => m.alsoType).map(m => [toId(m.name), m.alsoType!])),
};
/** The second type a move also counts as against the target's types (Flying Press, Lightning Joust), if any. */
export const secondMoveType = (moveId: string): string | undefined => SECOND_TYPES[toId(moveId)];

export type EffectivenessLabel = 'Super effective' | 'Not very effective' | 'No effect' | null;

/**
 * Type matchup of an attacking type against a defender's current types, like the
 * hint Sun & Moon show on move buttons. Abilities (Levitate, Flash Fire...) are
 * ignored, as the game's hint ignores them. Neutral returns null. `alsoType`: a
 * second type the move also counts as (secondMoveType).
 */
export function effectivenessLabel(moveType: string, defenderTypes: readonly string[], alsoType?: string): EffectivenessLabel {
  if (!defenderTypes.length) return null;
  const types = defenderTypes as TypeName[];
  if (!gen7.types.canDamage(moveType as TypeName, types)) return 'No effect';
  // A second type (Flying Press, Lightning Joust) multiplies in; only the move's own type makes a Pokémon immune.
  // (as the simulator counts it, type by type: an immunity to the second type counts as neutral).
  const mult = gen7.types.totalEffectiveness(moveType as TypeName, types)
    * (alsoType ? types.reduce((m, t) => m * (gen7.types.totalEffectiveness(alsoType as TypeName, [t]) || 1), 1) : 1);
  if (mult > 1) return 'Super effective';
  if (mult < 1) return 'Not very effective';
  return null;
}
