import { describe, expect, it } from 'vitest';
import { Battle, Dex, Teams, TeamValidator } from '@pkmn/sim';
import { CHAMPIONS_MEGAS, CHAMPIONS_MOD } from '../data/champions';
import { FORMAT_IDS, IGNORED_VALIDATOR_PROBLEMS, registerBattleTreeFormats } from './format';

registerBattleTreeFormats();
const validator = new TeamValidator(Dex.formats.get(FORMAT_IDS.singles));
const validate = (text: string) =>
  (validator.validateTeam(Teams.import(text)) ?? []).filter(p => !IGNORED_VALIDATOR_PROBLEMS.some(r => r.test(p)));

const mon = (species: string, item: string, ability: string, moves: string[], extra = '') =>
  `${species} @ ${item}\nAbility: ${ability}\nLevel: 50\n${extra}${moves.map(m => `- ${m}`).join('\n')}`;
const FILLER = [
  mon('Snorlax', 'Leftovers', 'Thick Fat', ['Body Slam', 'Rest']),
  mon('Tapu Koko', 'Choice Specs', 'Electric Surge', ['Thunderbolt']),
];
const team = (...mons: string[]) => [...mons, ...FILLER].join('\n\n');

describe('Pokémon Champions Megas: legality', () => {
  it.each([
    ['Clefable', 'Clefablite', 'Magic Guard', ['Moonblast', 'Calm Mind']],
    ['Lucario', 'Lucarionite Z', 'Inner Focus', ['Aura Sphere', 'Flash Cannon']],
    ['Garchomp', 'Garchompite Z', 'Rough Skin', ['Earthquake', 'Draco Meteor']],
    ['Absol', 'Absolite Z', 'Super Luck', ['Knock Off', 'Sucker Punch']],
    ['Meowstic-F', 'Meowsticite', 'Competitive', ['Psychic', 'Shadow Ball']],
    ['Floette-Eternal', 'Floettite', 'Flower Veil', ['Light of Ruin', 'Moonblast']],
    // Gen 8-9 Pokémon (approved): legal with moves from their newest learnsets.
    ['Falinks', 'Falinksite', 'Defiant', ['No Retreat', 'Close Combat', 'Throat Chop']],
    ['Scovillain', 'Scovillainite', 'Chlorophyll', ['Spicy Extract', 'Flamethrower', 'Giga Drain']],
    ['Glimmora', 'Glimmoranite', 'Toxic Debris', ['Mortal Spin', 'Power Gem', 'Sludge Wave']],
    ['Baxcalibur', 'Baxcalibrite', 'Thermal Exchange', ['Glaive Rush', 'Icicle Crash']],
  ])('%s @ %s is legal', (species, item, ability, moves) => {
    expect(validate(team(mon(species, item, ability, moves)))).toEqual([]);
  });

  it('makes every Champions Mega Stone a legal item for its Pokémon', () => {
    const stones = new Set(CHAMPIONS_MEGAS.map(m => m.megaStone));
    expect(stones.size).toBe(39);
    for (const stone of stones) expect(Dex.mod(CHAMPIONS_MOD).items.get(stone).isNonstandard, stone).toBeFalsy();
  });

  it('keeps Gen 7 learnsets for everyone else', () => {
    // Body Press is a Gen 8 move; Garchomp doesn't learn it in Gen 7.
    expect(validate(team(mon('Garchomp', 'Garchompite Z', 'Rough Skin', ['Body Press'])))).not.toEqual([]);
    // Smeargle can't Sketch the moves that were made available for the Champions Pokémon.
    expect(validate(team(mon('Smeargle', 'Focus Sash', 'Own Tempo', ['Spicy Extract'])))).not.toEqual([]);
    expect(validate(team(mon('Smeargle', 'Focus Sash', 'Own Tempo', ['Spore', 'Sticky Web'])))).toEqual([]);
    // And a Gen 9 Pokémon can't use moves outside its own learnset.
    expect(validate(team(mon('Glimmora', 'Glimmoranite', 'Toxic Debris', ['Spicy Extract'])))).not.toEqual([]);
  });

  it('still bans the Sun & Moon banlist and USUM-only Pokémon', () => {
    expect(validate(team(mon('Mewtwo', 'Mewtwonite Y', 'Pressure', ['Psystrike'])))).not.toEqual([]);
    expect(validate(team(mon('Poipole', 'Life Orb', 'Beast Boost', ['Sludge Bomb'])))).not.toEqual([]);
  });
});

describe('Pokémon Champions Megas: in battle', () => {
  function battleWith(p1: string, p2: string) {
    const battle = new Battle({ formatid: 'gen7battletreesinglesnopreview' as never, seed: '1,2,3,4' });
    battle.setPlayer('p1', { name: 'A', team: Teams.pack(Teams.import(p1)) });
    battle.setPlayer('p2', { name: 'B', team: Teams.pack(Teams.import(p2)) });
    return battle;
  }
  const filler = (lead: string) => [lead, mon('Snorlax', 'Leftovers', 'Thick Fat', ['Splash']), mon('Chansey', 'Eviolite', 'Natural Cure', ['Splash'])].join('\n\n');

  it('Mega Evolves into the Champions forme with its Champions Ability (Mega Lucario Z: Aura Guard)', () => {
    const battle = battleWith(filler(mon('Lucario', 'Lucarionite Z', 'Inner Focus', ['Swords Dance'])), filler(mon('Snorlax', 'Leftovers', 'Thick Fat', ['Splash'])));
    battle.makeChoices('move 1 mega', 'move 1');
    const lucario = battle.p1.active[0];
    expect(lucario.species.name).toBe('Lucario-Mega-Z');
    expect(lucario.ability).toBe('auraguard');
    expect(battle.log.join('\n')).toMatch(/\|detailschange\|p1a: Lucario\|Lucario-Mega-Z/);
  });

  it('Aura Guard halves damage from contact moves only', () => {
    const attacker = (moves: string[]) => filler(mon('Rampardos', 'Choice Band', 'Sheer Force', moves));
    const damageTaken = (megaZ: boolean, move: string) => {
      const battle = battleWith(filler(mon('Lucario', megaZ ? 'Lucarionite Z' : 'Lucarionite', 'Inner Focus', ['Protect', 'Swords Dance'])), attacker([move]));
      battle.makeChoices('move 2 mega', 'move 1'); // Rampardos is slower: Lucario Mega Evolves first
      const lucario = battle.p1.active[0];
      return lucario.maxhp - lucario.hp;
    };
    // The two Megas have different Defense, so compare each one's contact / non-contact damage ratio.
    const contact = damageTaken(true, 'Zen Headbutt') / damageTaken(true, 'Rock Slide');
    const normal = damageTaken(false, 'Zen Headbutt') / damageTaken(false, 'Rock Slide');
    expect(contact / normal).toBeGreaterThan(0.35);
    expect(contact / normal).toBeLessThan(0.65);
  });
});
