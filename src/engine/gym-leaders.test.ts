import { describe, expect, it } from 'vitest';
import { Dex, TeamValidator, type PokemonSet as SimSet } from '@pkmn/sim';
import { HeuristicAI } from '../ai/heuristic/heuristic-ai';
import { SETS, TRAINERS } from '../data/battle-tree';
import { treeSetToPokemonSet } from '../run/opponent';
import { Rng } from '../run/rng';
import { FORMAT_IDS, IGNORED_VALIDATOR_PROBLEMS, registerBattleTreeFormats } from './format';
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
      p1: { name: 'Marques', team: roster(id('Marques'), 'm').slice(0, 6) },
      p2: { name: 'Thomas', team: roster(id('Thomas'), 't').slice(0, 6) },
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

  it('gives Marques and Thomas their added Pokémon (2026-10-23): every set is legal and battles (Doubles)', async () => {
    const legend = (name: string) => TRAINERS.find(t => t.name === name && t.custom && t.kind === 'legend')!;
    const validator = new TeamValidator(Dex.formats.get(FORMAT_IDS.doubles));
    const problems: string[] = [];
    for (const name of ['Marques', 'Thomas']) {
      const t = legend(name);
      const team = roster(t.id, name) as unknown as SimSet[];
      // Item Clause and Species Clause hold over each whole team; checked four at a time (a Doubles team's size).
      for (let i = 0; i < team.length; i += 4) {
        const four = team.slice(i, i + 4).length === 4 ? team.slice(i, i + 4) : team.slice(-4);
        problems.push(...(validator.validateTeam(four) ?? []).filter(p => !IGNORED_VALIDATOR_PROBLEMS.some(r => r.test(p))).map(p => `${name}: ${p}`));
      }
      expect(new Set(t.roster.map(s => SETS[s].item)).size, name).toBe(t.roster.length);
    }
    expect(problems).toEqual([]);
    const byName = (name: string, species: string[]) => roster(legend(name).id, name).filter(s => species.includes(s.species));
    expect(byName('Marques', ['Hitmonchan'])[0]).toMatchObject({ item: 'Hitmonchanium Z', moves: expect.arrayContaining(['Sky Uppercut']) });
    expect(byName('Marques', ['Porygon2'])[0]).toMatchObject({ item: 'Eviolite', moves: expect.arrayContaining(['Toxic', 'Thunderbolt', 'Ice Beam']) });
    expect([byName('Marques', ['Espeon'])[0].ability, byName('Marques', ['Greninja'])[0].ability]).toEqual(['Magic Bounce', 'Protean']);
    for (const [seed, mine, theirs] of [
      ['a', ['Charizard', 'Porygon2', 'Espeon', 'Greninja'], ['Typhlosion', 'Dragonite', 'Meowscarada', 'Heracross']],
      ['b', ['Hitmonchan', 'Venusaur', 'Poliwrath', 'Alakazam'], ['Primarina', 'Umbreon', 'Ampharos', 'Infernape']],
    ] as const) {
      const warnings: string[] = [];
      const session = new BattleSession({
        format: 'doubles',
        teamPreview: false,
        seed: seedFromString(`b50-new-${seed}`),
        p1: { name: 'Marques', team: byName('Marques', [...mine]) },
        p2: { name: 'Thomas', team: byName('Thomas', [...theirs]) },
        p1AI: new HeuristicAI(),
        p2AI: new HeuristicAI(),
        onWarning: w => warnings.push(w),
      });
      session.start();
      const result = await session.done;
      expect(warnings).toEqual([]);
      expect(result.turns).toBeGreaterThan(0);
    }
  }, 60000);

  it('battles Tai vs Matt (Doubles): both lead with their Digimon and Warp Digivolve on turn 1, every set runs', async () => {
    const id = (name: string) => TRAINERS.find(t => t.name === name && t.custom && t.kind === 'legend')!.id;
    for (const [half, seed] of [[0, 'a'], [1, 'b']] as const) {
      // Lead first, then four of the other seven (both halves together use everyone).
      const team = (name: string) => { const all = roster(id(name), `${name}-${seed}`); return [all[0], ...all.slice(1 + half * 3, 5 + half * 3)]; };
      const warnings: string[] = [];
      const session = new BattleSession({
        format: 'doubles',
        teamPreview: false,
        seed: seedFromString(`tai-matt-${seed}`),
        p1: { name: 'Tai', team: team('Tai') },
        p2: { name: 'Matt', team: team('Matt') },
        p1AI: new HeuristicAI(),
        p2AI: new HeuristicAI(),
        onWarning: w => warnings.push(w),
      });
      session.start();
      const result = await session.done;
      const log = session.battle.log.join('\n');
      for (const text of ['Agumon warp-digivolve to...', '|message|WarGreymon!', 'Gabumon warp-digivolve to...', '|message|MetalGarurumon!']) {
        expect(log.indexOf(text), text).toBeGreaterThan(-1);
        expect(log.indexOf(text), text).toBeLessThan(log.indexOf('|turn|2'));
      }
      expect(warnings).toEqual([]);
      expect(result.turns).toBeGreaterThan(0);
    }
  }, 60000);

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
