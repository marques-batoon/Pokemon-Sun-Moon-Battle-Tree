import { RULES, type Course, type Format } from '../data/battle-tree';
import type { AIKind } from '../engine/protocol';
import type { PokemonSet } from '../team/types';

export type { Course, Format };

/** One saved challenge per format + course, e.g. "singles-super". */
export type RunKey = `${Format}-${Course}`;
export const runKey = (format: Format, course: Course): RunKey => `${format}-${course}`;
export const RUN_KEYS: readonly RunKey[] = ['singles-normal', 'singles-super', 'doubles-normal', 'doubles-super'];
export const FORMATS: readonly Format[] = ['singles', 'doubles'];

/** How many Pokémon the player brings to each battle (Singles 3, Doubles 4). */
export const BRING: Record<Format, number> = { singles: RULES.teamSize.singles.bring, doubles: RULES.teamSize.doubles.bring };
/** Fewest Pokémon a registered team may have (Singles 3, Doubles 4). */
export const MIN_REGISTERED: Record<Format, number> = {
  singles: RULES.teamSize.singles.registeredMin ?? 3,
  doubles: RULES.teamSize.doubles.registeredMin ?? 4,
};

export interface RunSettings {
  /** Reached Guzzlord's chapter of the Looker episode (Anabel can appear). */
  anabelUnlocked: boolean;
  /**
   * Off (game rule): the 3 Pokémon and their order are fixed when the challenge
   * starts or resumes, and the opponent's team is hidden. On: Showdown-style
   * Team Preview and a fresh pick before every battle.
   */
  teamPreviewEachBattle: boolean;
  /** 'heuristic' = Battle Tree AI. 'random' is practice: the run never counts toward records. */
  ai: AIKind;
}

export const DEFAULT_SETTINGS: RunSettings = { anabelUnlocked: true, teamPreviewEachBattle: false, ai: 'heuristic' };

export interface PlannedOpponent {
  battle: number;
  trainerId: number;
  /** "Youngster Florian", "Battle Legend Red". */
  displayName: string;
  kind: 'regular' | 'special' | 'legend';
  /** Anabel was rolled but is locked, so an ordinary trainer stands in. */
  replacedAnabel: boolean;
  setIds: number[];
  team: PokemonSet[];
  /** Simulator seed text for this battle. */
  seedText: string;
}

export interface BattleRecord {
  battle: number;
  opponent: string;
  result: 'win' | 'loss';
  bp: number;
  turns: number;
  seedText: string;
}

export type RunStatus =
  /** Between battles. */
  | 'ready'
  /** A battle was started and hasn't finished (if the app reloads now, it was interrupted). */
  | 'in-battle'
  /** Normal course cleared (Battle Legend at 20 beaten). */
  | 'cleared'
  | 'lost'
  | 'retired';

export interface RunState {
  id: string;
  /** Singles or Doubles (runs saved before Doubles existed are Singles). */
  format: Format;
  course: Course;
  settings: RunSettings;
  /** Base seed; every battle's opponent and simulator seed derive from it. */
  seedText: string;
  team: {
    sourceTeamId: string | null;
    name: string;
    /** Registered team (3-6 in Singles, 4-6 in Doubles), snapshotted when the run started or resumed. */
    sets: PokemonSet[];
    /** Indices into sets: the Pokémon brought, in battle order (game rule). */
    bring: number[];
  };
  /** Number of the next (or current) battle, 1-based. */
  battle: number;
  /** Current win streak in this run. */
  wins: number;
  /** BP earned in this run. */
  bp: number;
  status: RunStatus;
  next: PlannedOpponent;
  history: BattleRecord[];
  /** Unranked: started at battle > 1 (debug) or against the random AI (practice). Never counts toward records or unlocks. */
  debug: boolean;
  startedAt: number;
  updatedAt: number;
}

export interface CourseRecord {
  best: number;
  /** Streak of the last finished run. */
  last: number;
}

export interface TreeProfile {
  /** Super Singles / Super Doubles unlocked by beating the Normal course's Battle Legend (Red / Blue). */
  superUnlocked: Record<Format, boolean>;
  records: Record<RunKey, CourseRecord>;
  /** All BP ever earned (display only). */
  bpTotal: number;
  settings: RunSettings;
}
