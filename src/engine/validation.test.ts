import { describe, expect, it } from 'vitest';
import { newSet } from '../team/sets';
import type { PokemonSet } from '../team/types';
import { validateTeamDetailed } from './host';

const mon = (species: string, patch: Partial<PokemonSet>): PokemonSet => ({ ...newSet(species), ...patch });

const legal = () => [
  mon('Garchomp', { item: 'Choice Scarf', ability: 'Rough Skin', moves: ['Earthquake', 'Outrage'] }),
  mon('Chansey', { item: 'Eviolite', ability: 'Natural Cure', moves: ['Seismic Toss', 'Soft-Boiled'] }),
  mon('Aegislash', { item: 'Leftovers', ability: 'Stance Change', moves: ["King's Shield", 'Shadow Ball'] }),
];

describe('validateTeamDetailed', () => {
  it('passes a legal team, including 0 EVs and a Lv. 100 Pokémon', () => {
    const team = legal();
    team[0].level = 100;
    expect(validateTeamDetailed('singles', team)).toEqual({ team: [], sets: [[], [], []] });
  });

  it('attributes learnset, ability and ban problems to the right slot', () => {
    const team = legal();
    team[0] = { ...team[0], moves: ['Earthquake', 'Spore'] };
    team[1] = { ...team[1], ability: 'Huge Power' };
    team.push(mon('Mewtwo', { item: 'Life Orb', ability: 'Pressure', moves: ['Psystrike'] }));
    const v = validateTeamDetailed('singles', team);
    expect(v.sets[0].join()).toMatch(/Spore/);
    expect(v.sets[1].join()).toMatch(/Huge Power/);
    expect(v.sets[2]).toEqual([]);
    expect(v.sets[3].join()).toMatch(/banned/);
  });

  it('reports clauses and team size as team-wide problems', () => {
    const team = legal();
    team[2] = mon('Chansey', { item: 'Eviolite', ability: 'Natural Cure', moves: ['Seismic Toss'] });
    const v = validateTeamDetailed('singles', team);
    expect(v.team.join('\n')).toMatch(/Species Clause/);
    expect(v.team.join('\n')).toMatch(/Item Clause/);
    expect(validateTeamDetailed('singles', legal().slice(0, 2)).team.join()).toMatch(/at least 3/);
  });

  it('rejects USUM-only species and accepts Sun/Moon Ultra Beasts', () => {
    const team = legal();
    team[2] = mon('Naganadel', { item: 'Leftovers', ability: 'Beast Boost', moves: ['Sludge Wave'] });
    expect(validateTeamDetailed('singles', team).sets[2].join()).toMatch(/banned/);
    team[2] = mon('Pheromosa', { item: 'Leftovers', ability: 'Beast Boost', moves: ['High Jump Kick'] });
    expect(validateTeamDetailed('singles', team).sets[2]).toEqual([]);
    // Only the Dusk forme is USUM-only; Midday and Midnight Lycanroc were in Sun/Moon.
    for (const species of ['Lycanroc', 'Lycanroc-Midnight']) {
      team[2] = mon(species, { item: 'Leftovers', ability: 'Keen Eye', moves: ['Rock Slide'] });
      expect(validateTeamDetailed('singles', team).sets[2], species).toEqual([]);
    }
  });
});
