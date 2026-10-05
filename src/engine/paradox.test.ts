import { describe, expect, it } from 'vitest';
import { Battle, Dex, Teams, TeamValidator } from '@pkmn/sim';
import { PARADOX_FORMS } from '../data/custom/paradox';
import { FORMAT_IDS, IGNORED_VALIDATOR_PROBLEMS, NO_PREVIEW_FORMAT_IDS, registerBattleTreeFormats } from './format';

registerBattleTreeFormats();
const validator = new TeamValidator(Dex.formats.get(FORMAT_IDS.singles));
const validate = (text: string) =>
  (validator.validateTeam(Teams.import(text)) ?? []).filter(p => !IGNORED_VALIDATOR_PROBLEMS.some(r => r.test(p)));

const mon = (species: string, item: string, ability: string, moves: string[], extra = '') =>
  `${species} @ ${item}\nAbility: ${ability}\nLevel: 50\n${extra}${moves.map(m => `- ${m}`).join('\n')}`;
const CHANSEY = mon('Chansey', 'Eviolite', 'Natural Cure', ['Soft-Boiled']);
const SNORLAX = mon('Snorlax', 'Leftovers', 'Thick Fat', ['Rest']);
const GREAT_TUSK = mon('Donphan', 'Paradoxorb-A', 'Sturdy', ['Headlong Rush', 'Close Combat', 'Rapid Spin', 'Earthquake']);

function battle(p1: string[], p2: string[], format = NO_PREVIEW_FORMAT_IDS.singles) {
  const b = new Battle({ formatid: format as never, seed: '1,2,3,4' });
  b.setPlayer('p1', { name: 'A', team: Teams.pack(Teams.import(p1.join('\n\n'))) });
  b.setPlayer('p2', { name: 'B', team: Teams.pack(Teams.import(p2.join('\n\n'))) });
  return b;
}

describe('Paradox Evolution: data and legality', () => {
  it('covers the Paradox Pokémon whose original is in Sun & Moon (not Koraidon / Miraidon)', () => {
    const forms = PARADOX_FORMS.map(f => f.form);
    expect(forms).toHaveLength(20);
    expect(forms).not.toContain('Koraidon');
    expect(PARADOX_FORMS.find(f => f.form === 'Iron Valiant')!.bases).toEqual(['Gardevoir', 'Gallade']);
    // Both orbs work on Volcarona and Donphan.
    expect(PARADOX_FORMS.filter(f => f.bases.includes('Volcarona')).map(f => f.form).sort()).toEqual(['Iron Moth', 'Slither Wing']);
  });

  it("is legal with the Paradox form's moves, Gen 9 ones included", () => {
    expect(validate([GREAT_TUSK, CHANSEY, SNORLAX].join('\n\n'))).toEqual([]);
  });

  it('checks moves against the Paradox form, not the original', () => {
    // Donphan learns Brutal Swing in Gen 7; Great Tusk doesn't.
    expect(validate([mon('Donphan', 'Paradoxorb-A', 'Sturdy', ['Brutal Swing']), CHANSEY, SNORLAX].join('\n\n')).join(' ')).toMatch(/Brutal Swing/);
    // Without the orb, Gen 9 moves are illegal again.
    expect(validate([mon('Donphan', 'Leftovers', 'Sturdy', ['Headlong Rush']), CHANSEY, SNORLAX].join('\n\n')).join(' ')).toMatch(/Headlong Rush/);
    // ...and Smeargle can't Sketch them.
    expect(validate([mon('Smeargle', 'Focus Sash', 'Own Tempo', ['Headlong Rush']), CHANSEY, SNORLAX].join('\n\n')).join(' ')).toMatch(/Headlong Rush/);
  });

  it('only allows a Paradoxorb on Pokémon with that kind of form', () => {
    expect(validate([mon('Snorlax', 'Paradoxorb-A', 'Thick Fat', ['Rest']), CHANSEY, mon('Garchomp', 'Leftovers', 'Rough Skin', ['Earthquake'])].join('\n\n')).join(' '))
      .toMatch(/Snorlax can't hold Paradoxorb-A/);
    // Delibird only has a Future form.
    expect(validate([mon('Delibird', 'Paradoxorb-A', 'Hustle', ['Present']), CHANSEY, SNORLAX].join('\n\n')).join(' ')).toMatch(/no Ancient Paradox form/);
  });

  it("can't register a Paradox Pokémon directly", () => {
    expect(validate([mon('Great Tusk', 'Leftovers', 'Protosynthesis', ['Earthquake']), CHANSEY, SNORLAX].join('\n\n')).length).toBeGreaterThan(0);
  });

  it('exempts Paradoxorbs from Item Clause (other items still count)', () => {
    const team = [GREAT_TUSK, mon('Volcarona', 'Paradoxorb-A', 'Flame Body', ['Close Combat']), mon('Salamence', 'Paradoxorb-A', 'Intimidate', ['Crunch'])];
    expect(validate(team.join('\n\n'))).toEqual([]);
    expect(validate([CHANSEY, SNORLAX, mon('Blissey', 'Leftovers', 'Natural Cure', ['Soft-Boiled'])].join('\n\n')).join(' ')).toMatch(/Item Clause/);
  });
});

describe('Paradox Evolution in battle', () => {
  it('evolves automatically when first sent out, with its own messages (no Mega Evolution)', () => {
    const b = battle([GREAT_TUSK, CHANSEY, SNORLAX], [CHANSEY, SNORLAX, mon('Blissey', 'Sitrus Berry', 'Natural Cure', ['Soft-Boiled'])]);
    const log = b.log.join('\n');
    const tusk = b.p1.active[0];
    expect(tusk.species.name).toBe('Great Tusk');
    expect(tusk.ability).toBe('protosynthesis');
    expect(tusk.gender).toBe('');
    expect(log).toMatch(/\|detailschange\|p1a: Donphan\|Great Tusk, L50/);
    expect(log).toMatch(/is resonating with the ancient past!/);
    expect(log).toMatch(/Donphan Paradox Evolved into Great Tusk!/);
    expect(log).not.toMatch(/-mega/);
    // Great Tusk's Attack and Defense tie (131): Attack wins the tie.
    expect(log).toMatch(/\|-start\|p1a: Donphan\|protosynthesisatk/);
    expect(tusk.volatiles.paradoxboost).toBeTruthy();
  });

  it('boosts the highest stat by 1.3x (Speed by 1.5x) as a flat modifier, not a stat stage', () => {
    const b = battle([GREAT_TUSK, CHANSEY, SNORLAX], [CHANSEY, SNORLAX, mon('Blissey', 'Sitrus Berry', 'Natural Cure', ['Soft-Boiled'])]);
    const tusk = b.p1.active[0];
    // getStat(stat, unboosted, unmodified): the unmodified stat is without the Ability.
    const atk = tusk.getStat('atk', false, true);
    expect(Math.abs(tusk.getStat('atk') - atk * 1.3)).toBeLessThanOrEqual(1);
    expect(tusk.getStat('def')).toBe(tusk.getStat('def', false, true));
    expect(tusk.boosts.atk).toBe(0);

    const bundle = battle([mon('Delibird', 'Paradoxorb-F', 'Hustle', ['Freeze-Dry']), CHANSEY, SNORLAX], [CHANSEY, SNORLAX, mon('Blissey', 'Sitrus Berry', 'Natural Cure', ['Soft-Boiled'])]);
    const ib = bundle.p1.active[0];
    expect(ib.species.name).toBe('Iron Bundle');
    expect(bundle.log.join('\n')).toMatch(/\|-start\|p1a: Delibird\|quarkdrivespe/);
    expect(Math.abs(ib.getStat('spe') - ib.getStat('spe', false, true) * 1.5)).toBeLessThanOrEqual(1);
  });

  it("isn't removed by Haze, ends on switching out, comes back on switching in, and the form stays", () => {
    const b = battle([GREAT_TUSK, CHANSEY, SNORLAX], [mon('Weezing', 'Black Sludge', 'Levitate', ['Haze']), SNORLAX, CHANSEY]);
    b.makeChoices('move 3', 'move 1'); // Rapid Spin / Haze
    expect(b.p1.active[0].volatiles.paradoxboost).toBeTruthy();
    b.makeChoices('switch 2', 'move 1');
    const tusk = b.p1.pokemon.find(p => p.species.name === 'Great Tusk')!;
    expect(tusk.isActive).toBe(false);
    expect(tusk.volatiles.paradoxboost).toBeUndefined();
    b.makeChoices('switch 2', 'move 1');
    expect(b.p1.active[0].species.name).toBe('Great Tusk');
    expect(b.p1.active[0].volatiles.paradoxboost).toBeTruthy();
    // Evolved once; the boost restarted.
    const log = b.log.join('\n');
    expect(log.match(/Paradox Evolved into/g)).toHaveLength(1);
    expect(log.match(/\|-start\|p1a: Donphan\|protosynthesisatk/g)).toHaveLength(2);
  });

  it('skips the original Ability (no Intimidate from Salamence) and allows several Paradox Evolutions per battle', () => {
    const b = battle(
      [mon('Salamence', 'Paradoxorb-A', 'Intimidate', ['Crunch']), mon('Volcarona', 'Paradoxorb-F', 'Flame Body', ['Fiery Dance']), CHANSEY],
      [mon('Gyarados', 'Leftovers', 'Intimidate', ['Waterfall']), SNORLAX, CHANSEY],
    );
    expect(b.p1.active[0].species.name).toBe('Roaring Moon');
    expect(b.log.join('\n')).not.toMatch(/\|-ability\|p1a: [^|]*\|Intimidate/);
    b.makeChoices('switch 2', 'move 1');
    expect(b.p1.active[0].species.name).toBe('Iron Moth');
    expect(b.log.join('\n').match(/Paradox Evolved into/g)).toHaveLength(2);
  });

  it("can't have its Paradoxorb taken", () => {
    const b = battle([GREAT_TUSK, CHANSEY, SNORLAX], [mon('Alakazam', 'Choice Scarf', 'Magic Guard', ['Trick']), SNORLAX, CHANSEY]);
    b.makeChoices('move 1', 'move 1');
    expect(b.p1.active[0].item).toBe('paradoxorba');
  });

  it('evolves both leads in Doubles', () => {
    const b = battle(
      [GREAT_TUSK, mon('Gallade', 'Paradoxorb-F', 'Justified', ['Close Combat']), CHANSEY, SNORLAX],
      [CHANSEY, SNORLAX, mon('Blissey', 'Sitrus Berry', 'Natural Cure', ['Soft-Boiled']), mon('Wobbuffet', 'Leftovers', 'Shadow Tag', ['Counter'])],
      NO_PREVIEW_FORMAT_IDS.doubles,
    );
    expect(b.p1.active.map(p => p.species.name)).toEqual(['Great Tusk', 'Iron Valiant']);
  });
});
