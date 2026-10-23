import { describe, expect, it } from 'vitest';
import { Battle, Dex, Teams, TeamValidator } from '@pkmn/sim';
import { GALAR_BIRD_MOVES, GALAR_BIRD_NEW_MOVES, GALAR_BIRDS } from '../data/galar-birds';
import { allMoves, eligibleSpecies, gen7, learnableMoves } from '../team/dex';
import { FORMAT_IDS, IGNORED_VALIDATOR_PROBLEMS, NO_PREVIEW_FORMAT_IDS, registerBattleTreeFormats } from './format';

registerBattleTreeFormats();
const validator = new TeamValidator(Dex.formats.get(FORMAT_IDS.singles));
const validate = (text: string) =>
  (validator.validateTeam(Teams.import(text)) ?? []).filter(p => !IGNORED_VALIDATOR_PROBLEMS.some(r => r.test(p)));

const mon = (species: string, item: string, ability: string, moves: string[]) =>
  `${species} @ ${item}\nAbility: ${ability}\nLevel: 50\n${moves.map(m => `- ${m}`).join('\n')}`;
const CHANSEY = mon('Chansey', 'Eviolite', 'Natural Cure', ['Soft-Boiled']);
const SNORLAX = mon('Snorlax', 'Leftovers', 'Thick Fat', ['Rest', 'Splash']);
const ARTICUNO = mon('Articuno-Galar', 'Leftovers', 'Competitive', ['Freezing Glare', 'Expanding Force', 'Hurricane', 'Recover']);
const ZAPDOS = mon('Zapdos-Galar', 'Expert Belt', 'Defiant', ['Thunderous Kick', 'Dual Wingbeat', 'Brave Bird', 'Coaching']);
const MOLTRES = mon('Moltres-Galar', 'Lagging Tail', 'Berserk', ['Fiery Wrath', 'Lash Out', 'Nasty Plot', 'Hurricane']);

function battle(p1: string[], p2: string[], format = NO_PREVIEW_FORMAT_IDS.singles) {
  const b = new Battle({ formatid: format as never, seed: '1,2,3,4' });
  b.setPlayer('p1', { name: 'A', team: Teams.pack(Teams.import(p1.join('\n\n'))) });
  b.setPlayer('p2', { name: 'B', team: Teams.pack(Teams.import(p2.join('\n\n'))) });
  return b;
}

describe('the Galarian legendary birds', () => {
  it('are registrable, with their Sword and Shield stats, types and Abilities', () => {
    const names = eligibleSpecies().map(s => s.name);
    for (const bird of GALAR_BIRDS) expect(names, bird).toContain(bird);
    expect(gen7.species.get('Articuno-Galar')!.types).toEqual(['Psychic', 'Flying']);
    expect(gen7.species.get('Zapdos-Galar')!.abilities[0]).toBe('Defiant');
    expect(gen7.species.get('Moltres-Galar')!.baseStats.spd).toBe(125);
  });

  it('learn exactly their moves from Sword and Shield, Gen 8 moves included', async () => {
    expect(GALAR_BIRD_NEW_MOVES).toEqual(['Coaching', 'Dual Wingbeat', 'Expanding Force', 'Fiery Wrath', 'Freezing Glare', 'Lash Out', 'Thunderous Kick']);
    for (const bird of GALAR_BIRDS) {
      expect((await learnableMoves(bird)).map(m => m.name).sort(), bird).toEqual([...GALAR_BIRD_MOVES[bird]].sort());
    }
    expect(validate([ARTICUNO, ZAPDOS, MOLTRES].join('\n\n'))).toEqual([]);
    // Trick is a Scarlet and Violet move for Galarian Articuno, not a Sword and Shield one.
    expect(validate([mon('Articuno-Galar', 'Leftovers', 'Competitive', ['Trick']), CHANSEY, SNORLAX].join('\n\n')).join(' ')).toMatch(/Trick/);
  });

  it("keeps their Gen 8 moves theirs: nobody else learns them, Smeargle can't Sketch them", () => {
    const sketchable = new Set<string>(allMoves().map(m => m.name));
    for (const move of GALAR_BIRD_NEW_MOVES) expect(sketchable.has(move), move).toBe(false);
    expect(validate([mon('Smeargle', 'Focus Sash', 'Own Tempo', ['Freezing Glare']), CHANSEY, SNORLAX].join('\n\n')).join(' ')).toMatch(/Freezing Glare/);
    expect(validate([mon('Articuno', 'Leftovers', 'Pressure', ['Freezing Glare']), CHANSEY, SNORLAX].join('\n\n')).join(' ')).toMatch(/Freezing Glare/);
  });

  it('use their Gen 8 moves in battle: Thunderous Kick lowers Defense, Dual Wingbeat hits twice, Lash Out doubles after a stat drop', () => {
    // Slowbro takes Fighting moves at half power, and survives.
    const b = battle([ZAPDOS], [mon('Slowbro', 'Leftovers', 'Own Tempo', ['Splash'])]);
    b.makeChoices('move Thunderous Kick', 'move Splash');
    expect(b.p2.active[0].boosts.def).toBe(-1);
    const b2 = battle([ZAPDOS], [SNORLAX]);
    b2.makeChoices('move Dual Wingbeat', 'move Splash');
    expect(b2.log.join('\n')).toMatch(/\|-hitcount\|p2a: Snorlax\|2/);
    // Lash Out (last, Lagging Tail) after Growl hits harder than without it, even at -1 Attack (power 75 -> 150).
    const lashOut = (foe: string) => {
      const b3 = battle([MOLTRES], [mon('Snorlax', 'Leftovers', 'Thick Fat', [foe])]);
      b3.makeChoices('move Lash Out', `move ${foe}`);
      const snorlax = b3.p2.active[0];
      return snorlax.maxhp - snorlax.hp;
    };
    expect(lashOut('Growl')).toBeGreaterThan(lashOut('Splash'));
  });

  it('play their signature moves: Freezing Glare, Fiery Wrath (both foes in Doubles), Expanding Force', () => {
    const b = battle([ARTICUNO], [SNORLAX]);
    b.makeChoices('move Freezing Glare', 'move Splash');
    expect(b.log.join('\n')).toMatch(/\|move\|p1a: Articuno\|Freezing Glare\|p2a: Snorlax/);
    expect(b.p2.active[0].hp).toBeLessThan(b.p2.active[0].maxhp);
    b.makeChoices('move Expanding Force', 'move Splash');
    expect(b.log.join('\n')).toMatch(/\|move\|p1a: Articuno\|Expanding Force/);
    const d = battle([MOLTRES, ZAPDOS, CHANSEY, ARTICUNO], [SNORLAX, mon('Blissey', 'Leftovers', 'Natural Cure', ['Splash']), CHANSEY, mon('Lapras', 'Leftovers', 'Water Absorb', ['Splash'])], NO_PREVIEW_FORMAT_IDS.doubles);
    d.makeChoices('move Fiery Wrath, move Coaching -1', 'move Splash, move Splash');
    expect(d.p2.active.every(p => p.hp < p.maxhp)).toBe(true);
    expect(d.p1.active[0].boosts).toMatchObject({ atk: 1, def: 1 });
  });
});
