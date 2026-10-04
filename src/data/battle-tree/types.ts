// Shapes of the generated JSON in this folder. Regenerate the JSON with
// `npm run data:build`; see DATA_NOTES.md for how the data is used.

export type StatId = 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe';
export type StatTable = Record<StatId, number>;
export type GameVersion = 'sun' | 'moon';
export type Course = 'normal' | 'super';
export type Format = 'singles' | 'doubles';

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
}

interface TrainerBase {
  id: number;
  name: string;
  class: string;
  classGender: 'M' | 'F' | null;
  /** IV applied to all six stats of every Pokémon this trainer uses. */
  iv: number;
  /** Indices into sets.json. */
  roster: number[];
  source: Record<string, string>;
}

export interface RegularTrainer extends TrainerBase {
  kind: 'regular';
  /** Bulbapedia's 1-based trainer number (001-190). */
  number: number;
  bulbapediaBrackets: string[];
}

export interface SpecialTrainer extends TrainerBase {
  kind: 'special';
  number: null;
  versions: GameVersion[];
  /** Relative weight within the special pool (Anabel 1, everyone else 7). */
  weight: number;
  requires?: 'lookerGuzzlordChapter';
  requiresNote?: string;
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
  | { everyNth: number; special: true };

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
  specialTrainerPool: {
    weightsSource: string;
    versionsSource: string;
    trainerIds: number[];
    anabelFallback: { rule: string; approximation: boolean; note: string };
  };
}

export interface Boss {
  trainerId: number;
  format: Format;
  course: Course;
  battle: number;
  bp: number;
  unlocks?: string;
  teamSize: number;
  iv: number;
  future?: boolean;
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
  battlePoints: Record<Course, BpRange[]>;
  [key: string]: unknown;
}
