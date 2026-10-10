import type { Nature, StatsTable } from '@pkmn/data';
import { canHoldItem, paradoxFormForSet } from '../data/custom/paradox';
import { gen7, speciesAbilities } from './dex';
import { DEFAULT_LEVEL, MAX_EV_STAT, MAX_EV_TOTAL, MAX_IV, STAT_IDS, type PokemonSet, type StatID } from './types';

const fill = (v: number): StatsTable => ({ hp: v, atk: v, def: v, spa: v, spd: v, spe: v });

/** A fresh set for a species: Lv. 50, first ability, no item, no moves, 0 EVs / 31 IVs. */
export function newSet(species: string): PokemonSet {
  const s = gen7.species.get(species);
  return {
    name: s?.name ?? species,
    species: s?.name ?? species,
    item: '',
    ability: speciesAbilities(species)[0] ?? '',
    moves: [],
    nature: 'Hardy',
    gender: s?.gender ?? '',
    evs: fill(0),
    ivs: fill(MAX_IV),
    level: DEFAULT_LEVEL,
  };
}

/**
 * Switches species while keeping what still makes sense (item, nature, spreads,
 * moves the new species can't learn are dropped by the caller once its learnset loads).
 */
export function changeSpecies(set: PokemonSet, species: string): PokemonSet {
  const fresh = newSet(species);
  const abilities = speciesAbilities(species);
  return {
    ...set,
    name: set.name && set.name !== set.species ? set.name : fresh.name,
    species: fresh.species,
    ability: abilities.includes(set.ability) ? set.ability : fresh.ability,
    gender: fresh.gender,
    // A Paradoxorb only stays if the new species has that kind of Paradox form.
    item: canHoldItem(fresh.species, set.item) ? set.item : '',
  };
}

/** The species a set battles as: its Paradox form when holding the matching Paradoxorb, else itself. */
export const battleSpecies = (set: Pick<PokemonSet, 'species' | 'item'>): string => paradoxFormForSet(set.species, set.item) ?? set.species;

/**
 * The form a set changes into mid-battle with its held item: its Mega Evolution with a matching Mega
 * Stone, or its warp form with a Digimon's warp item (Wargreyite works like a Mega Stone). Null
 * otherwise. (Paradoxorbs aren't this: the Paradox form is what battles from the start; see battleSpecies.)
 */
export function megaFormForSet(set: Pick<PokemonSet, 'species' | 'item'>): string | null {
  const species = gen7.species.get(set.species);
  const stone = set.item ? gen7.items.get(set.item)?.megaStone : undefined;
  if (!species || !stone) return null;
  const form = (stone as Record<string, string>)[species.name] ?? (stone as Record<string, string>)[species.baseSpecies];
  return form && form !== species.name && gen7.species.get(form) ? form : null;
}

/** Level the Pokémon actually battles at: above 50 is lowered to 50, lower levels stay. */
export const battleLevel = (set: PokemonSet) => Math.min(set.level || DEFAULT_LEVEL, DEFAULT_LEVEL);

export function evTotal(set: PokemonSet): number {
  return STAT_IDS.reduce((sum, s) => sum + (set.evs?.[s] ?? 0), 0);
}

/**
 * Sets one EV, clamped to 0-252 and to whatever is left of the 510 budget.
 * Returns the set unchanged if nothing changes.
 */
export function withEv(set: PokemonSet, stat: StatID, value: number): PokemonSet {
  const others = evTotal(set) - (set.evs[stat] ?? 0);
  const clamped = Math.max(0, Math.min(MAX_EV_STAT, MAX_EV_TOTAL - others, Math.floor(value || 0)));
  return { ...set, evs: { ...set.evs, [stat]: clamped } };
}

export function withIv(set: PokemonSet, stat: StatID, value: number): PokemonSet {
  const clamped = Math.max(0, Math.min(MAX_IV, Math.floor(value || 0)));
  return { ...set, ivs: { ...set.ivs, [stat]: clamped } };
}

/** Final stats at the battle level (min(level, 50)), as the game computes them. */
/** Stats at the battle level; for a Paradoxorb holder, its Paradox form's stats. */
export function calcStats(set: PokemonSet): StatsTable {
  const species = gen7.species.get(battleSpecies(set));
  const nature = gen7.natures.get(set.nature) as Nature | undefined;
  const level = battleLevel(set);
  const out = fill(0);
  if (!species) return out;
  for (const stat of STAT_IDS) {
    out[stat] = gen7.stats.calc(stat, species.baseStats[stat], set.ivs?.[stat] ?? MAX_IV, set.evs?.[stat] ?? 0, level, nature);
  }
  return out;
}

/** Hidden Power type implied by the IVs (Gen 7). */
export function hiddenPowerType(set: PokemonSet): string {
  const types = ['Fighting', 'Flying', 'Poison', 'Ground', 'Rock', 'Bug', 'Ghost', 'Steel', 'Fire', 'Water', 'Grass', 'Electric', 'Psychic', 'Ice', 'Dragon', 'Dark'];
  const order: StatID[] = ['hp', 'atk', 'def', 'spe', 'spa', 'spd'];
  const bits = order.reduce((acc, s, i) => acc + ((set.ivs?.[s] ?? MAX_IV) % 2) * (1 << i), 0);
  return types[Math.floor((bits * 15) / 63)];
}
