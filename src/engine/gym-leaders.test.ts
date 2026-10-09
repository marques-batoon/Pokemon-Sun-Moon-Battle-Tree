import { describe, expect, it } from 'vitest';
import { HeuristicAI } from '../ai/heuristic/heuristic-ai';
import { SETS, TRAINERS } from '../data/battle-tree';
import { treeSetToPokemonSet } from '../run/opponent';
import { Rng } from '../run/rng';
import { registerBattleTreeFormats } from './format';
import { seedFromString } from './seed';
import { BattleSession } from './session';

registerBattleTreeFormats();

/** A Gym Leader's whole roster, in battle-ready sets. */
const roster = (id: number, seed: string) => {
  const t = TRAINERS[id];
  const rng = new Rng(seed);
  return t.roster.map(s => treeSetToPokemonSet(SETS[s], t.iv, rng));
};

describe('Gym Leaders in battle', () => {
  const leaders = TRAINERS.filter(t => t.kind === 'special' && t.custom);

  it('keeps the Abilities and genders from the exports', () => {
    const brock = TRAINERS.find(t => t.name === 'Brock' && t.kind === 'special')!;
    const team = roster(brock.id, 'x');
    expect(team.map(s => s.ability)).toEqual(brock.roster.map(id => SETS[id].ability));
    expect(team.every(s => Object.values(s.ivs).every(iv => iv === 31))).toBe(true);
    const janine = TRAINERS.find(t => t.name === 'Janine')!;
    expect(roster(janine.id, 'x').find(s => s.species === 'Nidoqueen')!.gender).toBe('F');
  });

  it('battles with the battle-50 trainers (Marques vs Thomas), Hidden Power Fire staying Fire at 31 IVs', async () => {
    const id = (name: string) => TRAINERS.find(t => t.name === name && t.custom && t.kind === 'legend')!.id;
    const session = new BattleSession({
      format: 'singles',
      teamPreview: false,
      seed: seedFromString('b50-smoke'),
      p1: { name: 'Marques', team: roster(id('Marques'), 'm') },
      p2: { name: 'Thomas', team: roster(id('Thomas'), 't') },
      p1AI: new HeuristicAI(),
      p2AI: new HeuristicAI(),
    });
    session.start();
    const venusaur = session.battle.p1.pokemon.find(p => p.species.baseSpecies === 'Venusaur')!;
    expect(venusaur.hpType).toBe('Fire');
    expect(Object.values(venusaur.set.ivs).every(iv => iv === 31)).toBe(true);
    const result = await session.done;
    expect(result.turns).toBeGreaterThan(0);
  });

  // Every set's moves, items and Abilities run in the simulator: each leader's first six
  // against their last six (so 8-Pokémon rosters use everyone), heuristic AI on both sides.
  it.each(leaders.map(t => [t.name, t.id] as const))('%s battles without errors', async (_name, id) => {
    const team = roster(id, `smoke-${id}`);
    const warnings: string[] = [];
    const session = new BattleSession({
      format: 'singles',
      teamPreview: false,
      seed: seedFromString(`smoke-${id}`),
      p1: { name: 'A', team: team.slice(0, 6) },
      p2: { name: 'B', team: team.slice(-6) },
      p1AI: new HeuristicAI(),
      p2AI: new HeuristicAI(),
      onWarning: w => warnings.push(w),
    });
    session.start();
    const result = await session.done;
    expect(warnings).toEqual([]);
    expect(result.turns).toBeGreaterThan(0);
  }, 30000);
});
