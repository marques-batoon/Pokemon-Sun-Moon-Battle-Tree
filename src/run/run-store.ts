import type { KeyValueStore } from '../storage/kv';
import { DEFAULT_SETTINGS, RUN_KEYS, type RunKey, type RunState, type TreeProfile } from './types';

const KEY = 'tree.v1';

export interface TreeState {
  profile: TreeProfile;
  /** Saved (suspended, in-battle or just-finished) runs, one per course. */
  runs: Partial<Record<RunKey, RunState>>;
}

interface TreeFileV1 extends TreeState {
  version: 1;
}

export const emptyProfile = (): TreeProfile => ({
  superUnlocked: { singles: false, doubles: false },
  records: Object.fromEntries(RUN_KEYS.map(k => [k, { best: 0, last: 0 }])) as TreeProfile['records'],
  bpTotal: 0,
  settings: { ...DEFAULT_SETTINGS },
});

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

  reset(): void {
    this.commit({ profile: emptyProfile(), runs: {} });
  }

  updateProfile(update: (p: TreeProfile) => TreeProfile): void {
    this.commit({ ...this.state, profile: update(this.state.profile) });
  }

  private load(): TreeState {
    const raw = this.kv.get(KEY);
    if (!raw) return { profile: emptyProfile(), runs: {} };
    try {
      const file = JSON.parse(raw) as TreeFileV1;
      if (file.version !== 1 || !file.profile) throw new Error('unexpected shape');
      const base = emptyProfile();
      // Saves from before Doubles: superUnlocked was one boolean (Singles) and runs had no format.
      const unlocked = file.profile.superUnlocked as TreeProfile['superUnlocked'] | boolean;
      const superUnlocked = typeof unlocked === 'boolean' ? { singles: unlocked, doubles: false } : { ...base.superUnlocked, ...unlocked };
      const runs = Object.fromEntries(Object.entries(file.runs ?? {}).map(([k, r]) => [k, { ...r, format: r.format ?? 'singles' }]));
      return {
        profile: { ...base, ...file.profile, superUnlocked, records: { ...base.records, ...file.profile.records }, settings: { ...base.settings, ...file.profile.settings } },
        runs,
      };
    } catch (err) {
      console.error('Battle Tree progress is unreadable; keeping a backup and starting fresh.', err);
      this.kv.set(`${KEY}.corrupt-${Date.now()}`, raw);
      return { profile: emptyProfile(), runs: {} };
    }
  }

  private commit(state: TreeState) {
    this.state = state;
    const file: TreeFileV1 = { version: 1, ...state };
    this.kv.set(KEY, JSON.stringify(file));
    this.listeners.forEach(l => l());
  }
}
