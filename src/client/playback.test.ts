import { describe, expect, it } from 'vitest';
import { Battle as ClientBattle } from '@pkmn/client';
import { Generations } from '@pkmn/data';
import { Dex } from '@pkmn/dex';
import { Protocol } from '@pkmn/protocol';
import { Battle, Teams, type ID } from '@pkmn/sim';
import { absorbedByAbility, displayOrder, planLine, type BattleAnimation } from './playback';

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
    expect(plan('|move|p1a: Agumon|Gaia Force|p2a: Snorlax')[0].animation?.durationMs).toBe(1500);
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

  it('flies a stolen Berry over to the Bug Bite / Pluck user, who eats it', () => {
    expect(plan('|-enditem|p1a: Snorlax|Sitrus Berry|[from] stealeat|[move] Bug Bite|[of] p2a: Scizor'))
      .toMatchObject({ kind: 'berry', side: 'p2', target: 'p1', label: 'Sitrus Berry' });
  });

  it('leaves other used-up items as text', () => {
    expect(plan('|-enditem|p1a: Snorlax|Occa Berry|[weaken]')?.kind).not.toBe('berry');
    expect(plan('|-enditem|p1a: Snorlax|Air Balloon')?.kind).not.toBe('berry');
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

  it('shows the Focus Sash and Focus Band letting the Pokémon hang on', () => {
    expect(plan('|-enditem|p2a: Alakazam|Focus Sash')).toMatchObject({ kind: 'sash', side: 'p2', condition: 'focussash' });
    expect(plan('|-activate|p1a: Machamp|item: Focus Band')).toMatchObject({ kind: 'sash', side: 'p1', condition: 'focusband' });
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
    // Will-O-Wisp on a Fire type fails, but not because of the type chart: no immunity animation.
    const fire = immune('Gengar', 'Will-O-Wisp', 'Arcanine', 'Intimidate');
    expect(fire.some(s => s.kind === 'immune')).toBe(false);
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
