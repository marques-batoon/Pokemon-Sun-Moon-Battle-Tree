import { describe, expect, it } from 'vitest';
import { multiPartners, pairedTrainer, pairGreeting, pairGreetingPartners, samePerson, TRAINERS } from '../data/battle-tree';
import { PAIR_TEAMMATE_CHANCE, planOpponent, scheduleSlot, specialPool } from './selection';
import { DEFAULT_SETTINGS } from './types';

const battle = Array.from({ length: 60 }, (_, i) => i + 1).find(n => scheduleSlot('multi', 'super', n).type === 'special')!;

/** Share of Multi special battles whose two opponents have pair greetings, with the given chance of picking such a teammate. */
function expectedRate(chance: number): number {
  const pool = specialPool();
  const W = pool.reduce((a, p) => a + p.weight, 0);
  let rate = 0;
  for (const f of pool) {
    // Tate and Liza, Izzy and Kaito: their teammate is fixed.
    if (pairedTrainer(f.trainer.id) || multiPartners(f.trainer.id).length) continue;
    const rest = pool.filter(s => !samePerson(s.trainer, f.trainer) && !pairedTrainer(s.trainer.id) && !multiPartners(s.trainer.id).length);
    const friends = new Set(pairGreetingPartners(f.trainer.id));
    const all = rest.reduce((a, s) => a + s.weight, 0);
    const withLines = rest.filter(s => friends.has(s.trainer.id)).reduce((a, s) => a + s.weight, 0);
    const q = withLines / all;
    rate += (f.weight / W) * (withLines > 0 ? chance + (1 - chance) * q : q);
  }
  return rate;
}

describe('Multi Battles: teammates with pair greetings', () => {
  it('pick a teammate the first opponent has pair greetings with 15% of the time (else an ordinary draw)', () => {
    expect(PAIR_TEAMMATE_CHANCE).toBe(0.15);
    const expected = expectedRate(PAIR_TEAMMATE_CHANCE);
    expect(expected).toBeGreaterThan(expectedRate(0) + 0.1);
    const n = 8000;
    let hits = 0;
    for (let i = 0; i < n; i++) {
      const o = planOpponent(`pair-teammate-${i}`, 'multi', 'super', battle, DEFAULT_SETTINGS);
      const [a, b] = [TRAINERS[o.trainerId], TRAINERS[o.second!.trainerId]];
      if (a.kind === 'special' && b.kind === 'special' && pairGreeting(a, b) !== null) {
        hits++;
        // They greet you with their pair lines.
        expect(pairGreeting(b, a)).not.toBeNull();
      }
    }
    expect(Math.abs(hits / n - expected)).toBeLessThan(4.5 * Math.sqrt((expected * (1 - expected)) / n));
  });

  it('knows who each trainer has pair greetings with', () => {
    const named = (name: string) => TRAINERS.find(t => t.kind === 'special' && t.name === name)!.id;
    expect(pairGreetingPartners(named('Brock'))).toContain(named('Misty'));
    expect(pairGreetingPartners(named('Misty'))).toContain(named('Brock'));
  });
});
