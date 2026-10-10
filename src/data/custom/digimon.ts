// Digimon (custom addition, see DATA_NOTES.md "Custom additions"): Pokémon-style
// entries designed by the user. A Digimon holding its warp item Warp Digivolves
// in battle, like Mega Evolution, except that a team can Warp Digivolve any
// number of Digimon (and still Mega Evolve once). No simulator imports: the UI
// thread and the worker both build their data from this.

type StatID = 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe';
type Stats = Record<StatID, number>;

export interface DigimonForm {
  name: string;
  types: string[];
  baseStats: Stats;
  abilities: { 0: string; 1?: string; H?: string };
  weightkg: number;
  color: string;
}

export interface WarpDigimon {
  /** The team member, e.g. "Agumon". */
  base: DigimonForm & { genderRatio: { M: number; F: number }; num: number };
  /** What it Warp Digivolves into, e.g. "WarGreymon" (battle-only, like a Mega). */
  warp: DigimonForm;
  /** The held item that lets it Warp Digivolve (works like a Mega Stone). */
  item: string;
  itemDesc: string;
  /** Moves it can learn (level-up and TM), by name. */
  moves: string[];
}

export const WARP_DIGIMON: WarpDigimon[] = [{
  base: {
    num: 10201, name: 'Agumon', types: ['Fire'], color: 'Yellow',
    baseStats: { hp: 44, atk: 60, def: 45, spa: 55, spd: 45, spe: 60 },
    abilities: { 0: 'Blaze', H: 'Tough Claws' }, weightkg: 12, genderRatio: { M: 0.875, F: 0.125 },
  },
  warp: {
    name: 'WarGreymon', types: ['Fire', 'Dragon'], color: 'Yellow',
    baseStats: { hp: 78, atk: 140, def: 100, spa: 130, spd: 86, spe: 100 },
    abilities: { 0: 'Sheer Force' }, weightkg: 120,
  },
  item: 'Wargreyite',
  itemDesc: 'If held by an Agumon, this item allows it to Warp Digivolve into WarGreymon in battle.',
  moves: [
    // Level-up
    'Scratch', 'Growl', 'Metal Claw', 'Ember', 'Smokescreen', 'Bite', 'Fire Fang', 'Pepper Breath', 'Slash', 'Scary Face',
    'Dragon Breath', 'Crunch', 'Flamethrower', 'Dragon Claw', 'Iron Defense', 'Dragon Dance', 'Gaia Force', 'Close Combat',
    'Heat Wave', 'Flare Blitz', 'Outrage', 'Giga Impact',
    // TMs
    'Aerial Ace', 'Air Slash', 'Aura Sphere', 'Blast Burn', 'Brick Break', 'Breaking Swipe', 'Bulldoze', 'Dark Pulse', 'Dig',
    'Draco Meteor', 'Dragon Pulse', 'Dragon Tail', 'Dual Wingbeat', 'Earthquake', 'Endure', 'Facade', 'Fire Blast', 'Fire Pledge',
    'Fire Punch', 'Fire Spin', 'Flame Charge', 'Fly', 'Focus Blast', 'Hyper Beam', 'Iron Head', 'Overheat', 'Protect', 'Rest',
    'Rock Slide', 'Rock Tomb', 'Scorching Sands', 'Shadow Claw', 'Sleep Talk', 'Solar Beam', 'Solar Blade', 'Stone Edge',
    'Substitute', 'Sunny Day', 'Swift', 'Swords Dance', 'Temper Flare', 'Tera Blast', 'Thunder Punch', 'U-turn', 'Will-O-Wisp',
    'X-Scissor',
  ],
}];

export interface DigimonMove {
  name: string;
  type: string;
  category: 'Physical' | 'Special';
  basePower: number;
  accuracy: number;
  pp: number;
  contact: boolean;
  /** Chance (%) to burn the target. */
  burnChance: number;
  desc: string;
}

/** Signature moves (only the Digimon that list them can learn them). */
export const DIGIMON_MOVES: DigimonMove[] = [
  {
    name: 'Pepper Breath', type: 'Fire', category: 'Special', basePower: 65, accuracy: 100, pp: 15, contact: false, burnChance: 20,
    desc: '20% chance to burn the target.',
  },
  {
    name: 'Gaia Force', type: 'Fire', category: 'Special', basePower: 110, accuracy: 90, pp: 5, contact: false, burnChance: 20,
    desc: '20% chance to burn the target.',
  },
];

/** Sprites shipped with the app (public/pokemon), facing left; the back view is the front one flipped. */
export const DIGIMON_SPRITES: Record<string, { file: string; w: number; h: number }> = {
  Agumon: { file: 'pokemon/agumon.png', w: 84, h: 84 },
  WarGreymon: { file: 'pokemon/wargreymon.png', w: 132, h: 132 },
};

const toId = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export const DIGIMON_MOVE_IDS = new Set(DIGIMON_MOVES.map(m => toId(m.name)));
const BY_ITEM = new Map(WARP_DIGIMON.map(d => [toId(d.item), d]));
const BY_BASE = new Map(WARP_DIGIMON.map(d => [toId(d.base.name), d]));
const WARP_FORMS = new Set(WARP_DIGIMON.map(d => d.warp.name));
const LEARNS = new Map(WARP_DIGIMON.map(d => [toId(d.base.name), new Set(d.moves.map(toId))]));

/** Names the AI's damage calculator doesn't know (it gets their stats passed in). */
export const DIGIMON_SPECIES = WARP_DIGIMON.flatMap(d => [d.base.name, d.warp.name]);
/** Whether the item is a warp item (Wargreyite...). */
export const isWarpItem = (item: string | undefined | null) => BY_ITEM.has(toId(item ?? ''));
/** Whether a species name is a Warp Digivolved form (WarGreymon...). */
export const isWarpForm = (species: string | undefined | null) => !!species && WARP_FORMS.has(species);
/** Whether the species is one of the Digimon (their learnsets are their own). */
export const isDigimon = (species: string) => BY_BASE.has(toId(species));
/** What a set Warp Digivolves into in battle (null without its warp item). */
export function warpFormForSet(species: string, item: string | undefined | null): string | null {
  const d = BY_ITEM.get(toId(item ?? ''));
  return d && toId(d.base.name) === toId(species) ? d.warp.name : null;
}
/** Whether a warp item may go on this species (each one only fits its own Digimon). */
export const canHoldWarpItem = (species: string, item: string) => !isWarpItem(item) || !!warpFormForSet(species, item);
/** Whether the Digimon can learn the move (ids or names); null if the species isn't a Digimon. */
export function digimonCanLearn(species: string, move: string): boolean | null {
  const learns = LEARNS.get(toId(species));
  return learns ? learns.has(toId(move)) : null;
}

/**
 * Data entries layered on the Gen 7 mod data (simulator and UI dex): the Digimon
 * and their warp forms (battle-only formes that need the warp item, like Megas),
 * the warp items (Mega-Stone-style: `megaStone` maps the Digimon to its warp
 * form, so the engine offers it as a Mega Evolution), the signature moves and
 * the learnsets. Everything says Gen 7 so it isn't "Future".
 */
export function digimonOverrides(): Record<string, Record<string, object>> {
  const species: Record<string, object> = {};
  const formatsData: Record<string, object> = {};
  const items: Record<string, object> = {};
  const learnsets: Record<string, object> = {};
  let itemNum = 10130;
  for (const d of WARP_DIGIMON) {
    const shared = { num: d.base.num, genderRatio: d.base.genderRatio, eggGroups: ['Monster', 'Dragon'], gen: 7 };
    species[toId(d.base.name)] = {
      ...shared, name: d.base.name, types: d.base.types, baseStats: d.base.baseStats, abilities: d.base.abilities,
      weightkg: d.base.weightkg, color: d.base.color, otherFormes: [d.warp.name], formeOrder: [d.base.name, d.warp.name],
    };
    species[toId(d.warp.name)] = {
      ...shared, name: d.warp.name, baseSpecies: d.base.name, forme: 'Warp', types: d.warp.types, baseStats: d.warp.baseStats,
      abilities: d.warp.abilities, weightkg: d.warp.weightkg, color: d.warp.color, requiredItem: d.item, battleOnly: d.base.name,
    };
    formatsData[toId(d.base.name)] = { isNonstandard: null, tier: 'OU' };
    formatsData[toId(d.warp.name)] = { isNonstandard: null, tier: 'OU' };
    items[toId(d.item)] = {
      name: d.item, num: itemNum++, gen: 7, isNonstandard: null,
      megaStone: { [d.base.name]: d.warp.name }, itemUser: [d.base.name], shortDesc: d.itemDesc, desc: d.itemDesc,
    };
    learnsets[toId(d.base.name)] = { learnset: Object.fromEntries(d.moves.map(m => [toId(m), ['7M']])) };
  }
  const moves: Record<string, object> = {};
  let moveNum = 10140;
  for (const m of DIGIMON_MOVES) {
    moves[toId(m.name)] = {
      num: moveNum++, name: m.name, type: m.type, category: m.category, basePower: m.basePower, accuracy: m.accuracy, pp: m.pp,
      priority: 0, flags: { protect: 1, mirror: 1, ...(m.contact ? { contact: 1 } : {}) },
      secondary: { chance: m.burnChance, status: 'brn' }, target: 'normal', gen: 7, isNonstandard: null,
      shortDesc: m.desc, desc: m.desc,
    };
  }
  const conditions = { warpdigivolution: { name: 'Warp Digivolution' } };
  return { Species: species, FormatsData: formatsData, Items: items, Moves: moves, Learnsets: learnsets, Conditions: conditions };
}
