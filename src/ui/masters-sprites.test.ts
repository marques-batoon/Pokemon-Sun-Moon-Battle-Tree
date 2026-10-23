import { describe, expect, it } from 'vitest';
import { TRAINERS, trainerKey, type Trainer } from '../data/battle-tree';
import spriteData from '../data/battle-tree/trainer-sprites.json';
import { mastersSpriteIds, opponentSpriteIds, trainerSpriteUrl } from './sprites';

const byKey = (key: string, kind = 'special') => TRAINERS.find(t => trainerKey(t) === key && t.kind === kind)!;
const N = 6000;

describe('Pokémon Masters sprites', () => {
  it('are known for the special trainers Showdown has them for (several outfits for some) and Red and Blue, not for Rika the Digimon Tamer', () => {
    expect(mastersSpriteIds(byKey('Candice'))).toEqual(['candice-masters']);
    expect(mastersSpriteIds(byKey('Cynthia'))).toHaveLength(5);
    expect(mastersSpriteIds(byKey('Rika'))).toEqual([]);
    expect(mastersSpriteIds(byKey('Red', 'legend'))).toEqual(['red-masters', 'red-masters2', 'red-masters3', 'red-masters4']);
    expect(mastersSpriteIds(byKey('Blue', 'legend'))).toEqual(['blue-masters', 'blue-masters2']);
    // Other Battle Legends (Tai, Marques...) have none.
    expect(mastersSpriteIds(byKey('Tai', 'legend'))).toEqual([]);
    expect(mastersSpriteIds(TRAINERS.find(t => t.kind === 'regular')!)).toEqual([]);
  });

  it('are bundled with the app (public/trainers/masters/), so they load without Showdown', () => {
    expect(trainerSpriteUrl(byKey('Candice'), 'candice-masters')).toBe('/trainers/masters/candice-masters.png');
    const bundled = new Set(Object.keys(import.meta.glob('../../public/trainers/masters/*.png')).map(p => p.split('/').pop()));
    for (const id of Object.values(spriteData.masters).flat()) expect(bundled.has(`${id}.png`), id).toBe(true);
  });

  it('show 30% of the time, each outfit equally likely, the same every time for one battle', () => {
    const candice = byKey('Candice');
    const shown = Array.from({ length: N }, (_, i) => opponentSpriteIds([candice], `run|battle-${i}`)[0]).filter(Boolean).length;
    expect(shown / N).toBeGreaterThan(0.27);
    expect(shown / N).toBeLessThan(0.33);
    const outfits = new Map<string, number>();
    for (let i = 0; i < N; i++) {
      const id = opponentSpriteIds([byKey('Cynthia')], `run|battle-${i}`)[0];
      if (id) outfits.set(id, (outfits.get(id) ?? 0) + 1);
    }
    expect([...outfits.keys()].sort()).toEqual([...mastersSpriteIds(byKey('Cynthia'))].sort());
    const total = [...outfits.values()].reduce((a, b) => a + b, 0);
    for (const n of outfits.values()) expect(n / total).toBeGreaterThan(0.15);
    expect(opponentSpriteIds([candice], 'seed|battle-7')).toEqual(opponentSpriteIds([candice], 'seed|battle-7'));
    // No key (online, before the host has picked the lines): their usual sprites.
    expect(opponentSpriteIds([candice], null)).toEqual([null]);
  });

  it('in a Multi Battle: when one opponent shows theirs, both do (if both have one)', () => {
    const pair: Trainer[] = [byKey('Tate'), byKey('Liza')];
    let both = 0;
    for (let i = 0; i < N; i++) {
      const ids = opponentSpriteIds(pair, `multi|battle-${i}`);
      expect(ids.filter(Boolean).length, `battle ${i}`).not.toBe(1);
      if (ids[0]) both++;
    }
    // Either of two 30% rolls: about 51%.
    expect(both / N).toBeGreaterThan(0.47);
    expect(both / N).toBeLessThan(0.55);
    // Red alone (Singles): any of his four outfits.
    const red = byKey('Red', 'legend');
    expect(new Set(Array.from({ length: N }, (_, i) => opponentSpriteIds([red], `s|${i}`)[0]).filter(Boolean)).size).toBe(4);
    // With someone who has none (Anabel), it's just the one.
    const mixed = Array.from({ length: 200 }, (_, i) => opponentSpriteIds([byKey('Candice'), byKey('Anabel')], `m|${i}`));
    expect(mixed.some(([c]) => c)).toBe(true);
    expect(mixed.every(([, a]) => a === null)).toBe(true);
  });

  it('dresses Red and Blue together in matching outfits (Sygna Suits, or Champion outfits), or neither', () => {
    const [red, blue] = [byKey('Red', 'legend'), byKey('Blue', 'legend')];
    const seen = new Map<string, number>();
    for (let i = 0; i < N; i++) {
      for (const pair of [[red, blue], [blue, red]]) {
        const ids = opponentSpriteIds(pair, `legends|battle-${i}`);
        const key = pair[0] === red ? ids.join('+') : [...ids].reverse().join('+');
        expect(['+', 'red-masters+blue-masters', 'red-masters3+blue-masters2'], `battle ${i}`).toContain(key);
        if (pair[0] === red) seen.set(key, (seen.get(key) ?? 0) + 1);
      }
    }
    expect([...seen.keys()].sort()).toEqual(['+', 'red-masters+blue-masters', 'red-masters3+blue-masters2']);
    // Either one's 30% roll: about 51% of battles, the two outfits about equally.
    expect(1 - seen.get('+')! / N).toBeGreaterThan(0.47);
    expect(1 - seen.get('+')! / N).toBeLessThan(0.55);
    expect(seen.get('red-masters+blue-masters')! / seen.get('red-masters3+blue-masters2')!).toBeGreaterThan(0.8);
    expect(seen.get('red-masters+blue-masters')! / seen.get('red-masters3+blue-masters2')!).toBeLessThan(1.25);
  });
});
