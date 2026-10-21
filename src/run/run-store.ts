import type { KeyValueStore } from '../storage/kv';
import { defaultPartnerBook, rollOffer, withDigimon } from './partners';
import { Rng } from './rng';
import { speaksFirst, TRAINERS } from '../data/battle-tree';
import { inSpeakingOrder } from './selection';
import type { TournamentState } from './tournament';
import { DEFAULT_SETTINGS, RUN_KEYS, type PartnerBook, type RunKey, type RunState, type TreeProfile } from './types';

const KEY = 'tree.v1';

export interface TreeState {
  profile: TreeProfile;
  /** Saved (suspended, in-battle or just-finished) runs, one per course. */
  runs: Partial<Record<RunKey, RunState>>;
  /** The All Star Duo Tournament in progress (or just finished), if any. */
  tournament: TournamentState | null;
}

interface TreeFileV1 extends TreeState {
  version: 1;
}

export const emptyProfile = (): TreeProfile => ({
  superUnlocked: { singles: false, doubles: false },
  records: Object.fromEntries(RUN_KEYS.map(k => [k, { best: 0, last: 0 }])) as TreeProfile['records'],
  bpTotal: 0,
  bpSpent: 0,
  partners: defaultPartnerBook(),
  settings: { ...DEFAULT_SETTINGS },
  tournaments: { entered: 0, won: 0 },
});

/**
 * Partner books from earlier versions: partners had two fixed Pokémon (setIds), and beaten trainers
 * were a "scoutable" map, then an "available" list (both count as beaten once).
 */
type OldPartnerBook = Partial<PartnerBook> & {
  owned?: Record<string, { offer?: number[]; setIds?: number[] }>;
  scoutable?: Record<string, unknown>;
  available?: string[];
};

function migratePartners(saved: OldPartnerBook | undefined, base: PartnerBook): PartnerBook {
  if (!saved) return base;
  const owned: PartnerBook['owned'] = { ...base.owned };
  for (const [name, entry] of Object.entries(saved.owned ?? {})) {
    try {
      // An offer from before a trainer's Digimon was always in it (2026-10-18) gets it.
      owned[name] = { offer: withDigimon(name, entry.offer ?? rollOffer(name, new Rng(`migrated-partner|${name}`))) };
    } catch {
      // Not a special trainer or Battle Legend (corrupt entry): drop it.
    }
  }
  const beaten: PartnerBook['beaten'] = {};
  for (const name of [...(saved.available ?? []), ...Object.keys(saved.scoutable ?? {})]) beaten[name] = 1;
  for (const [name, times] of Object.entries(saved.beaten ?? {})) if (Number.isInteger(times) && times > 0) beaten[name] = times;
  // Prices are kept since 2026-10-11; before, they came from the number of wins (priceOf still does that for these).
  const prices: Record<string, number> = {};
  for (const [name, price] of Object.entries(saved.prices ?? {})) if (beaten[name] && Number.isInteger(price) && price > 0) prices[name] = price;
  return { owned, beaten, prices };
}

/** Saves from before 2026-10-17 have an "Anabel can appear" setting; she always can now (the option was removed on request). */
function withoutAnabelSetting(settings: RunState['settings']): RunState['settings'] {
  const { anabelUnlocked: _removed, ...rest } = settings as RunState['settings'] & { anabelUnlocked?: boolean };
  return rest;
}

/**
 * All Star runs saved before 2026-10-11 were all marked debug (All Star Mode earned nothing); now it earns BP and
 * partner progress, so only practice runs (random AI) and debug starts (a later battle) stay debug. (A debug choice
 * of opponents can't be told apart: such a run counts as an ordinary All Star run.)
 */
function migrateRun(saved: RunState): RunState {
  // A Multi Battle planned before opponents were lined up in speaking order (2026-10-20): line them up.
  const run = { ...saved, settings: withoutAnabelSetting(saved.settings), next: inSpeakingOrder(saved.next) };
  if (run.course !== 'allstar' || !run.debug) return run;
  const firstBattle = run.history[0]?.battle ?? run.battle;
  return { ...run, debug: (run.settings?.ai ?? 'heuristic') !== 'heuristic' || firstBattle > 1 };
}

/** A tournament drawn before duos were lined up in speaking order (2026-10-20): line them up (their teams stay). */
function migrateTournament(t: TournamentState): TournamentState {
  const entrants = t.entrants.map(e => (e.kind === 'duo' && !speaksFirst(TRAINERS[e.trainers[0].trainerId], TRAINERS[e.trainers[1].trainerId])
    ? { ...e, trainers: [e.trainers[1], e.trainers[0]] as typeof e.trainers } : e));
  return { ...t, entrants };
}

/**
 * Battle Tree progress (profile, records, saved runs) persisted as one
 * versioned JSON document behind KeyValueStore. Unreadable data is backed up,
 * not discarded.
 */
export class RunStore {
  private state: TreeState;
  private readonly listeners = new Set<() => void>();
  private readonly kv: KeyValueStore;

  constructor(kv: KeyValueStore) {
    this.kv = kv;
    this.state = this.load();
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  getState = (): TreeState => this.state;

  setRun(key: RunKey, run: RunState | null): void {
    const runs = { ...this.state.runs };
    if (run) runs[key] = run; else delete runs[key];
    this.commit({ ...this.state, runs });
  }

  setTournament(tournament: TournamentState | null): void {
    this.commit({ ...this.state, tournament });
  }

  reset(): void {
    this.commit({ profile: emptyProfile(), runs: {}, tournament: null });
  }

  updateProfile(update: (p: TreeProfile) => TreeProfile): void {
    this.commit({ ...this.state, profile: update(this.state.profile) });
  }

  private load(): TreeState {
    const raw = this.kv.get(KEY);
    if (!raw) return { profile: emptyProfile(), runs: {}, tournament: null };
    try {
      const file = JSON.parse(raw) as TreeFileV1;
      if (file.version !== 1 || !file.profile) throw new Error('unexpected shape');
      const base = emptyProfile();
      // Saves from before Doubles: superUnlocked was one boolean (Singles) and runs had no format.
      const unlocked = file.profile.superUnlocked as TreeProfile['superUnlocked'] | boolean;
      const superUnlocked = typeof unlocked === 'boolean' ? { singles: unlocked, doubles: false } : { ...base.superUnlocked, ...unlocked };
      const runs = Object.fromEntries(Object.entries(file.runs ?? {}).map(([k, r]) => [k, migrateRun({ ...r, format: r.format ?? 'singles' })]));
      // Saves from before Multi have no partners or spent BP.
      return {
        profile: {
          ...base,
          ...file.profile,
          superUnlocked,
          records: { ...base.records, ...file.profile.records },
          bpSpent: file.profile.bpSpent ?? 0,
          partners: migratePartners(file.profile.partners, base.partners),
          settings: withoutAnabelSetting({ ...base.settings, ...file.profile.settings }),
          // Saves from before the Duo Tournament (2026-10-19) have no tournament count.
          tournaments: { ...base.tournaments, ...file.profile.tournaments },
        },
        runs,
        tournament: file.tournament ? migrateTournament(file.tournament) : null,
      };
    } catch (err) {
      console.error('Battle Tree progress is unreadable; keeping a backup and starting fresh.', err);
      this.kv.set(`${KEY}.corrupt-${Date.now()}`, raw);
      return { profile: emptyProfile(), runs: {}, tournament: null };
    }
  }

  private commit(state: TreeState) {
    this.state = state;
    const file: TreeFileV1 = { version: 1, ...state };
    this.kv.set(KEY, JSON.stringify(file));
    this.listeners.forEach(l => l());
  }
}
