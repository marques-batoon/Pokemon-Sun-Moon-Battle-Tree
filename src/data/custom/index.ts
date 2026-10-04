// Custom content made for this app (not from any Pokémon game): designed by the
// user and documented in DATA_NOTES.md ("Custom additions"). No simulator
// imports: the worker adds the battle logic (src/engine/custom.ts), and the UI
// uses the same data for the builder, battle display and AI estimates.

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

const toId = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

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
export const CUSTOM_SPECIES = CUSTOM_MEGAS.map(m => m.species);

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
  return { Species: species, FormatsData: formatsData, Items: items, Moves: moves };
}

type DataTables = Record<string, Record<string, object>>;
/** Combines mod data layers table by table (later layers win per entry). */
export function mergeModData(...layers: DataTables[]): DataTables {
  const out: DataTables = {};
  for (const layer of layers) for (const [table, entries] of Object.entries(layer)) out[table] = { ...out[table], ...entries };
  return out;
}
