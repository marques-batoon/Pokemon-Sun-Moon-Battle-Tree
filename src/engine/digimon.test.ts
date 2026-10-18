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
    expect(b.log.join('\n')).toMatch(/\|message\|Gabumon warp-digivolve to\.\.\.\n[^]*\|message\|MetalGarurumon!/);
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
    // Two lines around the warp: "Agumon warp-digivolve to..." then "WarGreymon!".
    expect(log).toMatch(/\|message\|Agumon warp-digivolve to\.\.\.\n[^]*?\|detailschange\|p1a: Agumon\|WarGreymon[^]*?\|message\|WarGreymon!/);
    expect(log).not.toMatch(/overflowing with power/);
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
    expect(b.log.join('\n')).toMatch(/\|message\|The opposing Agumon warp-digivolve to\.\.\.\n[^]*\|message\|WarGreymon!/);
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

describe('BlackWarGreymon (Dark Warp Digivolution) and the Dramon moves', () => {
  const black = (moves = ['Dark Gaia Force'], ability = 'Tough Claws') => mon('Agumon', 'Blackwargreyite', ability, moves, 'EVs: 252 SpA\nModest Nature\n');

  it('has the custom species, item and moves', () => {
    const w = dex.species.get('BlackWarGreymon');
    expect(w.exists).toBe(true);
    expect([w.baseSpecies, w.battleOnly, w.requiredItem]).toEqual(['Agumon', 'Agumon', 'Blackwargreyite']);
    expect(w.types).toEqual(['Dragon', 'Dark']);
    expect(w.baseStats).toEqual({ hp: 78, atk: 145, def: 95, spa: 130, spd: 86, spe: 100 });
    expect(Object.values(w.baseStats).reduce((x, y) => x + y, 0)).toBe(634);
    expect(w.abilities).toEqual({ 0: 'Tough Claws' });
    expect(w.weightkg).toBe(120);
    expect(dex.species.get('Agumon').otherFormes).toEqual(['WarGreymon', 'BlackWarGreymon']);
    expect(dex.items.get('Blackwargreyite').megaStone).toEqual({ Agumon: 'BlackWarGreymon' });
    // Renamed from BlackWarGreyite: same id, so teams saved with the old name still find it.
    expect(dex.items.get('BlackWarGreyite').name).toBe('Blackwargreyite');
    const dark = dex.moves.get('Dark Gaia Force');
    expect([dark.type, dark.category, dark.basePower, dark.accuracy, dark.pp, dark.priority, dark.target]).toEqual(['Dark', 'Special', 110, 90, 5, 0, 'normal']);
    expect(dark.flags.contact).toBeUndefined();
    expect(dark.secondary).toEqual({ chance: 20, status: 'brn' });
    const destroyer = dex.moves.get('Dramon Destroyer');
    expect([destroyer.type, destroyer.category, destroyer.basePower, destroyer.accuracy, destroyer.pp, destroyer.critRatio]).toEqual(['Dragon', 'Physical', 90, 100, 10, 2]);
    expect(destroyer.flags.contact).toBe(1);
    expect(destroyer.secondary ?? null).toBeNull();
    const breaker = dex.moves.get('Dramon Breaker');
    expect([breaker.type, breaker.category, breaker.basePower, breaker.accuracy, breaker.pp, breaker.critRatio]).toEqual(['Dragon', 'Physical', 90, 100, 10, 2]);
    expect(breaker.flags.contact).toBe(1);
    expect(breaker.secondary).toEqual({ chance: 20, boosts: { def: -1 } });
  });

  it('learns BlackWarGreymon\'s list instead of its own while holding Blackwargreyite', () => {
    expect(validate(team(black(['Dark Gaia Force', 'Dramon Destroyer', 'Lash Out', 'Knock Off'])))).toEqual([]);
    expect(validate(team(black(['Nasty Plot', 'Foul Play', 'Sucker Punch', 'Throat Chop'])))).toEqual([]);
    // Its own list's extras (Gaia Force, Dragon Breath, Fly, Draco Meteor) aren't on it.
    for (const move of ['Gaia Force', 'Dragon Breath', 'Fly', 'Draco Meteor', 'Dramon Breaker']) {
      expect(validate(team(black([move]))).join(' '), move).toMatch(new RegExp(`can't learn ${move}`));
    }
    // Without Blackwargreyite it can't use BlackWarGreymon's moves.
    expect(validate(team(agumon(['Dark Gaia Force']))).join(' ')).toMatch(/can't learn Dark Gaia Force/);
    expect(validate(team(agumon(['Nasty Plot'], 'Charcoal'))).join(' ')).toMatch(/can't learn Nasty Plot/);
    expect(validate(team(mon('Charizard', 'Blackwargreyite', 'Blaze', ['Flamethrower'], 'EVs: 252 SpA\n'))).join(' ')).toMatch(/can't hold Blackwargreyite/);
  });

  it('learns Dramon Breaker only while holding Wargreyite', () => {
    expect(validate(team(agumon(['Dramon Breaker', 'Gaia Force'])))).toEqual([]);
    expect(validate(team(agumon(['Dramon Breaker'], 'Charcoal'))).join(' ')).toMatch(/can't learn Dramon Breaker/);
    expect(validate(team(mon('Smeargle', 'Focus Sash', 'Own Tempo', ['Dramon Destroyer'], 'EVs: 252 Spe\n'))).join(' ')).toMatch(/Dramon Destroyer/);
  });

  it('Dark Warp Digivolves Agumon into BlackWarGreymon, with its own message', () => {
    const b = singles([black()], [target]);
    expect(b.p1.active[0].canMegaEvo).toBe('BlackWarGreymon');
    b.makeChoices('move 1 mega', 'move 1');
    const p = b.p1.active[0];
    expect(p.species.name).toBe('BlackWarGreymon');
    expect(p.ability).toBe('toughclaws');
    const log = b.log.join('\n');
    expect(log).toMatch(/\|message\|Agumon dark warp-digivolve to\.\.\.\n[^]*?\|detailschange\|p1a: Agumon\|BlackWarGreymon[^]*?\|message\|BlackWarGreymon!/);
    expect(log).toMatch(/\|move\|p1a: Agumon\|Dark Gaia Force/);
  });

  it('boosts Dramon Destroyer with Tough Claws, and Dramon Breaker with Sheer Force (losing its Defense drop)', () => {
    const b = singles([black(['Dramon Destroyer'])], [target]);
    b.makeChoices('move 1 mega', 'move 1');
    const destroyer = b.dex.getActiveMove('Dramon Destroyer');
    expect(b.runEvent('BasePower', b.p1.active[0], b.p2.active[0], destroyer, destroyer.basePower, true)).toBe(117);
    const w = singles([agumon(['Dramon Breaker'])], [target]);
    w.makeChoices('move 1 mega', 'move 1');
    const breaker = w.dex.getActiveMove('Dramon Breaker');
    w.runEvent('ModifyMove', w.p1.active[0], w.p2.active[0], breaker, breaker);
    expect(breaker.secondaries ?? []).toEqual([]);
    expect(w.runEvent('BasePower', w.p1.active[0], w.p2.active[0], breaker, breaker.basePower, true)).toBe(117);
  });
});

describe('Tentomon and HerculesKabuterimon', () => {
  const tentomon = (moves = ['Giga Blaster'], item = 'Herculeskabuterite') => mon('Tentomon', item, 'Static', moves, 'EVs: 252 SpA\nModest Nature\n');

  it('has the custom species, item, moves and Electromorphosis', () => {
    const t = dex.species.get('Tentomon');
    expect([t.types, t.baseStats, t.abilities, t.weightkg, t.genderRatio]).toEqual([
      ['Bug', 'Electric'], { hp: 55, atk: 35, def: 60, spa: 75, spd: 65, spe: 28 }, { 0: 'Static' }, 10.5, { M: 0.875, F: 0.125 },
    ]);
    const h = dex.species.get('HerculesKabuterimon');
    expect([h.baseSpecies, h.battleOnly, h.requiredItem, h.types, h.abilities, h.weightkg]).toEqual(['Tentomon', 'Tentomon', 'Herculeskabuterite', ['Bug', 'Electric'], { 0: 'Electromorphosis' }, 230]);
    expect(h.baseStats).toEqual({ hp: 90, atk: 75, def: 130, spa: 130, spd: 140, spe: 60 });
    expect(Object.values(h.baseStats).reduce((x, y) => x + y, 0)).toBe(625);
    expect(dex.items.get('Herculeskabuterite').megaStone).toEqual({ Tentomon: 'HerculesKabuterimon' });
    const shocker = dex.moves.get('Super Shocker');
    expect([shocker.type, shocker.category, shocker.basePower, shocker.accuracy, shocker.pp, shocker.flags.contact]).toEqual(['Electric', 'Special', 70, 100, 15, undefined]);
    expect(shocker.secondary).toEqual({ chance: 30, status: 'par' });
    const giga = dex.moves.get('Giga Blaster');
    expect([giga.type, giga.category, giga.basePower, giga.accuracy, giga.pp, giga.flags.contact]).toEqual(['Electric', 'Special', 100, 100, 10, undefined]);
    expect(giga.secondary).toEqual({ chance: 20, status: 'par' });
    expect(dex.abilities.get('Electromorphosis').isNonstandard).toBeNull();
  });

  it('learns its own list (Gen 8-9 TMs included) and only it gets Super Shocker and Giga Blaster', () => {
    expect(validate(team(tentomon(['Giga Blaster', 'Super Shocker', 'Hard Press', 'Pounce'])))).toEqual([]);
    expect(validate(team(tentomon(['Trailblaze', 'Skitter Smack', 'Body Press', 'Quiver Dance'], 'Magnet')))).toEqual([]);
    expect(validate(team(tentomon(['Flamethrower']))).join(' ')).toMatch(/can't learn Flamethrower/);
    // Hidden Power of any type, but not Tera Blast (on request).
    expect(validate(team(tentomon(['Hidden Power', 'Giga Blaster'])))).toEqual([]);
    expect(validate(team(mon('Tentomon', 'Herculeskabuterite', 'Static', ['Hidden Power [Ice]'], 'EVs: 252 SpA\nIVs: 30 Atk / 30 Def\nModest Nature\n')))).toEqual([]);
    expect(validate(team(tentomon(['Tera Blast']))).join(' ')).toMatch(/can't learn Tera Blast/);
    expect(validate(team(mon('Smeargle', 'Focus Sash', 'Own Tempo', ['Giga Blaster'], 'EVs: 252 Spe\n'))).join(' ')).toMatch(/Giga Blaster/);
    expect(validate(team(mon('Pikachu', 'Herculeskabuterite', 'Static', ['Thunderbolt'], 'EVs: 252 SpA\n'))).join(' ')).toMatch(/can't hold Herculeskabuterite/);
  });

  it('Warp Digivolves into HerculesKabuterimon', () => {
    const b = singles([tentomon()], [target]);
    expect(b.p1.active[0].canMegaEvo).toBe('HerculesKabuterimon');
    b.makeChoices('move 1 mega', 'move 1');
    expect(b.p1.active[0].species.name).toBe('HerculesKabuterimon');
    expect(b.p1.active[0].ability).toBe('electromorphosis');
    expect(b.log.join('\n')).toMatch(/\|message\|Tentomon warp-digivolve to\.\.\.\n[^]*?\|detailschange\|p1a: Tentomon\|HerculesKabuterimon[^]*?\|message\|HerculesKabuterimon!/);
  });

  it('Electromorphosis: hit by an attack, its next Electric move (Giga Blaster: 200 power) is doubled, then the charge is gone', () => {
    const hitter = mon('Snorlax', 'Leftovers', 'Thick Fat', ['Tackle'], 'EVs: 252 HP / 252 Def\n');
    const b = singles([tentomon(['Giga Blaster', 'Iron Defense'])], [hitter]);
    b.makeChoices('move 2 mega', 'move 1');
    const p = b.p1.active[0];
    expect(p.volatiles.electromorphosis).toBeTruthy();
    expect(b.log.join('\n')).toMatch(/\|-start\|p1a: Tentomon\|Charge\|\[from\] ability: Electromorphosis/);
    const giga = b.dex.getActiveMove('Giga Blaster');
    expect(b.runEvent('BasePower', p, b.p2.active[0], giga, giga.basePower, true)).toBe(200);
    // It stays charged until it uses an Electric move (here: after a turn of Iron Defense), then it's used up.
    b.makeChoices('move 2', 'move 1');
    expect(p.volatiles.electromorphosis).toBeTruthy();
    b.makeChoices('move 1', 'move 1');
    const after = b.log.slice(-30).join('\n');
    expect(after).toMatch(/\|move\|p1a: Tentomon\|Giga Blaster/);
    // Hit again by Tackle after its move (Tentomon is slower), so it may be charged anew: only the one before was spent.
    expect(after).toMatch(/\|-start\|p1a: Tentomon\|Charge/);
  });
});

describe('Guilmon and Gallantmon (Matrix Evolution)', () => {
  const guilmon = (moves = ['Pyro Fang'], item = 'Gallantite', ability = 'Strong Jaw') => mon('Guilmon', item, ability, moves, 'EVs: 252 Atk\nAdamant Nature\n');

  it('has the custom species, item and moves', () => {
    const g = dex.species.get('Guilmon');
    expect([g.types, g.baseStats, g.abilities, g.weightkg, g.genderRatio]).toEqual([
      ['Fire', 'Dragon'], { hp: 55, atk: 70, def: 60, spa: 35, spd: 54, spe: 35 }, { 0: 'Strong Jaw' }, 22, { M: 0.875, F: 0.125 },
    ]);
    expect(Object.values(g.baseStats).reduce((x, y) => x + y, 0)).toBe(309);
    const m = dex.species.get('Gallantmon');
    expect([m.baseSpecies, m.battleOnly, m.requiredItem, m.types, m.abilities, m.weightkg]).toEqual(['Guilmon', 'Guilmon', 'Gallantite', ['Steel', 'Fairy'], { 0: 'Dauntless Shield' }, 110]);
    expect(m.baseStats).toEqual({ hp: 95, atk: 145, def: 130, spa: 65, spd: 125, spe: 74 });
    expect(Object.values(m.baseStats).reduce((x, y) => x + y, 0)).toBe(634);
    expect(dex.items.get('Gallantite').megaStone).toEqual({ Guilmon: 'Gallantmon' });
    expect(dex.abilities.get('Dauntless Shield').isNonstandard).toBeNull();
    const pyro = dex.moves.get('Pyro Fang');
    expect([pyro.type, pyro.category, pyro.basePower, pyro.accuracy, pyro.pp, pyro.priority, pyro.target, pyro.flags.contact, pyro.flags.bite]).toEqual(['Fire', 'Physical', 70, 100, 15, 0, 'normal', 1, 1]);
    expect(pyro.secondary).toEqual({ chance: 20, status: 'brn' });
    const joust = dex.moves.get('Lightning Joust');
    expect([joust.type, joust.category, joust.basePower, joust.accuracy, joust.pp, joust.flags.contact]).toEqual(['Steel', 'Physical', 95, 100, 10, 1]);
    expect(joust.secondary).toEqual({ chance: 20, status: 'par' });
    const shield = dex.moves.get('Shield of Just');
    expect([shield.type, shield.category, shield.basePower, shield.accuracy, shield.pp, shield.flags.contact, shield.overrideOffensiveStat]).toEqual(['Fairy', 'Special', 85, 100, 10, undefined, 'spd']);
    expect(shield.secondary).toEqual({ chance: 20, boosts: { atk: -1 } });
  });

  it('learns its own list, and Gallantmon\'s instead while holding Gallantite', () => {
    expect(validate(team(guilmon(['Pyro Fang', 'Breaking Swipe', 'Temper Flare', 'Tera Blast'], 'Charcoal')))).toEqual([]);
    expect(validate(team(guilmon(['Trailblaze', 'Stomping Tantrum', 'Mud-Slap', 'Outrage'], 'Charcoal')))).toEqual([]);
    expect(validate(team(guilmon(['Lightning Joust'], 'Charcoal'))).join(' ')).toMatch(/can't learn Lightning Joust/);
    expect(validate(team(guilmon(['Lightning Joust', 'Shield of Just', 'Supercell Slam', 'Body Press'])))).toEqual([]);
    expect(validate(team(guilmon(['Pyro Fang', "King's Shield", 'Sacred Sword', 'Play Rough'])))).toEqual([]);
    expect(validate(team(guilmon(['Flamethrower']))).join(' ')).toMatch(/can't learn Flamethrower/);
    expect(validate(team(mon('Smeargle', 'Focus Sash', 'Own Tempo', ['Lightning Joust'], 'EVs: 252 Spe\n'))).join(' ')).toMatch(/Lightning Joust/);
    expect(validate(team(mon('Charizard', 'Gallantite', 'Blaze', ['Flamethrower'], 'EVs: 252 SpA\n'))).join(' ')).toMatch(/can't hold Gallantite: only Guilmon can Matrix Evolve with it/);
  });

  it('Matrix Evolves into Gallantmon like a Warp Digivolution, with its own messages, and Dauntless Shield raises its Defense once', () => {
    const b = singles([guilmon()], [target]);
    expect(b.p1.active[0].canMegaEvo).toBe('Gallantmon');
    b.makeChoices('move 1 mega', 'move 1');
    const p = b.p1.active[0];
    expect(p.species.name).toBe('Gallantmon');
    expect(p.ability).toBe('dauntlessshield');
    expect(p.boosts.def).toBe(1);
    const log = b.log.join('\n');
    expect(log).toMatch(/\|message\|Guilmon matrix-evolve to\.\.\.\n[^]*?\|detailschange\|p1a: Guilmon\|Gallantmon[^]*?\|message\|Gallantmon!/);
    expect(log).toMatch(/\|message\|Gallantmon!\n\|-ability\|p1a: Guilmon\|Dauntless Shield\|boost\n\|-boost\|p1a: Guilmon\|def\|1/);
    // As in Gen 9, only once a battle: not again when it comes back in.
    b.makeChoices('switch 2', 'move 1');
    b.makeChoices('switch 2', 'move 1');
    expect(b.p1.active[0].species.name).toBe('Gallantmon');
    expect(b.p1.active[0].boosts.def).toBe(0);
  });

  it('boosts Pyro Fang with Strong Jaw (70 -> 105)', () => {
    const b = singles([guilmon(['Pyro Fang'], 'Leftovers')], [target]);
    b.makeChoices('move 1', 'move 1');
    const pyro = b.dex.getActiveMove('Pyro Fang');
    expect(b.runEvent('BasePower', b.p1.active[0], b.p2.active[0], pyro, pyro.basePower, true)).toBe(105);
  });

  it('counts Lightning Joust as Steel and Electric against the target\'s types (like Flying Press)', () => {
    const vs = (foe: string) => {
      const b = singles([guilmon(['Lightning Joust'])], [mon(foe, 'Leftovers', 'Pressure', ['Splash'])]);
      return b.p2.active[0].runEffectiveness(b.dex.getActiveMove('Lightning Joust'));
    };
    expect(vs('Gyarados')).toBe(1); // Water / Flying: Steel resisted, Electric 4x
    expect(vs('Lapras')).toBe(1); // Water / Ice: Steel neutral, Electric super effective
    expect(vs('Skarmory')).toBe(0); // Steel / Flying: Steel resisted, Electric super effective
    expect(vs('Garchomp')).toBe(-1); // Dragon / Ground: Electric resisted by Dragon; Ground isn't immune (it's a Steel move)
  });

  it('attacks with Sp. Def for Shield of Just (Sp. Def rises make it stronger, Sp. Atk ones don\'t)', () => {
    const b = singles([guilmon(['Shield of Just'])], [target]);
    b.makeChoices('move 1 mega', 'move 1');
    const p = b.p1.active[0], t = b.p2.active[0];
    (b as unknown as { randomizer: (n: number) => number }).randomizer = n => n;
    const damage = () => {
      const move = b.dex.getActiveMove('Shield of Just');
      move.willCrit = false;
      return b.actions.getDamage(p, t, move, true) as number;
    };
    const base = damage();
    p.boosts.spa = 6;
    expect(damage()).toBe(base);
    p.boosts.spa = 0;
    p.boosts.spd = 2;
    expect(damage()).toBeGreaterThan(base * 1.7);
  });
});

describe('Terriermon and MegaGargomon (Matrix Evolution)', () => {
  const terriermon = (moves = ['Petit Twister'], item = 'Megagargoite') => mon('Terriermon', item, 'Technician', moves, 'EVs: 252 Atk\nAdamant Nature\n');
  const weak = (species = 'Magikarp') => `${species}\nAbility: Swift Swim\nLevel: 1\n- Splash`;

  it('has the custom species, item, moves and Elevate', () => {
    const t = dex.species.get('Terriermon');
    expect([t.types, t.baseStats, t.abilities, t.weightkg, t.genderRatio]).toEqual([
      ['Normal', 'Flying'], { hp: 40, atk: 30, def: 35, spa: 85, spd: 39, spe: 80 }, { 0: 'Technician' }, 5, { M: 0.875, F: 0.125 },
    ]);
    expect(Object.values(t.baseStats).reduce((x, y) => x + y, 0)).toBe(309);
    const g = dex.species.get('MegaGargomon');
    expect([g.baseSpecies, g.battleOnly, g.requiredItem, g.types, g.abilities, g.weightkg]).toEqual(['Terriermon', 'Terriermon', 'Megagargoite', ['Electric', 'Steel'], { 0: 'Elevate' }, 550]);
    expect(g.baseStats).toEqual({ hp: 100, atk: 150, def: 140, spa: 65, spd: 120, spe: 59 });
    expect(Object.values(g.baseStats).reduce((x, y) => x + y, 0)).toBe(634);
    expect(dex.items.get('Megagargoite').megaStone).toEqual({ Terriermon: 'MegaGargomon' });
    const elevate = dex.abilities.get('Elevate');
    expect([elevate.exists, elevate.isNonstandard]).toEqual([true, null]);
    const twister = dex.moves.get('Petit Twister');
    expect([twister.type, twister.category, twister.basePower, twister.accuracy, twister.pp, twister.target, twister.flags.contact, twister.flags.wind]).toEqual(['Flying', 'Special', 60, 100, 15, 'normal', undefined, 1]);
    expect(twister.secondary).toEqual({ chance: 20, boosts: { spe: -1 } });
    const burst = dex.moves.get('Burst Shot');
    expect([burst.type, burst.category, burst.basePower, burst.accuracy, burst.pp, burst.multihit, burst.flags.contact, burst.secondary ?? null]).toEqual(['Steel', 'Physical', 25, 100, 10, 4, undefined, null]);
    const missile = dex.moves.get('Giant Missile');
    expect([missile.type, missile.category, missile.basePower, missile.accuracy, missile.pp, missile.flags.contact]).toEqual(['Electric', 'Physical', 100, 95, 5, undefined]);
    expect(missile.secondary).toEqual({ chance: 20, status: 'par' });
  });

  it('learns its own list, and MegaGargomon\'s instead while holding Megagargoite', () => {
    expect(validate(team(terriermon(['Petit Twister', 'Boomburst', 'Tera Blast', 'Vacuum Wave'], 'Silk Scarf')))).toEqual([]);
    expect(validate(team(terriermon(['Burst Shot'], 'Silk Scarf'))).join(' ')).toMatch(/can't learn Burst Shot/);
    expect(validate(team(terriermon(['Burst Shot', 'Giant Missile', 'Supercell Slam', 'Hard Press'])))).toEqual([]);
    expect(validate(team(terriermon(['Petit Twister', 'Zing Zap', 'Steel Roller', 'Meteor Mash'])))).toEqual([]);
    expect(validate(team(terriermon(['Boomburst']))).join(' ')).toMatch(/can't learn Boomburst/);
    expect(validate(team(mon('Smeargle', 'Focus Sash', 'Own Tempo', ['Burst Shot'], 'EVs: 252 Spe\n'))).join(' ')).toMatch(/Burst Shot/);
    expect(validate(team(mon('Pikachu', 'Megagargoite', 'Static', ['Thunderbolt'], 'EVs: 252 SpA\n'))).join(' ')).toMatch(/can't hold Megagargoite: only Terriermon can Matrix Evolve with it/);
  });

  it('boosts Petit Twister with Technician (60 -> 90)', () => {
    const b = singles([terriermon(['Petit Twister'], 'Leftovers')], [target]);
    b.makeChoices('move 1', 'move 1');
    const twister = b.dex.getActiveMove('Petit Twister');
    expect(b.runEvent('BasePower', b.p1.active[0], b.p2.active[0], twister, twister.basePower, true)).toBe(90);
  });

  it('Matrix Evolves into MegaGargomon, which hits four times with Burst Shot', () => {
    const b = singles([terriermon(['Burst Shot'])], [target]);
    expect(b.p1.active[0].canMegaEvo).toBe('MegaGargomon');
    b.makeChoices('move 1 mega', 'move 1');
    expect(b.p1.active[0].species.name).toBe('MegaGargomon');
    expect(b.p1.active[0].ability).toBe('elevate');
    const log = b.log.join('\n');
    expect(log).toMatch(/\|message\|Terriermon matrix-evolve to\.\.\.\n[^]*?\|detailschange\|p1a: Terriermon\|MegaGargomon[^]*?\|message\|MegaGargomon!/);
    expect(log).toMatch(/\|-hitcount\|p2a: Snorlax\|4/);
  });

  it('Elevate: a knockout with an attack raises its highest base stat (Attack), indirect ones don\'t', () => {
    const b = singles([terriermon(['Giant Missile'])], [weak(), weak('Feebas')]);
    b.makeChoices('move 1 mega', 'move 1');
    const p = b.p1.active[0];
    expect(b.p2.pokemon[0].fainted).toBe(true);
    expect(p.boosts.atk).toBe(1);
    expect(b.log.join('\n')).toMatch(/\|faint\|p2a: Magikarp\n\|-ability\|p1a: Terriermon\|Elevate\|boost\n\|-boost\|p1a: Terriermon\|atk\|1/);
    // Fainting from something other than a move (poison, weather, hazards...) doesn't count.
    const elevate = b.dex.abilities.get('Elevate') as unknown as { onSourceAfterFaint: (this: Battle, n: number, t: unknown, s: unknown, e: unknown) => void };
    elevate.onSourceAfterFaint.call(b, 1, b.p2.pokemon[0], p, b.dex.conditions.get('psn'));
    expect(p.boosts.atk).toBe(1);
  });

  it('sends Burst Shot\'s remaining hits to the partner when its target faints first (Doubles)', () => {
    const b = new Battle({ formatid: 'gen7battletreedoublesnopreview' as never, seed: '1,2,3,4' });
    const p1 = [terriermon(['Burst Shot']), BENCH[0], ...BENCH].join('\n\n');
    const p2 = [weak(), target, ...BENCH].join('\n\n');
    b.setPlayer('p1', { name: 'A', team: Teams.pack(Teams.import(p1)) });
    b.setPlayer('p2', { name: 'B', team: Teams.pack(Teams.import(p2)) });
    b.makeChoices('move 1 1 mega, move 1', 'move 1, move 1');
    const log = b.log.join('\n');
    expect(b.p2.pokemon[0].fainted).toBe(true);
    expect(log).toMatch(/\|-damage\|p2a: Magikarp\|0 fnt[^]*?\|-anim\|p1a: Terriermon\|Burst Shot\|p2b: Snorlax[^]*?\|-hitcount\|p2b: Snorlax\|3/);
    // Without a partner left to hit, the rest are lost (as for any multi-hit move).
    const c = singles([terriermon(['Burst Shot'])], [weak()]);
    c.makeChoices('move 1 mega', 'move 1');
    expect(c.log.join('\n')).toMatch(/\|-hitcount\|p2a?: Magikarp\|1/);
    expect(c.log.join('\n')).not.toMatch(/\|-anim\|/);
  });
});
