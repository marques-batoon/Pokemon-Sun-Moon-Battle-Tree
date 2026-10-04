import { Teams, type PokemonSet } from '@pkmn/sim';
import { BOSSES, TRAINERS } from '../data/battle-tree';
import { TEST_OPPONENT_SET_LABELS, TEST_PLAYER_TEAM_TEXT } from './fixtures-data';
import { treeSetByLabel, treeSetToPokemonSet } from '../run/opponent';
import type { Rng } from '../run/rng';

export function testPlayerTeam(): PokemonSet[] {
  return Teams.import(TEST_PLAYER_TEAM_TEXT) ?? [];
}

export function testOpponentTeam(rng: Rng): { name: string; team: PokemonSet[] } {
  const red = TRAINERS[BOSSES['red-super'].trainerId];
  return {
    name: `${red.class} ${red.name}`,
    team: TEST_OPPONENT_SET_LABELS.map(label => treeSetToPokemonSet(treeSetByLabel(label), red.iv, rng) as PokemonSet),
  };
}
