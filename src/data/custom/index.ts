// Custom content made for this app (not from any Pokémon game): designed by the
// user and documented in DATA_NOTES.md ("Custom additions"). No simulator
// imports: the worker adds the battle logic (src/engine/custom.ts), and the UI
// uses the same data for the builder, battle display and AI estimates.
import { DIGIMON_SPECIES } from './digimon';

type StatID = 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe';
type Stats = Record<StatID, number>;

export interface CustomMega {
  /** Showdown-style forme name, e.g. "Politoed-Mega" (shown as "Mega Politoed"). */
  species: string;
  baseSpecies: string;
  megaStone: string;
  ability: string;
  /** Change from the base forme's stats (the rest are copied from it, like its types). */
  statChanges: Partial<Stats>;
  /** The Pokémon whose sprites it uses. */
  sprite: string;
  stoneDesc: string;
}

/** Mega Politoed: Rain Dish; Sp. Atk +40, Def +30, Sp. Def +30 (base stat total 500 -> 600). */
export const CUSTOM_MEGAS: CustomMega[] = [{
  species: 'Politoed-Mega',
  baseSpecies: 'Politoed',
  megaStone: 'Politoedite',
  ability: 'Rain Dish',
  statChanges: { spa: 40, def: 30, spd: 30 },
  sprite: 'Politoed',
  stoneDesc: 'If held by a Politoed, this item allows it to Mega Evolve in battle.',
}];

export interface CustomZMove {
  name: string;
  type: string;
  /** Stat changes for the user after the attack. */
  boosts: Partial<Record<Exclude<StatID, 'hp'>, number>>;
  /** Also sets up a Substitute without losing HP. */
  substitute?: boolean;
  desc: string;
}

/**
 * Poliwrathium Z: only Poliwrath can use it. A damaging Fighting, Water or Ice
 * move becomes the matching Z-Move, with the power of that type's crystal
 * (Fightinium / Waterium / Icium Z), and the user gets a bonus after the attack.
 */
export const POLIWRATHIUM_Z = {
  item: 'Poliwrathium Z',
  user: 'Poliwrath',
  desc: 'Poliwrath only: its Fighting, Water and Ice attacks can become its own Z-Moves (Omega Wrath, Riptide Rocket Rush, Glacial Guardian Gauntlet).',
  moves: {
    Fighting: {
      name: 'Omega Wrath', type: 'Fighting', boosts: { atk: 1, def: 1 }, substitute: true,
      desc: 'Power depends on the base move. After the attack, the user sets up a Substitute without losing HP and raises its Attack and Defense by 1 stage.',
    },
    Water: {
      name: 'Riptide Rocket Rush', type: 'Water', boosts: { atk: 1, spe: 2 },
      desc: 'Power depends on the base move. After the attack, the user raises its Attack by 1 stage and its Speed by 2 stages.',
    },
    Ice: {
      name: 'Glacial Guardian Gauntlet', type: 'Ice', boosts: { atk: 1, def: 1, spd: 1 },
      desc: 'Power depends on the base move. After the attack, the user raises its Attack, Defense and Sp. Def by 1 stage.',
    },
  } as Record<string, CustomZMove>,
};

/** A Hitmonchanium Z move: made from one particular base move, with its own power and effects. */
export interface HitmonchanZMove extends CustomZMove {
  /** Power; null: the base move's Z power, as with Poliwrathium Z (Omega Punch, from Focus Punch). */
  basePower: number | null;
  /** A punching move (Iron Fist boosts it). */
  punch?: boolean;
  /** Its own priority (Thunderbolt Blitzkrieg +2). */
  priority?: number;
  /** Heals the user this share of the damage dealt (rounded half up, as the games round drain). */
  drain?: [number, number];
  /** Also raises Sp. Def by 1 stage if the user was at full HP when the move began. */
  fullHpSpd?: boolean;
  /** Burns the user after the attack. */
  burnSelf?: boolean;
  /** Hits a target in the semi-invulnerable turn of Fly, Bounce or Sky Drop. */
  hitsSky?: boolean;
}

/**
 * Hitmonchanium Z (custom, designed by the user): only Hitmonchan can hold it. Each of these base moves becomes
 * Hitmonchan's own Z-Move (any other move: no Z-Move, as with the games' signature crystals).
 */
export const HITMONCHANIUM_Z = {
  item: 'Hitmonchanium Z',
  user: 'Hitmonchan',
  desc: 'Hitmonchan only: Drain Punch, Sky Uppercut, Close Combat, Focus Punch, Ice Punch, Fire Punch and Thunder Punch can become its own Z-Moves.',
  moves: {
    'Drain Punch': {
      name: 'Super Drain Punch', type: 'Fighting', basePower: 150, punch: true, drain: [3, 4], boosts: { atk: 1, def: 1 }, fullHpSpd: true,
      desc: 'The user heals 75% of the damage dealt, then raises its Attack and Defense by 1 stage (and its Sp. Def by 1 if it was at full HP when the move began). Punching move.',
    },
    'Sky Uppercut': {
      name: 'Sky Rocket Punch', type: 'Fighting', basePower: 170, punch: true, hitsSky: true, boosts: { atk: 1, spe: 1 },
      desc: 'Hits a target in the sky (Fly, Bounce, Sky Drop). Raises the user\'s Attack and Speed by 1 stage. Punching move.',
    },
    'Close Combat': {
      name: 'Punching Barrage', type: 'Fighting', basePower: 200, punch: true, boosts: {},
      desc: 'A barrage of punches. Punching move.',
    },
    'Focus Punch': {
      name: 'Omega Punch', type: 'Fighting', basePower: null, substitute: true, boosts: { atk: 1, def: 1 },
      desc: 'Power depends on the base move. After the attack, the user sets up a Substitute without losing HP and raises its Attack and Defense by 1 stage (as Omega Wrath).',
    },
    'Ice Punch': {
      name: 'Glacial Guardbreaker', type: 'Ice', basePower: 145, punch: true, boosts: { atk: 1, def: 1, spd: 1 },
      desc: 'An ice-coated uppercut. Raises the user\'s Attack, Defense and Sp. Def by 1 stage. Punching move.',
    },
    'Fire Punch': {
      name: 'Infernal Fury Fist', type: 'Fire', basePower: 145, punch: true, boosts: { atk: 4, spe: 1 }, burnSelf: true,
      desc: 'Raises the user\'s Attack by 4 stages and Speed by 1 stage, but burns the user. Punching move.',
    },
    'Thunder Punch': {
      name: 'Thunderbolt Blitzkrieg', type: 'Electric', basePower: 145, punch: true, priority: 2, boosts: { spe: 2 },
      desc: 'Usually goes first (+2 priority). Raises the user\'s Speed by 2 stages. Punching move.',
    },
  } as Record<string, HitmonchanZMove>,
};

const toId = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Hitmonchanium Z can only be held by Hitmonchan (on request; the game's own crystals can be held by anyone). */
export const canHoldCustomItem = (species: string, item: string) =>
  toId(item) !== toId(HITMONCHANIUM_Z.item) || toId(species) === toId(HITMONCHANIUM_Z.user);

/** Extra moves made legal for this app (the species can't learn them in Sun & Moon). */
export const CUSTOM_LEARNS: Record<string, string[]> = {
  // Learns it only from Gen 8 on (TM); allowed here on request.
  Poliwrath: ['Drain Punch'],
};
const customLearnIds = new Map(Object.entries(CUSTOM_LEARNS).map(([species, moves]) => [toId(species), new Set(moves.map(toId))]));
/** Whether the species can learn the move only thanks to CUSTOM_LEARNS (ids or names). */
export const isCustomLearn = (species: string, move: string) => !!customLearnIds.get(toId(species))?.has(toId(move));

/** Mega formes whose sprites are another Pokémon's (Mega Politoed uses Politoed's). */
export const SPRITE_ALIASES: Record<string, string> = Object.fromEntries(CUSTOM_MEGAS.map(m => [m.species, m.sprite]));
/** Names the AI's damage calculator doesn't know (it gets their stats passed in). */
export const CUSTOM_SPECIES = [...CUSTOM_MEGAS.map(m => m.species), ...DIGIMON_SPECIES];

interface ParentData {
  /** Species data by id (the simulator calls this table Pokedex). */
  species: Record<string, Record<string, unknown>>;
}

/**
 * Data entries for the custom content, layered on Gen 7 data (simulator mod and
 * UI dex). The Mega copies its base forme (types, size, gender...) with its own
 * stats and Ability; the Z-Moves are base-power-1 placeholders like Showdown's
 * type Z-Moves (the real power comes from the base move).
 */
export function customOverrides(parent: ParentData) {
  const species: Record<string, object> = {};
  const formatsData: Record<string, object> = {};
  const items: Record<string, object> = {};
  for (const m of CUSTOM_MEGAS) {
    const base = parent.species[toId(m.baseSpecies)];
    if (!base) throw new Error(`Custom Mega ${m.species}: no base species ${m.baseSpecies}`);
    const baseStats = { ...(base.baseStats as Stats) };
    for (const [stat, delta] of Object.entries(m.statChanges) as [StatID, number][]) baseStats[stat] += delta;
    const { prevo: _p, evos: _e, evoType: _t, evoLevel: _l, evoCondition: _c, evoItem: _i, otherFormes: _o, formeOrder: _f, canHatch: _h, ...rest } = base;
    species[toId(m.species)] = {
      ...rest, name: m.species, baseSpecies: m.baseSpecies, forme: 'Mega', baseStats, abilities: { 0: m.ability },
      requiredItem: m.megaStone, gen: 7,
    };
    species[toId(m.baseSpecies)] = { inherit: true, otherFormes: [m.species], formeOrder: [m.baseSpecies, m.species] };
    formatsData[toId(m.species)] = { isNonstandard: null, tier: 'OU' };
    items[toId(m.megaStone)] = {
      name: m.megaStone, num: 10100, gen: 7, isNonstandard: null,
      megaStone: { [m.baseSpecies]: m.species }, itemUser: [m.baseSpecies], shortDesc: m.stoneDesc, desc: m.stoneDesc,
    };
  }
  items[toId(POLIWRATHIUM_Z.item)] = {
    name: POLIWRATHIUM_Z.item, num: 10101, gen: 7, isNonstandard: null,
    zMove: true, itemUser: [POLIWRATHIUM_Z.user], shortDesc: POLIWRATHIUM_Z.desc, desc: POLIWRATHIUM_Z.desc,
  };
  const moves: Record<string, object> = {};
  let num = 10110;
  for (const z of Object.values(POLIWRATHIUM_Z.moves)) {
    moves[toId(z.name)] = {
      num: num++, name: z.name, type: z.type, category: 'Physical', basePower: 1, accuracy: true, pp: 1, priority: 0,
      flags: {}, isZ: toId(POLIWRATHIUM_Z.item), target: 'normal', gen: 7, isNonstandard: null,
      self: { boosts: { ...z.boosts } }, shortDesc: z.desc, desc: z.desc,
    };
  }
  items[toId(HITMONCHANIUM_Z.item)] = {
    name: HITMONCHANIUM_Z.item, num: 10102, gen: 7, isNonstandard: null,
    zMove: true, itemUser: [HITMONCHANIUM_Z.user], shortDesc: HITMONCHANIUM_Z.desc, desc: HITMONCHANIUM_Z.desc,
  };
  num = 10120;
  for (const z of Object.values(HITMONCHANIUM_Z.moves)) {
    moves[toId(z.name)] = {
      num: num++, name: z.name, type: z.type, category: 'Physical', basePower: z.basePower ?? 1, accuracy: true, pp: 1, priority: z.priority ?? 0,
      flags: z.punch ? { punch: 1 } : {}, isZ: toId(HITMONCHANIUM_Z.item), target: 'normal', gen: 7, isNonstandard: null,
      ...(z.drain ? { drain: z.drain } : {}), ...(Object.keys(z.boosts).length ? { self: { boosts: { ...z.boosts } } } : {}),
      shortDesc: z.desc, desc: z.desc,
    };
  }
  return { Species: species, FormatsData: formatsData, Items: items, Moves: moves };
}

type DataTables = Record<string, Record<string, object>>;
/** Combines mod data layers table by table (later layers win per entry). */
export function mergeModData(...layers: DataTables[]): DataTables {
  const out: DataTables = {};
  for (const layer of layers) for (const [table, entries] of Object.entries(layer)) out[table] = { ...out[table], ...entries };
  return out;
}
