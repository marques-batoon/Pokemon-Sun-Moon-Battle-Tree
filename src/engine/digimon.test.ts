import { describe, expect, it } from 'vitest';
import { Battle, Dex, Teams, TeamValidator } from '@pkmn/sim';
import { CHAMPIONS_MOD } from '../data/champions';
import { FORMAT_IDS, IGNORED_VALIDATOR_PROBLEMS, registerBattleTreeFormats } from './format';

registerBattleTreeFormats();
const dex = Dex.mod(CHAMPIONS_MOD);
const validator = new TeamValidator(Dex.formats.get(FORMAT_IDS.singles));
const validate = (text: string) =>
  (validator.validateTeam(Teams.import(text)) ?? []).filter(p => !IGNORED_VALIDATOR_PROBLEMS.some(r => r.test(p)));

const mon = (species: string, item: string, ability: string, moves: string[], extra = '') =>
  `${species} @ ${item}\nAbility: ${ability}\nLevel: 50\n${extra}${moves.map(m => `- ${m}`).join('\n')}`;
const BENCH = [mon('Chansey', 'Eviolite', 'Natural Cure', ['Soft-Boiled']), mon('Snorlax', 'Leftovers', 'Thick Fat', ['Rest'])];
const team = (...mons: string[]) => [...mons, ...BENCH].slice(0, Math.max(3, mons.length)).join('\n\n');
const agumon = (moves = ['Pepper Breath'], item = 'Wargreyite') => mon('Agumon', item, 'Blaze', moves, 'EVs: 252 SpA\nModest Nature\n');
const target = mon('Snorlax', 'Leftovers', 'Thick Fat', ['Splash'], 'EVs: 252 HP / 252 Def\n');

function singles(p1: string[], p2: string[]) {
  const b = new Battle({ formatid: 'gen7battletreesinglesnopreview' as never, seed: '1,2,3,4' });
  b.setPlayer('p1', { name: 'A', team: Teams.pack(Teams.import(team(...p1))) });
  b.setPlayer('p2', { name: 'B', team: Teams.pack(Teams.import(team(...p2))) });
  return b;
}

describe('Agumon and WarGreymon', () => {
  it('has the custom species data', () => {
    const a = dex.species.get('Agumon');
    expect(a.exists).toBe(true);
    expect(a.types).toEqual(['Fire']);
    expect(a.baseStats).toEqual({ hp: 44, atk: 60, def: 45, spa: 55, spd: 45, spe: 60 });
    expect(a.abilities).toEqual({ 0: 'Blaze', H: 'Tough Claws' });
    expect(a.weightkg).toBe(12);
    expect(a.genderRatio).toEqual({ M: 0.875, F: 0.125 });
    const w = dex.species.get('WarGreymon');
    expect(w.exists).toBe(true);
    expect(w.baseSpecies).toBe('Agumon');
    expect(w.battleOnly).toBe('Agumon');
    expect(w.types).toEqual(['Fire', 'Dragon']);
    expect(w.baseStats).toEqual({ hp: 78, atk: 140, def: 100, spa: 130, spd: 86, spe: 100 });
    expect(Object.values(w.baseStats).reduce((x, y) => x + y, 0)).toBe(634);
    expect(w.abilities).toEqual({ 0: 'Sheer Force' });
    expect(w.weightkg).toBe(120);
    expect(dex.items.get('Wargreyite').megaStone).toEqual({ Agumon: 'WarGreymon' });
  });

  it('has Pepper Breath and Gaia Force', () => {
    const pepper = dex.moves.get('Pepper Breath');
    expect([pepper.type, pepper.category, pepper.basePower, pepper.accuracy, pepper.pp, pepper.priority, pepper.target]).toEqual(['Fire', 'Special', 65, 100, 15, 0, 'normal']);
    expect(pepper.flags.contact).toBeUndefined();
    expect(pepper.secondary).toEqual({ chance: 20, status: 'brn' });
    const gaia = dex.moves.get('Gaia Force');
    expect([gaia.type, gaia.category, gaia.basePower, gaia.accuracy, gaia.pp]).toEqual(['Fire', 'Special', 110, 90, 5]);
    expect(gaia.secondary).toEqual({ chance: 20, status: 'brn' });
  });

  it('learns its own move list, Gen 8-9 TMs included, and nothing else', () => {
    expect(validate(team(agumon(['Pepper Breath', 'Gaia Force', 'Scorching Sands', 'Tera Blast'])))).toEqual([]);
    expect(validate(team(agumon(['Dragon Dance', 'Flare Blitz', 'Breaking Swipe', 'Dual Wingbeat'])))).toEqual([]);
    expect(validate(team(mon('Agumon', 'Charcoal', 'Tough Claws', ['Temper Flare', 'Close Combat'], 'EVs: 252 Atk\n')))).toEqual([]);
    expect(validate(team(agumon(['Thunderbolt']))).join(' ')).toMatch(/can't learn Thunderbolt/);
  });

  it('keeps the signature moves and Wargreyite for Agumon', () => {
    expect(validate(team(mon('Charizard', 'Charcoal', 'Blaze', ['Pepper Breath'], 'EVs: 252 SpA\n'))).join(' ')).toMatch(/Pepper Breath/);
    expect(validate(team(mon('Smeargle', 'Focus Sash', 'Own Tempo', ['Gaia Force'], 'EVs: 252 Spe\n'))).join(' ')).toMatch(/Gaia Force/);
    expect(validate(team(mon('Charizard', 'Wargreyite', 'Blaze', ['Flamethrower'], 'EVs: 252 SpA\n'))).join(' ')).toMatch(/can't hold Wargreyite/);
  });
});

describe('Gabumon and MetalGarurumon', () => {
  const gabumon = (moves = ['Fox Fire'], item = 'Metalgaruruite') => mon('Gabumon', item, 'Thick Fat', moves, 'EVs: 252 SpA\nModest Nature\n');

  it('has the custom species data', () => {
    const g = dex.species.get('Gabumon');
    expect(g.types).toEqual(['Ice']);
    expect(g.baseStats).toEqual({ hp: 44, atk: 55, def: 50, spa: 60, spd: 50, spe: 50 });
    expect(g.abilities).toEqual({ 0: 'Thick Fat', 1: 'Snow Cloak', H: 'Flash Fire' });
    expect(g.weightkg).toBe(14);
    expect(g.genderRatio).toEqual({ M: 0.875, F: 0.125 });
    const m = dex.species.get('MetalGarurumon');
    expect(m.baseSpecies).toBe('Gabumon');
    expect(m.battleOnly).toBe('Gabumon');
    expect(m.types).toEqual(['Ice', 'Steel']);
    expect(m.baseStats).toEqual({ hp: 80, atk: 95, def: 105, spa: 135, spd: 105, spe: 110 });
    expect(Object.values(m.baseStats).reduce((x, y) => x + y, 0)).toBe(630);
    expect(m.abilities).toEqual({ 0: 'Mega Launcher' });
    expect(m.weightkg).toBe(180);
    expect(dex.items.get('Metalgaruruite').megaStone).toEqual({ Gabumon: 'MetalGarurumon' });
  });

  it('has Fox Fire and Cocytus Pulse (both boosted by Mega Launcher)', () => {
    const fox = dex.moves.get('Fox Fire');
    expect([fox.type, fox.category, fox.basePower, fox.accuracy, fox.pp, fox.target]).toEqual(['Fire', 'Special', 70, 100, 10, 'normal']);
    expect(fox.flags.contact).toBeUndefined();
    expect(fox.flags.pulse).toBe(1);
    expect(fox.secondary).toEqual({ chance: 20, boosts: { spd: -1 } });
    const cocytus = dex.moves.get('Cocytus Pulse');
    expect([cocytus.type, cocytus.category, cocytus.basePower, cocytus.accuracy, cocytus.pp]).toEqual(['Ice', 'Special', 85, 100, 10]);
    expect(cocytus.flags.pulse).toBe(1);
    expect(cocytus.secondary).toEqual({ chance: 20, boosts: { spe: -1 } });
  });

  it('learns its own list (Gen 8-9 TMs included), and only it gets its signature moves', () => {
    expect(validate(team(gabumon(['Fox Fire', 'Cocytus Pulse', 'Chilling Water', 'Steel Beam'])))).toEqual([]);
    expect(validate(team(gabumon(['Ice Spinner', 'Snowscape', 'Tera Blast', 'Heavy Slam'])))).toEqual([]);
    expect(validate(team(mon('Gabumon', 'Charcoal', 'Flash Fire', ['Powder Snow'], 'EVs: 252 HP\n')))).toEqual([]);
    expect(validate(team(gabumon(['Flamethrower']))).join(' ')).toMatch(/can't learn Flamethrower/);
    // Each Digimon's moves are its own.
    expect(validate(team(agumon(['Fox Fire']))).join(' ')).toMatch(/Fox Fire/);
    expect(validate(team(gabumon(['Pepper Breath']))).join(' ')).toMatch(/Pepper Breath/);
    expect(validate(team(mon('Glalie', 'Leftovers', 'Inner Focus', ['Cocytus Pulse'], 'EVs: 252 SpA\n'))).join(' ')).toMatch(/Cocytus Pulse/);
    expect(validate(team(agumon(['Pepper Breath'], 'Metalgaruruite'))).join(' ')).toMatch(/can't hold Metalgaruruite/);
  });

  it('Warp Digivolves into MetalGarurumon with Mega Launcher boosting Cocytus Pulse', () => {
    const b = singles([gabumon(['Cocytus Pulse', 'Ice Beam'])], [target]);
    expect(b.p1.active[0].canMegaEvo).toBe('MetalGarurumon');
    b.makeChoices('move 1 mega', 'move 1');
    expect(b.p1.active[0].species.name).toBe('MetalGarurumon');
    expect(b.p1.active[0].ability).toBe('megalauncher');
    expect(b.log.join('\n')).toMatch(/Gabumon warp-digivolve to\.\.\. MetalGarurumon!/);
    // Mega Launcher: 1.5x on Cocytus Pulse (85 -> 127), nothing on Ice Beam.
    const [user, foe] = [b.p1.active[0], b.p2.active[0]];
    const power = (id: string) => b.runEvent('BasePower', user, foe, b.dex.getActiveMove(id), b.dex.moves.get(id).basePower, true);
    expect(power('cocytuspulse')).toBe(127);
    expect(power('foxfire')).toBe(105);
    expect(power('icebeam')).toBe(90);
  });
});

describe('Warp Digivolution', () => {
  it('turns Agumon holding Wargreyite into WarGreymon, like a Mega Evolution, with its own messages', () => {
    const b = singles([agumon()], [target]);
    expect(b.p1.active[0].canMegaEvo).toBe('WarGreymon');
    b.makeChoices('move 1 mega', 'move 1');
    const p = b.p1.active[0];
    expect(p.species.name).toBe('WarGreymon');
    expect(p.ability).toBe('sheerforce');
    expect(p.canMegaEvo).toBeFalsy();
    const log = b.log.join('\n');
    expect(log).toMatch(/\|detailschange\|p1a: Agumon\|WarGreymon/);
    expect(log).toMatch(/Agumon's Wargreyite is overflowing with power!/);
    expect(log).toMatch(/Agumon warp-digivolve to\.\.\. WarGreymon!/);
    expect(log).not.toMatch(/\|-mega\|/);
    // It warps before moving, and stays WarGreymon after switching out and back in.
    expect(log.indexOf('detailschange')).toBeLessThan(log.indexOf('|move|p1a: Agumon|Pepper Breath'));
    b.makeChoices('switch 2', 'move 1');
    b.makeChoices('switch 2', 'move 1');
    expect(b.p1.active[0].species.name).toBe('WarGreymon');
  });

  it('names the foe\'s Agumon as the opposing one', () => {
    const b = singles([target], [agumon()]);
    b.makeChoices('move 1', 'move 1 mega');
    expect(b.log.join('\n')).toMatch(/The opposing Agumon warp-digivolve to\.\.\. WarGreymon!/);
  });

  it('needs Wargreyite', () => {
    expect(singles([agumon(['Pepper Breath'], 'Charcoal')], [target]).p1.active[0].canMegaEvo).toBeFalsy();
  });

  it('can\'t lose Wargreyite to Knock Off or Trick', () => {
    const tank = mon('Agumon', 'Wargreyite', 'Blaze', ['Iron Defense'], 'EVs: 252 HP / 252 Def\n');
    const b = singles([tank], [mon('Sableye', 'Leftovers', 'Keen Eye', ['Knock Off', 'Trick'], 'EVs: 252 HP\n')]);
    b.makeChoices('move 1', 'move 1');
    expect(b.p1.active[0].item).toBe('wargreyite');
    b.makeChoices('move 1', 'move 2');
    expect(b.p1.active[0].item).toBe('wargreyite');
  });

  it('doesn\'t use up the team\'s Mega Evolution, and a Mega doesn\'t use up the warp', () => {
    // Singles: Mega Venusaur first, then Agumon can still warp later in the battle.
    const b = singles([mon('Venusaur', 'Venusaurite', 'Overgrow', ['Synthesis'], 'EVs: 252 HP\n'), agumon()], [target]);
    b.makeChoices('move 1 mega', 'move 1');
    expect(b.p1.active[0].species.name).toBe('Venusaur-Mega');
    b.makeChoices('switch 2', 'move 1');
    expect(b.p1.active[0].canMegaEvo).toBe('WarGreymon');
    b.makeChoices('move 1 mega', 'move 1');
    expect(b.p1.active[0].species.name).toBe('WarGreymon');
  });

  it('lets every Digimon on a team warp, on the same turn, and still Mega Evolve after (Doubles)', () => {
    const b = new Battle({ formatid: 'gen7battletreedoublesnopreview' as never, seed: '1,2,3,4' });
    const p1 = [agumon(), mon('Gabumon', 'Metalgaruruite', 'Thick Fat', ['Fox Fire']), mon('Venusaur', 'Venusaurite', 'Overgrow', ['Synthesis'], 'EVs: 252 HP\n'), BENCH[1]].join('\n\n');
    const p2 = [target, mon('Chansey', 'Eviolite', 'Natural Cure', ['Splash']), ...BENCH].join('\n\n');
    b.setPlayer('p1', { name: 'A', team: Teams.pack(Teams.import(p1)) });
    b.setPlayer('p2', { name: 'B', team: Teams.pack(Teams.import(p2)) });
    b.makeChoices('move 1 1 mega, move 1 1 mega', 'move 1, move 1');
    expect(b.p1.active.map(p => p.species.name)).toEqual(['WarGreymon', 'MetalGarurumon']);
    b.makeChoices('move 1 1, switch 3', 'move 1, move 1');
    expect(b.p1.active[1].canMegaEvo).toBe('Venusaur-Mega');
    b.makeChoices('move 1 1, move 1 mega', 'move 1, move 1');
    expect(b.p1.active[1].species.name).toBe('Venusaur-Mega');
  });

  it('can happen on the same turn as a Mega Evolution (Doubles)', () => {
    const b = new Battle({ formatid: 'gen7battletreedoublesnopreview' as never, seed: '1,2,3,4' });
    const p1 = [agumon(), mon('Venusaur', 'Venusaurite', 'Overgrow', ['Synthesis'], 'EVs: 252 HP\n'), ...BENCH].join('\n\n');
    const p2 = [target, mon('Chansey', 'Eviolite', 'Natural Cure', ['Splash']), ...BENCH].join('\n\n');
    b.setPlayer('p1', { name: 'A', team: Teams.pack(Teams.import(p1)) });
    b.setPlayer('p2', { name: 'B', team: Teams.pack(Teams.import(p2)) });
    b.makeChoices('move 1 1 mega, move 1 mega', 'move 1, move 1');
    expect(b.p1.active.map(p => p.species.name)).toEqual(['WarGreymon', 'Venusaur-Mega']);
    // And a second Mega is still refused.
    const c = new Battle({ formatid: 'gen7battletreedoublesnopreview' as never, seed: '1,2,3,4' });
    const megas = [mon('Venusaur', 'Venusaurite', 'Overgrow', ['Synthesis']), mon('Charizard', 'Charizardite Y', 'Blaze', ['Roost']), ...BENCH].join('\n\n');
    c.setPlayer('p1', { name: 'A', team: Teams.pack(Teams.import(megas)) });
    c.setPlayer('p2', { name: 'B', team: Teams.pack(Teams.import(p2)) });
    expect(c.p1.choose('move 1 mega, move 1 mega')).toBe(false);
  });
});
