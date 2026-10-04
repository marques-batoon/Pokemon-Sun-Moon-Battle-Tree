import type { SavedTeam } from '../team/types';
import type { KeyValueStore } from './kv';

const KEY = 'teams.v1';

interface TeamsFileV1 {
  version: 1;
  teams: SavedTeam[];
}

/**
 * Saved teams, persisted as one versioned JSON document. Unreadable data is
 * copied to a backup key instead of being silently discarded.
 * Subscribe with useSyncExternalStore(store.subscribe, store.getTeams).
 */
export class TeamStore {
  private teams: SavedTeam[];
  private readonly listeners = new Set<() => void>();
  private readonly kv: KeyValueStore;
  private readonly now: () => number;

  constructor(kv: KeyValueStore, now: () => number = Date.now) {
    this.kv = kv;
    this.now = now;
    this.teams = this.load();
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  /** Stable array reference until the next change. */
  getTeams = (): readonly SavedTeam[] => this.teams;

  get(id: string): SavedTeam | undefined {
    return this.teams.find(t => t.id === id);
  }

  create(name: string, sets: SavedTeam['sets'] = []): SavedTeam {
    const t = this.now();
    const team: SavedTeam = { id: newId(), name: name.trim() || 'Untitled team', format: 'singles', sets, createdAt: t, updatedAt: t };
    this.commit([...this.teams, team]);
    return team;
  }

  update(id: string, patch: Partial<Pick<SavedTeam, 'name' | 'sets'>>): void {
    this.commit(this.teams.map(t => (t.id === id ? { ...t, ...patch, updatedAt: this.now() } : t)));
  }

  duplicate(id: string): SavedTeam | undefined {
    const src = this.get(id);
    return src ? this.create(`${src.name} (copy)`, structuredClone(src.sets)) : undefined;
  }

  remove(id: string): void {
    this.commit(this.teams.filter(t => t.id !== id));
  }

  clear(): void {
    this.commit([]);
  }

  /** Replace every saved team (e.g. restoring a full backup). Returns the new teams. */
  replaceAll(teams: readonly { name: string; sets: SavedTeam['sets'] }[]): SavedTeam[] {
    const t = this.now();
    const next = teams.map(({ name, sets }) => ({ id: newId(), name: name.trim() || 'Untitled team', format: 'singles' as const, sets, createdAt: t, updatedAt: t }));
    this.commit(next);
    return next;
  }

  private load(): SavedTeam[] {
    const raw = this.kv.get(KEY);
    if (!raw) return [];
    try {
      const file = JSON.parse(raw) as TeamsFileV1;
      if (file.version !== 1 || !Array.isArray(file.teams)) throw new Error('unexpected shape');
      return file.teams;
    } catch (err) {
      console.error('Saved teams are unreadable; keeping a backup and starting empty.', err);
      this.kv.set(`${KEY}.corrupt-${this.now()}`, raw);
      return [];
    }
  }

  private commit(teams: SavedTeam[]) {
    this.teams = teams;
    const file: TeamsFileV1 = { version: 1, teams };
    this.kv.set(KEY, JSON.stringify(file));
    this.listeners.forEach(l => l());
  }
}

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
