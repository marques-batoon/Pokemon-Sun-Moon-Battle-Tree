import type { TypeName } from '@pkmn/data';
import { gen7 } from './dex';

export type EffectivenessLabel = 'Super effective' | 'Not very effective' | 'No effect' | null;

/**
 * Type matchup of an attacking type against a defender's current types, like the
 * hint Sun & Moon show on move buttons. Abilities (Levitate, Flash Fire...) are
 * ignored, as the game's hint ignores them. Neutral returns null.
 */
export function effectivenessLabel(moveType: string, defenderTypes: readonly string[]): EffectivenessLabel {
  if (!defenderTypes.length) return null;
  const types = defenderTypes as TypeName[];
  if (!gen7.types.canDamage(moveType as TypeName, types)) return 'No effect';
  const mult = gen7.types.totalEffectiveness(moveType as TypeName, types);
  if (mult > 1) return 'Super effective';
  if (mult < 1) return 'Not very effective';
  return null;
}
