import { describe, expect, it } from 'vitest';
import { TRAINERS, trainerKey, type Trainer } from '../data/battle-tree';
import { mastersSpriteIds, opponentSpriteIds, trainerSpriteUrl } from './sprites';

const byKey = (key: string, kind = 'special') => TRAINERS.find(t => trainerKey(t) === key && t.kind === kind)!;
const N = 6000;

describe('Pokémon Masters sprites', () => {
  it('are known for the special trainers Showdown has them for (several outfits for some), not for Rika the Digimon Tamer or Battle Legends', () => {
    expect(mastersSpriteIds(byKey('Candice'))).toEqual(['candice-masters']);
    expect(mastersSpriteIds(byKey('Cynthia'))).toHaveLength(5);
    expect(mastersSpriteIds(byKey('Rika'))).toEqual([]);
    expect(mastersSpriteIds(byKey('Red', 'legend'))).toEqual([]);
    expect(mastersSpriteIds(TRAINERS.find(t => t.kind === 'regular')!)).toEqual([]);
    expect(trainerSpriteUrl(byKey('Candice'), 'candice-masters')).toMatch(/trainers\/candice-masters\.png$/);
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
    // With someone who has none (Anabel), it's just the one.
    const mixed = Array.from({ length: 200 }, (_, i) => opponentSpriteIds([byKey('Candice'), byKey('Anabel')], `m|${i}`));
    expect(mixed.some(([c]) => c)).toBe(true);
    expect(mixed.every(([, a]) => a === null)).toBe(true);
  });
});
