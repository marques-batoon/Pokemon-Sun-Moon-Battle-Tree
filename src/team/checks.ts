import { gen7 } from './dex';
import type { PokemonSet } from './types';

/**
 * Slot indices that break Species Clause (same National Dex species) or Item
 * Clause (same held item), grouped per conflict. Instant, UI-side highlighting;
 * the engine's validator remains the authority on legality.
 */
export function clauseConflicts(sets: PokemonSet[]): { species: number[][]; items: number[][] } {
  const group = (key: (s: PokemonSet) => string | null) => {
    const byKey = new Map<string, number[]>();
    sets.forEach((s, i) => {
      const k = key(s);
      if (k) byKey.set(k, [...(byKey.get(k) ?? []), i]);
    });
    return [...byKey.values()].filter(g => g.length > 1);
  };
  return {
    species: group(s => String(gen7.species.get(s.species)?.num ?? s.species)),
    items: group(s => (s.item ? gen7.items.get(s.item)?.id ?? s.item : null)),
  };
}

export interface SlotConflicts {
  /** Slots sharing a species with another slot. */
  species: Set<number>;
  /** Slots sharing a held item with another slot. */
  items: Set<number>;
  any: Set<number>;
}

export function slotConflicts(sets: PokemonSet[]): SlotConflicts {
  const { species, items } = clauseConflicts(sets);
  const s = new Set(species.flat());
  const i = new Set(items.flat());
  return { species: s, items: i, any: new Set([...s, ...i]) };
}
