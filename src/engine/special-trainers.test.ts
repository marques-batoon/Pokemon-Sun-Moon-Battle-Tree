import { describe, expect, it } from 'vitest';
import { Dex, TeamValidator, type PokemonSet as SimSet } from '@pkmn/sim';
import { pairGreetingPartners, SETS, TRAINER_QUOTES, trainerKey, TRAINERS, type SpecialTrainer } from '../data/battle-tree';
import { treeSetToPokemonSet } from '../run/opponent';
import { Rng } from '../run/rng';
import { specialPool } from '../run/selection';
import { mastersSpriteIds, trainerSpriteId, trainerSpriteUrl } from '../ui/sprites';
import { FORMAT_IDS, IGNORED_VALIDATOR_PROBLEMS, registerBattleTreeFormats } from './format';

registerBattleTreeFormats();
const validator = new TeamValidator(Dex.formats.get(FORMAT_IDS.singles));
const NEW = TRAINERS.filter(t => t.source.sets?.includes('special-trainers.txt')) as SpecialTrainer[];
const byKey = (key: string) => TRAINERS.find(t => t.kind === 'special' && trainerKey(t) === key)!;
const partnersOf = (key: string) => pairGreetingPartners(byKey(key).id).map(id => trainerKey(TRAINERS[id]));
const BENCH: SimSet[] = [
  { name: '', species: 'Chansey', item: 'Eviolite', ability: 'Natural Cure', moves: ['Soft-Boiled'], nature: 'Bold', gender: 'F', evs: {} as never, ivs: {} as never, level: 50 },
  { name: '', species: 'Blissey', item: 'Shed Shell', ability: 'Natural Cure', moves: ['Soft-Boiled'], nature: 'Bold', gender: 'F', evs: {} as never, ivs: {} as never, level: 50 },
  { name: '', species: 'Audino', item: 'Bright Powder', ability: 'Healer', moves: ['Pound'], nature: 'Bold', gender: 'F', evs: {} as never, ivs: {} as never, level: 50 },
];
const ALOLA = ['Plumeria', 'Guzma', 'Kiawe', 'Mallow', 'Hala', 'Olivia', 'Acerola', 'Kahili', 'Molayne', 'Kukui', 'Lusamine', 'Faba'];

describe('Lillie, Hau, Lana and Marley (special trainers)', () => {
  it('are special trainers at weight 7 with eight legal sets each and three sets of lines', () => {
    expect(NEW.map(t => [t.name, t.class, t.region])).toEqual([
      ['Lillie', 'Pokémon Trainer', 'Alola'], ['Hau', 'Pokémon Trainer', 'Alola'], ['Lana', 'Captain', 'Alola'], ['Marley', 'Pokémon Trainer', 'Sinnoh'],
    ]);
    const pool = new Set(specialPool().map(p => p.trainer.id));
    const problems: string[] = [];
    for (const t of NEW) {
      expect([t.weight, t.iv, t.roster.length, pool.has(t.id), TRAINER_QUOTES[t.name].length], t.name).toEqual([7, 31, 8, true, 3]);
      for (const id of t.roster) {
        const set = treeSetToPokemonSet(SETS[id], 31, new Rng('x')) as unknown as SimSet;
        const bench = BENCH.filter(b => b.species !== set.species && b.item !== set.item).slice(0, 2);
        const found = (validator.validateTeam([set, ...bench]) ?? []).filter(p => !IGNORED_VALIDATOR_PROBLEMS.some(r => r.test(p)));
        if (found.length) problems.push(`${t.name} / ${SETS[id].label}: ${found.join(' | ')}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('show their bundled sprites (Lillie in her Z-Powered look) and have Pokémon Masters sprites', () => {
    expect(NEW.map(t => trainerSpriteId(t))).toEqual(['lillie-z', 'hau', 'lana', 'marley']);
    for (const t of NEW) expect(trainerSpriteUrl(t), t.name).toBe(`/trainers/showdown/${trainerSpriteId(t)}.png`);
    expect(NEW.map(t => mastersSpriteIds(t).length)).toEqual([5, 1, 2, 1]);
  });

  it('have special greetings with everyone from their region (and Lana with the Water specialists)', () => {
    for (const key of ['Lillie', 'Hau', 'Lana']) {
      const partners = partnersOf(key);
      for (const other of [...ALOLA, ...['Lillie', 'Hau', 'Lana'].filter(k => k !== key)]) expect(partners, `${key} & ${other}`).toContain(other);
    }
    expect(partnersOf('Lana')).toEqual(expect.arrayContaining(['Misty', 'Juan', 'Crasher Wake', 'Marlon', 'Cress', 'Wallace', 'Siebold']));
    const sinnoh = TRAINERS.filter(t => t.kind === 'special' && t.region === 'Sinnoh' && t.name !== 'Marley').map(trainerKey);
    expect(sinnoh.length).toBe(17);
    expect(partnersOf('Marley')).toEqual(expect.arrayContaining([...sinnoh, 'Cynthia']));
  });

  it('greet the young female trainers as friends: Lillie, Lana and Marley with each other, the 16 Gym Leaders and Mallow', () => {
    const girls = ['Misty', 'Erika', 'Sabrina', 'Janine', 'Whitney', 'Jasmine', 'Clair', 'Roxanne', 'Flannery', 'Winona', 'Gardenia', 'Maylene', 'Candice', 'Elesa', 'Skyla', 'Roxie', 'Mallow'];
    for (const key of ['Lillie', 'Lana', 'Marley']) {
      const others = [...girls, ...['Lillie', 'Lana', 'Marley'].filter(k => k !== key)];
      expect(partnersOf(key), key).toEqual(expect.arrayContaining(others));
    }
  });
});
