import { describe, expect, it } from 'vitest';
import { Battle as ClientBattle } from '@pkmn/client';
import { Generations } from '@pkmn/data';
import { Dex } from '@pkmn/dex';
import { Protocol } from '@pkmn/protocol';
import { Battle, Teams, type ID } from '@pkmn/sim';
import { planLine, type BattleAnimation } from './playback';

type Planned = Omit<BattleAnimation, 'id'>;

/** Runs a short scripted battle and plans every public protocol line, as the battle client does. */
function planBattle(p1Team: string, p2Team: string, turns: [string, string][]): Planned[] {
  const sim = new Battle({ formatid: 'gen7customgame' as ID, seed: '1,2,3,4' });
  sim.setPlayer('p1', { name: 'A', team: Teams.pack(Teams.import(p1Team)) });
  sim.setPlayer('p2', { name: 'B', team: Teams.pack(Teams.import(p2Team)) });
  sim.makeChoices('team 1', 'team 1');
  for (const [a, b] of turns) sim.makeChoices(a, b);

  const client = new ClientBattle(new Generations(Dex));
  const planned: Planned[] = [];
  const lines = sim.log;
  for (let i = 0; i < lines.length; i++) {
    // "|split|" is followed by a private line, then the public one.
    if (lines[i].startsWith('|split|')) { i++; continue; }
    const { args, kwArgs } = Protocol.parseBattleLine(lines[i]);
    for (const step of planLine(args as readonly string[], kwArgs as Record<string, unknown>, client, true)) {
      if (step.animation) planned.push(step.animation);
    }
    client.add(args, kwArgs);
  }
  return planned;
}

const VENUSAUR = `Venusaur
Ability: Overgrow
Level: 50
- Substitute
- Leech Seed
- Reflect
- Giga Drain`;
const NINETALES = `Ninetales-Alola
Ability: Snow Warning
Level: 50
- Aurora Veil
- Quick Attack
- Light Screen
- Moonblast`;

describe('planLine: lasting states', () => {
  const steps = planBattle(VENUSAUR, NINETALES, [
    ['move 1', 'move 1'], // Substitute, Aurora Veil
    ['move 2', 'move 2'], // Leech Seed, Quick Attack (hits the Substitute first)
    ['move 3', 'move 4'], // Reflect, Moonblast
    ['move 4', 'move 3'], // Giga Drain, Light Screen
    ['move 4', 'move 4'], // Giga Drain, Moonblast (until the Substitute breaks)
    ['move 4', 'move 4'],
  ]);
  const kinds = steps.map(s => s.kind);

  it('plays the Substitute doll appearing, taking a hit and breaking', () => {
    expect(steps.find(s => s.kind === 'sub-start')).toMatchObject({ side: 'p1' });
    expect(steps.find(s => s.kind === 'sub-hit')).toMatchObject({ side: 'p1' });
    expect(steps.find(s => s.kind === 'sub-end')).toMatchObject({ side: 'p1' });
    expect(kinds.indexOf('sub-start')).toBeLessThan(kinds.indexOf('sub-hit'));
    expect(kinds.indexOf('sub-hit')).toBeLessThan(kinds.indexOf('sub-end'));
  });

  it('marks the target seeded and drains its HP to the other side at the end of the turn', () => {
    expect(steps.find(s => s.kind === 'seeded')).toMatchObject({ side: 'p2' });
    const leech = steps.find(s => s.kind === 'leech');
    expect(leech).toMatchObject({ side: 'p2', target: 'p1' });
    expect(leech!.hpDelta).toBeLessThan(0);
  });

  it('shows a draining move\'s HP flowing from the target to the user', () => {
    const absorb = steps.find(s => s.kind === 'absorb');
    expect(absorb).toMatchObject({ side: 'p1', target: 'p2' });
  });

  it('puts up lasting screens by condition id, on the right side', () => {
    const screens = steps.filter(s => s.kind === 'side-start').map(s => [s.side, s.condition]);
    expect(screens).toEqual(expect.arrayContaining([['p2', 'auroraveil'], ['p1', 'reflect'], ['p2', 'lightscreen']]));
  });
});

const MEW = `Mew
Ability: Synchronize
Level: 50
- Protect
- Electric Terrain
- Trick Room
- Thunder Wave`;
const GENGAR = `Gengar
Ability: Cursed Body
Level: 50
- Shadow Ball
- Will-O-Wisp
- Confuse Ray
- Hypnosis`;

describe('planLine: field, status and Protect', () => {
  const steps = planBattle(MEW, GENGAR, [
    ['move 1', 'move 1'], // Protect blocks Shadow Ball
    ['move 2', 'move 2'], // Electric Terrain, Will-O-Wisp
    ['move 3', 'move 3'], // Trick Room, Confuse Ray
    ['move 4', 'move 4'], // Thunder Wave (fails: Gengar is already burned), Hypnosis
    ['move 4', 'move 1'],
  ]);
  const find = (kind: string, condition?: string) => steps.find(s => s.kind === kind && (condition === undefined || s.condition === condition));

  it('shows a move bouncing off Protect on the protected side', () => {
    expect(find('blocked')).toMatchObject({ side: 'p1', condition: 'protect' });
  });

  it('starts terrains and rooms by id', () => {
    expect(find('field-start', 'electricterrain')).toBeTruthy();
    expect(find('field-start', 'trickroom')).toMatchObject({ side: 'p1' });
  });

  it('shows status conditions taking hold and their end-of-turn damage', () => {
    expect(find('status', 'brn')).toMatchObject({ side: 'p1' });
    // Synchronize passes the burn back to Gengar.
    expect(find('status', 'brn')).toBeTruthy();
    expect(steps.some(s => s.kind === 'status' && s.side === 'p2' && s.condition === 'brn')).toBe(true);
    expect(find('residual', 'brn')).toBeTruthy();
    expect(steps.some(s => s.kind === 'residual' && s.side === 'p1' && s.condition === 'brn')).toBe(true);
  });

  it('shows confusion taking hold', () => {
    expect(find('confused')).toMatchObject({ side: 'p1' });
  });
});

describe('planLine: single lines', () => {
  const plan = (line: string) => {
    const { args, kwArgs } = Protocol.parseBattleLine(line);
    return planLine(args as readonly string[], kwArgs as Record<string, unknown>, new ClientBattle(new Generations(Dex)), true)[0].animation;
  };

  it.each([
    ['|cant|p2a: Gengar|par', { kind: 'cant', side: 'p2', condition: 'par' }],
    ['|cant|p1a: Mew|slp', { kind: 'cant', side: 'p1', condition: 'slp' }],
    ['|cant|p1a: Mew|frz', { kind: 'cant', side: 'p1', condition: 'frz' }],
    ['|-curestatus|p1a: Mew|slp|[msg]', { kind: 'cure', side: 'p1', condition: 'slp' }],
    ['|-fieldend|move: Trick Room', { kind: 'field-end', condition: 'trickroom' }],
    ['|-fieldstart|move: Psychic Terrain|[from] ability: Psychic Surge|[of] p2a: Tapu Lele', { kind: 'field-start', side: 'p2', condition: 'psychicterrain' }],
    ['|-activate|p1a: Mew|move: Attract|[of] p2a: Gengar', { kind: 'infatuated', side: 'p1' }],
    ['|-damage|p1a: Mew|100/175|[from] confusion', { kind: 'residual', side: 'p1', condition: 'confusion' }],
  ] as const)('%s', (line, expected) => {
    expect(plan(line)).toMatchObject(expected);
  });
});

describe('planLine: Paradox Evolution', () => {
  const steps = (line: string) => {
    const { args, kwArgs } = Protocol.parseBattleLine(line);
    return planLine(args as readonly string[], kwArgs as Record<string, unknown>, new ClientBattle(new Generations(Dex)), false);
  };

  it('charges up, then changes the sprite, with an Ancient or Future look', () => {
    const ancient = steps('|detailschange|p1a: Donphan|Great Tusk, L50');
    expect(ancient.map(s => [s.animation?.kind, s.animation?.condition, s.applyLine])).toEqual([['paradox-start', 'ancient', false], ['paradox', 'ancient', true]]);
    const future = steps('|detailschange|p1b: Gallade|Iron Valiant, L50');
    expect(future.map(s => [s.animation?.kind, s.animation?.condition, s.animation?.slot])).toEqual([['paradox-start', 'future', 1], ['paradox', 'future', 1]]);
    // Mega Evolution keeps its own animation.
    expect(steps('|detailschange|p1a: Salamence|Salamence-Mega, L50, M')[0].animation?.kind).toBe('mega-start');
  });

  it('plays the Warp Digivolution sequence for a Digimon, naming the new form', () => {
    const warp = steps('|detailschange|p2a: Agumon|WarGreymon, L50, M');
    expect(warp.map(s => [s.animation?.kind, s.animation?.condition, s.animation?.side, s.applyLine])).toEqual([
      ['warp-start', 'WarGreymon', 'p2', false], ['warp', 'WarGreymon', 'p2', true],
    ]);
  });
});
