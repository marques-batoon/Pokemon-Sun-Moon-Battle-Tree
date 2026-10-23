// All Star Duo Tournament (app mode, designed by the user 2026-10-19): a 32-pair single-elimination bracket (16 pairs
// until later that day, when the user asked for 32 and a two-sided bracket). You and
// a partner you own face special-trainer duos who have lines for battling together; the matches you're not in are
// fought by the Battle Tree AI behind the scenes.
import { canTeamUp, multiPartners, pairedTrainer, pairGreetingPartners, speaksFirst, TRAINERS } from '../data/battle-tree';
import type { RunTeam } from './controller';
import { Rng } from './rng';
import { bpForWin, planTrainer, samePersonIds, specialPool } from './selection';
import type { BattleRecord, PlannedTrainer, RunPartner, RunSettings } from './types';

/** Pairs in a new bracket (you and your partner are one of them). */
export const TOURNAMENT_SIZE = 32;
/** Rounds of a bracket of `size` pairs: 32 pairs, then 16, 8, 4 and 2. */
export const roundsFor = (size: number) => Math.round(Math.log2(size));
/** Rounds to win a new tournament. A tournament saved with 16 pairs (before 2026-10-19's change) keeps its 4: every helper takes the bracket's own size. */
export const TOURNAMENT_ROUNDS = roundsFor(TOURNAMENT_SIZE);
/** How many rounds a tournament has (from its results). */
export const roundsOf = (t: Pick<TournamentState, 'results'>) => t.results.length;
/** "Round 1", "Round 2", then "Quarterfinals", "Semifinals", "Final" (counted back from the final). */
export function roundName(round: number, rounds = TOURNAMENT_ROUNDS): string {
  const fromEnd = rounds - 1 - round;
  return fromEnd === 0 ? 'Final' : fromEnd === 1 ? 'Semifinals' : fromEnd === 2 ? 'Quarterfinals' : `Round ${round + 1}`;
}
/** A round in a sentence: "Round 1", "the quarterfinals", "the final". */
export const roundPhrase = (round: number, rounds = TOURNAMENT_ROUNDS) =>
  (rounds - 1 - round >= 3 ? roundName(round, rounds) : `the ${roundName(round, rounds).toLowerCase()}`);

/** You and your partner, or a duo of special trainers (left trainer first) with the 2 Pokémon each brings. */
export type TournamentEntrant =
  | { kind: 'player' }
  | { kind: 'duo'; trainers: [PlannedTrainer, PlannedTrainer] };

export type TournamentStatus =
  /** Your next match is ready to play. */
  | 'ready'
  /** Your match was started and hasn't finished (if the app reloads now, it was interrupted). */
  | 'in-battle'
  /** You won the final. */
  | 'won'
  /** Knocked out (the rest of the bracket still plays out). */
  | 'lost'
  /** Gave up between matches: the duo you were to face goes through. */
  | 'retired';

export interface TournamentState {
  id: string;
  /** Base seed: the draw, every team and every match derive from it. */
  seedText: string;
  settings: RunSettings;
  team: RunTeam;
  partner: RunPartner;
  /** The bracket, top to bottom: match m of round 1 is entrants 2m and 2m + 1. */
  entrants: TournamentEntrant[];
  /** results[r][m]: the entrant (index) who won match m of round r, or null until it's decided. */
  results: (number | null)[][];
  /**
   * logs[r][m]: the simulator input log of match m of round r (seed, teams and every choice: replaying it shows the
   * battle again), once it's been fought; null for a match that wasn't (you retired). Tournaments saved before replays
   * (2026-10-19) have none.
   */
  logs?: (string[] | null)[][];
  /** Rounds whose results have been shown on the bracket (its animation played). */
  shown: number;
  /** Your current round (0-based), or the one you went out in. */
  round: number;
  status: TournamentStatus;
  /** BP earned in this tournament. */
  bp: number;
  history: BattleRecord[];
  /** Practice (random AI): no BP or partner progress. */
  debug: boolean;
  startedAt: number;
  updatedAt: number;
}

/** How many matches round r has (16, 8, 4, 2, 1 in a 32-pair bracket). */
export const matchCount = (round: number, rounds = TOURNAMENT_ROUNDS) => 1 << (rounds - 1 - round);

/** The two entrants of match m in round r, or null while one of them isn't known yet. */
export function matchEntrants(t: Pick<TournamentState, 'results'>, round: number, match: number): [number, number] | null {
  if (round === 0) return [2 * match, 2 * match + 1];
  const a = t.results[round - 1][2 * match], b = t.results[round - 1][2 * match + 1];
  return a === null || b === null ? null : [a, b];
}

/** Where you are in the bracket. */
export const playerIndex = (t: Pick<TournamentState, 'entrants'>) => t.entrants.findIndex(e => e.kind === 'player');

/** Your match in round r (you're in it as long as you won the rounds before). */
export const playerMatch = (t: Pick<TournamentState, 'entrants'>, round: number) => playerIndex(t) >> (round + 1);

/** The duo you face in your current round, or null if it isn't decided yet (it always is: they're simulated first). */
export function nextOpponent(t: TournamentState): Extract<TournamentEntrant, { kind: 'duo' }> | null {
  const pair = matchEntrants(t, t.round, playerMatch(t, t.round));
  const other = pair?.find(i => t.entrants[i].kind !== 'player');
  const entrant = other === undefined ? undefined : t.entrants[other];
  return entrant?.kind === 'duo' ? entrant : null;
}

/** The tournament winner (an entrant index), once the final is decided. */
export const champion = (t: Pick<TournamentState, 'results'>) => t.results[roundsOf(t) - 1][0];

/** Whether every match has been decided. */
export const tournamentDecided = (t: Pick<TournamentState, 'results'>) => champion(t) !== null;

/**
 * BP for winning a match: the Super Multi rate for every round before the final (battles 1-10: 2 BP), and the final
 * pays like beating a Battle Legend (battle 50: 50 BP). User's choice, 2026-10-19.
 */
export const tournamentBp = (round: number, rounds = TOURNAMENT_ROUNDS) => (round === rounds - 1 ? bpForWin('super', 50) : bpForWin('super', round + 1));

/** Which of their lines the duo you face uses this round (the same on the card and in battle). */
export const matchKey = (t: Pick<TournamentState, 'seedText' | 'round'>) => `${t.seedText}|round-${t.round + 1}`;

/** Decides the duos' looks (a Pokémon Masters sprite or not) for the whole tournament: the same on the bracket and in every match. */
export const duoSpriteKey = (t: Pick<TournamentState, 'seedText'>) => `${t.seedText}|duos`;

/** Seed text of round r's matches (yours, or a simulated one). */
export const matchSeedText = (seedText: string, round: number, match: number) => `${seedText}|round-${round + 1}|match-${match + 1}`;

/**
 * The 31 duos facing you (`count`), each two special trainers with lines for battling together (they greet you about each
 * other), drawn as in Super Multi: the first by the special trainer weights, their teammate among those they have
 * pair greetings with, by weight (Tate and Liza always together; Izzy with Colress or Cheren, who goes first; Courtney
 * only with a female trainer). Every
 * trainer appears once at most, and never your partner (or another version of them, or their twin). Trainers whose
 * only Multi partners are Battle Legends (Rika, Kaito) can't enter. Each brings 2 Pokémon for the whole tournament.
 */
export function drawDuos(seedText: string, partnerId?: number, count = TOURNAMENT_SIZE - 1): [PlannedTrainer, PlannedTrainer][] {
  const rng = new Rng(`${seedText}|duos`);
  const pool = specialPool();
  const weight = new Map(pool.map(p => [p.trainer.id, p.weight]));
  const used = new Set<number>();
  const take = (id: number) => {
    for (const x of samePersonIds(id)) used.add(x);
    const twin = pairedTrainer(id);
    if (twin) used.add(twin.partnerId);
  };
  if (partnerId !== undefined) take(partnerId);
  const cannotLead = new Set<number>();
  const duos: [PlannedTrainer, PlannedTrainer][] = [];
  while (duos.length < count) {
    const leads = pool.filter(p => !used.has(p.trainer.id) && !cannotLead.has(p.trainer.id));
    if (!leads.length) throw new Error('Not enough special trainers left for a tournament.');
    const first = rng.weighted(leads, p => p.weight).trainer;
    const twin = pairedTrainer(first.id);
    const partners = multiPartners(first.id);
    let duo: [PlannedTrainer, PlannedTrainer] | null = null;
    if (twin) {
      if (!used.has(twin.partnerId)) {
        // Tate and Liza, in their order, leading with one of their pairs.
        const leads = rng.pick(twin.pair.multiLeads);
        const [a, b] = twin.pair.trainerIds;
        duo = [planTrainer({ trainer: TRAINERS[a] }, 'multi', rng, leads[0]), planTrainer({ trainer: TRAINERS[b] }, 'multi', rng, leads[1])];
      }
    } else if (partners.length) {
      // Izzy and a partner of his (special trainers only), who goes first.
      const mates = partners.filter(id => TRAINERS[id].kind === 'special' && !used.has(id));
      if (mates.length) duo = [planTrainer({ trainer: TRAINERS[rng.pick(mates)] }, 'multi', rng), planTrainer({ trainer: first }, 'multi', rng)];
    } else {
      const friends = pairGreetingPartners(first.id)
        .filter(id => weight.has(id) && !used.has(id) && !multiPartners(id).length && !pairedTrainer(id) && canTeamUp(first, TRAINERS[id]));
      if (friends.length) {
        const mate = rng.weighted(friends, id => weight.get(id)!);
        duo = [planTrainer({ trainer: first }, 'multi', rng), planTrainer({ trainer: TRAINERS[mate] }, 'multi', rng)];
      }
    }
    if (!duo) { cannotLead.add(first.id); continue; }
    for (const t of duo) take(t.trainerId);
    // Lined up so their lines together read in order (the one who speaks first stands first).
    duos.push(speaksFirst(TRAINERS[duo[0].trainerId], TRAINERS[duo[1].trainerId]) ? duo : [duo[1], duo[0]]);
  }
  return duos;
}

/** A new bracket: the 31 duos and you, at seeded random places. */
export function drawBracket(seedText: string, partnerId?: number, size = TOURNAMENT_SIZE): TournamentEntrant[] {
  const duos: TournamentEntrant[] = drawDuos(seedText, partnerId, size - 1).map(trainers => ({ kind: 'duo', trainers }));
  const rng = new Rng(`${seedText}|bracket`);
  const order = [...duos];
  // Shuffle (Fisher-Yates), then put you in at a random place.
  for (let i = order.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  order.splice(rng.int(size), 0, { kind: 'player' });
  return order;
}

/** No results (or logs) yet: one null per match of each round. */
export const emptyResults = <T = number>(rounds = TOURNAMENT_ROUNDS): (T | null)[][] =>
  Array.from({ length: rounds }, (_, r) => Array<T | null>(matchCount(r, rounds)).fill(null));

/** Entrant names for history and messages: "Gym Leader Brock & Gym Leader Misty", or "you and Sina". */
export function entrantLabel(e: TournamentEntrant, partnerName?: string): string {
  return e.kind === 'player' ? `you and ${partnerName ?? 'your partner'}` : `${e.trainers[0].displayName} & ${e.trainers[1].displayName}`;
}
