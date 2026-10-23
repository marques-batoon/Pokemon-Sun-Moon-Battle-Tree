import { describe, expect, it } from 'vitest';
import { Battle, Dex, Teams, TeamValidator } from '@pkmn/sim';
import { calcErrors, estimateDamage } from '../ai/heuristic/calc';
import { HeuristicAI } from '../ai/heuristic/heuristic-ai';
import { NEW_STARTERS, STARTER_MOVES, STARTER_NEW_ABILITIES, STARTER_NEW_MOVES } from '../data/starters';
import { allMoves, eligibleSpecies, gen7, learnableMoves, speciesAbilities } from '../team/dex';
import { FORMAT_IDS, IGNORED_VALIDATOR_PROBLEMS, NO_PREVIEW_FORMAT_IDS, registerBattleTreeFormats } from './format';
import { seedFromString } from './seed';
import { BattleSession } from './session';

registerBattleTreeFormats();
const validator = new TeamValidator(Dex.formats.get(FORMAT_IDS.singles));
const validate = (text: string) =>
  (validator.validateTeam(Teams.import(text)) ?? []).filter(p => !IGNORED_VALIDATOR_PROBLEMS.some(r => r.test(p)));

const mon = (species: string, item: string, ability: string, moves: string[]) =>
  `${species} @ ${item}\nAbility: ${ability}\nLevel: 50\n${moves.map(m => `- ${m}`).join('\n')}`;
const CHANSEY = mon('Chansey', 'Eviolite', 'Natural Cure', ['Soft-Boiled']);
const SNORLAX = mon('Snorlax', 'Leftovers', 'Thick Fat', ['Rest', 'Splash']);
const RILLABOOM = mon('Rillaboom', 'Choice Band', 'Grassy Surge', ['Drum Beating', 'Grassy Glide', 'Fake Out', 'Wood Hammer']);
const CINDERACE = mon('Cinderace', 'Life Orb', 'Libero', ['Pyro Ball', 'High Jump Kick', 'U-turn', 'Court Change']);
const INTELEON = mon('Inteleon', 'Choice Specs', 'Sniper', ['Snipe Shot', 'Ice Beam', 'Dark Pulse', 'Air Slash']);
const MEOWSCARADA = mon('Meowscarada', 'Focus Sash', 'Protean', ['Flower Trick', 'Knock Off', 'Triple Axel', 'U-turn']);
const SKELEDIRGE = mon('Skeledirge', 'Leftovers', 'Unaware', ['Torch Song', 'Shadow Ball', 'Slack Off', 'Will-O-Wisp']);
const QUAQUAVAL = mon('Quaquaval', 'Expert Belt', 'Moxie', ['Aqua Step', 'Close Combat', 'Wave Crash', 'Ice Spinner']);

/** Every stage of every starter line, Generations 1-9. */
const STARTERS = [
  'Bulbasaur', 'Ivysaur', 'Venusaur', 'Charmander', 'Charmeleon', 'Charizard', 'Squirtle', 'Wartortle', 'Blastoise',
  'Chikorita', 'Bayleef', 'Meganium', 'Cyndaquil', 'Quilava', 'Typhlosion', 'Totodile', 'Croconaw', 'Feraligatr',
  'Treecko', 'Grovyle', 'Sceptile', 'Torchic', 'Combusken', 'Blaziken', 'Mudkip', 'Marshtomp', 'Swampert',
  'Turtwig', 'Grotle', 'Torterra', 'Chimchar', 'Monferno', 'Infernape', 'Piplup', 'Prinplup', 'Empoleon',
  'Snivy', 'Servine', 'Serperior', 'Tepig', 'Pignite', 'Emboar', 'Oshawott', 'Dewott', 'Samurott',
  'Chespin', 'Quilladin', 'Chesnaught', 'Fennekin', 'Braixen', 'Delphox', 'Froakie', 'Frogadier', 'Greninja',
  'Rowlet', 'Dartrix', 'Decidueye', 'Litten', 'Torracat', 'Incineroar', 'Popplio', 'Brionne', 'Primarina',
  'Grookey', 'Thwackey', 'Rillaboom', 'Scorbunny', 'Raboot', 'Cinderace', 'Sobble', 'Drizzile', 'Inteleon',
  'Sprigatito', 'Floragato', 'Meowscarada', 'Fuecoco', 'Crocalor', 'Skeledirge', 'Quaxly', 'Quaxwell', 'Quaquaval',
];

function battle(p1: string[], p2: string[], format = NO_PREVIEW_FORMAT_IDS.singles) {
  const b = new Battle({ formatid: format as never, seed: '1,2,3,4' });
  b.setPlayer('p1', { name: 'A', team: Teams.pack(Teams.import(p1.join('\n\n'))) });
  b.setPlayer('p2', { name: 'B', team: Teams.pack(Teams.import(p2.join('\n\n'))) });
  return b;
}

describe('the starter Pokémon of Generations 1-9', () => {
  it('are all registrable: Generation 8 and 9\'s added, with their own stats, types and Abilities (Libero new)', () => {
    expect(NEW_STARTERS).toEqual(STARTERS.slice(-18));
    const names = new Set<string>(eligibleSpecies().map(s => s.name));
    for (const name of STARTERS) expect(names.has(name), name).toBe(true);
    expect(gen7.species.get('Meowscarada')!.types).toEqual(['Grass', 'Dark']);
    expect(gen7.species.get('Skeledirge')!.types).toEqual(['Fire', 'Ghost']);
    expect(gen7.species.get('Quaquaval')!.types).toEqual(['Water', 'Fighting']);
    expect(gen7.species.get('Cinderace')!.baseStats.spe).toBe(119);
    expect(STARTER_NEW_ABILITIES).toEqual(['Libero']);
    expect(speciesAbilities('Cinderace')).toEqual(['Blaze', 'Libero']);
    expect(speciesAbilities('Meowscarada')).toEqual(['Overgrow', 'Protean']);
    expect(gen7.abilities.get('Libero')?.exists).toBe(true);
  });

  it('learn exactly their moves from their debut game (their pre-evolutions\' too), its new moves included', async () => {
    expect(STARTER_NEW_MOVES).toEqual([
      'Alluring Voice', 'Aqua Cutter', 'Aqua Step', 'Body Press', 'Branch Poke', 'Breaking Swipe', 'Chilling Water', 'Coaching', 'Court Change',
      'Drum Beating', 'Flip Turn', 'Flower Trick', 'Grassy Glide', 'Ice Spinner', 'Lash Out', 'Poltergeist', 'Pyro Ball', 'Scale Shot',
      'Scorching Sands', 'Snipe Shot', 'Temper Flare', 'Tera Blast', 'Torch Song', 'Trailblaze', 'Triple Axel', 'Upper Hand', 'Wave Crash',
    ]);
    for (const name of NEW_STARTERS) {
      expect((await learnableMoves(name)).map(m => m.name).sort(), name).toEqual([...STARTER_MOVES[name]].sort());
    }
    // Fake Out is one of Grookey's egg moves in Sword and Shield: Rillaboom keeps it.
    expect(STARTER_MOVES.Rillaboom).toContain('Fake Out');
    expect(validate([RILLABOOM, CINDERACE, INTELEON].join('\n\n'))).toEqual([]);
    expect(validate([MEOWSCARADA, SKELEDIRGE, QUAQUAVAL].join('\n\n'))).toEqual([]);
    // Not a move they learn in their debut game.
    expect(validate([mon('Rillaboom', 'Leftovers', 'Overgrow', ['Spore']), CHANSEY, SNORLAX].join('\n\n')).join(' ')).toMatch(/Spore.*Sword and Shield/);
    expect(validate([mon('Quaquaval', 'Leftovers', 'Torrent', ['Spore']), CHANSEY, SNORLAX].join('\n\n')).join(' ')).toMatch(/Spore.*Scarlet and Violet/);
  });

  it("keeps their new moves theirs: nobody else learns them, Smeargle can't Sketch them", () => {
    const sketchable = new Set<string>(allMoves().map(m => m.name));
    for (const move of ['Flower Trick', 'Pyro Ball', 'Drum Beating', 'Snipe Shot', 'Torch Song', 'Aqua Step', 'Wave Crash', 'Court Change']) {
      expect(sketchable.has(move), move).toBe(false);
    }
    expect(validate([mon('Smeargle', 'Focus Sash', 'Own Tempo', ['Flower Trick']), CHANSEY, SNORLAX].join('\n\n')).join(' ')).toMatch(/Flower Trick/);
    expect(validate([mon('Blaziken', 'Life Orb', 'Blaze', ['Pyro Ball']), CHANSEY, SNORLAX].join('\n\n')).join(' ')).toMatch(/Pyro Ball/);
  });

  it('use their signature moves in battle: Flower Trick always crits, Drum Beating slows, Torch Song and Aqua Step raise stats', () => {
    const b = battle([MEOWSCARADA], [SNORLAX]);
    b.makeChoices('move Flower Trick', 'move Splash');
    expect(b.log.join('\n')).toMatch(/\|-crit\|p2a: Snorlax/);
    const d = battle([RILLABOOM], [SNORLAX]);
    d.makeChoices('move Drum Beating', 'move Splash');
    expect(d.p2.active[0].boosts.spe).toBe(-1);
    const s = battle([SKELEDIRGE], [SNORLAX]);
    s.makeChoices('move Torch Song', 'move Splash');
    expect(s.p1.active[0].boosts.spa).toBe(1);
    const q = battle([QUAQUAVAL], [SNORLAX]);
    q.makeChoices('move Aqua Step', 'move Splash');
    expect(q.p1.active[0].boosts.spe).toBe(1);
  });

  it('change type before every move with Libero (as in Sword and Shield) and Protean (Gen 7)', () => {
    const b = battle([CINDERACE], [mon('Slowbro', 'Leftovers', 'Own Tempo', ['Splash'])]);
    b.makeChoices('move High Jump Kick', 'move Splash');
    b.makeChoices('move U-turn', 'move Splash');
    const log = b.log.join('\n');
    expect(log).toMatch(/\|-start\|p1a: Cinderace\|typechange\|Fighting\|\[from\] ability: Libero/);
    expect(log).toMatch(/\|-start\|p1a: Cinderace\|typechange\|Bug\|\[from\] ability: Libero/);
    const m = battle([MEOWSCARADA], [SNORLAX]);
    m.makeChoices('move Triple Axel', 'move Splash');
    m.makeChoices('move Knock Off', 'move Splash');
    expect(m.log.join('\n')).toMatch(/typechange\|Ice\|\[from\] ability: Protean[\s\S]*typechange\|Dark\|\[from\] ability: Protean/);
  });

  it('battle with the heuristic AI on both sides without errors (the damage calc knows them)', async () => {
    const before = calcErrors.count;
    const warnings: string[] = [];
    const session = new BattleSession({
      format: 'singles',
      teamPreview: false,
      seed: seedFromString('starters-smoke'),
      p1: { name: 'A', team: Teams.import([RILLABOOM, CINDERACE, INTELEON].join('\n\n'))! },
      p2: { name: 'B', team: Teams.import([MEOWSCARADA, SKELEDIRGE, QUAQUAVAL].join('\n\n'))! },
      p1AI: new HeuristicAI(),
      p2AI: new HeuristicAI(),
      onWarning: w => warnings.push(w),
    });
    session.start();
    const result = await session.done;
    expect(warnings).toEqual([]);
    expect(result.turns).toBeGreaterThan(0);
    expect(calcErrors.count - before).toBe(0);
    // The calc knows Flower Trick always crits: at 70 power it out-damages a 90-power Grass move.
    const b = battle([MEOWSCARADA], [SNORLAX]);
    const est = (move: string) => estimateDamage(b, b.p1.active[0], b.p2.active[0], move).max;
    expect(est('flowertrick')).toBeGreaterThan(est('leafblade'));
    expect(calcErrors.count - before).toBe(0);
  }, 30000);
});
