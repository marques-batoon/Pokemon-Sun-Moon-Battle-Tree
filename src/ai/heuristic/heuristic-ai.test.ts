import { describe, expect, it } from 'vitest';
import { Battle, PRNG, Teams } from '@pkmn/sim';
import { applyFlatRules, NO_PREVIEW_FORMAT_IDS, registerBattleTreeFormats } from '../../engine/format';
import { seedFromString } from '../../engine/seed';
import { BattleSession } from '../../engine/session';
import type { SimRequest } from '../../engine/sim-types';
import { planOpponent } from '../../run/selection';
import { DEFAULT_SETTINGS } from '../../run/types';
import { RandomAI } from '../random-ai';
import { HeuristicAI } from './heuristic-ai';

registerBattleTreeFormats();

const team = (text: string) => Teams.pack(applyFlatRules(Teams.import(text)!));

/** A live battle (no Team Preview, so it starts immediately) with p1 = player, p2 = AI side. */
function scenario(p1: string, p2: string, setup?: (b: Battle) => void): Battle {
  const battle = new Battle({ formatid: NO_PREVIEW_FORMAT_IDS.singles as never, seed: seedFromString('scenario') });
  battle.setPlayer('p1', { name: 'Player', team: team(p1) });
  battle.setPlayer('p2', { name: 'AI', team: team(p2) });
  setup?.(battle);
  return battle;
}

/** Runs the AI's decision n times with different RNG seeds and counts the choices. */
function decide(battle: Battle, n = 200, ai = new HeuristicAI(), request?: SimRequest) {
  const req = request ?? (battle.p2.activeRequest as unknown as SimRequest);
  const counts: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    const choice = ai.choose({ request: req, battle, side: 'p2', prng: new PRNG(seedFromString(`d${i}`)) });
    counts[choice] = (counts[choice] ?? 0) + 1;
  }
  return counts;
}
const share = (counts: Record<string, number>, choice: string) => (counts[choice] ?? 0) / Object.values(counts).reduce((a, b) => a + b, 0);

const HEATRAN = `Heatran @ Leftovers\nAbility: Flash Fire\nEVs: 252 HP / 252 SpA\nModest Nature\n- Lava Plume\n- Flash Cannon\n- Earth Power\n- Protect`;
const CHANSEY = `Chansey @ Eviolite\nAbility: Natural Cure\nEVs: 252 HP / 252 Def\nBold Nature\n- Seismic Toss\n- Soft-Boiled`;
const GARCHOMP_SCARF = `Garchomp @ Choice Scarf\nAbility: Rough Skin\nEVs: 252 Atk / 252 Spe\nJolly Nature\n- Earthquake\n- Dragon Claw`;

describe('HeuristicAI move choice', () => {
  it('takes a super-effective KO (Earthquake vs Heatran) almost always', () => {
    const b = scenario(HEATRAN, `Garchomp @ Life Orb\nAbility: Rough Skin\nEVs: 252 Atk / 252 Spe\nJolly Nature\n- Earthquake\n- Dragon Claw\n- Fire Fang\n- Swords Dance`);
    expect(share(decide(b), 'move 1')).toBeGreaterThan(0.85);
  });

  it('never uses a move the target is immune to (Earthquake vs Levitate)', () => {
    const b = scenario(`Rotom-Wash @ Leftovers\nAbility: Levitate\nEVs: 252 HP\n- Hydro Pump\n- Volt Switch`, GARCHOMP_SCARF.replace('Choice Scarf', 'Life Orb'));
    expect(decide(b)['move 1'] ?? 0).toBe(0);
  });

  it('paralyzes a healthy foe, but not a Ground type or an already paralyzed one', () => {
    const KLEFKI = `Klefki @ Light Clay\nAbility: Keen Eye\nEVs: 252 HP / 252 SpD\nCalm Nature\n- Thunder Wave\n- Dazzling Gleam`;
    const kartana = `Kartana @ Life Orb\nAbility: Beast Boost\nEVs: 252 Atk / 252 Spe\nJolly Nature\n- Leaf Blade\n- Smart Strike`;
    expect(share(decide(scenario(kartana, KLEFKI)), 'move 1')).toBeGreaterThan(0.6);
    expect(decide(scenario(GARCHOMP_SCARF, KLEFKI))['move 1'] ?? 0).toBe(0);
    expect(decide(scenario(kartana, KLEFKI, b => b.p1.active[0].setStatus('par')))['move 1'] ?? 0).toBe(0);
  });

  it('uses Fake Out on its first turn out, except against a Ghost type', () => {
    const AMBIPOM = `Ambipom @ Silk Scarf\nAbility: Technician\nEVs: 252 Atk / 252 Spe\nJolly Nature\n- Fake Out\n- Return\n- U-turn\n- Knock Off`;
    expect(share(decide(scenario(GARCHOMP_SCARF, AMBIPOM)), 'move 1')).toBeGreaterThan(0.85);
    expect(decide(scenario(`Gengar @ Life Orb\nAbility: Cursed Body\n- Shadow Ball`, AMBIPOM))['move 1'] ?? 0).toBe(0);
  });

  it('sets weather when it is not up and no KO is available, but not when it already is', () => {
    const PELIPPER = `Pelipper @ Damp Rock\nAbility: Keen Eye\nEVs: 252 HP / 252 Def\nBold Nature\n- Rain Dance\n- Scald\n- Hurricane\n- Roost`;
    expect(share(decide(scenario(CHANSEY, PELIPPER)), 'move 1')).toBeGreaterThan(0.6);
    expect(share(decide(scenario(CHANSEY, PELIPPER, b => b.field.setWeather('raindance', b.p2.active[0]))), 'move 1')).toBeLessThan(0.05);
  });

  it('sets up while safe and stops at the breakpoint', () => {
    const GYARADOS = `Gyarados @ Leftovers\nAbility: Intimidate\nEVs: 252 Atk / 252 Spe\nJolly Nature\n- Dragon Dance\n- Waterfall\n- Earthquake\n- Ice Fang`;
    expect(share(decide(scenario(CHANSEY, GYARADOS)), 'move 1')).toBeGreaterThan(0.5);
    const boosted = scenario(CHANSEY, GYARADOS, b => { b.p2.active[0].boosts.atk = 2; b.p2.active[0].boosts.spe = 2; });
    expect(share(decide(boosted), 'move 1')).toBeLessThan(0.1);
  });

  it('phazes a boosted foe that has something to switch into', () => {
    const SKARMORY = `Skarmory @ Leftovers\nAbility: Sturdy\nEVs: 252 HP / 252 Def\nImpish Nature\n- Whirlwind\n- Brave Bird\n- Roost\n- Spikes`;
    const b = scenario(`${CHANSEY}\n\n${HEATRAN}`, SKARMORY, b => { b.p1.active[0].boosts.def = 2; b.p1.active[0].boosts.spd = 2; });
    expect(share(decide(b), 'move 1')).toBeGreaterThan(0.6);
  });

  it('Mega Evolves whenever it can and prefers a plain KO over spending the Z-Move', () => {
    const zard = scenario(CHANSEY, `Charizard @ Charizardite X\nAbility: Blaze\nEVs: 252 Atk / 252 Spe\nJolly Nature\n- Flare Blitz\n- Dragon Claw\n- Dragon Dance\n- Roost`);
    for (const choice of Object.keys(decide(zard))) expect(choice).toMatch(/ mega$/);
    const chompZ = scenario(HEATRAN, `Garchomp @ Groundium Z\nAbility: Rough Skin\nEVs: 252 Atk / 252 Spe\nJolly Nature\n- Earthquake\n- Dragon Claw`);
    const counts = decide(chompZ);
    expect(share(counts, 'move 1')).toBeGreaterThan(0.85);
    expect(counts['move 1 zmove'] ?? 0).toBeLessThan(20);
  });

  it('is not perfectly predictable when no move KOs', () => {
    const b = scenario(CHANSEY, `Tyranitar @ Leftovers\nAbility: Sand Stream\nEVs: 252 Atk / 252 HP\nAdamant Nature\n- Stone Edge\n- Crunch\n- Earthquake\n- Ice Punch`);
    expect(Object.keys(decide(b)).length).toBeGreaterThan(1);
  });
});

describe('HeuristicAI switching', () => {
  // Heatran is outsped and KO'd by Scarf Garchomp's Earthquake; Gyarados is immune and has 4x Ice Fang.
  const GYARADOS = `Gyarados @ Leftovers\nAbility: Intimidate\nEVs: 252 HP / 252 Def\nImpish Nature\n- Waterfall\n- Ice Fang\n- Dragon Dance\n- Bounce`;
  const threatened = () => scenario(GARCHOMP_SCARF, `${HEATRAN}\n\n${GYARADOS}`);

  it('switches to a resist that threatens back when about to be KO\'d (config.switchChance)', () => {
    expect(decide(threatened(), 50, new HeuristicAI({ switchChance: 1 }))).toEqual({ 'switch 2': 50 });
    expect(decide(threatened(), 50, new HeuristicAI({ switchChance: 0 }))['switch 2'] ?? 0).toBe(0);
    const s = share(decide(threatened(), 400), 'switch 2');
    expect(s).toBeGreaterThan(0.25);
    expect(s).toBeLessThan(0.65);
  });

  it('switches out of a Choice lock into a move that does nothing', () => {
    // Turn 1: Scarf Garchomp locks into Earthquake against a Flying-type.
    const b = scenario(
      `Skarmory @ Leftovers\nAbility: Keen Eye\nEVs: 252 HP / 252 Def\nImpish Nature\n- Roost\n- Whirlwind`,
      `${GARCHOMP_SCARF}\n\nMagnezone @ Leftovers\nAbility: Magnet Pull\nEVs: 252 HP / 252 SpA\nModest Nature\n- Thunderbolt\n- Flash Cannon`,
    );
    b.makeChoices('move 1', 'move 1');
    const req = b.p2.activeRequest as unknown as SimRequest & { active: { moves: { disabled?: unknown }[] }[] };
    expect(req.active[0].moves[1].disabled).toBeTruthy();
    expect(decide(b, 50, new HeuristicAI({ lockedSwitchChance: 1 }))).toEqual({ 'switch 2': 50 });
  });

  it('never switches when trapped', () => {
    const b = threatened();
    const req = structuredClone(b.p2.activeRequest) as unknown as SimRequest & { active: { trapped?: boolean }[] };
    req.active[0].trapped = true;
    expect(decide(b, 50, new HeuristicAI({ switchChance: 1 }), req)['switch 2'] ?? 0).toBe(0);
  });

  it('after a faint, sends in the bench Pokémon with the most damage against the foe', () => {
    const b = scenario(HEATRAN, `${CHANSEY}\n\n${CHANSEY.replace('Chansey', 'Blissey')}\n\n${GARCHOMP_SCARF}`);
    const req = { forceSwitch: [true], side: (b.p2.activeRequest as unknown as SimRequest).side } as SimRequest;
    expect(decide(b, 20, new HeuristicAI(), req)).toEqual({ 'switch 3': 20 });
  });
});

describe('HeuristicAI in full Battle Tree battles', () => {
  const runBattle = (seed: string, p1: 'heuristic' | 'random', p2: 'heuristic' | 'random', a: number, bBattle: number) => {
    const warnings: string[] = [];
    const left = planOpponent(`${seed}-l`, 'singles', 'super', a, DEFAULT_SETTINGS);
    const right = planOpponent(`${seed}-r`, 'singles', 'super', bBattle, DEFAULT_SETTINGS);
    const session = new BattleSession({
      format: 'singles',
      teamPreview: false,
      seed: seedFromString(seed),
      p1: { name: 'Left', team: left.team as never },
      p2: { name: 'Right', team: right.team as never },
      p1AI: p1 === 'heuristic' ? new HeuristicAI() : new RandomAI(),
      p2AI: p2 === 'heuristic' ? new HeuristicAI() : new RandomAI(),
      onWarning: w => warnings.push(w),
    });
    session.start();
    return session.done.then(result => ({ result, warnings }));
  };

  it('never makes an invalid choice across many real trainer teams', async () => {
    const battles = [5, 15, 25, 35, 45, 55, 65, 75, 85, 95, 105, 115].map(n => runBattle(`fuzz-${n}`, 'heuristic', 'heuristic', n, n + 1));
    for (const { result, warnings } of await Promise.all(battles)) {
      expect(warnings).toEqual([]);
      expect(result.turns).toBeGreaterThan(0);
    }
  }, 60000);

  it('beats the random AI with the same teams most of the time', async () => {
    const games: Promise<boolean>[] = [];
    for (let i = 0; i < 30; i++) {
      // Same two teams, heuristic on alternating sides.
      const heuristicLeft = i % 2 === 0;
      games.push(runBattle(`vs-${i}`, heuristicLeft ? 'heuristic' : 'random', heuristicLeft ? 'random' : 'heuristic', 55, 55)
        .then(({ result }) => result.winner === (heuristicLeft ? 'p1' : 'p2')));
    }
    const wins = (await Promise.all(games)).filter(Boolean).length;
    expect(wins).toBeGreaterThanOrEqual(20);
  }, 60000);
});

describe('calc bridge', () => {
  it('builds a calc Pokémon for every Battle Tree set and every builder species', async () => {
    const { SETS } = await import('../../data/battle-tree');
    const { eligibleSpecies } = await import('../../team/dex');
    const { calcSpeciesName } = await import('./calc');
    const { Generations } = await import('@smogon/calc');
    const { Dex } = await import('@pkmn/sim');
    const calcGen = Generations.get(7);
    const names = new Set([...SETS.map(s => s.species), ...eligibleSpecies().map(s => s.name)]);
    // Mega formes the AI evaluates when Mega Evolving.
    for (const s of Dex.forGen(7).species.all()) if (s.isMega && s.exists && s.gen <= 7 && !s.isNonstandard) names.add(s.name);
    // Pokémon Champions Megas and Gen 8-9 Pokémon aren't in the calc's Gen 7 data: calcPokemon passes their stats.
    const { CHAMPIONS_MEGAS, NEW_BASE_SPECIES } = await import('../../data/champions');
    const described = new Set([...CHAMPIONS_MEGAS.map(m => m.species), ...NEW_BASE_SPECIES]);
    const missing = [...names].filter(n => {
      const s = Dex.forGen(7).species.get(n);
      const name = calcSpeciesName(s.name, s.baseSpecies, s.baseForme);
      return !described.has(name) && !calcGen.species.get(name.toLowerCase().replace(/[^a-z0-9]/g, '') as never);
    });
    expect(missing).toEqual([]);
  });

  it('estimates real damage against Aegislash (default forme name differs in the calc)', async () => {
    const { calcErrors, estimateDamage } = await import('./calc');
    const before = calcErrors.count;
    const b = scenario(`Aegislash @ Leftovers\nAbility: Stance Change\nEVs: 252 HP\n- King's Shield`, `Snorlax @ Life Orb\nAbility: Thick Fat\nEVs: 252 Atk\nAdamant Nature\n- Earthquake`);
    expect(estimateDamage(b, b.p2.active[0], b.p1.active[0], 'earthquake').frac).toBeGreaterThan(0.2);
    expect(calcErrors.count).toBe(before);
  });

  it('estimates damage for Pokémon Champions Megas and Gen 9 moves from the simulator\'s data', async () => {
    const { calcErrors, estimateDamage } = await import('./calc');
    const before = calcErrors.count;
    const b = scenario(
      `Glimmora @ Glimmoranite\nAbility: Toxic Debris\nEVs: 252 SpA\nModest Nature\n- Mortal Spin\n- Power Gem`,
      `Snorlax @ Leftovers\nAbility: Thick Fat\nEVs: 252 HP\n- Body Slam`,
    );
    const glimmora = b.p1.active[0];
    const snorlax = b.p2.active[0];
    // A Gen 9 move from a Gen 9 Pokémon.
    expect(estimateDamage(b, glimmora, snorlax, 'mortalspin').frac).toBeGreaterThan(0.05);
    // Evaluated as its Mega forme (Champions stats: 150 base Sp. Atk vs 130 for regular Glimmora).
    const base = estimateDamage(b, glimmora, snorlax, 'powergem').frac;
    const mega = estimateDamage(b, glimmora, snorlax, 'powergem', { attackerForme: { species: 'Glimmora-Mega', ability: 'Adaptability' } }).frac;
    expect(mega).toBeGreaterThan(base);
    expect(calcErrors.count).toBe(before);
  });

  it('raises no calc errors during full battles', async () => {
    const { calcErrors } = await import('./calc');
    expect(calcErrors.count, calcErrors.last ?? '').toBe(0);
  });
});

describe('HeuristicAI in Doubles', () => {
  /** A live Double Battle (game rule, no preview): p1 = player, p2 = AI. Each team text has 4 Pokémon, first two lead. */
  function doubles(p1: string, p2: string): Battle {
    const battle = new Battle({ formatid: NO_PREVIEW_FORMAT_IDS.doubles as never, seed: seedFromString('doubles-scenario') });
    battle.setPlayer('p1', { name: 'Player', team: team(p1) });
    battle.setPlayer('p2', { name: 'AI', team: team(p2) });
    return battle;
  }
  const mon = (text: string) => `${text}\nLevel: 50`;
  const BENCH = [mon('Chansey @ Eviolite\nAbility: Natural Cure\n- Soft-Boiled'), mon('Blissey @ Leftovers\nAbility: Natural Cure\n- Soft-Boiled')];
  const sideOf = (...mons: string[]) => [...mons, ...BENCH].join('\n\n');
  const choicesFor = (battle: Battle, n = 200) => {
    const ai = new HeuristicAI();
    const req = battle.p2.activeRequest as unknown as SimRequest;
    const counts: Record<string, number> = {};
    for (let i = 0; i < n; i++) {
      const choice = ai.choose({ request: req, battle, side: 'p2', prng: new PRNG(seedFromString(`dd${i}`)) }).split(', ')[0];
      counts[choice] = (counts[choice] ?? 0) + 1;
    }
    return counts;
  };
  const foes = sideOf(
    mon('Heatran @ Leftovers\nAbility: Flash Fire\nEVs: 4 HP\n- Protect'),
    mon('Snorlax @ Leftovers\nAbility: Thick Fat\nEVs: 252 HP / 252 Def\n- Protect'),
  );

  it('avoids Earthquake when it would knock out its own partner', () => {
    const bulky = sideOf(
      mon('Snorlax @ Leftovers\nAbility: Thick Fat\nEVs: 252 HP / 252 Def\n- Protect'),
      mon('Cresselia @ Leftovers\nAbility: Levitate\nEVs: 252 HP / 252 Def\n- Protect'),
    );
    const battle = doubles(bulky, sideOf(
      mon('Garchomp @ Life Orb\nAbility: Rough Skin\nEVs: 252 Atk\nAdamant Nature\n- Earthquake\n- Rock Slide'),
      mon('Magnezone @ Leftovers\nAbility: Sturdy\nEVs: 4 HP\n- Protect'),
    ));
    const counts = choicesFor(battle);
    expect(counts['move 2'] ?? 0).toBeGreaterThan(counts['move 1'] ?? 0);
  });

  it('uses Earthquake freely when its partner is immune', () => {
    const battle = doubles(foes, sideOf(
      mon('Garchomp @ Life Orb\nAbility: Rough Skin\nEVs: 252 Atk\n- Earthquake\n- Rock Slide'),
      mon('Salamence @ Leftovers\nAbility: Intimidate\nEVs: 4 HP\n- Protect'),
    ));
    const counts = choicesFor(battle);
    expect(counts['move 1'] ?? 0).toBeGreaterThan(counts['move 2'] ?? 0);
  });

  it('aims a single-target move at the foe it can knock out', () => {
    // Earth Power OHKOs the frail Heatran (slot 1), not the bulky Snorlax (slot 2).
    const battle = doubles(foes, sideOf(
      mon('Gengar @ Choice Specs\nAbility: Levitate\nEVs: 252 SpA\nModest Nature\n- Earth Power'),
      mon('Salamence @ Leftovers\nAbility: Intimidate\n- Protect'),
    ));
    const counts = choicesFor(battle);
    expect((counts['move 1 1'] ?? 0) / 200).toBeGreaterThan(0.8);
  });
});

describe('moves that are certain to fail', () => {
  // Rock Slide only chips Great Tusk; Toxic and Thunder Wave fail on a paralyzed target; Roost isn't needed.
  const DRAGONITE = `Dragonite @ Leftovers\nAbility: Multiscale\nEVs: 252 HP / 252 Def\nBold Nature\n- Rock Slide\n- Toxic\n- Thunder Wave\n- Roost`;
  const TUSK = `Donphan @ Paradoxorb-A\nAbility: Sturdy\nEVs: 252 HP / 252 Def\nImpish Nature\n- Headlong Rush\n- Rapid Spin`;

  it('never repeats Thunder Wave / Toxic on a target that already has a status, even when nothing else is worthwhile', () => {
    const battle = scenario(TUSK, DRAGONITE, b => b.p1.active[0].setStatus('par'));
    const counts = decide(battle, 120);
    expect(share(counts, 'move 2') + share(counts, 'move 3')).toBe(0);
    expect(share(counts, 'move 1')).toBe(1); // the chip damage is the most it can do
  });
});
