import { describe, expect, it } from 'vitest';
import { Battle, Teams, TeamValidator, Dex } from '@pkmn/sim';
import { RandomAI } from '../ai/random-ai';
import { applyFlatRules, FORMAT_IDS, IGNORED_VALIDATOR_PROBLEMS, registerBattleTreeFormats } from './format';
import { testOpponentTeam, testPlayerTeam } from './fixtures';
import { seedFromString } from './seed';
import { BattleSession } from './session';
import { rollAbility, treeSetByLabel, treeSetToPokemonSet } from '../run/opponent';
import { Rng } from '../run/rng';

registerBattleTreeFormats();
const validator = new TeamValidator(Dex.formats.get(FORMAT_IDS.singles));
const validate = (text: string) =>
  (validator.validateTeam(Teams.import(text)) ?? []).filter(p => !IGNORED_VALIDATOR_PROBLEMS.some(r => r.test(p)));

function runHeadless(seedText: string) {
  const seed = seedFromString(seedText);
  const chunks: string[] = [];
  const session = new BattleSession({
    format: 'singles',
    seed,
    p1: { name: 'Player', team: testPlayerTeam() },
    p2: testOpponentTeam(new Rng(`${seedText}|team`)),
    p1AI: new RandomAI(),
    p2AI: new RandomAI(),
    onP1Output: c => chunks.push(c),
  });
  session.start();
  return session.done.then(result => ({ result, log: chunks.join('\n') }));
}

describe('Battle Tree Singles format', () => {
  it('accepts the hardcoded test team', () => {
    expect(validator.validateTeam(testPlayerTeam())).toBeNull();
  });

  it('enforces Species Clause and Item Clause', () => {
    const problems = validate(`
Chansey @ Eviolite
- Seismic Toss

Chansey @ Leftovers
- Seismic Toss

Blissey @ Eviolite
- Seismic Toss`);
    expect(problems.join('\n')).toMatch(/Species Clause/);
    expect(problems.join('\n')).toMatch(/Item Clause/);
  });

  it('bans restricted/mythical species (all formes) and USUM-only species', () => {
    for (const species of ['Giratina-Origin', 'Mewtwo', 'Marshadow', 'Necrozma-Dusk-Mane', 'Naganadel', 'Lycanroc-Dusk']) {
      const problems = validate(`${species}\n- Protect\n\nChansey\n- Protect\n\nBlissey\n- Protect`);
      expect(problems.join('\n'), species).toMatch(/banned/);
    }
  });

  it('allows Tapus and Ultra Beasts', () => {
    expect(validate(`
Tapu Koko
Ability: Electric Surge
- Protect

Pheromosa
Ability: Beast Boost
- Protect

Chansey
Ability: Natural Cure
- Protect`)).toEqual([]);
  });

  it('requires 3 to 6 registered Pokémon', () => {
    expect(validate('Chansey\n- Protect\n\nBlissey\n- Protect').join()).toMatch(/at least 3/);
  });

  it('lowers Pokémon above Lv. 50 to 50 but leaves lower levels alone', () => {
    const team = testPlayerTeam();
    team[1].level = 30;
    team[2].level = 70;
    const battle = new Battle({ formatid: FORMAT_IDS.singles as never, seed: seedFromString('levels') });
    battle.setPlayer('p1', { name: 'A', team: Teams.pack(applyFlatRules(team)) });
    battle.setPlayer('p2', { name: 'B', team: Teams.pack(applyFlatRules(testPlayerTeam())) });
    expect(battle.p1.pokemon.map(p => p.level)).toEqual([50, 30, 50, 50, 50, 50]);
  });
});

describe('Battle Tree set conversion', () => {
  it('builds a Lv. 50 set with flat IVs and the dumped EVs/moves', () => {
    const set = treeSetToPokemonSet(treeSetByLabel('Garchomp-3'), 23, new Rng('x'));
    expect(set.level).toBe(50);
    expect(Object.values(set.ivs)).toEqual([23, 23, 23, 23, 23, 23]);
    expect(set.species).toBe('Garchomp');
    expect(set.moves).toHaveLength(4);
  });

  it('rolls abilities over [1, 2, H] with empty slots repeating ability 1', () => {
    const prng = new Rng('abilities');
    const counts: Record<string, number> = {};
    // Greninja: Torrent / (none) / Protean -> 2/3 Torrent, 1/3 Protean, never Battle Bond.
    for (let i = 0; i < 30000; i++) {
      const a = rollAbility('Greninja', prng);
      counts[a] = (counts[a] ?? 0) + 1;
    }
    expect(Object.keys(counts).sort()).toEqual(['Protean', 'Torrent']);
    expect(counts.Torrent / 30000).toBeCloseTo(2 / 3, 1);
  });
});

describe('BattleSession', () => {
  it('plays a full random-vs-random battle to completion', async () => {
    const { result, log } = await runHeadless('smoke');
    expect(result.turns).toBeGreaterThan(0);
    expect(log).toMatch(/\|win\||\|tie/);
    expect(log).toContain('|teampreview');
  });

  it('reproduces the same battle from the same seed', async () => {
    const a = await runHeadless('repro-seed');
    const b = await runHeadless('repro-seed');
    // "|t:|" lines are wall-clock timestamps, not part of the battle.
    const noTime = (log: string) => log.replace(/^\|t:\|\d+$/gm, '|t:|');
    expect(noTime(b.log)).toBe(noTime(a.log));
    expect(b.result).toEqual(a.result);
    const c = await runHeadless('another-seed');
    expect(c.log).not.toBe(a.log);
  });

  it('caps the player\'s Lv. 100 Salamence at 50 in battle', async () => {
    const { log } = await runHeadless('smoke');
    // Team Preview lists all six registered Pokémon with their battle level.
    expect(log).toMatch(/\|poke\|p1\|Salamence, L50/);
    expect(log).not.toMatch(/Salamence, L100|\|poke\|p1\|Salamence(, [MF])?\|/);
  });
});

describe('game rule (no Team Preview)', () => {
  it('starts with the brought Pokémon in order and hides the opponent\'s team', async () => {
    const team = testPlayerTeam();
    const brought = [team[3], team[0], team[1]]; // Tapu Lele leads
    const chunks: string[] = [];
    const session = new BattleSession({
      format: 'singles',
      teamPreview: false,
      seed: seedFromString('no-preview'),
      p1: { name: 'Player', team: brought },
      p2: testOpponentTeam(new Rng('no-preview|team')),
      p1AI: new RandomAI(),
      p2AI: new RandomAI(),
      onP1Output: c => chunks.push(c),
    });
    session.start();
    await session.done;
    const log = chunks.join('\n');
    expect(log).not.toContain('|teampreview');
    expect(log).not.toMatch(/\|poke\|p2\|/);
    expect(log).toMatch(/\|switch\|p1a: Tapu Lele\|/);
    expect(log.indexOf('|switch|p1a: Tapu Lele|')).toBeLessThan(log.indexOf('|turn|1'));
  });
});
