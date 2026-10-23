import { describe, expect, it } from 'vitest';
import { Battle, Dex, Teams, TeamValidator, type PokemonSet as SimSet } from '@pkmn/sim';
import { BRACKETS, SETS, TRAINER_QUOTES, TRAINERS } from '../data/battle-tree';
import { paradoxKindOfItem } from '../data/custom/paradox';
import { pickTeamSets, treeSetToPokemonSet } from '../run/opponent';
import { Rng } from '../run/rng';
import { planOpponent, scheduleSlot } from '../run/selection';
import { trainerSpriteId } from '../ui/sprites';
import { FORMAT_IDS, IGNORED_VALIDATOR_PROBLEMS, NO_PREVIEW_FORMAT_IDS, registerBattleTreeFormats } from './format';

registerBattleTreeFormats();
const validator = new TeamValidator(Dex.formats.get(FORMAT_IDS.singles));
const WREN = TRAINERS.find(t => t.name === 'Wren')!;
const roster = () => WREN.roster.map(id => SETS[id]);
const isParadox = (id: number) => !!paradoxKindOfItem(SETS[id].item);
const BENCH: SimSet[] = [
  { name: '', species: 'Chansey', item: 'Eviolite', ability: 'Natural Cure', moves: ['Soft-Boiled'], nature: 'Bold', gender: 'F', evs: {} as never, ivs: {} as never, level: 50 },
  { name: '', species: 'Blissey', item: 'Shed Shell', ability: 'Natural Cure', moves: ['Soft-Boiled'], nature: 'Bold', gender: 'F', evs: {} as never, ivs: {} as never, level: 50 },
];

describe('Veteran Wren (custom regular trainer)', () => {
  it('is a female Veteran with the X and Y sprite, IV 31, and nine sets, every one legal', () => {
    expect([WREN.kind, WREN.class, WREN.classGender, WREN.iv, trainerSpriteId(WREN)]).toEqual(['regular', 'Veteran', 'F', 31, 'veteranf-gen6']);
    expect(roster().map(s => s.species)).toEqual([
      'Articuno-Galar', 'Articuno-Galar', 'Zapdos-Galar', 'Zapdos-Galar', 'Moltres-Galar', 'Moltres-Galar', 'Entei', 'Raikou', 'Suicune',
    ]);
    expect(roster().filter(s => s.species === 'Entei' || s.species === 'Raikou' || s.species === 'Suicune').every(s => s.item === 'Paradoxorb-A')).toBe(true);
    const problems: string[] = [];
    for (const id of WREN.roster) {
      const set = treeSetToPokemonSet(SETS[id], 31, new Rng('x')) as unknown as SimSet;
      const found = (validator.validateTeam([set, ...BENCH]) ?? []).filter(p => !IGNORED_VALIDATOR_PROBLEMS.some(r => r.test(p)));
      if (found.length) problems.push(`${SETS[id].label}: ${found.join(' | ')}`);
    }
    expect(problems).toEqual([]);
  });

  it('has three sets of lines', () => {
    expect(TRAINER_QUOTES.Wren).toHaveLength(3);
  });

  it('joins the regular pool from battle 100 of Super Singles, Doubles and Multi, at the same chance as everyone in it', () => {
    const late = BRACKETS.pools['b100+'].trainerIds;
    expect(late).toEqual([...BRACKETS.pools['b51+'].trainerIds, WREN.id]);
    expect(BRACKETS.pools['b51+'].trainerIds).not.toContain(WREN.id);
    for (const format of ['singles', 'doubles', 'multi'] as const) {
      expect(scheduleSlot(format, 'super', 99)).toEqual({ type: 'pool', poolKey: 'b51+' });
      expect(scheduleSlot(format, 'super', 101)).toEqual({ type: 'pool', poolKey: 'b100+' });
      expect(scheduleSlot(format, 'super', 110)).toEqual({ type: 'special' });
      expect(scheduleSlot(format, 'super', 100).type).toBe('boss');
    }
    // Drawn uniformly: about 1 in 101 battles from 101 on, never before 100.
    let seen = 0;
    for (let i = 0; i < 4000; i++) {
      if (planOpponent(`wren-${i}`, 'singles', 'super', 101 + (i % 9)).trainerId === WREN.id) seen++;
      expect(planOpponent(`early-${i}`, 'singles', 'super', 51 + (i % 9)).trainerId).not.toBe(WREN.id);
    }
    expect(seen / 4000).toBeGreaterThan(0.004);
    expect(seen / 4000).toBeLessThan(0.02);
  });

  it('brings at most one Paradox Pokémon (all three hold Paradoxorb-A: Item Clause)', () => {
    let withParadox = 0;
    for (const [format, size] of [['singles', 3], ['doubles', 4], ['multi', 2]] as const) {
      for (let i = 0; i < 400; i++) {
        const team = pickTeamSets(WREN, size, new Rng(`${format}-${i}`)).map(s => s.id);
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
    const entei = SETS[WREN.roster.find(id => SETS[id].species === 'Entei')!];
    const b = new Battle({ formatid: NO_PREVIEW_FORMAT_IDS.singles as never, seed: '1,2,3,4' });
    b.setPlayer('p1', { name: 'A', team: Teams.pack([BENCH[0]]) });
    b.setPlayer('p2', { name: 'Wren', team: Teams.pack([treeSetToPokemonSet(entei, 31, new Rng('x')) as unknown as SimSet]) });
    expect(b.p2.active[0].species.name).toBe('Gouging Fire');
  });
});
