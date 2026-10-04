import { describe, expect, it } from 'vitest';
import { Dex } from '@pkmn/dex';
import { BOSSES, BRACKETS, RULES, SETS, TRAINERS, type SpecialTrainer, type Trainer } from './index';

const gen7 = Dex.forGen(7);
const byName = (name: string) => TRAINERS.find(t => t.name === name && t.kind !== 'legend') as Trainer;
const labels = (t: Trainer) => t.roster.map(id => SETS[id].label);

/** Largest team a roster can field under Species Clause + Item Clause (capped at `cap`). */
function maxClauseTeam(roster: number[], cap: number): number {
  let best = 0;
  const species = new Set<string>();
  const items = new Set<string>();
  const rec = (start: number, size: number) => {
    best = Math.max(best, size);
    if (best >= cap) return;
    for (let i = start; i < roster.length; i++) {
      const set = SETS[roster[i]];
      const base = gen7.species.get(set.species).baseSpecies;
      if (species.has(base) || items.has(set.item)) continue;
      species.add(base);
      items.add(set.item);
      rec(i + 1, size + 1);
      species.delete(base);
      items.delete(set.item);
    }
  };
  rec(0, 0);
  return best;
}

describe('sets.json', () => {
  it('has the 996 Sun/Moon sets with sequential ids', () => {
    expect(SETS).toHaveLength(996);
    SETS.forEach((s, i) => expect(s.id).toBe(i));
  });

  it('resolves every species, move, item and nature in Gen 7', () => {
    for (const s of SETS) {
      expect(gen7.species.get(s.species).exists, s.label).toBe(true);
      expect(gen7.items.get(s.item).exists, s.label).toBe(true);
      expect(gen7.natures.get(s.nature).exists, s.label).toBe(true);
      expect(s.moves.length, s.label).toBeGreaterThan(0);
      for (const m of s.moves) expect(gen7.moves.get(m).exists, `${s.label} ${m}`).toBe(true);
    }
  });

  it('keeps EVs within 510 total / 252 per stat', () => {
    for (const s of SETS) {
      const evs = Object.values(s.evs);
      expect(evs.reduce((a, b) => a + b, 0), s.label).toBeLessThanOrEqual(510);
      expect(Math.max(...evs), s.label).toBeLessThanOrEqual(252);
    }
  });

  it('uses Sun/Moon v1.1 data, not USUM', () => {
    const get = (label: string) => SETS.find(s => s.label === label)!;
    // USUM changed Lurantis-1's Smooth Rock to Heat Rock (pastebin jt9TQEdP).
    expect(get('Lurantis-1').item).toBe('Smooth Rock');
    // USUM gave Aerodactyl-1 three extra moves.
    expect(get('Aerodactyl-1').moves).toEqual(['Rock Slide']);
    // v1.1 patch (Kaphotics): Kommo-o-4 has Draco Meteor, not Shell Smash.
    expect(get('Kommo-o-4').moves).toContain('Draco Meteor');
  });
});

describe('trainers.json', () => {
  it('has 190 regular, 11 special and 4 legend trainers', () => {
    const count = (k: Trainer['kind']) => TRAINERS.filter(t => t.kind === k).length;
    expect(TRAINERS).toHaveLength(205);
    expect([count('regular'), count('special'), count('legend')]).toEqual([190, 11, 4]);
  });

  it('only references existing sets, without duplicates', () => {
    for (const t of TRAINERS) {
      expect(new Set(t.roster).size, t.name).toBe(t.roster.length);
      for (const id of t.roster) expect(SETS[id], `${t.name} -> ${id}`).toBeDefined();
    }
  });

  it('lets every trainer field a clause-legal team of 3 (and 4 for Doubles)', () => {
    for (const t of TRAINERS) expect(maxClauseTeam(t.roster, 4), t.name).toBe(4);
  });

  it('assigns IVs by trainer tier (19 / 23 / 27 / 31)', () => {
    for (const t of TRAINERS) {
      if (t.kind !== 'regular') expect(t.iv, t.name).toBe(31);
      else if (t.number <= 50) expect(t.iv).toBe(19);
      else if (t.number <= 70) expect(t.iv).toBe(23);
      else if (t.number <= 90) expect(t.iv).toBe(27);
      else expect(t.iv).toBe(31);
    }
  });

  it('gives Colress, Dexio, Kiawe and Sina only the Alolan regional forms (Bulbapedia lists both; 3 other sources agree on Alolan only)', () => {
    expect(labels(byName('Colress')).filter(l => l.includes('Muk'))).toEqual(['Alolan Muk-1', 'Alolan Muk-2']);
    expect(labels(byName('Dexio')).filter(l => l.includes('Ninetales'))).toEqual(['Alolan Ninetales-2']);
    expect(labels(byName('Kiawe')).filter(l => l.includes('Marowak'))).toEqual(['Alolan Marowak-2']);
    expect(labels(byName('Sina')).filter(l => l.includes('Sandslash'))).toEqual(['Alolan Sandslash-2']);
  });

  it('includes Heat Rotom-1 for Kendra (SadisticMystic omitted it; same pool as Rocky per Tree-Sets)', () => {
    expect(labels(byName('Kendra'))).toContain('Heat Rotom-1');
    expect([...byName('Kendra').roster].sort()).toEqual([...byName('Rocky').roster].sort());
  });
});

describe('brackets.json', () => {
  it('pools are contiguous Bulbapedia ranges containing only regular trainers', () => {
    const expected: Record<string, [number, number]> = {
      'b01-10': [1, 50], 'b11-19': [31, 70], 'b21-29': [51, 90],
      'b31-39': [71, 110], 'b41-49': [91, 130], 'b51+': [91, 190],
    };
    for (const [key, [from, to]] of Object.entries(expected)) {
      const nums = BRACKETS.pools[key].trainerIds.map(id => {
        const t = TRAINERS[id];
        expect(t.kind).toBe('regular');
        return t.kind === 'regular' ? t.number : -1;
      });
      expect(nums).toEqual(Array.from({ length: to - from + 1 }, (_, i) => from + i));
    }
  });

  it('special pool has 8 trainers per version with Anabel at 1/7 weight', () => {
    const specials = BRACKETS.specialTrainerPool.trainerIds.map(id => TRAINERS[id] as SpecialTrainer);
    for (const v of ['sun', 'moon'] as const) {
      const pool = specials.filter(t => t.versions.includes(v));
      expect(pool).toHaveLength(8);
      const total = pool.reduce((a, t) => a + t.weight, 0);
      expect(pool.find(t => t.name === 'Anabel')!.weight / total).toBeCloseTo(1 / 50);
    }
    const names = (v: 'sun' | 'moon') => specials.filter(t => t.versions.length === 1 && t.versions[0] === v).map(t => t.name).sort();
    expect(names('sun')).toEqual(['Kiawe', 'Plumeria', 'Sina']);
    expect(names('moon')).toEqual(['Dexio', 'Guzma', 'Mallow']);
  });
});

describe('bosses.json / rules.json', () => {
  it('schedules Red at battle 20 (Normal) and 50 (Super)', () => {
    expect(BOSSES['red-normal']).toMatchObject({ battle: 20, trainerId: 203, bp: 20 });
    expect(BOSSES['red-super']).toMatchObject({ battle: 50, trainerId: 190, bp: 50 });
    expect(TRAINERS[203]).toMatchObject({ name: 'Red', kind: 'legend', course: 'normal' });
    expect(TRAINERS[190]).toMatchObject({ name: 'Red', kind: 'legend', course: 'super' });
  });

  it('BP tables cover every battle exactly once', () => {
    const cover = (course: 'normal' | 'super', upTo: number) => {
      for (let n = 1; n <= upTo; n++) {
        const hits = RULES.battlePoints[course].filter(r => n >= r.battles[0] && (r.battles[1] === null || n <= r.battles[1]));
        expect(hits, `${course} battle ${n}`).toHaveLength(1);
      }
    };
    cover('normal', 20);
    cover('super', 200);
  });

  it('bans only species that exist, and no AI set uses one', () => {
    const banned = new Set(RULES.bannedSpecies.species);
    for (const s of RULES.bannedSpecies.species) expect(gen7.species.get(s).exists, s).toBe(true);
    for (const s of SETS) expect(banned.has(gen7.species.get(s.species).baseSpecies), s.label).toBe(false);
  });
});
