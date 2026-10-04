import { describe, expect, it } from 'vitest';
import { SettingsStore, DEFAULT_APP_SETTINGS } from '../settings/settings-store';
import { newSet } from '../team/sets';
import { checkBackup, createBackup, restoreBackup } from './backup';
import { memoryStore } from './kv';
import { TeamStore } from './team-store';

describe('backup', () => {
  it('round-trips teams and settings through a backup file', () => {
    const source = memoryStore();
    new TeamStore(source).create('Rain', [newSet('Pelipper')]);
    new SettingsStore(source).update({ theme: 'dark' });

    const file = JSON.parse(JSON.stringify(createBackup(source)));
    expect(checkBackup(file)).toBeNull();

    const target = memoryStore({ 'tree.v1': '{"stale":true}' });
    restoreBackup(target, file);
    expect(new TeamStore(target).getTeams().map(t => t.name)).toEqual(['Rain']);
    expect(new SettingsStore(target).getSettings().theme).toBe('dark');
    // Sections absent from the backup are cleared so the result matches it exactly.
    expect(target.get('tree.v1')).toBeNull();
  });

  it('rejects files that are not backups', () => {
    expect(checkBackup(null)).toMatch(/Not a backup/);
    expect(checkBackup({ app: 'other' })).toMatch(/not a Battle Tree/);
    expect(checkBackup({ app: 'battle-tree-simulator', version: 2, data: {} })).toMatch(/version/);
    expect(checkBackup({ app: 'battle-tree-simulator', version: 1, data: { passwords: 1 } })).toMatch(/Unknown sections/);
  });

  it('settings fall back to defaults when stored data is unreadable', () => {
    expect(new SettingsStore(memoryStore({ 'settings.v1': '{oops' })).getSettings()).toEqual(DEFAULT_APP_SETTINGS);
  });
});
