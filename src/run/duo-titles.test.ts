import { describe, expect, it } from 'vitest';
import { duoTitle, PLAYER_DUO_TITLE, TRAINER_PAIR_QUOTES, trainerKey, TRAINERS, type Trainer } from '../data/battle-tree';
import titles from '../data/battle-tree/duo-titles.json';
import { drawDuos } from './tournament';

const byKey = (key: string) => TRAINERS.find(t => (t.kind === 'special' || t.kind === 'legend') && trainerKey(t) === key)!;
const label = (a: string, b: string) => [a, b].sort().join(' & ');

describe('All Star Duo Tournament team titles', () => {
  it('gives every pair that can be drawn (pair lines, Tate and Liza, Izzy with Colress or Cheren) a title of its own, no two the same', () => {
    const pairs: [Trainer, Trainer][] = Object.values(TRAINER_PAIR_QUOTES).map(e => Object.keys(e).map(byKey) as [Trainer, Trainer]);
    pairs.push([byKey('Tate'), byKey('Liza')], [byKey('Colress'), byKey('Izzy')], [byKey('Cheren'), byKey('Izzy')]);
    const known = new Set(pairs.map(([a, b]) => label(trainerKey(a), trainerKey(b))));
    const titled = new Set(Object.keys(titles.titles).map(l => label(...(l.split(' & ') as [string, string]))));
    expect([...known].filter(p => !titled.has(p))).toEqual([]);
    expect([...titled].filter(p => !known.has(p))).toEqual([]);
    expect(titled.size).toBe(1419);
    const all = Object.values(titles.titles);
    expect(new Set(all).size).toBe(all.length);
    // Every duo a tournament draws has its own title, never just their names.
    for (let i = 0; i < 20; i++) {
      for (const duo of drawDuos(`titles-${i}`, byKey('Sina').id, 31)) {
        const [a, b] = duo.map(d => TRAINERS[d.trainerId]);
        expect(duoTitle(a, b), `${a.name} & ${b.name}`).not.toBe(`${a.name} & ${b.name}`);
      }
    }
  });

  it('titles the pair, whichever speaks first; your team is the Rising Champions', () => {
    expect(duoTitle(byKey('Brock'), byKey('Misty'))).toBe('The Original Travel Companions');
    expect(duoTitle(byKey('Misty'), byKey('Brock'))).toBe('The Original Travel Companions');
    expect(duoTitle(byKey('Tate'), byKey('Liza'))).toBe('The Mystic Combination');
    expect(duoTitle(byKey('Liza'), byKey('Tate'))).toBe('The Mystic Combination');
    // Each pair has its own, even with the same trainer in it.
    expect(duoTitle(byKey('Brock'), byKey('Erika'))).not.toBe(duoTitle(byKey('Misty'), byKey('Erika')));
    expect(PLAYER_DUO_TITLE).toBe('Rising Champions');
  });
});
