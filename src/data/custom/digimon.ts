// Digimon (custom addition, see DATA_NOTES.md "Custom additions"): Pokémon-style
// entries designed by the user. A Digimon holding its warp item Warp Digivolves
// (Guilmon: Matrix Evolves) in battle, like Mega Evolution, except that a team can Warp Digivolve any
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
  /** Moves it can learn (level-up and TM) while holding this item, by name. Without a warp item: DIGIMON_BASE_MOVES. */
  moves: string[];
  /** A Dark Warp Digivolution (BlackWarGreymon): its own name in messages and buttons, dark energy in the animation. */
  dark?: boolean;
  /**
   * A Matrix Evolution (Gallantmon, after Digimon Tamers): the same mechanics as Warp Digivolution, with its own name in
   * messages and buttons and its own animation.
   */
  matrix?: boolean;
}

const AGUMON: WarpDigimon['base'] = {
  num: 10201, name: 'Agumon', types: ['Fire'], color: 'Yellow',
  baseStats: { hp: 44, atk: 60, def: 45, spa: 55, spd: 45, spe: 60 },
  abilities: { 0: 'Blaze', H: 'Tough Claws' }, weightkg: 12, genderRatio: { M: 0.875, F: 0.125 },
};
/** Agumon's own list (no warp item); with Wargreyite it also learns Dramon Breaker. */
const AGUMON_MOVES = [
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
];
const GABUMON_MOVES = [
  // Level-up
  'Scratch', 'Growl', 'Powder Snow', 'Metal Claw', 'Bite', 'Tail Whip', 'Quick Attack', 'Icy Wind', 'Fox Fire', 'Ice Fang',
  'Metal Sound', 'Scary Face', 'Crunch', 'Ice Beam', 'Flash Cannon', 'Agility', 'Dark Pulse', 'Cocytus Pulse', 'Aura Sphere',
  'Blizzard', 'Iron Defense', 'Steel Beam', 'Hyper Beam',
  // TMs
  'Aerial Ace', 'Avalanche', 'Body Slam', 'Breaking Swipe', 'Chilling Water', 'Dig', 'Dragon Pulse', 'Endure', 'Facade', 'Fling',
  'Focus Blast', 'Frost Breath', 'Giga Impact', 'Heavy Slam', 'Ice Spinner', 'Iron Head', 'Iron Tail', 'Mud-Slap', 'Pin Missile',
  'Protect', 'Rain Dance', 'Rest', 'Roar', 'Rock Blast', 'Rock Slide', 'Rock Tomb', 'Shadow Ball', 'Sleep Talk', 'Snarl',
  'Snowscape', 'Smart Strike', 'Substitute', 'Swift', 'Swords Dance', 'Tera Blast', 'Thunderbolt', 'Thunder Wave', 'Tri Attack',
  'U-turn', 'Water Pulse', 'Wild Charge', 'Zen Headbutt',
];

// Tentomon (added 2026-10-11, designed by the user): the level-up and TM lists given for HerculesKabuterimon
// (Tera Blast taken out and Hidden Power added, on request).
const TENTOMON_MOVES = [...new Set([
  // Level-up
  'Tackle', 'Growl', 'Thunder Shock', 'String Shot', 'Harden', 'Struggle Bug', 'Charge', 'Spark', 'Super Shocker', 'Bug Bite',
  'Thunder Wave', 'Electro Ball', 'Bug Buzz', 'Discharge', 'Iron Defense', 'Thunderbolt', 'Flash Cannon', 'Giga Blaster',
  'Quiver Dance', 'Thunder', 'Energy Ball', 'Zap Cannon', 'Hyper Beam',
  // TMs
  'Acrobatics', 'Agility', 'Body Press', 'Body Slam', 'Bug Bite', 'Bug Buzz', 'Charge Beam', 'Dazzling Gleam', 'Discharge',
  'Earth Power', 'Eerie Impulse', 'Electric Terrain', 'Electroweb', 'Endure', 'Energy Ball', 'Facade', 'Flash Cannon', 'Giga Drain',
  'Giga Impact', 'Hard Press', 'Heavy Slam', 'Helping Hand', 'Hyper Beam', 'Infestation', 'Iron Defense', 'Iron Head', 'Leech Life',
  'Light Screen', 'Lunge', 'Magnet Rise', 'Metal Sound', 'Mud-Slap', 'Pounce', 'Protect', 'Rain Dance', 'Reflect', 'Rest',
  'Rock Slide', 'Rock Tomb', 'Screech', 'Signal Beam', 'Skitter Smack', 'Sleep Talk', 'Solar Beam', 'Struggle Bug', 'Substitute',
  'Sunny Day', 'Swift', 'Swords Dance', 'Hidden Power', 'Thunder', 'Thunder Punch', 'Thunder Wave', 'Thunderbolt', 'Trailblaze',
  'U-turn', 'Venoshock', 'Volt Switch', 'Wild Charge', 'X-Scissor', 'Zap Cannon',
])];

// Guilmon -> Gallantmon (added 2026-10-18, designed by the user): Guilmon's own list, and the one it learns instead
// while holding Gallantite (Gallantmon's).
const GUILMON_MOVES = [...new Set([
  // Level-up
  'Scratch', 'Growl', 'Ember', 'Leer', 'Bite', 'Dragon Tail', 'Fire Fang', 'Rock Tomb', 'Pyro Fang', 'Scary Face', 'Crunch',
  'Dragon Claw', 'Fire Punch', 'Outrage',
  // TMs
  'Aerial Ace', 'Body Slam', 'Breaking Swipe', 'Brick Break', 'Bulldoze', 'Crunch', 'Dig', 'Dragon Claw', 'Dragon Dance',
  'Dragon Pulse', 'Dragon Tail', 'Earthquake', 'Endure', 'Facade', 'Fire Blast', 'Fire Fang', 'Fire Pledge', 'Fire Punch',
  'Fire Spin', 'Flame Charge', 'Flamethrower', 'Flare Blitz', 'Fling', 'Heat Wave', 'Hyper Voice', 'Ice Fang', 'Iron Head',
  'Iron Tail', 'Mud-Slap', 'Outrage', 'Overheat', 'Protect', 'Rest', 'Roar', 'Rock Slide', 'Rock Tomb', 'Scary Face',
  'Shadow Claw', 'Sleep Talk', 'Snarl', 'Stomping Tantrum', 'Stone Edge', 'Substitute', 'Sunny Day', 'Swords Dance', 'Tera Blast',
  'Thunder Fang', 'Temper Flare', 'Trailblaze', 'Will-O-Wisp',
])];
const GALLANTMON_MOVES = [...new Set([
  // Level-up
  'Scratch', 'Growl', 'Protect', 'Metal Claw', 'Leer', 'Bite', 'Dragon Tail', 'Fire Fang', 'Slash', 'Pyro Fang', 'Scary Face',
  'Crunch', 'Spark', 'Iron Defense', 'Sacred Sword', 'Play Rough', 'Lightning Joust', "King's Shield", 'Shield of Just',
  'Wild Charge', 'Close Combat', 'Giga Impact',
  // TMs
  'Aerial Ace', 'Agility', 'Aura Sphere', 'Body Press', 'Body Slam', 'Brick Break', 'Bulk Up', 'Bulldoze', 'Calm Mind',
  'Close Combat', 'Dazzling Gleam', 'Dig', 'Discharge', 'Dragon Claw', 'Dragon Tail', 'Earthquake', 'Electric Terrain', 'Endure',
  'Facade', 'Fire Fang', 'Fire Punch', 'Flash Cannon', 'Focus Blast', 'Giga Impact', 'Heavy Slam', 'Helping Hand', 'Hyper Beam',
  'Iron Defense', 'Iron Head', 'Iron Tail', 'Light Screen', 'Low Kick', 'Magnet Rise', 'Metal Claw', 'Misty Terrain',
  'Play Rough', 'Protect', 'Reflect', 'Rest', 'Rock Slide', 'Rock Tomb', 'Sacred Sword', 'Shadow Claw', 'Sleep Talk',
  'Smart Strike', 'Solar Blade', 'Spark', 'Stone Edge', 'Substitute', 'Supercell Slam', 'Swords Dance', 'Tera Blast', 'Thunder',
  'Thunder Punch', 'Thunder Wave', 'Thunderbolt', 'Trailblaze', 'Volt Switch', 'Wild Charge', 'Zen Headbutt',
])];

// Terriermon -> MegaGargomon (added 2026-10-18, designed by the user): Terriermon's own list, and the one it learns
// instead while holding Megagargoite (MegaGargomon's).
const TERRIERMON_MOVES = [...new Set([
  // Level-up
  'Pound', 'Tail Whip', 'Gust', 'Quick Attack', 'Swift', 'Air Cutter', 'Petit Twister', 'Double Team', 'Echoed Voice', 'Air Slash',
  'Tailwind', 'Hyper Voice', 'Hurricane', 'Boomburst',
  // TMs
  'Acrobatics', 'Aerial Ace', 'Agility', 'Air Cutter', 'Air Slash', 'Calm Mind', 'Charge Beam', 'Charm', 'Double Team', 'Echoed Voice',
  'Electroweb', 'Endure', 'Energy Ball', 'Facade', 'Fake Tears', 'Giga Drain', 'Grass Knot', 'Helping Hand', 'Hurricane', 'Hyper Voice',
  'Icy Wind', 'Light Screen', 'Mud Shot', 'Nasty Plot', 'Protect', 'Psychic', 'Rain Dance', 'Reflect', 'Rest', 'Round', 'Shadow Ball',
  'Sleep Talk', 'Snore', 'Solar Beam', 'Substitute', 'Sunny Day', 'Swift', 'Tailwind', 'Taunt', 'Tera Blast', 'Thunder Wave', 'U-turn',
  'Vacuum Wave', 'Volt Switch', 'Water Pulse', 'Work Up',
])];
const MEGAGARGOMON_MOVES = [...new Set([
  // Level-up
  'Pound', 'Tail Whip', 'Gust', 'Swift', 'Quick Attack', 'Charge Beam', 'Air Cutter', 'Petit Twister', 'Metal Claw', 'Spark',
  'Bullet Seed', 'Lock-On', 'Iron Head', 'Zing Zap', 'Heavy Slam', 'Burst Shot', 'Electric Terrain', 'Wild Charge', 'Iron Defense',
  'Giant Missile', 'Zap Cannon', 'Giga Impact',
  // TMs
  'Acrobatics', 'Aerial Ace', 'Agility', 'Air Slash', 'Body Press', 'Body Slam', 'Brick Break', 'Bulk Up', 'Bulldoze', 'Bullet Seed',
  'Charge Beam', 'Close Combat', 'Dark Pulse', 'Dig', 'Discharge', 'Drain Punch', 'Earthquake', 'Electric Terrain', 'Electro Ball',
  'Electroweb', 'Endure', 'Energy Ball', 'Facade', 'Fire Blast', 'Fire Punch', 'Flame Charge', 'Flamethrower', 'Flash Cannon', 'Fling',
  'Focus Blast', 'Giga Impact', 'Grass Knot', 'Hammer Arm', 'Hard Press', 'Heavy Slam', 'Helping Hand', 'High Horsepower', 'Hyper Beam',
  'Hyper Voice', 'Ice Punch', 'Iron Defense', 'Iron Head', 'Light Screen', 'Low Kick', 'Magnet Rise', 'Metal Claw', 'Meteor Mash',
  'Mud Shot', 'Nasty Plot', 'Overheat', 'Pin Missile', 'Protect', 'Rain Dance', 'Reflect', 'Rest', 'Rock Blast', 'Rock Slide',
  'Rock Tomb', 'Sandstorm', 'Shadow Ball', 'Sleep Talk', 'Smart Strike', 'Snarl', 'Solar Beam', 'Steel Beam', 'Steel Roller',
  'Stomping Tantrum', 'Substitute', 'Sunny Day', 'Supercell Slam', 'Swift', 'Tailwind', 'Taunt', 'Tera Blast', 'Thunder',
  'Thunder Punch', 'Thunder Wave', 'Thunderbolt', 'Tri Attack', 'U-turn', 'Vacuum Wave', 'Volt Switch', 'Wild Charge', 'Zen Headbutt',
])];

/** What each Digimon can learn without a warp item (or holding someone else's). */
export const DIGIMON_BASE_MOVES: Record<string, string[]> = {
  Agumon: AGUMON_MOVES, Gabumon: GABUMON_MOVES, Tentomon: TENTOMON_MOVES, Guilmon: GUILMON_MOVES, Terriermon: TERRIERMON_MOVES,
};

export const WARP_DIGIMON: WarpDigimon[] = [{
  base: AGUMON,
  warp: {
    name: 'WarGreymon', types: ['Fire', 'Dragon'], color: 'Yellow',
    baseStats: { hp: 78, atk: 140, def: 100, spa: 130, spd: 86, spe: 100 },
    abilities: { 0: 'Sheer Force' }, weightkg: 120,
  },
  item: 'Wargreyite',
  itemDesc: 'If held by an Agumon, this item allows it to Warp Digivolve into WarGreymon in battle.',
  moves: [...AGUMON_MOVES, 'Dramon Breaker'],
}, {
  base: {
    num: 10202, name: 'Gabumon', types: ['Ice'], color: 'Yellow',
    baseStats: { hp: 44, atk: 55, def: 50, spa: 60, spd: 50, spe: 50 },
    abilities: { 0: 'Thick Fat', 1: 'Snow Cloak', H: 'Flash Fire' }, weightkg: 14, genderRatio: { M: 0.875, F: 0.125 },
  },
  warp: {
    name: 'MetalGarurumon', types: ['Ice', 'Steel'], color: 'Blue',
    baseStats: { hp: 80, atk: 95, def: 105, spa: 135, spd: 105, spe: 110 },
    abilities: { 0: 'Mega Launcher' }, weightkg: 180,
  },
  item: 'Metalgaruruite',
  itemDesc: 'If held by a Gabumon, this item allows it to Warp Digivolve into MetalGarurumon in battle.',
  moves: GABUMON_MOVES,
}, {
  // Agumon's alternate evolution (2026-10-11, designed by the user): Dark Warp Digivolution. Holding Blackwargreyite,
  // Agumon learns this list instead of its own.
  base: AGUMON,
  warp: {
    name: 'BlackWarGreymon', types: ['Dragon', 'Dark'], color: 'Black',
    baseStats: { hp: 78, atk: 145, def: 95, spa: 130, spd: 86, spe: 100 },
    abilities: { 0: 'Tough Claws' }, weightkg: 120,
  },
  item: 'Blackwargreyite',
  itemDesc: 'If held by an Agumon, this item allows it to Dark Warp Digivolve into BlackWarGreymon in battle.',
  dark: true,
  moves: [
    // Level-up
    'Scratch', 'Growl', 'Metal Claw', 'Ember', 'Smokescreen', 'Bite', 'Fire Fang', 'Pepper Breath', 'Slash', 'Scary Face',
    'Snarl', 'Crunch', 'Flamethrower', 'Night Slash', 'Iron Defense', 'Swords Dance', 'Dramon Destroyer', 'Close Combat',
    'Dark Pulse', 'Dark Gaia Force', 'Flare Blitz', 'Outrage', 'Giga Impact',
    // TMs
    'Aerial Ace', 'Air Slash', 'Aura Sphere', 'Blast Burn', 'Brick Break', 'Breaking Swipe', 'Bulk Up', 'Bulldoze', 'Dig',
    'Dragon Claw', 'Dragon Dance', 'Dragon Pulse', 'Dragon Tail', 'Dual Wingbeat', 'Earthquake', 'Endure', 'Facade', 'Fire Blast',
    'Fire Pledge', 'Fire Punch', 'Fire Spin', 'Flame Charge', 'Fling', 'Focus Blast', 'Foul Play', 'Heat Wave', 'Hone Claws',
    'Hyper Beam', 'Iron Head', 'Knock Off', 'Lash Out', 'Nasty Plot', 'Overheat', 'Payback', 'Protect', 'Rest', 'Rock Slide',
    'Rock Tomb', 'Scorching Sands', 'Shadow Ball', 'Shadow Claw', 'Sleep Talk', 'Solar Beam', 'Solar Blade', 'Stone Edge',
    'Substitute', 'Sucker Punch', 'Sunny Day', 'Swift', 'Taunt', 'Temper Flare', 'Tera Blast', 'Thief', 'Throat Chop',
    'Thunder Punch', 'Torment', 'U-turn', 'Will-O-Wisp', 'X-Scissor',
  ],
}, {
  // Tentomon -> HerculesKabuterimon (added 2026-10-11, designed by the user).
  base: {
    num: 10203, name: 'Tentomon', types: ['Bug', 'Electric'], color: 'Red',
    baseStats: { hp: 55, atk: 35, def: 60, spa: 75, spd: 65, spe: 28 },
    abilities: { 0: 'Static' }, weightkg: 10.5, genderRatio: { M: 0.875, F: 0.125 },
  },
  warp: {
    name: 'HerculesKabuterimon', types: ['Bug', 'Electric'], color: 'Yellow',
    baseStats: { hp: 90, atk: 75, def: 130, spa: 130, spd: 140, spe: 60 },
    abilities: { 0: 'Electromorphosis' }, weightkg: 230,
  },
  item: 'Herculeskabuterite',
  itemDesc: 'If held by a Tentomon, this item allows it to Warp Digivolve into HerculesKabuterimon in battle.',
  moves: TENTOMON_MOVES,
}, {
  // Guilmon -> Gallantmon (added 2026-10-18, designed by the user): Matrix Evolution (Digimon Tamers), which works
  // exactly like Warp Digivolution. Holding Gallantite, Guilmon learns Gallantmon's list instead of its own.
  base: {
    num: 10204, name: 'Guilmon', types: ['Fire', 'Dragon'], color: 'Red',
    baseStats: { hp: 55, atk: 70, def: 60, spa: 35, spd: 54, spe: 35 },
    abilities: { 0: 'Strong Jaw' }, weightkg: 22, genderRatio: { M: 0.875, F: 0.125 },
  },
  warp: {
    name: 'Gallantmon', types: ['Steel', 'Fairy'], color: 'Red',
    baseStats: { hp: 95, atk: 145, def: 130, spa: 65, spd: 125, spe: 74 },
    abilities: { 0: 'Dauntless Shield' }, weightkg: 110,
  },
  item: 'Gallantite',
  itemDesc: 'If held by a Guilmon, this item allows it to Matrix Evolve into Gallantmon in battle.',
  matrix: true,
  moves: GALLANTMON_MOVES,
}, {
  // Terriermon -> MegaGargomon (added 2026-10-18, designed by the user): Matrix Evolution. Holding Megagargoite,
  // Terriermon learns MegaGargomon's list instead of its own.
  base: {
    num: 10205, name: 'Terriermon', types: ['Normal', 'Flying'], color: 'White',
    baseStats: { hp: 40, atk: 30, def: 35, spa: 85, spd: 39, spe: 80 },
    abilities: { 0: 'Technician' }, weightkg: 5, genderRatio: { M: 0.875, F: 0.125 },
  },
  warp: {
    name: 'MegaGargomon', types: ['Electric', 'Steel'], color: 'Green',
    baseStats: { hp: 100, atk: 150, def: 140, spa: 65, spd: 120, spe: 59 },
    abilities: { 0: 'Elevate' }, weightkg: 550,
  },
  item: 'Megagargoite',
  itemDesc: 'If held by a Terriermon, this item allows it to Matrix Evolve into MegaGargomon in battle.',
  matrix: true,
  moves: MEGAGARGOMON_MOVES,
}];

export interface DigimonMove {
  name: string;
  type: string;
  category: 'Physical' | 'Special';
  basePower: number;
  accuracy: number;
  pp: number;
  contact: boolean;
  /** A pulse move (boosted by Mega Launcher). */
  pulse?: boolean;
  /** Critical-hit ratio as the simulator counts it: 2 = one stage higher than usual (like Slash). */
  critRatio?: number;
  /** A biting move (boosted by Strong Jaw). */
  bite?: boolean;
  /** A second type it also counts as against the target's types, as Flying Press does (Lightning Joust: Electric). */
  alsoType?: string;
  /** The user's stat it attacks with instead of Attack / Sp. Atk, as Body Press does (Shield of Just: Sp. Def). */
  attackStat?: 'def' | 'spd';
  /** A wind move (Petit Twister). */
  wind?: boolean;
  /** Hits this many times (Burst Shot: 4). */
  multihit?: number;
  /**
   * In Doubles, if its target faints before all the hits are done, the rest go to the target's partner (Burst Shot).
   * The engine does this (src/engine/custom.ts).
   */
  retarget?: boolean;
  /** Chance (%) of a burn or paralysis, or of a stat drop on the target (none: no secondary effect, so Sheer Force doesn't boost it). */
  secondary?: { chance: number; status?: 'brn' | 'par'; boosts?: Partial<Record<Exclude<StatID, 'hp'>, number>> };
  desc: string;
}

/** Signature moves (only the Digimon that list them can learn them). */
export const DIGIMON_MOVES: DigimonMove[] = [
  {
    name: 'Pepper Breath', type: 'Fire', category: 'Special', basePower: 65, accuracy: 100, pp: 15, contact: false,
    secondary: { chance: 20, status: 'brn' }, desc: '20% chance to burn the target.',
  },
  {
    name: 'Gaia Force', type: 'Fire', category: 'Special', basePower: 110, accuracy: 90, pp: 5, contact: false,
    secondary: { chance: 20, status: 'brn' }, desc: '20% chance to burn the target.',
  },
  {
    name: 'Fox Fire', type: 'Fire', category: 'Special', basePower: 70, accuracy: 100, pp: 10, contact: false, pulse: true,
    secondary: { chance: 20, boosts: { spd: -1 } }, desc: '20% chance to lower the target\'s Sp. Def by 1. Boosted by Mega Launcher.',
  },
  {
    name: 'Cocytus Pulse', type: 'Ice', category: 'Special', basePower: 85, accuracy: 100, pp: 10, contact: false, pulse: true,
    secondary: { chance: 20, boosts: { spe: -1 } }, desc: '20% chance to lower the target\'s Speed by 1. Boosted by Mega Launcher.',
  },
  // Added 2026-10-11 (designed by the user). Agumon with Wargreyite (WarGreymon's Dramon Killer claws):
  {
    name: 'Dramon Breaker', type: 'Dragon', category: 'Physical', basePower: 90, accuracy: 100, pp: 10, contact: true, critRatio: 2,
    secondary: { chance: 20, boosts: { def: -1 } }, desc: 'High critical hit ratio. 20% chance to lower the target\'s Defense by 1.',
  },
  // Agumon with Blackwargreyite (BlackWarGreymon):
  {
    name: 'Dark Gaia Force', type: 'Dark', category: 'Special', basePower: 110, accuracy: 90, pp: 5, contact: false,
    secondary: { chance: 20, status: 'brn' }, desc: '20% chance to burn the target.',
  },
  {
    name: 'Dramon Destroyer', type: 'Dragon', category: 'Physical', basePower: 90, accuracy: 100, pp: 10, contact: true, critRatio: 2,
    desc: 'High critical hit ratio.',
  },
  // Tentomon (2026-10-11, designed by the user):
  {
    name: 'Super Shocker', type: 'Electric', category: 'Special', basePower: 70, accuracy: 100, pp: 15, contact: false,
    secondary: { chance: 30, status: 'par' }, desc: '30% chance to paralyze the target.',
  },
  {
    name: 'Giga Blaster', type: 'Electric', category: 'Special', basePower: 100, accuracy: 100, pp: 10, contact: false,
    secondary: { chance: 20, status: 'par' }, desc: '20% chance to paralyze the target.',
  },
  // Guilmon and Gallantmon (2026-10-18, designed by the user):
  {
    name: 'Pyro Fang', type: 'Fire', category: 'Physical', basePower: 70, accuracy: 100, pp: 15, contact: true, bite: true,
    secondary: { chance: 20, status: 'brn' }, desc: '20% chance to burn the target. Boosted by Strong Jaw.',
  },
  {
    name: 'Lightning Joust', type: 'Steel', category: 'Physical', basePower: 95, accuracy: 100, pp: 10, contact: true, alsoType: 'Electric',
    secondary: { chance: 20, status: 'par' }, desc: 'Combines Electric in its type effectiveness. 20% chance to paralyze the target.',
  },
  {
    name: 'Shield of Just', type: 'Fairy', category: 'Special', basePower: 85, accuracy: 100, pp: 10, contact: false, attackStat: 'spd',
    secondary: { chance: 20, boosts: { atk: -1 } }, desc: 'Uses user\'s Sp. Def stat as Sp. Atk in damage calculation. 20% chance to lower the target\'s Attack by 1.',
  },
  // Terriermon and MegaGargomon (2026-10-18, designed by the user):
  {
    name: 'Petit Twister', type: 'Flying', category: 'Special', basePower: 60, accuracy: 100, pp: 15, contact: false, wind: true,
    secondary: { chance: 20, boosts: { spe: -1 } }, desc: '20% chance to lower the target\'s Speed by 1. Boosted by Technician.',
  },
  {
    name: 'Burst Shot', type: 'Steel', category: 'Physical', basePower: 25, accuracy: 100, pp: 10, contact: false, multihit: 4, retarget: true,
    desc: 'Hits 4 times. If the target faints first, the remaining hits go to its partner.',
  },
  {
    name: 'Giant Missile', type: 'Electric', category: 'Physical', basePower: 100, accuracy: 95, pp: 5, contact: false,
    secondary: { chance: 20, status: 'par' }, desc: '20% chance to paralyze the target.',
  },
];

/**
 * Abilities of the user's own design (made for this app), with what the team builder shows; the engine gives them
 * their effect (src/engine/custom.ts).
 */
export const DIGIMON_ABILITIES = [
  {
    name: 'Elevate',
    shortDesc: 'This Pokemon\'s highest base stat (not HP) is raised by 1 stage if it attacks and KOes another Pokemon.',
    desc: 'This Pokemon\'s highest base stat, excluding HP, is raised by 1 stage if it attacks and knocks out another Pokemon. The stat is chosen from its species\' base stats, not its current stats or stat stages. Indirect damage (poison, burn, weather, hazards) doesn\'t count.',
  },
];

/**
 * Sprites shipped with the app (public/pokemon): the user's pixel art in the style of the Pokémon's 2D (Black and
 * White) sprites: the front view facing left, and `back` (public/pokemon/back, added 2026-10-11) for your side. Each picture is a 96-px sprite box like
 * Pokémon's (480 px files, 5 px per box pixel, so they stay sharp), with the Digimon at its own size in it and
 * its feet 10% above the bottom, so it is drawn and placed exactly like a Pokémon's 2D sprite. `icon`: the
 * Digimon alone, cropped, for menus. `stageScale`: how much larger a warp form may be drawn on the battle
 * stage (Megas: 1.2x); with these pictures it only lets a warp form go a little past the usual size limit.
 */
export const DIGIMON_SPRITES: Record<string, { file: string; back?: string; icon: string; w: number; h: number; stageScale?: number }> = {
  Agumon: { file: 'pokemon/agumon.png', back: 'pokemon/back/agumon.png', icon: 'pokemon/icons/agumon.png', w: 96, h: 96 },
  WarGreymon: { file: 'pokemon/wargreymon.png', back: 'pokemon/back/wargreymon.png', icon: 'pokemon/icons/wargreymon.png', w: 96, h: 96, stageScale: 1.5 },
  Gabumon: { file: 'pokemon/gabumon.png', back: 'pokemon/back/gabumon.png', icon: 'pokemon/icons/gabumon.png', w: 96, h: 96 },
  MetalGarurumon: { file: 'pokemon/metalgarurumon.png', back: 'pokemon/back/metalgarurumon.png', icon: 'pokemon/icons/metalgarurumon.png', w: 96, h: 96, stageScale: 1.2954 },
  BlackWarGreymon: { file: 'pokemon/blackwargreymon.png', back: 'pokemon/back/blackwargreymon.png', icon: 'pokemon/icons/blackwargreymon.png', w: 96, h: 96, stageScale: 1.5 },
  Tentomon: { file: 'pokemon/tentomon.png', back: 'pokemon/back/tentomon.png', icon: 'pokemon/icons/tentomon.png', w: 96, h: 96 },
  HerculesKabuterimon: { file: 'pokemon/herculeskabuterimon.png', back: 'pokemon/back/herculeskabuterimon.png', icon: 'pokemon/icons/herculeskabuterimon.png', w: 96, h: 96, stageScale: 1.5 },
  Terriermon: { file: 'pokemon/terriermon.png', back: 'pokemon/back/terriermon.png', icon: 'pokemon/icons/terriermon.png', w: 96, h: 96 },
  MegaGargomon: { file: 'pokemon/megagargomon.png', back: 'pokemon/back/megagargomon.png', icon: 'pokemon/icons/megagargomon.png', w: 96, h: 96, stageScale: 1.5 },
  Guilmon: { file: 'pokemon/guilmon.png', back: 'pokemon/back/guilmon.png', icon: 'pokemon/icons/guilmon.png', w: 96, h: 96 },
  Gallantmon: { file: 'pokemon/gallantmon.png', back: 'pokemon/back/gallantmon.png', icon: 'pokemon/icons/gallantmon.png', w: 96, h: 96, stageScale: 1.5 },
};
/** How much larger a warp form is drawn on the battle stage (1 for anything else). */
export const warpStageScale = (species: string) => (isWarpForm(species) ? DIGIMON_SPRITES[species]?.stageScale ?? 1.3 : 1);

const toId = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export const DIGIMON_MOVE_IDS = new Set(DIGIMON_MOVES.map(m => toId(m.name)));
/** Signature moves that were renamed (old name -> new), so saved teams keep them. */
export const RENAMED_MOVES: Record<string, string> = { 'Blue Blaster': 'Fox Fire' };
const BY_ITEM = new Map(WARP_DIGIMON.map(d => [toId(d.item), d]));
const BY_FORM = new Map(WARP_DIGIMON.map(d => [toId(d.warp.name), d]));
const BASES = new Set(WARP_DIGIMON.map(d => toId(d.base.name)));
const WARP_FORMS = new Set(WARP_DIGIMON.map(d => d.warp.name));
const BASE_LEARNS = new Map(Object.entries(DIGIMON_BASE_MOVES).map(([species, moves]) => [toId(species), new Set(moves.map(toId))]));
const ITEM_LEARNS = new Map(WARP_DIGIMON.map(d => [toId(d.item), new Set(d.moves.map(toId))]));

/** Names the AI's damage calculator doesn't know (it gets their stats passed in). */
export const DIGIMON_SPECIES = [...new Set(WARP_DIGIMON.flatMap(d => [d.base.name, d.warp.name]))];
/** Whether the item is a warp item (Wargreyite...). */
export const isWarpItem = (item: string | undefined | null) => BY_ITEM.has(toId(item ?? ''));
/** Whether a species name is a Warp Digivolved form (WarGreymon...). */
export const isWarpForm = (species: string | undefined | null) => !!species && WARP_FORMS.has(species);
/** Whether the species is one of the Digimon (their learnsets are their own). */
export const isDigimon = (species: string) => BASES.has(toId(species));
/** Whether a warp item or warp form is a Dark Warp Digivolution (Blackwargreyite / BlackWarGreymon). */
export const isDarkWarp = (itemOrForm: string | undefined | null) => !!(BY_ITEM.get(toId(itemOrForm ?? '')) ?? BY_FORM.get(toId(itemOrForm ?? '')))?.dark;
/** Whether a warp item or warp form is a Matrix Evolution (Gallantite / Gallantmon). */
export const isMatrix = (itemOrForm: string | undefined | null) => !!(BY_ITEM.get(toId(itemOrForm ?? '')) ?? BY_FORM.get(toId(itemOrForm ?? '')))?.matrix;

/** The kinds of warp: Warp Digivolution, Dark Warp Digivolution (BlackWarGreymon), Matrix Evolution (Gallantmon). */
export type WarpKind = 'warp' | 'dark' | 'matrix';
/** What each kind is called: the change, the button, "...ing", and the call in battle ("Guilmon matrix-evolve to..."). */
export const WARP_NAMES: Record<WarpKind, { noun: string; verb: string; ing: string; call: string }> = {
  warp: { noun: 'Warp Digivolution', verb: 'Warp Digivolve', ing: 'Warp Digivolving', call: 'warp-digivolve' },
  dark: { noun: 'Dark Warp Digivolution', verb: 'Dark Warp Digivolve', ing: 'Dark Warp Digivolving', call: 'dark warp-digivolve' },
  matrix: { noun: 'Matrix Evolution', verb: 'Matrix Evolve', ing: 'Matrix Evolving', call: 'matrix-evolve' },
};
/** The kind of warp a warp item or warp form gives (Warp Digivolution for anything else). */
export const warpKind = (itemOrForm: string | undefined | null): WarpKind => (isMatrix(itemOrForm) ? 'matrix' : isDarkWarp(itemOrForm) ? 'dark' : 'warp');
/** What a warp item's or warp form's change is called. */
export const warpNames = (itemOrForm: string | undefined | null) => WARP_NAMES[warpKind(itemOrForm)];

/** What a set Warp Digivolves into in battle (null without its warp item). */
export function warpFormForSet(species: string, item: string | undefined | null): string | null {
  const d = BY_ITEM.get(toId(item ?? ''));
  return d && toId(d.base.name) === toId(species) ? d.warp.name : null;
}
/** Whether a warp item may go on this species (each one only fits its own Digimon). */
export const canHoldWarpItem = (species: string, item: string) => !isWarpItem(item) || !!warpFormForSet(species, item);
/** The moves a Digimon can learn with this held item (its warp item's list, else its own); null if it isn't a Digimon. */
export function digimonMoves(species: string, item?: string | null): string[] | null {
  if (!isDigimon(species)) return null;
  const warp = BY_ITEM.get(toId(item ?? ''));
  if (warp && toId(warp.base.name) === toId(species)) return warp.moves;
  return DIGIMON_BASE_MOVES[WARP_DIGIMON.find(d => toId(d.base.name) === toId(species))!.base.name] ?? [];
}
/** Whether the Digimon can learn the move (ids or names) holding `item`; null if the species isn't a Digimon. */
export function digimonCanLearn(species: string, move: string, item?: string | null): boolean | null {
  if (!isDigimon(species)) return null;
  const warp = BY_ITEM.get(toId(item ?? ''));
  const learns = warp && toId(warp.base.name) === toId(species) ? ITEM_LEARNS.get(toId(warp.item)) : BASE_LEARNS.get(toId(species));
  // Hidden Power of any type ("Hidden Power [Ice]") is Hidden Power.
  return !!learns?.has(toId(move).replace(/^hiddenpower[a-z]+$/, 'hiddenpower'));
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
    // Agumon has two warp forms (WarGreymon, BlackWarGreymon): list them all.
    const forms = WARP_DIGIMON.filter(o => o.base.name === d.base.name).map(o => o.warp.name);
    species[toId(d.base.name)] = {
      ...shared, name: d.base.name, types: d.base.types, baseStats: d.base.baseStats, abilities: d.base.abilities,
      weightkg: d.base.weightkg, color: d.base.color, otherFormes: forms, formeOrder: [d.base.name, ...forms],
    };
    species[toId(d.warp.name)] = {
      ...shared, name: d.warp.name, baseSpecies: d.base.name, forme: d.dark ? 'Dark-Warp' : 'Warp', types: d.warp.types, baseStats: d.warp.baseStats,
      abilities: d.warp.abilities, weightkg: d.warp.weightkg, color: d.warp.color, requiredItem: d.item, battleOnly: d.base.name,
    };
    formatsData[toId(d.base.name)] = { isNonstandard: null, tier: 'OU' };
    formatsData[toId(d.warp.name)] = { isNonstandard: null, tier: 'OU' };
    items[toId(d.item)] = {
      name: d.item, num: itemNum++, gen: 7, isNonstandard: null,
      megaStone: { [d.base.name]: d.warp.name }, itemUser: [d.base.name], shortDesc: d.itemDesc, desc: d.itemDesc,
    };
  }
  // Every move a Digimon can learn with any of its items (the validator and builder check the held item: digimonCanLearn).
  for (const [base, own] of Object.entries(DIGIMON_BASE_MOVES)) {
    const all = [...own, ...WARP_DIGIMON.filter(d => d.base.name === base).flatMap(d => d.moves)];
    learnsets[toId(base)] = { learnset: Object.fromEntries(all.map(m => [toId(m), ['7M']])) };
  }
  const moves: Record<string, object> = {};
  let moveNum = 10140;
  for (const m of DIGIMON_MOVES) {
    moves[toId(m.name)] = {
      num: moveNum++, name: m.name, type: m.type, category: m.category, basePower: m.basePower, accuracy: m.accuracy, pp: m.pp,
      priority: 0, flags: { protect: 1, mirror: 1, ...(m.contact ? { contact: 1 } : {}), ...(m.pulse ? { pulse: 1 } : {}), ...(m.bite ? { bite: 1 } : {}), ...(m.wind ? { wind: 1 } : {}) },
      ...(m.multihit ? { multihit: m.multihit } : {}),
      ...(m.critRatio ? { critRatio: m.critRatio } : {}),
      ...(m.attackStat ? { overrideOffensiveStat: m.attackStat } : {}),
      secondary: m.secondary ? { ...m.secondary } : null, target: 'normal', gen: 7, isNonstandard: null,
      shortDesc: m.desc, desc: m.desc,
    };
  }
  const conditions = { warpdigivolution: { name: 'Warp Digivolution' } };
  // Gen 8-9 Abilities the warp forms use (HerculesKabuterimon's Electromorphosis, Gallantmon's Dauntless Shield): made
  // usable in Gen 7; the engine gives them their Gen 9 behaviour (src/engine/custom.ts).
  const abilities: Record<string, object> = {
    electromorphosis: { inherit: true, gen: 7, isNonstandard: null },
    dauntlessshield: { inherit: true, gen: 7, isNonstandard: null },
  };
  // The user's own Abilities (MegaGargomon's Elevate).
  let abilityNum = 10130;
  for (const a of DIGIMON_ABILITIES) {
    abilities[toId(a.name)] = { name: a.name, num: abilityNum++, gen: 7, isNonstandard: null, rating: 3, flags: {}, shortDesc: a.shortDesc, desc: a.desc };
  }
  return { Species: species, FormatsData: formatsData, Items: items, Moves: moves, Learnsets: learnsets, Conditions: conditions, Abilities: abilities };
}
