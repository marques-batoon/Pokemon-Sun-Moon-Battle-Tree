// Shapes of the generated JSON in this folder. Regenerate the JSON with
// `npm run data:build`; see DATA_NOTES.md for how the data is used.

export type StatId = 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe';
export type StatTable = Record<StatId, number>;
export type GameVersion = 'sun' | 'moon';
/** 'allstar': All Star Mode (custom, unrated): special trainers every battle, the battle-50 draw every 10th; earns BP and partner progress. */
export type Course = 'normal' | 'super' | 'allstar';
export type Format = 'singles' | 'doubles' | 'multi';

export interface TreeSet {
  id: number;
  /** Community label, e.g. "Garchomp-3" (species + set number). */
  label: string;
  /** Showdown species name (base form; Mega forms happen in battle). */
  species: string;
  setNumber: number;
  nature: string;
  item: string;
  moves: string[];
  evs: StatTable;
  notes?: string[];
  /** Custom trainers' sets fix these; Battle Tree sets roll them (opponent.ts). */
  ability?: string;
  gender?: 'M' | 'F';
}

interface TrainerBase {
  id: number;
  name: string;
  /**
   * Unique name for data lookups (lines, pictures, partners) when two trainers share a name: the two
   * Archies and Maxies (Ruby / Sapphire / Emerald and Omega Ruby / Alpha Sapphire), Team Aqua's Matt.
   * Use trainerKey(); defaults to the name.
   */
  key?: string;
  /** The same character in two versions (both Archies): they never battle together or against each other. */
  person?: string;
  class: string;
  classGender: 'M' | 'F' | null;
  /** IV applied to all six stats of every Pokémon this trainer uses. */
  iv: number;
  /** Indices into sets.json. */
  roster: number[];
  source: Record<string, string>;
  /** A custom addition, not in the game (src/data/custom/). */
  custom?: boolean;
  /** Custom trainers' own sprite (a path under public/), instead of a Showdown one. */
  sprite?: string;
  /** Custom trainers: their Pokémon Showdown sprite, instead of their class's (Veteran Mildred: veteranf-gen6). */
  spriteId?: string;
  /** Custom trainers: the set (id) that always leads their team (Tai's Agumon, Matt's Gabumon). */
  leadSetId?: number;
  /** Custom trainers: one of these sets (ids) is on every team they bring, at a random place (the Paradox trainers' Paradox Pokémon). */
  alwaysOneOf?: number[];
}

export interface RegularTrainer extends TrainerBase {
  kind: 'regular';
  /** Bulbapedia's 1-based trainer number (001-190); null for custom ones. */
  number: number | null;
  bulbapediaBrackets: string[];
  /** Custom: in the regular trainers' pool from this battle on (Veteran Mildred: 100). */
  fromBattle?: number;
  /** Custom: chance in that pool relative to the game's trainers (1 each), from each battle on: 1.1 from 100, 1.5 from 200 (on request). */
  poolWeights?: { fromBattle: number; weight: number }[];
}

export interface SpecialTrainer extends TrainerBase {
  kind: 'special';
  number: null;
  versions: GameVersion[];
  /** Relative weight within the special pool (Anabel 1, the Elite Four and Champions and the evil teams 3.5, everyone else 7). */
  weight: number;
  requires?: 'lookerGuzzlordChapter';
  requiresNote?: string;
  region?: string;
}

export interface LegendTrainer extends TrainerBase {
  kind: 'legend';
  number: null;
  bossKey: string;
  format: Format;
  course: Course;
}

export type Trainer = RegularTrainer | SpecialTrainer | LegendTrainer;

export type ScheduleRule =
  | { battles: [number, number | null]; pool: string }
  | { battles: [number, number]; boss: string }
  | { everyNth: number; special: true }
  /** Custom: the boss battle recurs every N battles (Battle Legends every 50; All Star Mode every 10). */
  | { everyNth: number; boss: string }
  /** Custom: special trainers for these battles (All Star Mode). */
  | { battles: [number, number | null]; special: true };

export interface CourseSchedule {
  length: number | null;
  endsAfterLength: boolean;
  /** Evaluated top-down; the first matching rule decides the battle. */
  schedule: ScheduleRule[];
  specialTrainers: boolean;
}

export interface BracketsFile {
  source: Record<string, string>;
  trainerWeighting: { rule: 'uniform'; source: string };
  pools: Record<string, { label: string; trainerIds: number[]; bulbapediaNumbers: string }>;
  singles: Record<Course, CourseSchedule>;
  doubles: Record<Course, CourseSchedule>;
  /** Super only (this app has no Normal Multi). */
  multi: Partial<Record<Course, CourseSchedule>>;
  specialTrainerPool: {
    weightsSource: string;
    versionsSource: string;
    trainerIds: number[];
    anabelFallback: { rule: string; approximation: boolean; note: string };
  };
}

export interface Boss {
  trainerId: number;
  /** Multi: the second Battle Legend fighting alongside (Blue with Red). */
  partnerTrainerId?: number;
  format: Format;
  course: Course;
  battle: number;
  bp: number;
  unlocks?: string;
  teamSize: number;
  iv: number;
  future?: boolean;
  /** Chance relative to the other trainers that can appear at the same battle (battle 50). */
  weight?: number;
}

export interface BpRange {
  battles: [number, number | null];
  bp: number;
  note?: string;
}

export interface RulesFile {
  game: 'sun-moon';
  level: { max: number; scaleDownAbove: boolean; scaleUpBelow: boolean };
  teamSize: Record<string, { bring: number; registeredMax?: number; registeredMin?: number; future?: boolean }>;
  bannedSpecies: { includeAllForms: boolean; species: string[] };
  /** Per course in rules.json; All Star Mode earns none (see bpForWin). */
  battlePoints: Record<Exclude<Course, 'allstar'>, BpRange[]>;
  [key: string]: unknown;
}

/** A trainer's lines: before the battle, and after it depending on who won. */
export interface TrainerQuotes {
  greeting: string;
  /** Said when the trainer wins (the player lost). */
  trainerWins: string;
  /** Said when the trainer loses (the player won). */
  trainerLoses: string;
}
