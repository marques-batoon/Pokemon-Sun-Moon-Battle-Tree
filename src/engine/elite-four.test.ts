import { describe, expect, it } from 'vitest';
import { Dex, TeamValidator, type PokemonSet as SimSet } from '@pkmn/sim';
import { SETS, TRAINERS } from '../data/battle-tree';
import { treeSetToPokemonSet } from '../run/opponent';
import { Rng } from '../run/rng';
import { planOpponent, scheduleSlot, specialPool } from '../run/selection';
import { DEFAULT_SETTINGS } from '../run/types';
import { FORMAT_IDS, IGNORED_VALIDATOR_PROBLEMS, registerBattleTreeFormats } from './format';

registerBattleTreeFormats();
const validator = new TeamValidator(Dex.formats.get(FORMAT_IDS.singles));
const ELITE = TRAINERS.filter(t => t.kind === 'special' && t.custom && t.weight === 3.5);
/** Two Pokémon to make a full team around the set being checked (never clashing with it). */
const BENCH: SimSet[] = [
  { name: '', species: 'Chansey', item: 'Eviolite', ability: 'Natural Cure', moves: ['Soft-Boiled'], nature: 'Bold', gender: 'F', evs: {} as never, ivs: {} as never, level: 50 },
  { name: '', species: 'Blissey', item: 'Shed Shell', ability: 'Natural Cure', moves: ['Soft-Boiled'], nature: 'Bold', gender: 'F', evs: {} as never, ivs: {} as never, level: 50 },
  { name: '', species: 'Audino', item: 'Bright Powder', ability: 'Healer', moves: ['Pound'], nature: 'Bold', gender: 'F', evs: {} as never, ivs: {} as never, level: 50 },
];

describe('Elite Four and Champions', () => {
  it('are 33 special trainers with eight sets each, every set legal for a player in Sun & Moon', () => {
    expect(ELITE).toHaveLength(33);
    const problems: string[] = [];
    for (const t of ELITE) {
      for (const id of t.roster) {
        const set = treeSetToPokemonSet(SETS[id], 31, new Rng('x')) as unknown as SimSet;
        const bench = BENCH.filter(b => b.species !== set.species && b.item !== set.item).slice(0, 2);
        const found = (validator.validateTeam([set, ...bench]) ?? []).filter(p => !IGNORED_VALIDATOR_PROBLEMS.some(r => r.test(p)));
        if (found.length) problems.push(`${t.name} / ${SETS[id].label}: ${found.join(' | ')}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('are in the special-trainer pool at weight 3.5, so they appear in Super Singles, Doubles and Multi and in All Star Mode', () => {
    const pool = specialPool().filter(p => ELITE.includes(p.trainer));
    expect(pool).toHaveLength(33);
    expect(pool.every(p => p.weight === 3.5)).toBe(true);
    const drawn = new Set<string>();
    /** The first battle of a course drawn from the special-trainer pool. */
    const specialBattle = (format: 'singles' | 'doubles' | 'multi', course: 'super' | 'allstar') =>
      Array.from({ length: 60 }, (_, i) => i + 1).find(n => scheduleSlot(format, course, n).type === 'special')!;
    for (let i = 0; i < 300; i++) {
      for (const [format, course] of [['singles', 'super'], ['doubles', 'super'], ['multi', 'super'], ['singles', 'allstar']] as const) {
        const battle = specialBattle(format, course);
        const o = planOpponent(`e4-${i}`, format, course, battle, DEFAULT_SETTINGS, format === 'multi' ? TRAINERS.find(t => t.name === 'Sina')!.id : undefined);
        for (const id of [o.trainerId, o.second?.trainerId]) if (id !== undefined && ELITE.some(t => t.id === id)) drawn.add(`${format}-${course}`);
      }
    }
    expect([...drawn].sort()).toEqual(['doubles-super', 'multi-super', 'singles-allstar', 'singles-super']);
  });
});
