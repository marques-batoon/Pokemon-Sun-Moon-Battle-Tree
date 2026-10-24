import { describe, expect, it } from 'vitest';
import { Dex, TeamValidator, type PokemonSet as SimSet } from '@pkmn/sim';
import { HeuristicAI } from '../ai/heuristic/heuristic-ai';
import { BOSSES, SETS, TRAINER_DUO_QUOTES, TRAINER_MULTI_QUOTES, TRAINER_QUOTES, trainerKey, trainerQuotes, TRAINERS, type Trainer } from '../data/battle-tree';
import { GALAR_NEW_MOVES, GALAR_OPPONENT_ONLY } from '../data/galar';
import { treeSetToPokemonSet } from '../run/opponent';
import { rollOffer } from '../run/partners';
import { Rng } from '../run/rng';
import { allMoves, eligibleSpecies } from '../team/dex';
import { mastersSpriteIds, opponentSpriteIds, trainerSpriteId, trainerSpriteUrl } from '../ui/sprites';
import { FORMAT_IDS, IGNORED_VALIDATOR_PROBLEMS, registerBattleTreeFormats } from './format';
import { seedFromString } from './seed';
import { BattleSession } from './session';

registerBattleTreeFormats();
const NAMES = ['Elio', 'Kris', 'Brendan', 'May', 'Dawn', 'Rosa', 'Gloria'];
const legend = (name: string) => TRAINERS.find(t => t.kind === 'legend' && t.name === name)!;
const species = (name: string) => legend(name).roster.map(id => SETS[id].species);
const roster = (t: Trainer, seed = 'x') => { const rng = new Rng(seed); return t.roster.map(id => treeSetToPokemonSet(SETS[id], 31, rng)); };

describe('the later Battle Legends (Elio, Kris, Brendan, May, Dawn, Rosa, Gloria)', () => {
  it('are Battle Legends with 8 Pokémon each, their region\'s three starters among them', () => {
    const starters: Record<string, string[]> = {
      Elio: ['Decidueye', 'Incineroar', 'Primarina'], Kris: ['Meganium', 'Typhlosion', 'Feraligatr'], Brendan: ['Sceptile', 'Blaziken', 'Swampert'],
      May: ['Sceptile', 'Blaziken', 'Swampert'], Dawn: ['Torterra', 'Infernape', 'Empoleon'], Rosa: ['Serperior', 'Emboar', 'Samurott'],
      Gloria: ['Rillaboom', 'Cinderace', 'Inteleon'],
    };
    for (const name of NAMES) {
      const t = legend(name);
      expect([t.class, t.kind, t.iv, t.roster.length], name).toEqual(['Battle Legend', 'legend', 31, 8]);
      expect(species(name), name).toEqual(expect.arrayContaining(starters[name]));
      expect(new Set(t.roster.map(id => SETS[id].item)).size, name).toBe(8);
    }
    expect(species('Kris')).toContain('Suicune');
    // Gloria: the Galar starters and five other Galar Pokémon, none legendary.
    expect(species('Gloria').slice(3)).toEqual(GALAR_OPPONENT_ONLY);
    for (const s of GALAR_OPPONENT_ONLY) expect(Dex.species.get(s).tags, s).toEqual([]);
  });

  it('have legal sets (Gloria\'s Galar Pokémon only with moves they learn in Sword and Shield)', () => {
    const validator = new TeamValidator(Dex.formats.get(FORMAT_IDS.singles));
    const problems: string[] = [];
    /** Moves the species or a pre-evolution learns in Sword and Shield (egg moves carry over). */
    const swsh = (name: string) => {
      const ids = new Set<string>();
      for (let s = Dex.species.get(name); s.exists; s = Dex.species.get(s.prevo)) {
        for (const [id, src] of Object.entries(Dex.species.getLearnsetData(s.id).learnset ?? {})) if (src.some(x => x.startsWith('8'))) ids.add(id);
        if (!s.prevo) break;
      }
      return ids;
    };
    for (const name of NAMES) {
      const team = roster(legend(name)) as unknown as SimSet[];
      const usable = team.filter(s => !GALAR_OPPONENT_ONLY.includes(s.species));
      // Three at a time (Singles): Item Clause and Species Clause hold over each.
      for (let i = 0; i < usable.length; i += 3) {
        const three = usable.slice(i, i + 3).length === 3 ? usable.slice(i, i + 3) : usable.slice(-3);
        problems.push(...(validator.validateTeam(three) ?? []).filter(p => !IGNORED_VALIDATOR_PROBLEMS.some(r => r.test(p))).map(p => `${name}: ${p}`));
      }
      for (const set of team.filter(s => GALAR_OPPONENT_ONLY.includes(s.species))) {
        const learnable = swsh(set.species);
        for (const m of set.moves) if (!learnable.has(Dex.moves.get(m).id)) problems.push(`${set.species} can't learn ${m} in Sword and Shield`);
        if (!Object.values(Dex.species.get(set.species).abilities).includes(set.ability)) problems.push(`${set.species}: ${set.ability}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('battle without errors, Gloria\'s Galar Pokémon and their new moves included (Doubles)', async () => {
    for (const name of NAMES) {
      const team = roster(legend(name), name);
      const warnings: string[] = [];
      const session = new BattleSession({
        format: 'doubles',
        teamPreview: false,
        seed: seedFromString(`later-legend-${name}`),
        p1: { name: 'A', team: team.slice(0, 4) },
        p2: { name: 'B', team: team.slice(4) },
        p1AI: new HeuristicAI(),
        p2AI: new HeuristicAI(),
        onWarning: w => warnings.push(w),
      });
      session.start();
      const result = await session.done;
      expect(warnings, name).toEqual([]);
      expect(result.turns, name).toBeGreaterThan(0);
    }
  }, 120000);

  it("keep Gloria's Galar Pokémon opponents only: not on your team, not offered as a partner's", () => {
    const names = new Set<string>(eligibleSpecies().map(s => s.name));
    for (const s of GALAR_OPPONENT_ONLY) expect(names.has(s), s).toBe(false);
    const validator = new TeamValidator(Dex.formats.get(FORMAT_IDS.singles));
    const mon = (s: string, item: string, ability: string, moves: string[]) => ({ name: '', species: s, item, ability, moves, nature: 'Jolly', gender: '', evs: {}, ivs: {}, level: 50 }) as unknown as SimSet;
    const problems = validator.validateTeam([mon('Dragapult', 'Choice Scarf', 'Clear Body', ['U-turn']), mon('Snorlax', 'Leftovers', 'Thick Fat', ['Rest']), mon('Chansey', 'Eviolite', 'Natural Cure', ['Soft-Boiled'])]) ?? [];
    expect(problems.join(' ')).toMatch(/Dragapult/);
    const sketchable = new Set<string>(allMoves().map(m => m.name));
    for (const m of GALAR_NEW_MOVES) expect(sketchable.has(m), m).toBe(false);
    for (let i = 0; i < 30; i++) {
      const offer = rollOffer('Gloria', new Rng(`gloria-${i}`)).map(id => SETS[id].species);
      expect(offer.some(s => GALAR_OPPONENT_ONLY.includes(s)), offer.join()).toBe(false);
    }
  });

  it('show their sprites, bundled with the app, and their Pokémon Masters outfits (Kris: hers is her usual sprite too)', () => {
    expect(NAMES.map(n => trainerSpriteId(legend(n)))).toEqual(['elio', 'kris-masters', 'brendan', 'may', 'dawn-contest', 'rosa', 'gloria-league']);
    for (const n of NAMES) expect(trainerSpriteUrl(legend(n)), n).toMatch(/^\/trainers\/(showdown|masters)\//);
    expect(trainerSpriteUrl(legend('Kris'))).toBe('/trainers/masters/kris-masters.png');
    expect(NAMES.map(n => mastersSpriteIds(legend(n)).length)).toEqual([1, 2, 3, 4, 3, 4, 2]);
    // When Kris's Masters outfit shows, each of hers is equally likely, her usual one included.
    const seen = new Map<string, number>();
    for (let i = 0; i < 4000; i++) {
      const [id] = opponentSpriteIds([legend('Kris')], `kris-${i}`);
      if (id) seen.set(id, (seen.get(id) ?? 0) + 1);
    }
    expect([...seen.keys()].sort()).toEqual(['kris-masters', 'kris-masters2']);
    expect(Math.abs(seen.get('kris-masters')! - seen.get('kris-masters2')!)).toBeLessThan(140);
  });

  it('have three sets of lines each, and three matching sets with each Battle Legend they can be paired with', () => {
    for (const n of NAMES) expect(TRAINER_QUOTES[n], n).toHaveLength(3);
    const pairs = Object.values(BOSSES).filter(b => b.format === 'multi' && b.partnerTrainerId !== undefined)
      .map(b => [TRAINERS[b.trainerId], TRAINERS[b.partnerTrainerId!]]);
    for (const [a, b] of pairs) {
      const [ka, kb] = [trainerKey(a), trainerKey(b)];
      const label = `${ka} & ${kb}`;
      // Marques and Thomas: their own lines are their team-up lines; Tai and Matt: theirs (TRAINER_MULTI_QUOTES).
      const lines = label === 'Marques & Thomas' ? [TRAINER_QUOTES.Marques, TRAINER_QUOTES.Thomas]
        : label === 'Tai & Matt' ? [TRAINER_MULTI_QUOTES.Tai, TRAINER_MULTI_QUOTES.Matt]
        : (e => (e ? [e[ka], e[kb]] : [undefined, undefined]))(Object.values(TRAINER_DUO_QUOTES).find(e => ka in e && kb in e));
      expect(lines.map(l => l?.length), label).toEqual([3, 3]);
      // Together, they use those lines, the same set for both.
      for (const key of ['k1', 'k2', 'k3', 'k4']) {
        const [qa, qb] = [trainerQuotes(a, key, [a, b]), trainerQuotes(b, key, [a, b])];
        expect(lines[0]!.indexOf(qa!), `${label} ${key}`).toBeGreaterThanOrEqual(0);
        expect(lines[0]!.indexOf(qa!), `${label} ${key}`).toBe(lines[1]!.indexOf(qb!));
      }
    }
  });
});
