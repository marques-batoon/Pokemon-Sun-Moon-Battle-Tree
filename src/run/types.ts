import { RULES, type Course, type Format } from '../data/battle-tree';
import type { AIKind } from '../engine/protocol';
import type { PokemonSet } from '../team/types';

export type { Course, Format };

/** One saved challenge per format + course, e.g. "singles-super" (there's no Normal Multi). */
export type RunKey = Exclude<`${Format}-${Course}`, 'multi-normal'>;
export const runKey = (format: Format, course: Course): RunKey => `${format}-${course}` as RunKey;
export const RUN_KEYS: readonly RunKey[] = ['singles-normal', 'singles-super', 'singles-allstar', 'doubles-normal', 'doubles-super', 'doubles-allstar', 'multi-super', 'multi-allstar'];
export const FORMATS: readonly Format[] = ['singles', 'doubles', 'multi'];
/** Courses each format has: this app has only Super Multi. */
export const COURSES: Record<Format, readonly Course[]> = { singles: ['normal', 'super', 'allstar'], doubles: ['normal', 'super', 'allstar'], multi: ['super', 'allstar'] };
/** Courses that need the format's Super course unlocked: Super and All Star Mode. */
export const needsSuper = (course: Course) => course !== 'normal';

/** How many Pokémon the player brings to each battle (Singles 3, Doubles 4, Multi 2). */
export const BRING: Record<Format, number> = {
  singles: RULES.teamSize.singles.bring, doubles: RULES.teamSize.doubles.bring, multi: RULES.teamSize.multi.bring,
};
/** Fewest Pokémon a registered team may have (Singles 3, Doubles 4, Multi 2). */
export const MIN_REGISTERED: Record<Format, number> = {
  singles: RULES.teamSize.singles.registeredMin ?? 3,
  doubles: RULES.teamSize.doubles.registeredMin ?? 4,
  multi: RULES.teamSize.multi.registeredMin ?? 2,
};

/** Multi partners everyone starts with (rules.json multiPartners). */
const MULTI_PARTNERS = RULES.multiPartners as { scoutCost: number; defaultPartners: string[] };
export const DEFAULT_PARTNERS: readonly string[] = MULTI_PARTNERS.defaultPartners;
/**
 * BP to buy a partner (special trainers and Battle Legends; app choice, requested 2026-10-08 and 2026-10-11; the
 * game's scouting costs 10, rules.json multiPartners.scoutCost). Beaten for the first time: 1000 BP, or 10000 BP in
 * All Star Mode. Each further win: 100 BP less (All Star Mode: 10 BP less), at least 100; a win outside All Star
 * Mode brings a price above 1000 down to 1000.
 */
export const PARTNER_PRICE = { first: 1000, dropPerWin: 100, lowest: 100, allStarFirst: 10000, allStarDropPerWin: 10 } as const;
/** The price after beating them `timesBeaten` times outside All Star Mode (how prices were kept before 2026-10-11). */
export const partnerPrice = (timesBeaten: number): number =>
  Math.max(PARTNER_PRICE.lowest, PARTNER_PRICE.first - PARTNER_PRICE.dropPerWin * (Math.max(1, timesBeaten) - 1));
/** A partner's price after another win over them (`current`: undefined if never beaten), in All Star Mode or not. */
export function priceAfterWin(current: number | undefined, allStar: boolean): number {
  if (current === undefined) return allStar ? PARTNER_PRICE.allStarFirst : PARTNER_PRICE.first;
  if (allStar) return Math.max(PARTNER_PRICE.lowest, current - PARTNER_PRICE.allStarDropPerWin);
  if (current > PARTNER_PRICE.first) return PARTNER_PRICE.first;
  return Math.max(PARTNER_PRICE.lowest, current - PARTNER_PRICE.dropPerWin);
}
/** How many of a partner's Pokémon you choose their two from. App choice (requested 2026-10-08). */
export const PARTNER_OFFER_SIZE = 6;
/** Pokémon a Multi partner brings. */
export const PARTNER_BRING = 2;

export interface RunSettings {
  /**
   * Off (game rule): the 3 Pokémon and their order are fixed when the challenge
   * starts or resumes, and the opponent's team is hidden. On: Showdown-style
   * Team Preview and a fresh pick before every battle.
   */
  teamPreviewEachBattle: boolean;
  /** 'heuristic' = Battle Tree AI. 'random' is practice: the run never counts toward records. */
  ai: AIKind;
}

export const DEFAULT_SETTINGS: RunSettings = { teamPreviewEachBattle: false, ai: 'heuristic' };

/** One opposing trainer and the team they bring. */
export interface PlannedTrainer {
  trainerId: number;
  /** "Youngster Florian", "Battle Legend Red". */
  displayName: string;
  kind: 'regular' | 'special' | 'legend';
  setIds: number[];
  team: PokemonSet[];
}

export interface PlannedOpponent extends PlannedTrainer {
  battle: number;
  /** Simulator seed text for this battle. */
  seedText: string;
  /** Multi Battles: the second opposing trainer. */
  second?: PlannedTrainer;
}

/** "Lass Sophia" or, in a Multi Battle, "Lass Sophia & Youngster Max". */
export const opponentLabel = (next: PlannedOpponent) => (next.second ? `${next.displayName} & ${next.second.displayName}` : next.displayName);

/** A Multi Battle partner (a special trainer) and the two Pokémon they bring, as Battle Tree set ids. */
export interface RunPartner {
  name: string;
  trainerId: number;
  setIds: number[];
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
  /** Multi Battles: the partner chosen for this challenge. */
  partner?: RunPartner;
  history: BattleRecord[];
  /**
   * Unranked: started at battle > 1 or with chosen opponents (debug), or against the random AI (practice). Never counts
   * toward records or unlocks, and earns no BP or partner progress. (All Star Mode is unrated too, but earns BP and
   * partner progress: countsForRecords.)
   */
  debug: boolean;
  startedAt: number;
  updatedAt: number;
}

export interface CourseRecord {
  best: number;
  /** Streak of the last finished run. */
  last: number;
}

/**
 * Later battles a new challenge may start at (app feature): battle 30 once you've won
 * battle 50 of that course, battles 50 and 100 once you've won battle 100. `best` counts wins,
 * so it's the last battle won.
 */
export const CHECKPOINTS: readonly { start: number; unlockedBy: number }[] = [
  { start: 30, unlockedBy: 50 }, { start: 50, unlockedBy: 100 },
  // On request (2026-10-22).
  { start: 100, unlockedBy: 100 },
];
export const checkpointsFor = (record: CourseRecord | undefined): number[] =>
  CHECKPOINTS.filter(c => (record?.best ?? 0) >= c.unlockedBy).map(c => c.start);

/**
 * After losing battle N (after battle 10), a new challenge can start again from the last multiple of 10
 * that was won: lost battle 27: battle 20; lost battle 20: battle 10, not 20 (on request, 2026-10-23;
 * it was 20 before). Null up to battle 10 (no multiple of 10 won).
 */
export const retryStart = (lostBattle: number): number | null => (lostBattle > 10 ? Math.floor((lostBattle - 1) / 10) * 10 : null);

/** Formats with a Normal course whose Battle Legend unlocks Super. */
export type UnlockFormat = Exclude<Format, 'multi'>;

/** Partners for Multi Battles, by special trainer name. */
export interface PartnerBook {
  /**
   * Partners you can pick (Sina and Dexio from the start), each with the Battle Tree sets
   * (up to PARTNER_OFFER_SIZE, rolled when you got them) you choose their two Pokémon from.
   */
  owned: Record<string, { offer: number[] }>;
  /** How many times you've beaten each special trainer and Battle Legend (not in debug or practice runs). */
  beaten: Record<string, number>;
  /**
   * The price of each one beaten (PARTNER_PRICE, priceAfterWin), kept for those you don't own yet. Older saves
   * have none: their price comes from the number of wins (partnerPrice).
   */
  prices?: Record<string, number>;
}

/** What a beaten trainer costs now (undefined if never beaten). */
export const priceOf = (book: PartnerBook, name: string): number | undefined =>
  book.prices?.[name] ?? (book.beaten[name] ? partnerPrice(book.beaten[name]) : undefined);

/** Whether a run's streak counts toward records and unlocks (not debug or practice runs, nor All Star Mode). */
export const countsForRecords = (run: Pick<RunState, 'debug' | 'course'>) => !run.debug && run.course !== 'allstar';

export interface TreeProfile {
  /** Super Singles / Super Doubles unlocked by beating the Normal course's Battle Legend (Red / Blue). */
  superUnlocked: Record<UnlockFormat, boolean>;
  records: Record<RunKey, CourseRecord>;
  /** All BP ever earned. */
  bpTotal: number;
  /** BP spent buying partners; the balance is bpTotal - bpSpent. */
  bpSpent: number;
  partners: PartnerBook;
  settings: RunSettings;
  /** All Star Duo Tournaments entered and won (practice ones don't count). */
  tournaments: { entered: number; won: number };
}

/** Super Multi opens once both Super Singles and Super Doubles are unlocked. */
export function isSuperUnlocked(profile: TreeProfile, format: Format): boolean {
  return format === 'multi' ? profile.superUnlocked.singles && profile.superUnlocked.doubles : profile.superUnlocked[format];
}

export const bpBalance = (profile: TreeProfile) => profile.bpTotal - profile.bpSpent;
