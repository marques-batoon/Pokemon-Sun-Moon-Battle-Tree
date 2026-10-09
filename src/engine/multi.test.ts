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

/** A Battle Tree trainer's Multi team (2 Pokémon). */
function trainerTeam(trainerId: number, seed: string) {
  const trainer = TRAINERS[trainerId];
  const rng = new Rng(seed);
  return { name: trainer.name, team: pickTeamSets(trainer, 2, rng).map(s => treeSetToPokemonSet(s, trainer.iv, rng)) };
}

function runMulti(seedText: string, ai: () => BattleAI) {
  const warnings: string[] = [];
  const chunks: string[] = [];
  const session = new BattleSession({
    format: 'multi',
    teamPreview: false,
    seed: seedFromString(seedText),
    p1: { name: 'Player', team: testPlayerTeam().slice(0, 2) },
    p2: trainerTeam(190, `${seedText}|red`),
    p2AI: ai(),
    p3: { ...trainerTeam(201, `${seedText}|sina`), ai: ai() },
    p4: { ...trainerTeam(191, `${seedText}|blue`), ai: ai() },
    p1AI: ai(),
    onP1Output: c => chunks.push(c),
    onWarning: w => warnings.push(w),
  });
  session.start();
  return session.done.then(result => ({ result, warnings, log: chunks.join('\n') }));
}

describe('Battle Tree Multi format', () => {
  it('registers 2-6 Pokémon and brings 2', () => {
    const validator = new TeamValidator(Dex.formats.get(FORMAT_IDS.multi));
    const validate = (n: number) => (validator.validateTeam(testPlayerTeam().slice(0, n)) ?? []).filter(p => !IGNORED_VALIDATOR_PROBLEMS.some(r => r.test(p)));
    expect(validate(1).join(' ')).toMatch(/at least 2/);
    expect(validate(2)).toEqual([]);
    expect(validate(6)).toEqual([]);
  });

  it.each([['heuristic', () => new HeuristicAI()], ['random', () => new RandomAI()]] as const)(
    'plays a full 2-vs-2-trainer battle with %s AIs, every choice legal',
    async (_name, ai) => {
      const { result, warnings, log } = await runMulti(`multi-${_name}`, ai);
      expect(warnings).toEqual([]);
      expect(result.winner === 'p1' || result.winner === 'p2').toBe(true);
      expect(log).toMatch(/\|gametype\|multi/);
      // Player (p1a), partner (p3b), and both opposing trainers (p2a, p4b) all fight.
      for (const ident of ['p1a', 'p3b', 'p2a', 'p4b']) expect(log).toMatch(new RegExp(`\\|switch\\|${ident}: `));
    },
  );
});
