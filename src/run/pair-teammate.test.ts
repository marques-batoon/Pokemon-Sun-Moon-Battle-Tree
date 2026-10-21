import { describe, expect, it } from 'vitest';
import { multiPartners, pairedTrainer, pairGreeting, pairGreetingPartners, samePerson, speaksFirst, trainerGender, trainerKey, TRAINER_PAIR_QUOTES, TRAINERS } from '../data/battle-tree';
import { memoryStore } from '../storage/kv';
import { RunStore } from './run-store';
import { planChosenOpponent } from './selection';
import { drawDuos } from './tournament';
import { PAIR_TEAMMATE_CHANCE, planOpponent, scheduleSlot, specialPool } from './selection';

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
  it('pick a teammate the first opponent has pair greetings with 30% of the time (else an ordinary draw)', () => {
    expect(PAIR_TEAMMATE_CHANCE).toBe(0.3);
    const expected = expectedRate(PAIR_TEAMMATE_CHANCE);
    expect(expected).toBeGreaterThan(expectedRate(0) + 0.1);
    const n = 8000;
    let hits = 0;
    for (let i = 0; i < n; i++) {
      const o = planOpponent(`pair-teammate-${i}`, 'multi', 'super', battle);
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

describe('Courtney teams up only with female trainers', () => {
  it('in Super Multi and All Star Multi, and in the Duo Tournament draw', () => {
    const teammates: string[] = [];
    for (let i = 0; i < 1500; i++) {
      for (const [course, n] of [['super', battle], ['allstar', 1]] as const) {
        const next = planOpponent(`courtney-${i}`, 'multi', course, n);
        const ids = [next.trainerId, next.second!.trainerId];
        const c = ids.findIndex(id => trainerKey(TRAINERS[id]) === 'Courtney');
        if (c >= 0) teammates.push(trainerKey(TRAINERS[ids[1 - c]]));
      }
    }
    for (let i = 0; i < 40; i++) {
      for (const [a, b] of drawDuos(`courtney-cup-${i}`)) {
        const names = [a, b].map(p => trainerKey(TRAINERS[p.trainerId]));
        const c = names.indexOf('Courtney');
        if (c >= 0) teammates.push(names[1 - c]);
      }
    }
    expect(teammates.length).toBeGreaterThan(20);
    for (const name of teammates) expect(trainerGender(TRAINERS.find(t => trainerKey(t) === name)!), name).toBe('F');
  });

  it('knows every special trainer\'s gender', () => {
    for (const { trainer } of specialPool()) expect(trainerGender(trainer), trainerKey(trainer)).not.toBeNull();
  });
});

describe('opponents with lines together are lined up so the lines read in order', () => {
  const byKey = (name: string) => TRAINERS.find(t => trainerKey(t) === name && t.kind !== 'regular')!;

  it('the one who speaks first in their lines stands first (left), whoever was drawn first', () => {
    let together = 0;
    for (let i = 0; i < 2500; i++) {
      for (const [course, n] of [['super', battle], ['allstar', 1 + (i % 9)]] as const) {
        const next = planOpponent(`order-${i}`, 'multi', course, n);
        const [a, b] = [TRAINERS[next.trainerId], TRAINERS[next.second!.trainerId]];
        expect(speaksFirst(a, b), `${trainerKey(a)} & ${trainerKey(b)}`).toBe(true);
        const entry = Object.values(TRAINER_PAIR_QUOTES).find(e => trainerKey(a) in e && trainerKey(b) in e);
        if (entry) { together++; expect(Object.keys(entry)[0]).toBe(trainerKey(a)); }
      }
    }
    expect(together).toBeGreaterThan(200);
    for (let i = 0; i < 20; i++) {
      for (const [a, b] of drawDuos(`order-cup-${i}`)) expect(speaksFirst(TRAINERS[a.trainerId], TRAINERS[b.trainerId])).toBe(true);
    }
  });

  it('whichever order they are chosen in (Volkner before Elesa, as their lines are written; Tate before Liza)', () => {
    const order = (x: string, y: string) => { const o = planChosenOpponent('chosen', 'multi', 10, [byKey(x).id, byKey(y).id]); return [o.trainerId, o.second!.trainerId].map(id => trainerKey(TRAINERS[id])); };
    expect(order('Elesa', 'Volkner')).toEqual(['Volkner', 'Elesa']);
    expect(order('Volkner', 'Elesa')).toEqual(['Volkner', 'Elesa']);
    expect(order('Liza', 'Tate')).toEqual(['Tate', 'Liza']);
    // No lines together: as chosen.
    expect(order('Kahili', 'Brock')).toEqual(['Kahili', 'Brock']);
  });

  it('lines up a challenge saved before (its next battle)', () => {
    const kv = memoryStore();
    const next = planChosenOpponent('saved', 'multi', 10, [byKey('Volkner').id, byKey('Elesa').id]);
    const { battle: b, seedText, second, ...first } = next;
    const swapped = { battle: b, seedText, ...second!, second: first };
    kv.set('tree.v1', JSON.stringify({ version: 1, profile: {}, runs: { 'multi-super': { format: 'multi', course: 'super', settings: {}, history: [], next: swapped } } }));
    const loaded = new RunStore(kv).getState().runs['multi-super']!.next;
    expect([loaded.trainerId, loaded.second!.trainerId].map(id => trainerKey(TRAINERS[id]))).toEqual(['Volkner', 'Elesa']);
    expect(loaded.team).toEqual(next.team);
  });
});
