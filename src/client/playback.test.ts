import { describe, expect, it } from 'vitest';
import { Battle as ClientBattle } from '@pkmn/client';
import { Generations } from '@pkmn/data';
import { Dex } from '@pkmn/dex';
import { Protocol } from '@pkmn/protocol';
import { Battle, Teams, type ID } from '@pkmn/sim';
import { ABILITY_MS, absorbedByAbility, displayOrder, ELEVATE_MS, PARADOX_BOOST_MS, planLine, type BattleAnimation } from './playback';

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
    // Elevate floats MegaGargomon like Levitate: its Ability's own animation (lifting off on rocket jets, a little longer), named Elevate.
    ['|-immune|p2a: Terriermon|[from] ability: Elevate', { kind: 'ability', side: 'p2', condition: 'elevate', label: 'Elevate', durationMs: ELEVATE_MS }],
    ['|-immune|p2a: Rotom|[from] ability: Levitate', { kind: 'ability', side: 'p2', condition: 'levitate', durationMs: ABILITY_MS }],
  ] as const)('%s', (line, expected) => {
    expect(plan(line)).toMatchObject(expected);
  });
});

describe('planLine: Z-Moves and signature moves', () => {
  const battle = new ClientBattle(new Generations(Dex));
  const plan = (line: string) => {
    const { args, kwArgs } = Protocol.parseBattleLine(line);
    return planLine(args as readonly string[], kwArgs as Record<string, unknown>, battle, false);
  };

  it("takes a Z-Move's category from the engine's silent hint (Physical without one)", () => {
    expect(plan('|-activate|p1a: Charizard|Z-Move: Special|[silent]')).toEqual([{ animation: null, applyLine: true }]);
    expect(plan('|move|p1a: Charizard|Inferno Overdrive|p2a: Snorlax').map(s => s.animation?.fx?.category)).toEqual(['Special']);
    // The hint only covers the next move line.
    expect(plan('|move|p1a: Charizard|Inferno Overdrive|p2a: Snorlax').map(s => s.animation?.fx?.category)).toEqual(['Physical']);
    expect(plan('|move|p1a: Charizard|Inferno Overdrive|p2a: Snorlax')[0].animation?.durationMs).toBe(2200);
  });

  it('gives Gaia Force and Cocytus Pulse their longer animations', () => {
    // Gaia Force: the sun is raised, pulled back and hurled, and its explosion has time to burn out (2026-10-23).
    expect(plan('|move|p1a: Agumon|Gaia Force|p2a: Snorlax')[0].animation?.durationMs).toBe(2400);
    expect(plan('|move|p1a: Agumon|Dark Gaia Force|p2a: Snorlax')[0].animation?.durationMs).toBe(2400);
    expect(plan('|move|p1a: Gabumon|Cocytus Pulse|p2a: Snorlax')[0].animation?.durationMs).toBe(1300);
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
    expect(steps('|detailschange|p1b: Gabumon|MetalGarurumon, L50, F').map(s => [s.animation?.kind, s.animation?.condition, s.animation?.slot])).toEqual([
      ['warp-start', 'MetalGarurumon', 1], ['warp', 'MetalGarurumon', 1],
    ]);
  });
});

/** As planBattle, with the battle client's look-ahead for moves taken in by an Ability. */
function planWithLookahead(p1Team: string, p2Team: string, turns: [string, string][]): Planned[] {
  const sim = new Battle({ formatid: 'gen7customgame' as ID, seed: '1,2,3,4' });
  sim.setPlayer('p1', { name: 'A', team: Teams.pack(Teams.import(p1Team)) });
  sim.setPlayer('p2', { name: 'B', team: Teams.pack(Teams.import(p2Team)) });
  sim.makeChoices('team 1', 'team 1');
  for (const [a, b] of turns) sim.makeChoices(a, b);
  const lines: string[] = [];
  for (let i = 0; i < sim.log.length; i++) {
    if (sim.log[i].startsWith('|split|')) { i++; continue; }
    lines.push(sim.log[i]);
  }
  const client = new ClientBattle(new Generations(Dex));
  const planned: Planned[] = [];
  lines.forEach((line, i) => {
    const { args, kwArgs } = Protocol.parseBattleLine(line);
    const absorbed = args[0] === 'move' && absorbedByAbility(args as readonly string[], kwArgs as Record<string, unknown>, lines.slice(i + 1), client);
    for (const step of planLine(args as readonly string[], kwArgs as Record<string, unknown>, client, true, { absorbed })) {
      if (step.animation) planned.push(step.animation);
    }
    client.add(args, kwArgs);
  });
  return planned;
}
const set = (species: string, ability: string, moves: string[]) => `${species}\nAbility: ${ability}\nLevel: 50\nEVs: 252 HP / 252 SpA\n${moves.map(m => `- ${m}`).join('\n')}`;

describe('planLine: moves taken in by an Ability (Water Absorb, Volt Absorb...)', () => {
  const moveOf = (planned: Planned[], name: string) => planned.filter(a => a.kind === 'move' && a.moveName === name).pop()!;
  const abilityAnims = (planned: Planned[]) => planned.filter(a => a.kind === 'ability');

  it('Volt Absorb: the move doesn\'t animate; the Ability heals with its own animation, the attack coming from the user', () => {
    const planned = planWithLookahead(set('Pikachu', 'Static', ['Thunderbolt', 'Grass Knot']), set('Lanturn', 'Volt Absorb', ['Splash']), [['move 2', 'move 1'], ['move 1', 'move 1']]);
    expect(moveOf(planned, 'Thunderbolt')).toMatchObject({ still: true });
    expect(moveOf(planned, 'Grass Knot').still).toBe(false);
    const [heal] = abilityAnims(planned);
    expect(heal).toMatchObject({ kind: 'ability', side: 'p2', target: 'p1', condition: 'voltabsorb', label: 'Volt Absorb' });
    expect(heal.hpDelta).toBeGreaterThan(0);
    expect(planned.some(a => a.kind === 'miss')).toBe(false);
  });

  it('Water Absorb at full HP: its animation, not a miss', () => {
    const planned = planWithLookahead(set('Starmie', 'Natural Cure', ['Surf']), set('Vaporeon', 'Water Absorb', ['Splash']), [['move 1', 'move 1']]);
    expect(moveOf(planned, 'Surf').still).toBe(true);
    expect(abilityAnims(planned)).toEqual([expect.objectContaining({ side: 'p2', target: 'p1', condition: 'waterabsorb', label: 'Water Absorb' })]);
    expect(planned.some(a => a.kind === 'miss')).toBe(false);
  });

  it('Motor Drive, Flash Fire and Levitate each get their own', () => {
    const motor = planWithLookahead(set('Pikachu', 'Static', ['Thunderbolt']), set('Electivire', 'Motor Drive', ['Splash']), [['move 1', 'move 1']]);
    expect(moveOf(motor, 'Thunderbolt').still).toBe(true);
    expect(abilityAnims(motor)).toEqual([expect.objectContaining({ condition: 'motordrive', label: 'Motor Drive' })]);
    // The Speed rise follows with its usual animation.
    expect(motor.findIndex(a => a.kind === 'boost')).toBeGreaterThan(motor.findIndex(a => a.kind === 'ability'));
    const fire = planWithLookahead(set('Charizard', 'Blaze', ['Flamethrower']), set('Heatran', 'Flash Fire', ['Splash']), [['move 1', 'move 1']]);
    expect(moveOf(fire, 'Flamethrower').still).toBe(true);
    expect(abilityAnims(fire)).toEqual([expect.objectContaining({ condition: 'flashfire' })]);
    const quake = planWithLookahead(set('Garchomp', 'Rough Skin', ['Earthquake']), set('Gengar', 'Levitate', ['Splash']), [['move 1', 'move 1']]);
    expect(moveOf(quake, 'Earthquake').still).toBe(true);
    expect(abilityAnims(quake)).toEqual([expect.objectContaining({ condition: 'levitate', label: 'Levitate' })]);
  });

  it('gives a type immunity its own animation, not an Ability\'s', () => {
    const ghost = planWithLookahead(set('Snorlax', 'Thick Fat', ['Body Slam']), set('Gengar', 'Levitate', ['Splash']), [['move 1', 'move 1']]);
    expect(moveOf(ghost, 'Body Slam').still).toBe(true);
    expect(ghost.filter(a => a.kind === 'immune')).toEqual([expect.objectContaining({ side: 'p2', target: 'p1', condition: 'normal-ghost' })]);
    expect(ghost.some(a => a.kind === 'miss')).toBe(false);
    expect(abilityAnims(ghost)).toEqual([]);
  });

  it('only stops a single-target move whose own target takes it in', () => {
    const move = ['move', 'p1a: Pikachu', 'Thunderbolt', 'p2a: Lanturn'];
    expect(absorbedByAbility(move, {}, ['|-immune|p2a: Lanturn|[from] ability: Volt Absorb'])).toBe(true);
    expect(absorbedByAbility(move, {}, ['|-heal|p2a: Lanturn|100/100|[from] ability: Volt Absorb|[of] p1a: Pikachu'])).toBe(true);
    expect(absorbedByAbility(move, {}, ['|-damage|p2a: Lanturn|50/100', '|', '|-heal|p2a: Lanturn|100/100|[from] ability: Volt Absorb'])).toBe(false);
    expect(absorbedByAbility(move, { spread: 'p2a,p2b' }, ['|-immune|p2a: Lanturn|[from] ability: Volt Absorb'])).toBe(false);
    expect(absorbedByAbility(move, {}, ['|-heal|p2a: Lanturn|100/100|[from] item: Leftovers'])).toBe(false);
    expect(absorbedByAbility(['move', 'p1a: Pikachu', 'Thunderbolt', 'p2a: Raichu'], {}, ['|-ability|p2a: Raichu|Lightning Rod|boost', '|-boost|p2a: Raichu|spa|1'])).toBe(true);
    expect(absorbedByAbility(['move', 'p1a: Pikachu', 'Thunderbolt', 'p2a: Raichu'], {}, ['|-ability|p2b: Gyarados|Intimidate|boost'])).toBe(false);
  });
});

describe('planLine: Charge', () => {
  const RAICHU = set('Raichu', 'Static', ['Charge', 'Thunderbolt']);
  const SNORLAX = set('Snorlax', 'Thick Fat', ['Splash']);

  it('gives Giga Blaster its bigger animation when its user is charged (Charge, Electromorphosis), and only then', () => {
    const client = new ClientBattle(new Generations(Dex));
    const feed = (line: string) => { const { args, kwArgs } = Protocol.parseBattleLine(line); client.add(args, kwArgs); };
    const planOne = (line: string) => {
      const { args, kwArgs } = Protocol.parseBattleLine(line);
      return planLine(args as readonly string[], kwArgs as Record<string, unknown>, client, true)[0].animation!;
    };
    for (const line of ['|player|p1|A|', '|player|p2|B|', '|gametype|singles', '|gen|7', '|start', '|switch|p1a: Raichu|Raichu, L50|100/100', '|switch|p2a: Snorlax|Snorlax, L50|100/100', '|turn|1']) feed(line);
    const giga = '|move|p1a: Raichu|Giga Blaster|p2a: Snorlax';
    expect(planOne(giga)).toMatchObject({ durationMs: 2400 });
    expect(planOne(giga).fx?.charged).toBeFalsy();
    feed('|-start|p1a: Raichu|Charge|[from] ability: Electromorphosis');
    expect(planOne(giga)).toMatchObject({ durationMs: 2800, fx: { moveId: 'gigablaster', charged: true } });
    // Other Electric moves keep their animation.
    expect(planOne('|move|p1a: Raichu|Thunderbolt|p2a: Snorlax').fx?.charged).toBeFalsy();
  });

  it('charges the user up, and the battle client holds the charge (the lasting glow) until its next move', () => {
    const steps = planBattle(RAICHU, SNORLAX, [['move 1', 'move 1']]);
    expect(steps.filter(s => s.kind === 'charged')).toEqual([expect.objectContaining({ side: 'p1', label: undefined })]);

    const sim = new Battle({ formatid: 'gen7customgame' as ID, seed: '1,2,3,4' });
    sim.setPlayer('p1', { name: 'A', team: Teams.pack(Teams.import(RAICHU)) });
    sim.setPlayer('p2', { name: 'B', team: Teams.pack(Teams.import(SNORLAX)) });
    sim.makeChoices('team 1', 'team 1');
    const client = new ClientBattle(new Generations(Dex));
    const feed = () => {
      for (const line of sim.log.splice(0)) {
        if (line.startsWith('|split|')) continue;
        const { args, kwArgs } = Protocol.parseBattleLine(line);
        client.add(args, kwArgs);
      }
    };
    sim.makeChoices('move 1', 'move 1');
    feed();
    expect('charge' in client.p1.active[0]!.volatiles).toBe(true);
    sim.makeChoices('move 2', 'move 1');
    feed();
    expect('charge' in client.p1.active[0]!.volatiles).toBe(false);
  });

  it('names the Ability when one charges it (Electromorphosis)', () => {
    const client = new ClientBattle(new Generations(Dex));
    const { args, kwArgs } = Protocol.parseBattleLine('|-start|p2a: HerculesKabuterimon|Charge|[from] ability: Electromorphosis');
    expect(planLine(args as readonly string[], kwArgs as Record<string, unknown>, client, true)[0].animation)
      .toMatchObject({ kind: 'charged', side: 'p2', label: 'Electromorphosis' });
  });
});

describe('planLine: Berries', () => {
  const plan = (line: string) => {
    const client = new ClientBattle(new Generations(Dex));
    const { args, kwArgs } = Protocol.parseBattleLine(line);
    return planLine(args as readonly string[], kwArgs as Record<string, unknown>, client, true)[0].animation;
  };

  it('plays a Berry being eaten by its holder, before what it does', () => {
    const steps = planBattle(set('Snorlax', 'Thick Fat', ['Splash']).replace('Snorlax', 'Snorlax @ Lum Berry'), set('Breloom', 'Technician', ['Spore']), [['move 1', 'move 1']]);
    const kinds = steps.map(s => s.kind);
    expect(steps.find(s => s.kind === 'berry')).toMatchObject({ side: 'p1', target: null, label: 'Lum Berry' });
    expect(kinds.indexOf('berry')).toBeLessThan(kinds.indexOf('cure'));
  });

  it('plays a Power Herb between the charge and the attack, and herbs and Weakness Policy before what they do', () => {
    const held = (species: string, item: string, ability: string, moves: string[]) => set(species, ability, moves).replace(species, `${species} @ ${item}`);
    const herb = planBattle(held('Venusaur', 'Power Herb', 'Overgrow', ['Solar Beam']), set('Snorlax', 'Thick Fat', ['Splash']), [['move 1', 'move 1']]);
    const kinds = herb.map(s => s.kind);
    expect(herb.find(s => s.kind === 'item')).toMatchObject({ side: 'p1', label: 'Power Herb' });
    expect(kinds.indexOf('solar-charge')).toBeLessThan(kinds.indexOf('item'));
    expect(herb.findIndex(s => s.kind === 'move' && !s.still)).toBeGreaterThan(kinds.indexOf('item'));
    const white = planBattle(held('Snorlax', 'White Herb', 'Thick Fat', ['Splash']), set('Gyarados', 'Intimidate', ['Splash']), [['move 1', 'move 1']]);
    expect(white.find(s => s.kind === 'item')).toMatchObject({ side: 'p1', label: 'White Herb' });
    expect(white.map(s => s.kind).indexOf('unboost')).toBeLessThan(white.map(s => s.kind).indexOf('item'));
    const policy = planBattle(held('Snorlax', 'Weakness Policy', 'Thick Fat', ['Splash']), set('Machamp', 'No Guard', ['Cross Chop']), [['move 1', 'move 1']]);
    const order = policy.map(s => s.kind);
    expect(policy.find(s => s.kind === 'item')).toMatchObject({ side: 'p1', label: 'Weakness Policy' });
    expect(order.indexOf('hit')).toBeLessThan(order.indexOf('item'));
    expect(order.indexOf('item')).toBeLessThan(order.indexOf('boost'));
  });

  it('flies a stolen Berry over to the Bug Bite / Pluck user, who eats it', () => {
    expect(plan('|-enditem|p1a: Snorlax|Sitrus Berry|[from] stealeat|[move] Bug Bite|[of] p2a: Scizor'))
      .toMatchObject({ kind: 'berry', side: 'p2', target: 'p1', label: 'Sitrus Berry' });
  });

  it('leaves other used-up items as text', () => {
    expect(plan('|-enditem|p1a: Snorlax|Occa Berry|[weaken]')?.kind).not.toBe('berry');
    expect(plan('|-enditem|p1a: Snorlax|Air Balloon')?.kind).not.toBe('berry');
  });
});

describe('planLine: Frisk', () => {
  it('shows each item Frisk finds when its Pokémon comes in', () => {
    const steps = planBattle(set('Gothitelle', 'Frisk', ['Psychic']), set('Snorlax', 'Thick Fat', ['Splash']).replace('Snorlax', 'Snorlax @ Leftovers'), [['move 1', 'move 1']]);
    expect(steps.find(s => s.kind === 'frisk')).toMatchObject({ side: 'p2', target: 'p1', label: 'Leftovers' });
  });
});

describe('planLine: Bonemerang', () => {
  it('throws the bone through the target (first hit), then it comes back and strikes again on its way to the thrower', () => {
    const steps = planBattle(set('Marowak', 'Rock Head', ['Bonemerang']).replace('Marowak', 'Marowak @ Thick Club'), set('Snorlax', 'Thick Fat', ['Splash']), [['move 1', 'move 1']]);
    const from = steps.findIndex(s => s.kind === 'move' && s.moveName === 'Bonemerang');
    const after = steps.slice(from, from + 4);
    expect(after.map(s => s.kind)).toEqual(['move', 'hit', 'move-return', 'hit']);
    expect(after[1].condition).toBeUndefined();
    expect(after[2]).toMatchObject({ side: 'p1', target: 'p2', condition: 'bonemerang' });
    expect(after[3]).toMatchObject({ side: 'p2', target: 'p1', condition: 'bonemerang' });
  });

  it('leaves other multi-hit moves alone', () => {
    const steps = planBattle(set('Cloyster', 'Skill Link', ['Icicle Spear']), set('Snorlax', 'Thick Fat', ['Splash']), [['move 1', 'move 1']]);
    expect(steps.some(s => s.kind === 'move-return')).toBe(false);
    expect(steps.filter(s => s.kind === 'hit').every(s => s.condition === undefined)).toBe(true);
  });
});

describe('planLine: Air Balloon', () => {
  const held = (species: string, item: string, ability: string, moves: string[]) => set(species, ability, moves).replace(species, `${species} @ ${item}`);

  it('a Ground move into an Air Balloon: no move animation, the balloon floats the Pokémon over it; then it pops when hit', () => {
    const steps = planWithLookahead(held('Garchomp', 'Expert Belt', 'Rough Skin', ['Earthquake', 'Dragon Claw']), held('Heatran', 'Air Balloon', 'Flash Fire', ['Splash']), [['move 1', 'move 1'], ['move 2', 'move 1']]);
    expect(steps.find(s => s.kind === 'move' && s.moveName === 'Earthquake')).toMatchObject({ still: true });
    expect(steps.filter(s => s.kind === 'ability')).toEqual([expect.objectContaining({ side: 'p2', target: 'p1', condition: 'airballoon', label: 'Air Balloon' })]);
    expect(steps.some(s => s.kind === 'miss')).toBe(false);
    const kinds = steps.map(s => s.kind);
    expect(steps.find(s => s.kind === 'balloon-pop')).toMatchObject({ side: 'p2' });
    expect(kinds.lastIndexOf('hit')).toBeLessThan(kinds.indexOf('balloon-pop'));
  });

  it('shows the type immunity, not the balloon, for a Pokémon that happens to hold one', () => {
    const steps = planWithLookahead(held('Snorlax', 'Leftovers', 'Thick Fat', ['Return']), held('Gengar', 'Air Balloon', 'Levitate', ['Splash']), [['move 1', 'move 1']]);
    expect(steps.some(s => s.kind === 'ability')).toBe(false);
    expect(steps.find(s => s.kind === 'immune')).toMatchObject({ condition: 'normal-ghost' });
  });
});

describe('planLine: critical hits', () => {
  it('marks the damage of a critical hit (not the rest), after the move', () => {
    const steps = planBattle(set('Absol', 'Super Luck', ['Night Slash']).replace('Absol', 'Absol @ Scope Lens'), set('Snorlax', 'Thick Fat', ['Splash']).replace('Snorlax', 'Snorlax @ Leftovers'), [['move 1', 'move 1']]);
    const kinds = steps.map(s => s.kind);
    const hit = steps.find(s => s.kind === 'hit');
    expect(hit).toMatchObject({ side: 'p2', crit: true });
    expect(kinds.indexOf('move')).toBeLessThan(kinds.indexOf('hit'));
    expect(steps.filter(s => s.crit)).toHaveLength(1);
  });

  it('shows on a Substitute taking it, and is forgotten by the next move', () => {
    const client = new ClientBattle(new Generations(Dex));
    const plan = (line: string) => {
      const { args, kwArgs } = Protocol.parseBattleLine(line);
      return planLine(args as readonly string[], kwArgs as Record<string, unknown>, client, true)[0]?.animation;
    };
    plan('|-crit|p2a: Snorlax');
    expect(plan('|-activate|p2a: Snorlax|Substitute|[damage]')).toMatchObject({ kind: 'sub-hit', crit: true });
    plan('|-crit|p2a: Snorlax');
    plan('|move|p1a: Absol|Night Slash|p2a: Snorlax');
    expect(plan('|-damage|p2a: Snorlax|50/100')?.crit).toBeUndefined();
  });
});

describe('planLine: items that show (Air Balloon coming in, Focus Sash, Focus Band)', () => {
  const plan = (line: string) => {
    const client = new ClientBattle(new Generations(Dex));
    const { args, kwArgs } = Protocol.parseBattleLine(line);
    return planLine(args as readonly string[], kwArgs as Record<string, unknown>, client, true)[0]?.animation;
  };

  it('floats a Pokémon that comes in (or gets) an Air Balloon, but not when an Ability only reveals it', () => {
    expect(plan('|-item|p2a: Heatran|Air Balloon')).toMatchObject({ kind: 'balloon-in', side: 'p2' });
    expect(plan('|-item|p1a: Snorlax|Air Balloon|[from] move: Trick')).toMatchObject({ kind: 'balloon-in', side: 'p1' });
    expect(plan('|-item|p2a: Heatran|Air Balloon|[from] ability: Frisk|[of] p1a: Gothitelle')?.kind).not.toBe('balloon-in');
    expect(plan('|-item|p2a: Heatran|Leftovers|[from] move: Trick')?.kind).not.toBe('balloon-in');
  });

  it('shows the item Frisk finds popping up beside the Pokémon holding it (the Air Balloon too, without floating it)', () => {
    expect(plan('|-item|p2a: Heatran|Leftovers|[from] ability: Frisk|[of] p1a: Gothitelle')).toMatchObject({ kind: 'frisk', side: 'p2', target: 'p1', label: 'Leftovers' });
    expect(plan('|-item|p1b: Snorlax|Air Balloon|[from] ability: Frisk|[of] p2a: Banette')).toMatchObject({ kind: 'frisk', side: 'p1', slot: 1, target: 'p2', label: 'Air Balloon' });
    // Another Ability revealing an item isn't Frisk.
    expect(plan('|-item|p2a: Heatran|Leftovers|[from] ability: Pickpocket|[of] p1a: Weavile')?.kind).not.toBe('frisk');
  });

  it('shows the Focus Sash and Focus Band letting the Pokémon hang on', () => {
    expect(plan('|-enditem|p2a: Alakazam|Focus Sash')).toMatchObject({ kind: 'sash', side: 'p2', condition: 'focussash' });
    expect(plan('|-activate|p1a: Machamp|item: Focus Band')).toMatchObject({ kind: 'sash', side: 'p1', condition: 'focusband' });
  });

  it('shows Sturdy holding the Pokémon on with 1 HP, after the hit', () => {
    expect(plan('|-ability|p2b: Magnezone|Sturdy')).toMatchObject({ kind: 'sturdy', side: 'p2', slot: 1 });
    const lines = ['|move|p1a: Garchomp|Earthquake|p2a: Golem', '|-ability|p2a: Golem|Sturdy', '|-damage|p2a: Golem|1/130'];
    expect(displayOrder(lines)).toEqual([lines[0], lines[2], lines[1]]);
    // Another Ability announced before someone's damage stays put.
    expect(displayOrder(['|-ability|p2a: Golem|Rock Head', '|-damage|p2a: Golem|50/100'])).toEqual(['|-ability|p2a: Golem|Rock Head', '|-damage|p2a: Golem|50/100']);
  });

  it('shows Protosynthesis and Quark Drive heightening a stat, with the stat and the Ability', () => {
    expect(plan('|-start|p2a: Great Tusk|protosynthesisatk')).toMatchObject({ kind: 'paradox-boost', side: 'p2', condition: 'atk', label: 'Protosynthesis', durationMs: PARADOX_BOOST_MS });
    expect(plan('|-start|p1b: Iron Bundle|quarkdrivespe')).toMatchObject({ kind: 'paradox-boost', side: 'p1', slot: 1, condition: 'spe', label: 'Quark Drive' });
    for (const stat of ['def', 'spa', 'spd']) expect(plan(`|-start|p1a: Flutter Mane|protosynthesis${stat}`)).toMatchObject({ kind: 'paradox-boost', condition: stat });
    // The boost wearing off isn't animated.
    expect(plan('|-end|p1a: Flutter Mane|Protosynthesis')?.kind).not.toBe('paradox-boost');
  });

  it('shows other held items being used up (herbs, Weakness Policy, Red Card thrown at the attacker...)', () => {
    expect(plan('|-enditem|p1a: Snorlax|White Herb')).toMatchObject({ kind: 'item', side: 'p1', target: null, label: 'White Herb', condition: 'whiteherb' });
    expect(plan('|-enditem|p2b: Garchomp|Weakness Policy')).toMatchObject({ kind: 'item', side: 'p2', slot: 1, condition: 'weaknesspolicy' });
    expect(plan('|-enditem|p2a: Snorlax|Red Card|[of] p1b: Garchomp')).toMatchObject({ kind: 'item', side: 'p2', target: 'p1', targetSlot: 1, condition: 'redcard' });
    expect(plan('|-enditem|p1a: Snorlax|Normal Gem|[from] gem')).toMatchObject({ kind: 'item', condition: 'normalgem' });
    // Not items a move takes or destroys, Berries (their own animation, or one eaten earlier), nor the Air Balloon.
    for (const line of [
      '|-enditem|p1a: Snorlax|Leftovers|[from] move: Knock Off|[of] p2a: Weavile', '|-enditem|p1a: Snorlax|Choice Scarf|[silent]|[from] move: Trick',
      '|-enditem|p1a: Snorlax|Occa Berry|[weaken]', '|-enditem|p1a: Snorlax|Micle Berry', '|-enditem|p1a: Snorlax|Air Balloon',
    ]) expect(plan(line)?.kind, line).not.toBe('item');
  });

  it('shows the hit first, then the sash (the engine announces the sash just before the damage)', () => {
    const lines = ['|move|p1a: Garchomp|Earthquake|p2a: Alakazam', '|-enditem|p2a: Alakazam|Focus Sash', '|-damage|p2a: Alakazam|1/130', '|-enditem|p1a: Garchomp|Air Balloon'];
    expect(displayOrder(lines)).toEqual([lines[0], lines[2], lines[1], lines[3]]);
    // Not another Pokémon's damage, nor other items.
    expect(displayOrder(['|-enditem|p2a: Alakazam|Focus Sash', '|-damage|p1a: Garchomp|50/100'])).toEqual(['|-enditem|p2a: Alakazam|Focus Sash', '|-damage|p1a: Garchomp|50/100']);
    expect(displayOrder(['|-enditem|p2a: Heatran|Air Balloon', '|-damage|p2a: Heatran|1/130'])).toEqual(['|-enditem|p2a: Heatran|Air Balloon', '|-damage|p2a: Heatran|1/130']);
    const client = new ClientBattle(new Generations(Dex));
    const kinds = displayOrder(lines.slice(1, 3)).flatMap(line => {
      const { args, kwArgs } = Protocol.parseBattleLine(line);
      return planLine(args as readonly string[], kwArgs as Record<string, unknown>, client, true).map(s => s.animation?.kind);
    });
    expect(kinds).toEqual(['hit', 'sash']);
  });
});

describe('planLine: type-chart immunities', () => {
  const immune = (attacker: string, move: string, defender: string, ability = 'Pressure') =>
    planWithLookahead(set(attacker, 'Pressure', [move]), set(defender, ability, ['Splash']), [['move 1', 'move 1']]);
  const pairOf = (steps: Planned[]) => steps.find(s => s.kind === 'immune')?.condition;

  it('names the pair: the move\'s type and the type that blocks it', () => {
    expect(pairOf(immune('Alakazam', 'Psychic', 'Tyranitar', 'Sand Stream'))).toBe('psychic-dark');
    expect(pairOf(immune('Machamp', 'Close Combat', 'Gengar', 'Cursed Body'))).toBe('fighting-ghost');
    expect(pairOf(immune('Gengar', 'Shadow Ball', 'Snorlax', 'Thick Fat'))).toBe('ghost-normal');
    expect(pairOf(immune('Pikachu', 'Thunderbolt', 'Garchomp', 'Rough Skin'))).toBe('electric-ground');
    expect(pairOf(immune('Garchomp', 'Earthquake', 'Skarmory', 'Sturdy'))).toBe('ground-flying');
    expect(pairOf(immune('Nidoking', 'Sludge Bomb', 'Scizor', 'Technician'))).toBe('poison-steel');
    expect(pairOf(immune('Garchomp', 'Dragon Claw', 'Sylveon', 'Pixilate'))).toBe('dragon-fairy');
    // A status move blocked by the type chart too (Thunder Wave on a Ground type).
    expect(pairOf(immune('Jolteon', 'Thunder Wave', 'Garchomp', 'Rough Skin'))).toBe('electric-ground');
  });

  it('skips the move\'s own animation (the immunity\'s shows the attack), but not when nothing blocks it by type', () => {
    const dark = immune('Alakazam', 'Psychic', 'Tyranitar', 'Sand Stream');
    expect(dark.find(s => s.kind === 'move' && s.moveName === 'Psychic')).toMatchObject({ still: true });
    // Splash does nothing, but nothing is immune to it.
    const splash = immune('Magikarp', 'Splash', 'Snorlax', 'Thick Fat');
    expect(splash.some(s => s.kind === 'immune')).toBe(false);
  });

  it('names a type\'s other immunities: what\'s blocked and the type that blocks it', () => {
    expect(pairOf(immune('Venusaur', 'Leech Seed', 'Sceptile', 'Overgrow'))).toBe('leechseed-grass');
    expect(pairOf(immune('Jolteon', 'Thunder Wave', 'Raichu', 'Static'))).toBe('par-electric');
    expect(pairOf(immune('Gengar', 'Will-O-Wisp', 'Arcanine', 'Intimidate'))).toBe('brn-fire');
    expect(pairOf(immune('Gengar', 'Toxic', 'Muk', 'Stench'))).toBe('psn-poison');
    // Toxic on a Steel type is the type chart's (Poison on Steel).
    expect(pairOf(immune('Gengar', 'Toxic', 'Skarmory', 'Sturdy'))).toBe('poison-steel');
    expect(pairOf(immune('Breloom', 'Spore', 'Venusaur', 'Overgrow'))).toBe('powder-grass');
    expect(pairOf(immune('Lapras', 'Sheer Cold', 'Glalie', 'Inner Focus'))).toBe('sheercold-ice');
    expect(pairOf(planWithLookahead(set('Sableye', 'Prankster', ['Thunder Wave']), set('Tyranitar', 'Sand Stream', ['Splash']), [['move 1', 'move 1']]))).toBe('prankster-dark');
    // The move itself doesn't animate: the immunity's does.
    expect(immune('Venusaur', 'Leech Seed', 'Sceptile', 'Overgrow').find(s => s.kind === 'move' && s.moveName === 'Leech Seed')).toMatchObject({ still: true });
  });
});

describe('planLine: Sky Drop', () => {
  it('shows the user taking its target up into the sky', () => {
    const client = new ClientBattle(new Generations(Dex));
    const { args, kwArgs } = Protocol.parseBattleLine('|-prepare|p1a: Aerodactyl|Sky Drop|p2a: Garchomp');
    expect(planLine(args as readonly string[], kwArgs as Record<string, unknown>, client, true)[0].animation)
      .toMatchObject({ kind: 'sky-drop', side: 'p1', target: 'p2' });
    const fly = Protocol.parseBattleLine('|-prepare|p1a: Aerodactyl|Fly');
    expect(planLine(fly.args as readonly string[], fly.kwArgs as Record<string, unknown>, client, true)[0].animation?.kind).not.toBe('sky-drop');
  });
});

describe('planLine: Sky Drop landing', () => {
  it('drops the carried Pokémon from the sky before its damage shows (and the drop line\'s state waits for the hit)', async () => {
    const { trackSemiInvulnerable } = await import('./semi-invulnerable');
    const client = new ClientBattle(new Generations(Dex));
    const planned: ReturnType<typeof planLine>[] = [];
    for (const line of ['|player|p1|A|', '|player|p2|B|', '|gametype|singles', '|gen|7', '|start',
      '|switch|p1a: Aerodactyl|Aerodactyl, L50|100/100', '|switch|p2a: Garchomp|Garchomp, L50|100/100',
      '|move|p1a: Aerodactyl|Sky Drop||[still]', '|-prepare|p1a: Aerodactyl|Sky Drop|p2a: Garchomp',
      '|move|p1a: Aerodactyl|Sky Drop|p2a: Garchomp|[from] lockedmove', '|-damage|p2a: Garchomp|78/100', '|-end|p2a: Garchomp|Sky Drop',
      '|move|p1a: Aerodactyl|Earthquake|p2a: Garchomp', '|-damage|p2a: Garchomp|50/100']) {
      const { args, kwArgs } = Protocol.parseBattleLine(line);
      planned.push(planLine(args as readonly string[], kwArgs as Record<string, unknown>, client, true));
      client.add(args, kwArgs);
      trackSemiInvulnerable(client, args as readonly string[], kwArgs as Record<string, unknown>);
    }
    const drop = planned[10];
    expect(drop.map(s => [s.animation?.kind, s.applyLine])).toEqual([['sky-dropped', false], ['hit', true]]);
    expect(drop[0].animation).toMatchObject({ side: 'p2' });
    // An ordinary hit afterwards is just a hit.
    expect(planned[13].map(s => s.animation?.kind)).toEqual(['hit']);
  });
});

describe('planLine: Solar Beam', () => {
  const run = (p1: string, p2: string, turns: number) => {
    const sim = new Battle({ formatid: 'gen7customgame' as ID, seed: '1,2,3,4' });
    sim.setPlayer('p1', { name: 'A', team: Teams.pack(Teams.import(p1)) });
    sim.setPlayer('p2', { name: 'B', team: Teams.pack(Teams.import(p2)) });
    sim.makeChoices('team 1', 'team 1');
    for (let i = 0; i < turns; i++) sim.makeChoices('default', 'default');
    const client = new ClientBattle(new Generations(Dex));
    const planned: Planned[] = [];
    for (let i = 0; i < sim.log.length; i++) {
      if (sim.log[i].startsWith('|split|')) { i++; continue; }
      const { args, kwArgs } = Protocol.parseBattleLine(sim.log[i]);
      for (const s of planLine(args as readonly string[], kwArgs as Record<string, unknown>, client, true)) if (s.animation) planned.push(s.animation);
      client.add(args, kwArgs);
    }
    return planned.filter(a => a.kind === 'solar-charge' || (a.kind === 'move' && a.moveName === 'Solar Beam'));
  };
  const venusaur = (ability: string) => `Venusaur\nAbility: ${ability}\nLevel: 50\n- Solar Beam`;

  it('absorbs light on the charging turn, then fires on the next', () => {
    expect(run(venusaur('Overgrow'), `Snorlax\nAbility: Thick Fat\nLevel: 50\n- Splash`, 2).map(a => [a.kind, a.still ?? null, a.durationMs])).toEqual([
      ['move', true, 450], ['solar-charge', null, 1000], ['move', false, 1500],
    ]);
  });

  it('fires the same turn in sun (the "-anim" line is animated as the move)', () => {
    const steps = run(venusaur('Chlorophyll'), `Torkoal\nAbility: Drought\nLevel: 50\n- Splash`, 1);
    expect(steps.map(a => [a.kind, a.still ?? null])).toEqual([['move', true], ['solar-charge', null], ['move', false]]);
    expect(steps[2]).toMatchObject({ side: 'p1', target: 'p2', moveType: 'Grass' });
  });
});

describe('planLine: moves over 100 power', () => {
  const plan = (line: string) => {
    const { args, kwArgs } = Protocol.parseBattleLine(line);
    return planLine(args as readonly string[], kwArgs as Record<string, unknown>, new ClientBattle(new Generations(Dex)), true);
  };

  it('plays each for its own length', () => {
    expect(plan('|move|p1a: Snorlax|Hyper Beam|p2a: Mew')[0].animation?.durationMs).toBe(1500);
    expect(plan('|move|p1a: Electrode|Explosion|p2a: Mew|[spread] p2a')[0].animation?.durationMs).toBe(1700);
    expect(plan('|move|p1a: Raikou|Thunder|p2a: Mew')[0].animation?.durationMs).toBe(1100);
    // Under 100 power: the type's attack.
    expect(plan('|move|p1a: Raikou|Thunderbolt|p2a: Mew')[0].animation?.durationMs).toBe(1000);
  });

  it('shows Future Sight landing two turns later, before its damage', () => {
    const turns: [string, string][] = [['move 1', 'move 1'], ['move 1', 'move 1'], ['move 1', 'move 1']];
    const planned = planBattle(`Alakazam\nAbility: Synchronize\nLevel: 50\n- Future Sight`, `Snorlax\nAbility: Thick Fat\nLevel: 100\nEVs: 252 HP / 252 SpD\n- Splash`, turns);
    const landing = planned.findIndex(a => a.kind === 'future-hit');
    expect(landing).toBeGreaterThan(0);
    expect(planned[landing]).toMatchObject({ side: 'p2', condition: 'futuresight', durationMs: 900 });
    expect(planned[landing + 1]).toMatchObject({ kind: 'hit', side: 'p2' });
    expect(plan('|-end|p1a: Mew|move: Doom Desire')[0].animation).toMatchObject({ kind: 'future-hit', side: 'p1', condition: 'doomdesire' });
  });
});

describe('planLine: Matrix Evolution', () => {
  it('plays like a Warp Digivolution, named for Gallantmon', () => {
    const { args, kwArgs } = Protocol.parseBattleLine('|detailschange|p1a: Guilmon|Gallantmon, L50, M');
    const steps = planLine(args as readonly string[], kwArgs as Record<string, unknown>, new ClientBattle(new Generations(Dex)), true);
    expect(steps.map(s => [s.animation?.kind, s.animation?.condition, s.applyLine])).toEqual([['warp-start', 'Gallantmon', false], ['warp', 'Gallantmon', true]]);
  });
});
