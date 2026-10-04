// Choice-string helpers shared by the AIs (worker) and the battle controls (UI).
// No simulator imports.

/**
 * Target locations a move may be aimed at in a Double Battle, from the user in
 * active slot `slot` (0 = left, 1 = right). Showdown numbers foes 1 and 2 and
 * the user's own side -1 and -2. Returns null when the move picks its own
 * targets (self, spread moves, the whole field, random).
 */
export function doublesTargets(target: string | undefined, slot: number): number[] | null {
  const self = -(slot + 1);
  const ally = -(2 - slot);
  switch (target) {
    case 'normal':
    case 'any':
      return [1, 2, ally];
    case 'adjacentFoe':
      return [1, 2];
    case 'adjacentAlly':
      return [ally];
    case 'adjacentAllyOrSelf':
      return [self, ally];
    default:
      return null;
  }
}

/** Moves that hit everyone around the user, the partner included (Earthquake, Surf, Explosion...). */
export const hitsPartner = (target: string | undefined) => target === 'allAdjacent';
/** Moves that hit both foes (Rock Slide, Heat Wave...). */
export const isSpread = (target: string | undefined) => target === 'allAdjacentFoes' || target === 'allAdjacent';
