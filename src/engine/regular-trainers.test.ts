import { describe, expect, it } from 'vitest';
import { Battle, Dex, Teams, TeamValidator, type PokemonSet as SimSet } from '@pkmn/sim';
import { BRACKETS, SETS, TRAINER_QUOTES, TRAINERS } from '../data/battle-tree';
import { PARADOX_FORMS, paradoxFormForSet, paradoxKindOfItem } from '../data/custom/paradox';
import { canField, pickTeamSets, treeSetToPokemonSet } from '../run/opponent';
import { Rng } from '../run/rng';
import { chooseTrainer, planOpponent, poolWeight, scheduleSlot } from '../run/selection';
import { trainerSpriteId } from '../ui/sprites';
import { FORMAT_IDS, IGNORED_VALIDATOR_PROBLEMS, NO_PREVIEW_FORMAT_IDS, registerBattleTreeFormats } from './format';

registerBattleTreeFormats();
const validator = new TeamValidator(Dex.formats.get(FORMAT_IDS.singles));
const MILDRED = TRAINERS.find(t => t.name === 'Mildred')!;
const PARADOX_TRAINERS = TRAINERS.filter(t => t.alwaysOneOf?.length);
/** Every custom regular trainer (from battle 100). */
const LATE = TRAINERS.filter(t => t.kind === 'regular' && t.custom);
/** The Ace Trainers and Beauties. */
const GLAM = LATE.filter(t => t.class === 'Ace Trainer' && !t.alwaysOneOf || t.class === 'Beauty');
const roster = () => MILDRED.roster.map(id => SETS[id]);
const isParadox = (id: number) => !!paradoxKindOfItem(SETS[id].item);
const BENCH: SimSet[] = [
  { name: '', species: 'Chansey', item: 'Eviolite', ability: 'Natural Cure', moves: ['Soft-Boiled'], nature: 'Bold', gender: 'F', evs: {} as never, ivs: {} as never, level: 50 },
  { name: '', species: 'Blissey', item: 'Shed Shell', ability: 'Natural Cure', moves: ['Soft-Boiled'], nature: 'Bold', gender: 'F', evs: {} as never, ivs: {} as never, level: 50 },
  { name: '', species: 'Audino', item: 'Bright Powder', ability: 'Healer', moves: ['Pound'], nature: 'Bold', gender: 'F', evs: {} as never, ivs: {} as never, level: 50 },
];

describe('Veteran Mildred (custom regular trainer)', () => {
  it('is a female Veteran with the X and Y sprite, IV 31, and nine sets, every one legal', () => {
    expect([MILDRED.kind, MILDRED.class, MILDRED.classGender, MILDRED.iv, trainerSpriteId(MILDRED)]).toEqual(['regular', 'Veteran', 'F', 31, 'veteranf-gen6']);
    expect(roster().map(s => s.species)).toEqual([
      'Articuno-Galar', 'Articuno-Galar', 'Zapdos-Galar', 'Zapdos-Galar', 'Moltres-Galar', 'Moltres-Galar', 'Entei', 'Raikou', 'Suicune',
    ]);
    expect(roster().filter(s => s.species === 'Entei' || s.species === 'Raikou' || s.species === 'Suicune').every(s => s.item === 'Paradoxorb-A')).toBe(true);
    const problems: string[] = [];
    for (const id of MILDRED.roster) {
      const set = treeSetToPokemonSet(SETS[id], 31, new Rng('x')) as unknown as SimSet;
      const found = (validator.validateTeam([set, ...BENCH.filter(b => b.species !== set.species && b.item !== set.item).slice(0, 2)]) ?? []).filter(p => !IGNORED_VALIDATOR_PROBLEMS.some(r => r.test(p)));
      if (found.length) problems.push(`${SETS[id].label}: ${found.join(' | ')}`);
    }
    expect(problems).toEqual([]);
  });

  it('has three sets of lines', () => {
    expect(TRAINER_QUOTES.Mildred).toHaveLength(3);
  });

  it('joins the regular pool from battle 100 of Super Singles, Doubles and Multi', () => {
    const late = BRACKETS.pools['b100+'].trainerIds;
    expect(late).toEqual([...BRACKETS.pools['b51+'].trainerIds, MILDRED.id, ...PARADOX_TRAINERS.map(t => t.id), ...GLAM.map(t => t.id)]);
    expect(BRACKETS.pools['b51+'].trainerIds).not.toContain(MILDRED.id);
    for (const format of ['singles', 'doubles', 'multi'] as const) {
      expect(scheduleSlot(format, 'super', 99)).toEqual({ type: 'pool', poolKey: 'b51+' });
      expect(scheduleSlot(format, 'super', 101)).toEqual({ type: 'pool', poolKey: 'b100+' });
      expect(scheduleSlot(format, 'super', 110)).toEqual({ type: 'special' });
      expect(scheduleSlot(format, 'super', 100).type).toBe('boss');
    }
    // About 1.1 in 133 battles from 101 on, never before 100.
    let seen = 0;
    for (let i = 0; i < 4000; i++) {
      if (planOpponent(`wren-${i}`, 'singles', 'super', 101 + (i % 9)).trainerId === MILDRED.id) seen++;
      expect(planOpponent(`early-${i}`, 'singles', 'super', 51 + (i % 9)).trainerId).not.toBe(MILDRED.id);
    }
    expect(seen / 4000).toBeGreaterThan(0.003);
    expect(seen / 4000).toBeLessThan(0.018);
  });

  it('comes up 1.1 times as often as each of the game\'s trainers there from battle 100, and 1.5 times from battle 200, as every custom trainer there does', () => {
    const customs = LATE;
    expect(customs).toHaveLength(30);
    for (const t of customs) {
      expect([poolWeight(t.id, 99), poolWeight(t.id, 101), poolWeight(t.id, 199), poolWeight(t.id, 201), poolWeight(t.id, 999)], t.name).toEqual([1, 1.1, 1.1, 1.5, 1.5]);
    }
    const customIds = new Set(customs.map(t => t.id));
    const late = BRACKETS.pools['b100+'].trainerIds;
    const ratioAt = (battle: number) => {
      const n = 200_000;
      const rng = new Rng(`late-pool-weights-${battle}`);
      const counts = new Map<number, number>();
      for (let i = 0; i < n; i++) {
        const { trainer } = chooseTrainer('singles', 'super', battle, rng);
        counts.set(trainer.id, (counts.get(trainer.id) ?? 0) + 1);
      }
      const mean = (ids: number[]) => ids.reduce((s, id) => s + (counts.get(id) ?? 0), 0) / ids.length;
      return mean(late.filter(id => customIds.has(id))) / mean(late.filter(id => !customIds.has(id)));
    };
    const at101 = ratioAt(101);
    expect(at101).toBeGreaterThan(1.06);
    expect(at101).toBeLessThan(1.14);
    const at201 = ratioAt(201);
    expect(at201).toBeGreaterThan(1.45);
    expect(at201).toBeLessThan(1.55);
    // Before battle 100 nothing changes: the game's pools stay uniform.
    expect(BRACKETS.pools['b51+'].trainerIds.every(id => poolWeight(id, 150) === 1)).toBe(true);
  }, 60000);

  it('brings at most one Paradox Pokémon (all three hold Paradoxorb-A: Item Clause)', () => {
    let withParadox = 0;
    for (const [format, size] of [['singles', 3], ['doubles', 4], ['multi', 2]] as const) {
      for (let i = 0; i < 400; i++) {
        const team = pickTeamSets(MILDRED, size, new Rng(`${format}-${i}`)).map(s => s.id);
        const paradox = team.filter(isParadox).length;
        expect(paradox, `${format} ${i}`).toBeLessThanOrEqual(1);
        if (paradox) withParadox++;
        // Never two of the same bird (Species Clause).
        expect(new Set(team.map(id => SETS[id].species)).size).toBe(size);
      }
    }
    expect(withParadox).toBeGreaterThan(0);
  });

  it('Paradox Evolves her beasts in battle (Entei into Gouging Fire)', () => {
    const entei = SETS[MILDRED.roster.find(id => SETS[id].species === 'Entei')!];
    const b = new Battle({ formatid: NO_PREVIEW_FORMAT_IDS.singles as never, seed: '1,2,3,4' });
    b.setPlayer('p1', { name: 'A', team: Teams.pack([BENCH[0]]) });
    b.setPlayer('p2', { name: 'Mildred', team: Teams.pack([treeSetToPokemonSet(entei, 31, new Rng('x')) as unknown as SimSet]) });
    expect(b.p2.active[0].species.name).toBe('Gouging Fire');
  });
});

describe('the Paradox trainers (custom regular trainers)', () => {
  const formOf = (id: number) => paradoxFormForSet(SETS[id].species, SETS[id].item);

  it('are 17, one for each Paradox Pokémon but the legendary beasts\' forms, from battle 100, each with two sets of it and six others', () => {
    expect(PARADOX_TRAINERS).toHaveLength(17);
    const forms = PARADOX_TRAINERS.map(t => formOf(t.alwaysOneOf![0]));
    const expected = PARADOX_FORMS.map(f => f.form).filter(f => !['Walking Wake', 'Gouging Fire', 'Raging Bolt'].includes(f));
    expect([...forms].sort()).toEqual([...expected].sort());
    for (const t of PARADOX_TRAINERS) {
      expect(t.kind === 'regular' && t.fromBattle, t.name).toBe(100);
      expect(t.iv).toBe(31);
      expect(t.roster).toHaveLength(8);
      expect(t.alwaysOneOf!.map(formOf), t.name).toEqual([formOf(t.alwaysOneOf![0]), formOf(t.alwaysOneOf![0])]);
      const others = t.roster.filter(id => !t.alwaysOneOf!.includes(id));
      expect(others, t.name).toHaveLength(6);
      // The six others: no Paradox Pokémon, no Mega Stones, different items (Item Clause never blocks them).
      expect(others.some(id => paradoxKindOfItem(SETS[id].item)), t.name).toBe(false);
      expect(others.some(id => /ite( [XYZ])?$/.test(SETS[id].item) && SETS[id].item !== 'Eviolite'), t.name).toBe(false);
      expect(new Set(others.map(id => SETS[id].item)).size, t.name).toBe(6);
      expect(TRAINER_QUOTES[t.name], t.name).toHaveLength(3);
    }
  });

  it('use girl Ace Trainer sprites for three (X and Y for Regina, ORAS style for Gwendolyn and Sylvie), and a different Gen 6 class sprite each for the rest', () => {
    const sprites = PARADOX_TRAINERS.map(t => trainerSpriteId(t)!);
    const ace = PARADOX_TRAINERS.filter(t => t.class === 'Ace Trainer').map(t => [t.name, trainerSpriteId(t)]);
    expect(ace).toEqual([['Gwendolyn', 'acetrainerf-gen6'], ['Sylvie', 'acetrainerf-gen6'], ['Regina', 'acetrainerf-gen6xy']]);
    const rest = sprites.filter(s => !s.startsWith('acetrainerf-'));
    expect(rest).toHaveLength(14);
    expect(new Set(rest).size).toBe(14);
    for (const s of rest) expect(s).toMatch(/^[a-z]+-gen6$/);
  });

  it('every set is legal', () => {
    const problems: string[] = [];
    for (const t of PARADOX_TRAINERS) for (const id of t.roster) {
      const set = treeSetToPokemonSet(SETS[id], 31, new Rng('x')) as unknown as SimSet;
      const bench = BENCH.filter(b => b.species !== set.species && b.item !== set.item).slice(0, 2);
      const found = (validator.validateTeam([set, ...bench]) ?? []).filter(p => !IGNORED_VALIDATOR_PROBLEMS.some(r => r.test(p)));
      if (found.length) problems.push(`${t.name} / ${SETS[id].label}: ${found.join(' | ')}`);
    }
    expect(problems).toEqual([]);
  });

  it('always bring exactly one of their Paradox sets, in any place in the team, in every format', () => {
    for (const t of PARADOX_TRAINERS) {
      for (const [format, size] of [['singles', 3], ['doubles', 4], ['multi', 2]] as const) {
        expect(canField(t, size), `${t.name} ${format}`).toBe(true);
        const places = new Set<number>();
        for (let i = 0; i < 120; i++) {
          const team = pickTeamSets(t, size, new Rng(`${t.name}-${format}-${i}`)).map(s => s.id);
          expect(team.filter(id => t.alwaysOneOf!.includes(id)), `${t.name} ${format} ${i}`).toHaveLength(1);
          expect(new Set(team.map(id => SETS[id].item)).size).toBe(size);
          places.add(team.findIndex(id => t.alwaysOneOf!.includes(id)));
        }
        expect(places.size, `${t.name} ${format}`).toBe(size);
      }
    }
  });
});

describe('the Ace Trainers and Beauties (custom regular trainers)', () => {
  it('are 5 Ace Trainers and 7 Beauties with the Gen 6 sprites asked for, from battle 100 at the battle-100 weights', () => {
    expect(GLAM).toHaveLength(12);
    const sprites = (cls: string) => GLAM.filter(t => t.class === cls).map(t => trainerSpriteId(t));
    expect(sprites('Ace Trainer').sort()).toEqual(['acetrainerf-gen6', 'acetrainerf-gen6', 'acetrainerf-gen6xy', 'acetrainerf-gen6xy', 'acetrainerf-gen6xy']);
    expect(sprites('Beauty').sort()).toEqual(['beauty-gen6', 'beauty-gen6', 'beauty-gen6', 'beauty-gen6xy', 'beauty-gen6xy', 'beauty-gen6xy', 'beauty-gen6xy']);
    for (const t of GLAM) {
      expect([t.classGender, t.iv, t.kind === 'regular' && t.fromBattle, t.roster.length, TRAINER_QUOTES[t.name].length], t.name).toEqual(['F', 31, 100, 8, 3]);
      expect(t.kind === 'regular' && t.poolWeights).toEqual([{ fromBattle: 100, weight: 1.1 }, { fromBattle: 200, weight: 1.5 }]);
      // Eight different items, so any team they bring can be drawn under Item Clause.
      expect(new Set(t.roster.map(id => SETS[id].item)).size, t.name).toBe(8);
    }
  });

  it('every set is legal', () => {
    const problems: string[] = [];
    for (const t of GLAM) for (const id of t.roster) {
      const set = treeSetToPokemonSet(SETS[id], 31, new Rng('x')) as unknown as SimSet;
      const bench = BENCH.filter(b => b.species !== set.species && b.item !== set.item).slice(0, 2);
      const found = (validator.validateTeam([set, ...bench]) ?? []).filter(p => !IGNORED_VALIDATOR_PROBLEMS.some(r => r.test(p)));
      if (found.length) problems.push(`${t.name} / ${SETS[id].label}: ${found.join(' | ')}`);
    }
    expect(problems).toEqual([]);
  });

  it('come up in battles from 101 on, never before', () => {
    const ids = new Set(GLAM.map(t => t.id));
    let seen = 0;
    for (let i = 0; i < 3000; i++) {
      if (ids.has(planOpponent(`glam-${i}`, 'singles', 'super', 101 + (i % 9)).trainerId)) seen++;
      expect(ids.has(planOpponent(`glam-early-${i}`, 'singles', 'super', 51 + (i % 9)).trainerId)).toBe(false);
    }
    // 12 of them at 1.1 against 100 at 1 and 18 others at 1.1: about 10%.
    expect(seen / 3000).toBeGreaterThan(0.07);
    expect(seen / 3000).toBeLessThan(0.13);
  });
});
