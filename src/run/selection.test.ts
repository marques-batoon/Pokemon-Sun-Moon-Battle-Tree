import { describe, expect, it } from 'vitest';
import { BRACKETS, SETS, TRAINERS, type Course, type Trainer } from '../data/battle-tree';
import { gen7 } from '../team/dex';
import { pickTeamSets, rollAbility } from './opponent';
import { Rng } from './rng';
import { bpForWin, chooseTrainer, courseSchedule, planOpponent, scheduleSlot, specialPool, teamSizeFor } from './selection';
import { DEFAULT_SETTINGS, type RunSettings } from './types';

const SETTINGS: RunSettings = DEFAULT_SETTINGS;

/** Chi-square critical value at p = 0.001 (Wilson-Hilferty approximation). */
function chiSquareCritical(df: number): number {
  const z = 3.09;
  return df * (1 - 2 / (9 * df) + z * Math.sqrt(2 / (9 * df))) ** 3;
}

function chiSquare(counts: Map<number, number>, expected: Map<number, number>): number {
  let stat = 0;
  for (const [k, e] of expected) stat += ((counts.get(k) ?? 0) - e) ** 2 / e;
  return stat;
}

function drawTrainers(course: Course, battle: number, settings: RunSettings, n: number, seed: string) {
  const rng = new Rng(seed);
  const counts = new Map<number, number>();
  for (let i = 0; i < n; i++) {
    const { trainer } = chooseTrainer('singles', course, battle, settings, rng);
    counts.set(trainer.id, (counts.get(trainer.id) ?? 0) + 1);
  }
  return counts;
}

describe('schedule', () => {
  it('follows the documented Normal course: 1-10, 11-19, Red at 20, then stops', () => {
    expect(scheduleSlot('singles', 'normal', 1)).toEqual({ type: 'pool', poolKey: 'b01-10' });
    expect(scheduleSlot('singles', 'normal', 10)).toEqual({ type: 'pool', poolKey: 'b01-10' });
    expect(scheduleSlot('singles', 'normal', 11)).toEqual({ type: 'pool', poolKey: 'b11-19' });
    expect(scheduleSlot('singles', 'normal', 20)).toEqual({ type: 'boss', bossKey: 'red-normal' });
    expect(() => scheduleSlot('singles', 'normal', 21)).toThrow();
  });

  it('follows the documented Super course: specials every 10th, the Battle Legends at 50 (and, an app change, every 50 after), 51+ forever', () => {
    const expected: [number, string][] = [
      [1, 'b01-10'], [9, 'b01-10'], [11, 'b11-19'], [21, 'b21-29'], [31, 'b31-39'], [41, 'b41-49'], [49, 'b41-49'], [51, 'b51+'], [999, 'b51+'],
    ];
    for (const [n, pool] of expected) expect(scheduleSlot('singles', 'super', n), `battle ${n}`).toEqual({ type: 'pool', poolKey: pool });
    for (const n of [10, 20, 30, 40, 60, 70, 90, 110, 140, 160]) expect(scheduleSlot('singles', 'super', n).type, `battle ${n}`).toBe('special');
    for (const n of [50, 100, 150, 500]) expect(scheduleSlot('singles', 'super', n), `battle ${n}`).toEqual({ type: 'boss', bossKey: 'red-super' });
    expect(scheduleSlot('doubles', 'super', 100)).toEqual({ type: 'boss', bossKey: 'blue-super' });
    expect(scheduleSlot('multi', 'super', 150)).toEqual({ type: 'boss', bossKey: 'redblue-super' });
    // Normal courses are unchanged.
    expect(scheduleSlot('singles', 'normal', 20)).toEqual({ type: 'boss', bossKey: 'red-normal' });
  });

  it('runs All Star Mode: special trainers every battle, the battle-50 draw every 5th, endless', () => {
    for (const format of ['singles', 'doubles', 'multi'] as const) {
      expect(courseSchedule(format, 'allstar').length).toBeNull();
      for (const n of [1, 2, 3, 4, 6, 9, 11, 49, 51, 99]) expect(scheduleSlot(format, 'allstar', n).type, `${format} ${n}`).toBe('special');
      const boss = scheduleSlot(format, 'super', 50);
      for (const n of [5, 10, 15, 50, 100, 105]) expect(scheduleSlot(format, 'allstar', n), `${format} ${n}`).toEqual(boss);
    }
  });

  it('uses pool sizes matching DATA_NOTES (50 / 40 / 40 / 40 / 40 / 100)', () => {
    const sizes = Object.fromEntries(Object.entries(BRACKETS.pools).map(([k, p]) => [k, p.trainerIds.length]));
    expect(sizes).toEqual({ 'b01-10': 50, 'b11-19': 40, 'b21-29': 40, 'b31-39': 40, 'b41-49': 40, 'b51+': 100 });
  });
});

describe('trainer selection (Monte Carlo vs documented odds)', () => {
  const brackets: [Course, number, string][] = [
    ['normal', 5, 'b01-10'], ['normal', 15, 'b11-19'],
    ['super', 5, 'b01-10'], ['super', 15, 'b11-19'], ['super', 25, 'b21-29'],
    ['super', 35, 'b31-39'], ['super', 45, 'b41-49'], ['super', 77, 'b51+'],
  ];

  it.each(brackets)('%s battle %i draws uniformly from pool %s', (course, battle, poolKey) => {
    const pool = BRACKETS.pools[poolKey].trainerIds;
    const n = pool.length * 1000;
    const counts = drawTrainers(course, battle, SETTINGS, n, `mc-${course}-${battle}`);
    expect([...counts.keys()].sort((a, b) => a - b)).toEqual(pool);
    const expected = new Map(pool.map(id => [id, n / pool.length]));
    expect(chiSquare(counts, expected)).toBeLessThan(chiSquareCritical(pool.length - 1));
  });

  it('special trainers from both versions: shared trainers weight 7 (Anabel 1), each version exclusive 3.5; Gym Leaders 7', () => {
    const pool = specialPool();
    expect(pool).toHaveLength(11 + 47);
    const weightOf = (name: string) => pool.find(p => p.trainer.name === name)!.weight;
    for (const name of ['Grimsley', 'Wally', 'Colress', 'Cynthia', 'Brock', 'Bianca']) expect(weightOf(name), name).toBe(7);
    expect(weightOf('Anabel')).toBe(1);
    for (const name of ['Plumeria', 'Kiawe', 'Sina', 'Guzma', 'Mallow', 'Dexio']) expect(weightOf(name), name).toBe(3.5);
    const total = pool.reduce((s, t) => s + t.weight, 0);
    expect(total).toBe(50 + 47 * 7);

    const n = 100_000;
    const counts = drawTrainers('super', 30, SETTINGS, n, 'special');
    const expected = new Map(pool.map(t => [t.trainer.id, (n * t.weight) / total]));
    expect([...counts.keys()].sort()).toEqual(pool.map(t => t.trainer.id).sort());
    expect(chiSquare(counts, expected)).toBeLessThan(chiSquareCritical(pool.length - 1));
  });

  it('gives Sun- and Moon-exclusive trainers the same chance', () => {
    const n = 200_000;
    const counts = drawTrainers('super', 40, SETTINGS, n, 'exclusives');
    const byVersion = { sun: 0, moon: 0 };
    for (const { trainer } of specialPool()) {
      if (trainer.versions.length === 1) byVersion[trainer.versions[0]] += counts.get(trainer.id) ?? 0;
    }
    // Each side expects 3 × 3.5/50 of the draws; the difference should be within noise.
    const p = 10.5 / specialPool().reduce((s, t) => s + t.weight, 0);
    expect(Math.abs(byVersion.sun - byVersion.moon)).toBeLessThan(4.5 * Math.sqrt(2 * n * p));
  });

  it('never shows Anabel when locked; her share (weight 1) goes to the previous bracket\'s trainers', () => {
    const settings = { ...SETTINGS, anabelUnlocked: false };
    const rng = new Rng('anabel-locked');
    const n = 100_000;
    let replaced = 0;
    const replacements = new Map<number, number>();
    for (let i = 0; i < n; i++) {
      const { trainer, replacedAnabel } = chooseTrainer('singles', 'super', 20, settings, rng);
      expect(trainer.name).not.toBe('Anabel');
      if (replacedAnabel) {
        replaced++;
        replacements.set(trainer.id, (replacements.get(trainer.id) ?? 0) + 1);
      }
    }
    const p = 1 / specialPool().reduce((s, t) => s + t.weight, 0);
    expect(Math.abs(replaced - n * p)).toBeLessThan(4.5 * Math.sqrt(n * p * (1 - p)));
    const pool = BRACKETS.pools['b11-19'].trainerIds;
    for (const id of replacements.keys()) expect(pool).toContain(id);
  });

  it('always picks a Battle Legend at the boss battles (battle 50 of Super: Red or Blue, or rarely Tai or Matt)', () => {
    const rng = new Rng('boss');
    expect(chooseTrainer('singles', 'normal', 20, SETTINGS, rng).trainer.id).toBe(203);
    for (let i = 0; i < 30; i++) {
      const t = chooseTrainer('singles', 'super', 50, SETTINGS, rng).trainer;
      expect(t.kind).toBe('legend');
      expect([190, 191].includes(t.id) || ['Tai', 'Matt'].includes(t.name)).toBe(true);
    }
  });
});

/** Exact probability that each roster set appears, by enumerating the sequential clause-respecting draw. */
function exactInclusion(trainer: Trainer, size: number): Map<number, number> {
  const out = new Map<number, number>();
  const sets = trainer.roster.map(id => SETS[id]);
  const num = (id: number) => gen7.species.get(SETS[id].species)!.num;
  const rec = (picked: number[], p: number) => {
    if (picked.length === size) {
      for (const id of picked) out.set(id, (out.get(id) ?? 0) + p);
      return;
    }
    const candidates = sets.filter(c => !picked.some(id => num(id) === num(c.id) || SETS[id].item === c.item));
    for (const c of candidates) rec([...picked, c.id], p / candidates.length);
  };
  rec([], 1);
  return out;
}

describe('team generation', () => {
  it('always fields a clause-legal team of the right size from the roster', () => {
    const rng = new Rng('teams');
    for (const trainer of TRAINERS) {
      for (let i = 0; i < 60; i++) {
        const size = teamSizeFor(trainer);
        const team = pickTeamSets(trainer, size, rng);
        expect(team).toHaveLength(size);
        expect(new Set(team.map(s => gen7.species.get(s.species)!.num)).size).toBe(size);
        expect(new Set(team.map(s => s.item)).size).toBe(size);
        for (const s of team) expect(trainer.roster).toContain(s.id);
      }
    }
  });

  // Red (Super) has two sets per species; the second trainer is the first small regular roster with repeated items.
  const withItemClash = TRAINERS.find(t => t.kind === 'regular' && new Set(t.roster.map(id => SETS[id].item)).size < t.roster.length && t.roster.length <= 20)!;
  it.each([['Red (Super)', TRAINERS[190]], [`${withItemClash.name} (item clashes)`, withItemClash]])(
    'set frequencies for %s match the exact clause-aware probabilities',
    (_, trainer) => {
      const size = teamSizeFor(trainer);
      const exact = exactInclusion(trainer, size);
      const n = 40_000;
      const rng = new Rng(`inclusion-${trainer.id}`);
      const counts = new Map<number, number>();
      for (let i = 0; i < n; i++) for (const s of pickTeamSets(trainer, size, rng)) counts.set(s.id, (counts.get(s.id) ?? 0) + 1);
      for (const [id, p] of exact) {
        const sd = Math.sqrt(n * p * (1 - p));
        expect(Math.abs((counts.get(id) ?? 0) - n * p), SETS[id].label).toBeLessThan(4.5 * sd + 1);
      }
    },
  );

  it('rolls abilities only from the species\' slots', () => {
    const rng = new Rng('abilities');
    for (const set of SETS.slice(0, 200)) {
      const abilities = Object.values(gen7.species.get(set.species)!.abilities);
      expect(abilities).toContain(rollAbility(set.species, rng));
    }
  });
});

describe('planOpponent', () => {
  it('is deterministic for a run seed and battle, and differs across battles', () => {
    const a = planOpponent('run-x', 'singles', 'super', 12, SETTINGS);
    expect(planOpponent('run-x', 'singles', 'super', 12, SETTINGS)).toEqual(a);
    expect(planOpponent('run-x', 'singles', 'super', 13, SETTINGS)).not.toEqual(a);
  });

  it('applies the trainer\'s IVs at Lv. 50', () => {
    for (const battle of [3, 25, 45, 55]) {
      const plan = planOpponent('ivs', 'singles', 'super', battle, SETTINGS);
      const trainer = TRAINERS[plan.trainerId];
      for (const set of plan.team) {
        expect(set.level).toBe(50);
        expect(new Set(Object.values(set.ivs))).toEqual(new Set([trainer.iv]));
      }
    }
  });
});

describe('Battle Points', () => {
  it('uses the documented per-win values', () => {
    expect([1, 10, 11, 19, 20].map(n => bpForWin('normal', n))).toEqual([1, 1, 2, 2, 20]);
    expect([1, 10, 11, 20, 21, 30, 31, 40, 41, 49, 50, 51, 100, 150, 299, 300].map(n => bpForWin('super', n)))
      .toEqual([2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 50, 7, 50, 50, 7, 50]);
    // All Star Mode earns none.
    expect([1, 5, 50].map(n => bpForWin('allstar', n))).toEqual([0, 0, 0]);
    let normalTotal = 0;
    for (let n = 1; n <= 20; n++) normalTotal += bpForWin('normal', n);
    expect(normalTotal).toBe(10 * 1 + 9 * 2 + 20);
  });
});
