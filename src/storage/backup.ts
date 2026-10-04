import type { KeyValueStore } from './kv';

/** Every key the app persists. Backups copy exactly these. */
export const BACKUP_KEYS = ['teams.v1', 'tree.v1', 'settings.v1'] as const;
type BackupKey = (typeof BACKUP_KEYS)[number];

export interface Backup {
  app: 'battle-tree-simulator';
  version: 1;
  exportedAt: string;
  /** Parsed JSON of each stored document (null if it was never written). */
  data: Partial<Record<BackupKey, unknown>>;
}

export function createBackup(kv: KeyValueStore, now = new Date()): Backup {
  const data: Backup['data'] = {};
  for (const key of BACKUP_KEYS) {
    const raw = kv.get(key);
    if (raw === null) continue;
    try { data[key] = JSON.parse(raw); } catch { /* skip unreadable documents */ }
  }
  return { app: 'battle-tree-simulator', version: 1, exportedAt: now.toISOString(), data };
}

/** Checks a parsed backup file. Returns a problem description, or null if it can be restored. */
export function checkBackup(value: unknown): string | null {
  if (!value || typeof value !== 'object') return 'Not a backup file.';
  const b = value as Partial<Backup>;
  if (b.app !== 'battle-tree-simulator') return 'This file is not a Battle Tree Simulator backup.';
  if (b.version !== 1) return `Unsupported backup version ${String(b.version)}.`;
  if (!b.data || typeof b.data !== 'object') return 'The backup has no data.';
  const unknown = Object.keys(b.data).filter(k => !(BACKUP_KEYS as readonly string[]).includes(k));
  if (unknown.length) return `Unknown sections in backup: ${unknown.join(', ')}.`;
  return null;
}

/**
 * Replaces stored documents with the backup's. Sections missing from the backup
 * are removed, so the result matches the backup exactly. Reload the app afterwards.
 */
export function restoreBackup(kv: KeyValueStore, backup: Backup): void {
  for (const key of BACKUP_KEYS) {
    const value = backup.data[key];
    if (value === undefined) kv.remove(key);
    else kv.set(key, JSON.stringify(value));
  }
}
