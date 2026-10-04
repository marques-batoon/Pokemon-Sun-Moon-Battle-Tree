import { describe, expect, it } from 'vitest';
import { Dex, TeamValidator } from '@pkmn/sim';
import { RandomAI } from '../ai/random-ai';
import { HeuristicAI } from '../ai/heuristic/heuristic-ai';
import type { BattleAI } from '../ai/types';
import { TRAINERS } from '../data/battle-tree';
import { pickTeamSets, treeSetToPokemonSet } from '../run/opponent';
import { Rng } from '../run/rng';
import { FORMAT_IDS, IGNORED_VALIDATOR_PROBLEMS, registerBattleTreeFormats } from './format';
import { testPlayerTeam } from './fixtures';
import { seedFromString } from './seed';
import { BattleSession } from './session';

registerBattleTreeFormats();

/** A Battle Tree trainer's Doubles team (4 Pokémon). */
function trainerTeam(trainerId: number, seed: string) {
  const trainer = TRAINERS[trainerId];
  const rng = new Rng(seed);
  return { name: trainer.name, team: pickTeamSets(trainer, 4, rng).map(s => treeSetToPokemonSet(s, trainer.iv, rng)) };
}

function runDoubles(seedText: string, p1AI: BattleAI, p2AI: BattleAI, teamPreview = true) {
  const warnings: string[] = [];
  const chunks: string[] = [];
  const player = testPlayerTeam();
  const session = new BattleSession({
    format: 'doubles',
    teamPreview,
    seed: seedFromString(seedText),
    p1: { name: 'Player', team: teamPreview ? player : player.slice(0, 4) },
    p2: trainerTeam(204, `${seedText}|blue`), // Battle Legend Blue (Normal)
    p1AI,
    p2AI,
    onP1Output: c => chunks.push(c),
    onWarning: w => warnings.push(w),
  });
  session.start();
  return session.done.then(result => ({ result, warnings, log: chunks.join('\n') }));
}

describe('Battle Tree Doubles format', () => {
  const validator = new TeamValidator(Dex.formats.get(FORMAT_IDS.doubles));
  const validate = (n: number) => (validator.validateTeam(testPlayerTeam().slice(0, n)) ?? []).filter(p => !IGNORED_VALIDATOR_PROBLEMS.some(r => r.test(p)));

  it('needs at least 4 registered Pokémon', () => {
    expect(validate(3).join(' ')).toMatch(/at least 4/);
    expect(validate(4)).toEqual([]);
    expect(validate(6)).toEqual([]);
  });

  it('is a Double Battle where each side brings 4 (Team Preview)', async () => {
    const { result, warnings, log } = await runDoubles('doubles-1', new RandomAI(), new RandomAI());
    expect(warnings).toEqual([]);
    expect(result.winner === 'p1' || result.winner === 'p2').toBe(true);
    expect(log).toMatch(/\|gametype\|doubles/);
    expect(log).toMatch(/\|switch\|p1a: /);
    expect(log).toMatch(/\|switch\|p1b: /);
    expect(log).toMatch(/\|teamsize\|p2\|4/);
  });

  it('plays the game rule (no Team Preview, first two lead)', async () => {
    const { warnings, log } = await runDoubles('doubles-2', new RandomAI(), new RandomAI(), false);
    expect(warnings).toEqual([]);
    const lead = testPlayerTeam().slice(0, 2).map(p => p.species);
    expect(log).toMatch(new RegExp(`\\|switch\\|p1a: ${lead[0]}`));
    expect(log).toMatch(new RegExp(`\\|switch\\|p1b: ${lead[1]}`));
  });

  it.each(['doubles-h1', 'doubles-h2', 'doubles-h3'])('the heuristic AI only makes legal Doubles choices (%s)', async seed => {
    const { result, warnings } = await runDoubles(seed, new RandomAI(), new HeuristicAI());
    expect(warnings).toEqual([]);
    expect(result.turns).toBeGreaterThan(0);
  }, 20000);
});

