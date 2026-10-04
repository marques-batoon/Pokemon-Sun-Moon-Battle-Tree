/**
 * Minimal key-value storage interface. Everything the app persists goes through
 * this, so localStorage can later be swapped for IndexedDB or a backend.
 */
export interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export function memoryStore(initial: Record<string, string> = {}): KeyValueStore {
  const data = new Map(Object.entries(initial));
  return {
    get: key => data.get(key) ?? null,
    set: (key, value) => { data.set(key, value); },
    remove: key => { data.delete(key); },
  };
}

/**
 * localStorage-backed store. Falls back to memory (data lost on reload) when
 * localStorage is unavailable, e.g. blocked site data or private windows.
 */
export function localStore(prefix = 'battletree:'): KeyValueStore {
  try {
    const probe = `${prefix}__probe`;
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
  } catch {
    console.warn('localStorage unavailable; data will not persist across reloads.');
    return memoryStore();
  }
  return {
    get: key => window.localStorage.getItem(prefix + key),
    set: (key, value) => window.localStorage.setItem(prefix + key, value),
    remove: key => window.localStorage.removeItem(prefix + key),
  };
}
