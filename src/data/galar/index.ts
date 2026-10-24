// Galar Pokémon (Sword and Shield) for Battle Legend Gloria's team, added on request (2026-10-23): Corviknight,
// Dragapult, Toxtricity, Grimmsnarl and Hatterene, non-legendary. Opponents only for now: they can't be registered on
// your team (the team builder leaves them out and the validator bans them) and aren't offered as a partner's Pokémon.
// Real data (Showdown's: stats, types, Abilities, moves); their sets only use moves they learn in Sword and Shield.
// No Dynamax. No simulator imports: the UI thread and the worker both build their data from this.

const toId = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export const GALAR_OPPONENT_ONLY = ['Corviknight', 'Dragapult', 'Toxtricity', 'Grimmsnarl', 'Hatterene'];
const OPPONENT_ONLY_IDS = new Set(GALAR_OPPONENT_ONLY.map(toId));
/** Whether a species is one of them (by name or id). */
export const isOpponentOnly = (species: string) => OPPONENT_ONLY_IDS.has(toId(species));

/** Gen 8 moves their sets use that Gen 7 doesn't have: theirs only (nobody else learns them, Smeargle can't Sketch them). */
export const GALAR_NEW_MOVES = ['Dragon Darts', 'Overdrive', 'Spirit Break'];
export const GALAR_NEW_MOVE_IDS = new Set(GALAR_NEW_MOVES.map(toId));
/** Gen 8 Abilities they have that Gen 7 doesn't (Mirror Armor is already in for Gallantmon). */
export const GALAR_NEW_ABILITIES = ['Punk Rock'];

/**
 * Data layered on Showdown's Gen 7 data (as mod data, `inherit: true` entries): the Pokémon, their new moves and
 * Abilities stop being "Future" (Showdown derives that from the entry's generation).
 */
export function galarOverrides() {
  const species = Object.fromEntries(GALAR_OPPONENT_ONLY.map(n => [toId(n), { inherit: true, gen: 7 }]));
  const formatsData = Object.fromEntries(GALAR_OPPONENT_ONLY.map(n => [toId(n), { inherit: true, isNonstandard: null, tier: 'OU' }]));
  const moves = Object.fromEntries(GALAR_NEW_MOVES.map(n => [toId(n), { inherit: true, gen: 7, isNonstandard: null }]));
  const abilities = Object.fromEntries(GALAR_NEW_ABILITIES.map(n => [toId(n), { inherit: true, gen: 7, isNonstandard: null }]));
  return { Species: species, FormatsData: formatsData, Moves: moves, Abilities: abilities };
}
