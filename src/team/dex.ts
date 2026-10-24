// Gen 7 data for the UI thread (team builder, battle display). Uses @pkmn/dex
// + @pkmn/data only; the simulator and its validator stay in the worker.
import { Generations, type Specie, type Move, type Item } from '@pkmn/data';
import { Dex, type ID, type ModdedDex } from '@pkmn/dex';
import { RULES } from '../data/battle-tree';
import { CHAMPIONS_MOD, championsOverrides, NEW_BASE_SPECIES, NEW_MOVE_IDS } from '../data/champions';
import { CUSTOM_LEARNS, customOverrides, mergeModData } from '../data/custom';
import { DIGIMON_MOVE_IDS, digimonMoves, digimonOverrides } from '../data/custom/digimon';
import { isParadoxForm, PARADOX_MOVE_IDS, paradoxFormForSet, paradoxOverrides } from '../data/custom/paradox';
import { GALAR_BIRD_MOVES, GALAR_BIRD_NEW_MOVE_IDS, galarBirdsOverrides } from '../data/galar-birds';
import { STARTER_MOVES, STARTER_NEW_MOVE_IDS, startersOverrides } from '../data/starters';
import { galarOverrides, GALAR_NEW_MOVE_IDS, isOpponentOnly } from '../data/galar';
import { USUM_ONLY_SPECIES } from '../engine/format-constants';

/**
 * Gen 7 plus the Pokémon Champions Megas, the Galarian legendary birds, the Gen 8-9 starters and the custom additions: the same data
 * layer the simulator uses (src/engine/format.ts). Here the Paradox forms are
 * visible too, for their stats, types and sprites (they're never team choices).
 */
const championsDex: ModdedDex = Dex.mod(CHAMPIONS_MOD as ID, {
  Scripts: { inherit: 'gen7' },
  ...mergeModData(championsOverrides(), customOverrides({ species: Dex.forGen(7).data.Species as never }), paradoxOverrides({ ui: true }), digimonOverrides(), galarBirdsOverrides(), startersOverrides(), galarOverrides()),
} as never);

export const gens = new Generations({ ...Dex, forGen: (gen: number) => (gen === 7 ? championsDex : Dex.forGen(gen)) } as typeof Dex);
export const gen7 = gens.get(7);
/** Newest learnsets, for the Champions Pokémon that aren't in Sun & Moon. */
const gen9 = gens.get(9);
/** @pkmn/sets wants a Dex-shaped data source for import/export canonicalization. */
export const dex7 = championsDex;

// Banning a base species bans all its formes; banning a forme (Lycanroc-Dusk) bans only that forme.
const isForme = (name: string) => !!gen7.species.get(name)?.forme;
const bannedBase = new Set([...RULES.bannedSpecies.species, ...USUM_ONLY_SPECIES].filter(n => !isForme(n)));
const bannedExact = new Set(USUM_ONLY_SPECIES.filter(isForme));

/**
 * Whether a species can be registered in the Sun/Moon Battle Tree. Banned
 * species include every forme; USUM-only formes (Lycanroc-Dusk) are banned
 * individually. Battle-only formes (Megas, Ash-Greninja, ...), Totems and the
 * Paradox forms (reached by Paradox Evolution) aren't team choices.
 */
export function isEligibleSpecies(s: Specie): boolean {
  // Gloria's Galar Pokémon are opponents only (for now).
  if (s.battleOnly || s.name.endsWith('-Totem') || isParadoxForm(s.name) || isOpponentOnly(s.name)) return false;
  if (bannedExact.has(s.name)) return false;
  return !bannedBase.has(s.baseSpecies);
}

let speciesCache: Specie[] | null = null;
export function eligibleSpecies(): Specie[] {
  speciesCache ??= [...gen7.species].filter(isEligibleSpecies).sort((a, b) => a.num - b.num || a.name.localeCompare(b.name));
  return speciesCache;
}

let itemCache: Item[] | null = null;
/** Every Gen 7 item is allowed (approved decision). */
export function allItems(): Item[] {
  itemCache ??= [...gen7.items].sort((a, b) => a.name.localeCompare(b.name));
  return itemCache;
}

let moveCache: Move[] | null = null;
/**
 * Gen 7 moves (the Gen 8-9 moves made available for the Champions Pokémon, the Paradox forms, the Galarian birds and the new starters,
 * and the Digimon's signature moves, aren't for anyone else).
 */
export function allMoves(): Move[] {
  moveCache ??= [...gen7.moves]
    .filter(m => !m.isZ && m.id !== 'struggle' && !NEW_MOVE_IDS.has(m.id) && !PARADOX_MOVE_IDS.has(m.id) && !DIGIMON_MOVE_IDS.has(m.id) && !GALAR_BIRD_NEW_MOVE_IDS.has(m.id) && !STARTER_NEW_MOVE_IDS.has(m.id) && !GALAR_NEW_MOVE_IDS.has(m.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  return moveCache;
}

/** Moves Smeargle can't Sketch (and so can never learn). */
const UNSKETCHABLE = new Set(['chatter', 'struggle', 'sketch']);

/**
 * Moves the species can learn in Gen 7 per Showdown's merged Sun/Moon + Ultra
 * Sun/Ultra Moon learnsets (approved decision). Teambuilder-level legality;
 * event/egg-move combinations are checked by the simulator's validator.
 * Holding a Paradoxorb, it's the Paradox form's moves instead (its newest learnset).
 */
export async function learnableMoves(species: string, item?: string): Promise<Move[]> {
  const paradox = paradoxFormForSet(species, item);
  if (paradox) {
    const learnable = (await gen9.learnsets.learnable(paradox)) ?? {};
    return Object.keys(learnable)
      .map(id => gen7.moves.get(id))
      .filter((m): m is Move => !!m && !m.isZ)
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  // The Digimon learn their own list, which depends on the held warp item (Blackwargreyite: BlackWarGreymon's).
  const digimon = digimonMoves(species, item);
  if (digimon) return digimon.map(m => gen7.moves.get(m)).filter((m): m is Move => !!m).sort((a, b) => a.name.localeCompare(b.name));
  const s = gen7.species.get(species);
  // The Galarian birds learn what they learn in Sword and Shield, the Gen 8-9 starters what they learn in their debut game.
  const own = s && (GALAR_BIRD_MOVES[s.name] ?? STARTER_MOVES[s.name]);
  if (own) return own.map(m => gen7.moves.get(m)).filter((m): m is Move => !!m).sort((a, b) => a.name.localeCompare(b.name));
  // Champions Pokémon that aren't in Sun & Moon learn from their newest (Gen 9) learnsets.
  const learnable = s && NEW_BASE_SPECIES.includes(s.name)
    ? await gen9.learnsets.learnable(s.name)
    : await gen7.learnsets.learnable(species);
  if (!learnable) return [];
  if ('sketch' in learnable) return allMoves().filter(m => !UNSKETCHABLE.has(m.id));
  const extra = (CUSTOM_LEARNS[s?.name ?? ''] ?? []).map(m => gen7.moves.get(m)?.id).filter((id): id is ID => !!id);
  return [...new Set([...Object.keys(learnable), ...extra])]
    .map(id => gen7.moves.get(id))
    .filter((m): m is Move => !!m)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function speciesAbilities(species: string): string[] {
  const s = gen7.species.get(species);
  if (!s) return [];
  // Slot S (e.g. Battle Bond) belongs to a separate forme in Gen 7 data.
  return [...new Set([s.abilities[0], s.abilities[1], s.abilities.H].filter((a): a is NonNullable<typeof a> => !!a))];
}
