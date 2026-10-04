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
const team = (lead: string) => [lead, ...BENCH].join('\n\n');

function battle(p1Lead: string, p2Lead: string) {
  const b = new Battle({ formatid: 'gen7battletreesinglesnopreview' as never, seed: '1,2,3,4' });
  b.setPlayer('p1', { name: 'A', team: Teams.pack(Teams.import(team(p1Lead))) });
  b.setPlayer('p2', { name: 'B', team: Teams.pack(Teams.import(team(p2Lead))) });
  return b;
}
const target = mon('Snorlax', 'Leftovers', 'Thick Fat', ['Splash'], 'EVs: 252 HP / 252 Def\n');

describe('Politoedite / Mega Politoed', () => {
  it('defines Mega Politoed from Politoed with the custom stats and Rain Dish', () => {
    const base = dex.species.get('Politoed');
    const mega = dex.species.get('Politoed-Mega');
    expect(mega.exists).toBe(true);
    expect(mega.isMega).toBe(true);
    expect(mega.types).toEqual(base.types);
    expect(mega.abilities).toEqual({ 0: 'Rain Dish' });
    expect(mega.baseStats).toEqual({ ...base.baseStats, spa: base.baseStats.spa + 40, def: base.baseStats.def + 30, spd: base.baseStats.spd + 30 });
    expect(mega.baseStats).toEqual({ hp: 90, atk: 75, def: 105, spa: 130, spd: 130, spe: 70 });
    expect(dex.items.get('Politoedite').megaStone).toEqual({ Politoed: 'Politoed-Mega' });
  });

  it('is legal on Politoed', () => {
    expect(validate(team(mon('Politoed', 'Politoedite', 'Drizzle', ['Scald', 'Ice Beam'])))).toEqual([]);
  });

  it('Mega Evolves Politoed (and only Politoed)', () => {
    const b = battle(mon('Politoed', 'Politoedite', 'Drizzle', ['Rain Dance']), target);
    expect(b.p1.active[0].canMegaEvo).toBe('Politoed-Mega');
    b.makeChoices('move 1 mega', 'move 1');
    expect(b.p1.active[0].species.name).toBe('Politoed-Mega');
    expect(b.p1.active[0].ability).toBe('raindish');
    expect(b.log.join('\n')).toMatch(/\|detailschange\|p1a: Politoed\|Politoed-Mega/);
    const other = battle(mon('Poliwrath', 'Politoedite', 'Water Absorb', ['Splash']), target);
    expect(other.p1.active[0].canMegaEvo).toBeFalsy();
  });
});

describe('Poliwrathium Z', () => {
  const poliwrath = (moves: string[], item = 'Poliwrathium Z', species = 'Poliwrath') =>
    battle(mon(species, item, 'Water Absorb', moves, 'EVs: 252 Atk\nAdamant Nature\n'), target);
  const zNames = (b: Battle) => (b.p1.activeRequest as { active: { canZMove?: ({ move: string } | null)[] }[] }).active[0].canZMove?.map(z => z?.move ?? null);

  it('Poliwrath can learn Drain Punch (custom; Gen 8+ only in the games), and its relatives still can\'t', () => {
    expect(validate(team(mon('Poliwrath', 'Poliwrathium Z', 'Water Absorb', ['Drain Punch', 'Waterfall', 'Ice Punch', 'Bulk Up'], 'EVs: 252 Atk\n')))).toEqual([]);
    expect(validate(team(mon('Politoed', 'Leftovers', 'Drizzle', ['Drain Punch'], 'EVs: 252 HP\n'))).join(' ')).toMatch(/Drain Punch/);
    expect(validate(team(mon('Poliwhirl', 'Eviolite', 'Water Absorb', ['Drain Punch'], 'EVs: 252 HP\n'))).join(' ')).toMatch(/Drain Punch/);
  });

  it('is legal on Poliwrath', () => {
    // Gen 7 Poliwrath learns Brick Break / Dynamic Punch (Close Combat is Gen 9 only).
    expect(validate(team(mon('Poliwrath', 'Poliwrathium Z', 'Water Absorb', ['Brick Break', 'Waterfall', 'Ice Punch', 'Bulk Up'])))).toEqual([]);
  });

  it('turns damaging Fighting, Water and Ice moves into its own Z-Moves, and nothing else', () => {
    const b = poliwrath(['Close Combat', 'Waterfall', 'Ice Punch', 'Bulk Up']);
    expect(zNames(b)).toEqual(['Omega Wrath', 'Riptide Rocket Rush', 'Glacial Guardian Gauntlet', null]);
    expect(zNames(poliwrath(['Earthquake', 'Hypnosis']))).toBeUndefined();
    // Only Poliwrath can use it.
    expect(zNames(battle(mon('Politoed', 'Poliwrathium Z', 'Drizzle', ['Waterfall']), target))).toBeUndefined();
  });

  it('Omega Wrath hits with Fightinium Z power, then sets up a free Substitute and raises Attack and Defense', () => {
    const b = poliwrath(['Close Combat']);
    const hpBefore = b.p1.active[0].hp;
    b.makeChoices('move 1 zmove', 'move 1');
    const log = b.log.join('\n');
    expect(log).toMatch(/\|move\|p1a: Poliwrath\|Omega Wrath\|p2a: Snorlax/);
    expect(log).toMatch(/\|-start\|p1a: Poliwrath\|Substitute/);
    const p = b.p1.active[0];
    expect(p.hp).toBe(hpBefore); // no HP spent on the Substitute
    expect(p.volatiles.substitute).toBeTruthy();
    expect(p.boosts).toMatchObject({ atk: 1, def: 1 });
    // Close Combat's Z power is 190, as with Fightinium Z.
    expect(dex.moves.get('Close Combat').zMove?.basePower).toBe(190);
  });

  it('Riptide Rocket Rush raises Attack 1 and Speed 2; Glacial Guardian Gauntlet raises Attack, Defense and Sp. Def 1', () => {
    const water = poliwrath(['Waterfall']);
    water.makeChoices('move 1 zmove', 'move 1');
    expect(water.log.join('\n')).toMatch(/\|move\|p1a: Poliwrath\|Riptide Rocket Rush/);
    expect(water.p1.active[0].boosts).toMatchObject({ atk: 1, spe: 2 });
    const ice = poliwrath(['Ice Punch']);
    ice.makeChoices('move 1 zmove', 'move 1');
    expect(ice.log.join('\n')).toMatch(/\|move\|p1a: Poliwrath\|Glacial Guardian Gauntlet/);
    expect(ice.p1.active[0].boosts).toMatchObject({ atk: 1, def: 1, spd: 1 });
  });
});

describe('field effect durations', () => {
  it('tags weather, terrain, rooms and Tailwind with their real length', () => {
    const b = battle(mon('Politoed', 'Damp Rock', 'Drizzle', ['Trick Room', 'Tailwind']), mon('Tapu Koko', 'Terrain Extender', 'Electric Surge', ['Splash']));
    b.makeChoices('move 1', 'move 1');
    b.makeChoices('move 2', 'move 1');
    const log = b.log.join('\n');
    expect(log).toMatch(/\|-weather\|RainDance\|\[from\] ability: Drizzle\|\[of\] p1a: Politoed\|\[turns\] 8/);
    expect(log).toMatch(/\|-fieldstart\|move: Electric Terrain\|\[from\] ability: Electric Surge\|\[of\] p2a: Tapu Koko\|\[turns\] 8/);
    expect(log).toMatch(/\|-fieldstart\|move: Trick Room\|\[of\] p1a: Politoed\|\[turns\] 5/);
    expect(log).toMatch(/\|-sidestart\|p1: A\|move: Tailwind\|\[turns\] 4/);
    // Upkeep messages stay untagged.
    expect(log).not.toMatch(/\[upkeep\][^\n]*\[turns\]/);
  });
});
