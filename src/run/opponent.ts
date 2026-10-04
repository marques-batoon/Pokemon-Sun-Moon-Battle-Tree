import { SETS, type Trainer, type TreeSet } from '../data/battle-tree';
import { gen7 } from '../team/dex';
import type { PokemonSet } from '../team/types';
import type { Rng } from './rng';

/**
 * Ability roll for a Battle Tree opponent: uniform over the three slots
 * [ability1, ability2, hidden], where an empty slot repeats ability1.
 * Showdown's special `S` slot (e.g. Battle Bond) is never rolled.
 * Source: Smogon Battle Tree guide (DATA_NOTES.md section 4).
 */
export function rollAbility(species: string, rng: Rng): string {
  const abilities = gen7.species.get(species)!.abilities;
  const slots = [abilities[0], abilities[1] ?? abilities[0], abilities.H ?? abilities[0]];
  return slots[rng.int(3)];
}

/** Gender roll. The game's ratio isn't documented; the species ratio is used (APPROXIMATION). */
export function rollGender(species: string, rng: Rng): 'M' | 'F' | 'N' {
  const s = gen7.species.get(species)!;
  if (s.gender) return s.gender as 'M' | 'F' | 'N';
  return rng.next() < s.genderRatio.M ? 'M' : 'F';
}

/** A Battle Tree set as a Showdown set at Lv. 50 with the trainer's flat IVs. */
export function treeSetToPokemonSet(set: TreeSet, iv: number, rng: Rng): PokemonSet {
  return {
    name: set.species,
    species: set.species,
    item: set.item,
    ability: rollAbility(set.species, rng),
    moves: [...set.moves],
    nature: set.nature,
    gender: rollGender(set.species, rng),
    evs: { ...set.evs },
    ivs: { hp: iv, atk: iv, def: iv, spa: iv, spd: iv, spe: iv },
    level: 50,
  };
}

export function treeSetByLabel(label: string): TreeSet {
  const set = SETS.find(s => s.label === label);
  if (!set) throw new Error(`Unknown Battle Tree set "${label}"`);
  return set;
}

/** National Dex number: Species Clause compares these (Rotom-Wash and Rotom-Heat clash). */
const dexNum = (set: TreeSet) => gen7.species.get(set.species)!.num;

/**
 * Picks a trainer's team: roster sets drawn uniformly one at a time, skipping
 * any that would repeat a species (National Dex number) or a held item, until
 * the team is full. Pick order is the battle order (first = lead).
 * Source: Smogon Battle Tree guide; uniform weighting assumed (DATA_NOTES.md section 4).
 */
export function pickTeamSets(trainer: Trainer, size: number, rng: Rng): TreeSet[] {
  const picked: TreeSet[] = [];
  let candidates = trainer.roster.map(id => SETS[id]);
  while (picked.length < size) {
    candidates = candidates.filter(c => !picked.some(p => dexNum(p) === dexNum(c) || p.item === c.item));
    if (!candidates.length) throw new Error(`${trainer.name} can't field ${size} Pokémon under the clauses`);
    picked.push(rng.pick(candidates));
  }
  return picked;
}
