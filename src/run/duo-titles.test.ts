import { describe, expect, it } from 'vitest';
import { duoTitle, playerDuoTitle, TRAINER_PAIR_QUOTES, trainerEpithet, trainerKey, TRAINERS, type Trainer } from '../data/battle-tree';
import titles from '../data/battle-tree/duo-titles.json';
import { drawDuos } from './tournament';

const byKey = (key: string) => TRAINERS.find(t => (t.kind === 'special' || t.kind === 'legend') && trainerKey(t) === key)!;

describe('All Star Duo Tournament team titles', () => {
  it('gives every special trainer and Battle Legend an epithet of their own', () => {
    const named = [...new Set(TRAINERS.filter(t => t.kind === 'special' || t.kind === 'legend').map(trainerKey))];
    for (const key of named) expect(titles.epithets[key as keyof typeof titles.epithets], key).toBeTruthy();
    expect(Object.keys(titles.epithets).sort()).toEqual([...named].sort());
    expect(new Set(Object.values(titles.epithets)).size).toBe(Object.keys(titles.epithets).length);
  });

  it('titles a duo from their epithets in speaking order, or with a title of their own', () => {
    expect(duoTitle(byKey('Brock'), byKey('Misty'))).toBe('The Rock & the Mermaid');
    expect(duoTitle(byKey('Tate'), byKey('Liza'))).toBe('The Mystic Combination');
    expect(duoTitle(byKey('Liza'), byKey('Tate'))).toBe('The Mystic Combination');
    expect(playerDuoTitle('Marques', byKey('Misty'))).toBe('Marques & the Mermaid');
    expect(trainerEpithet(byKey('Lillie'))).toBe('Brave Girl');
  });

  it('only titles pairs that can be drawn (pair lines, Tate and Liza, Izzy with Colress or Cheren), and no two duos share a title', () => {
    const pairs: [Trainer, Trainer][] = Object.values(TRAINER_PAIR_QUOTES).map(e => Object.keys(e).map(byKey) as [Trainer, Trainer]);
    pairs.push([byKey('Tate'), byKey('Liza')], [byKey('Colress'), byKey('Izzy')], [byKey('Cheren'), byKey('Izzy')]);
    const known = new Set(pairs.map(([a, b]) => [trainerKey(a), trainerKey(b)].sort().join('|')));
    for (const label of Object.keys(titles.titles)) expect(known.has(label.split(' & ').sort().join('|')), label).toBe(true);
    const all = pairs.map(([a, b]) => duoTitle(a, b));
    expect(new Set(all).size).toBe(all.length);
    // Every duo a tournament draws has a title.
    for (let i = 0; i < 20; i++) {
      for (const duo of drawDuos(`titles-${i}`, byKey('Sina').id, 31)) expect(duoTitle(TRAINERS[duo[0].trainerId], TRAINERS[duo[1].trainerId])).toMatch(/\S/);
    }
  });
});
