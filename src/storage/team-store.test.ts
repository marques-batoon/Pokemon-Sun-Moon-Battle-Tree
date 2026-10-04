import { describe, expect, it } from 'vitest';
import { newSet } from '../team/sets';
import { memoryStore } from './kv';
import { TeamStore } from './team-store';

describe('TeamStore', () => {
  it('creates, updates, duplicates and removes teams, persisting each change', () => {
    const kv = memoryStore();
    const store = new TeamStore(kv, () => 1000);
    const a = store.create('Rain', [newSet('Pelipper')]);
    store.update(a.id, { name: 'Rain v2' });
    const copy = store.duplicate(a.id)!;
    expect(store.getTeams().map(t => t.name)).toEqual(['Rain v2', 'Rain v2 (copy)']);
    expect(copy.sets).toEqual(a.sets);
    expect(copy.sets).not.toBe(a.sets);

    const reloaded = new TeamStore(kv);
    expect(reloaded.getTeams().map(t => t.name)).toEqual(['Rain v2', 'Rain v2 (copy)']);
    reloaded.remove(a.id);
    expect(new TeamStore(kv).getTeams().map(t => t.id)).toEqual([copy.id]);
  });

  it('notifies subscribers and keeps a stable snapshot between changes', () => {
    const store = new TeamStore(memoryStore());
    let calls = 0;
    store.subscribe(() => calls++);
    const before = store.getTeams();
    expect(store.getTeams()).toBe(before);
    store.create('x');
    expect(calls).toBe(1);
    expect(store.getTeams()).not.toBe(before);
  });

  it('backs up unreadable data instead of discarding it', () => {
    const kv = memoryStore({ 'teams.v1': '{not json' });
    const store = new TeamStore(kv, () => 42);
    expect(store.getTeams()).toEqual([]);
    expect(kv.get('teams.v1.corrupt-42')).toBe('{not json');
  });
});

describe('TeamStore.replaceAll', () => {
  it('replaces every saved team and persists the result', () => {
    const kv = memoryStore();
    const store = new TeamStore(kv);
    store.create('Old A');
    store.create('Old B');
    const created = store.replaceAll([{ name: 'New', sets: [newSet('Garchomp')] }, { name: ' ', sets: [] }]);
    expect(created.map(t => t.name)).toEqual(['New', 'Untitled team']);
    expect(new TeamStore(kv).getTeams().map(t => t.name)).toEqual(['New', 'Untitled team']);
  });
});
