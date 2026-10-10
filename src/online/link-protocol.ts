// What the two players of an online Multi Battle send each other (inside the
// relay's { t: 'msg' }). The host runs the battle engine; the guest sends
// their team and choices and gets their own view of the battle back.
//
// Everything received comes from another person's browser, so it's checked
// against these shapes before use and anything else is dropped.
import { QUOTE_PICKS, TRAINERS } from '../data/battle-tree';
import type { FromEngine } from '../engine/protocol';
import { STAT_IDS, type PokemonSet } from '../team/types';
import { PARTNER_BRING } from '../run/types';

/** What the guest sees between battles. */
export interface LobbyView {
  /** The room's mode: Super Multi, or All Star Mode (special trainers every battle, Battle Legends every 5th). */
  course: OnlineCourse;
  /** Battles won in a row together. */
  streak: number;
  /** Number of the next battle. */
  battle: number;
  /** The next opposing trainers (Battle Tree trainer ids). */
  next: number[];
  /** Which of their greetings and closing remarks the next battle uses (see quotePick; the seed itself stays with the host). */
  quotePick: number | null;
  hostReady: boolean;
  guestReady: boolean;
  /** A battle is on. */
  inBattle: boolean;
  /** Something to tell the guest (e.g. their team was rejected). */
  notice: string | null;
}

export type OnlineCourse = 'super' | 'allstar';

export type ToHost =
  /** The guest's two Pokémon, lead first (null: not ready). */
  | { k: 'team'; sets: PokemonSet[] | null }
  | { k: 'choose'; battleId: string; choice: string };

export type ToGuest =
  | { k: 'lobby'; lobby: LobbyView }
  /** The guest's view of the battle, as the engine reports it. */
  | { k: 'engine'; msg: GuestEngineMessage };

export type GuestEngineMessage = Extract<FromEngine, { type: 'started' | 'chunks' | 'end' | 'invalid-team' | 'error' }>;

const MAX_STR = 40;
const MAX_CHOICE = 80;
const MAX_ID = 64;
const MAX_CHUNKS = 200;
const MAX_CHUNK = 60_000;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown, max = MAX_STR): string | null => (typeof v === 'string' && v.length <= max ? v : null);
const int = (v: unknown, min: number, max: number): number | null => (Number.isInteger(v) && (v as number) >= min && (v as number) <= max ? (v as number) : null);

function stats(v: unknown, max: number, fallback: number): PokemonSet['evs'] | null {
  if (v === undefined) return Object.fromEntries(STAT_IDS.map(s => [s, fallback])) as PokemonSet['evs'];
  if (!isObj(v)) return null;
  const out: Obj = {};
  for (const s of STAT_IDS) {
    const n = v[s] === undefined ? fallback : int(v[s], 0, max);
    if (n === null) return null;
    out[s] = n;
  }
  return out as PokemonSet['evs'];
}

/**
 * A Pokémon from the other player, rebuilt field by field (unknown fields dropped).
 * The nickname is replaced by the species: nicknames are free text other players would see.
 * Legality (moves, items, clauses) is the engine's job when the battle starts.
 */
export function cleanSet(v: unknown): PokemonSet | null {
  if (!isObj(v)) return null;
  const species = str(v.species);
  const moves = Array.isArray(v.moves) && v.moves.length >= 1 && v.moves.length <= 4 ? v.moves.map(m => str(m)) : null;
  const evs = stats(v.evs, 252, 0);
  const ivs = stats(v.ivs, 31, 31);
  const level = v.level === undefined ? 50 : int(v.level, 1, 100);
  if (!species || !moves || moves.some(m => m === null) || !evs || !ivs || level === null) return null;
  return {
    name: species,
    species,
    item: str(v.item) ?? '',
    ability: str(v.ability) ?? '',
    moves: moves as string[],
    nature: str(v.nature) ?? '',
    gender: ['M', 'F', 'N', ''].includes(v.gender as string) ? (v.gender as string) : '',
    evs,
    ivs,
    level,
    ...(v.shiny === true && { shiny: true }),
  } as PokemonSet;
}

/** Your own Pokémon as sent online: nicknames removed (see cleanSet). */
export const withoutNicknames = (sets: PokemonSet[]): PokemonSet[] => sets.map(s => ({ ...s, name: s.species }));

export function parseToHost(data: unknown): ToHost | null {
  if (!isObj(data)) return null;
  if (data.k === 'team') {
    if (data.sets === null) return { k: 'team', sets: null };
    if (!Array.isArray(data.sets) || data.sets.length !== PARTNER_BRING) return null;
    const sets = data.sets.map(cleanSet);
    return sets.every(Boolean) ? { k: 'team', sets: sets as PokemonSet[] } : null;
  }
  if (data.k === 'choose') {
    const battleId = str(data.battleId, MAX_ID);
    const choice = str(data.choice, MAX_CHOICE);
    return battleId && choice ? { k: 'choose', battleId, choice } : null;
  }
  return null;
}

function parseLobby(v: unknown): LobbyView | null {
  if (!isObj(v)) return null;
  const streak = int(v.streak, 0, 1e6);
  const battle = int(v.battle, 1, 1e6);
  const next = Array.isArray(v.next) && v.next.length <= 2 && v.next.every(id => int(id, 0, TRAINERS.length - 1) !== null) ? (v.next as number[]) : null;
  if (streak === null || battle === null || !next) return null;
  return {
    // An older host sends no mode: that's Super Multi.
    course: v.course === 'allstar' ? 'allstar' : 'super',
    streak, battle, next,
    quotePick: int(v.quotePick, 0, QUOTE_PICKS - 1),
    hostReady: v.hostReady === true,
    guestReady: v.guestReady === true,
    inBattle: v.inBattle === true,
    notice: str(v.notice, 500),
  };
}

function parseEngine(v: unknown): GuestEngineMessage | null {
  if (!isObj(v)) return null;
  const battleId = str(v.battleId, MAX_ID);
  if (!battleId) return null;
  switch (v.type) {
    case 'started': {
      const team = Array.isArray(v.playerTeam) && v.playerTeam.length <= PARTNER_BRING ? v.playerTeam.map(cleanSet) : null;
      const opponentName = str(v.opponentName, 200);
      const seed = str(v.seed, 200) ?? '';
      return team && team.every(Boolean) && opponentName ? { type: 'started', battleId, seed, opponentName, playerTeam: team as PokemonSet[] } : null;
    }
    case 'chunks': {
      const chunks = Array.isArray(v.chunks) && v.chunks.length <= MAX_CHUNKS && v.chunks.every(c => str(c, MAX_CHUNK) !== null) ? (v.chunks as string[]) : null;
      return chunks ? { type: 'chunks', battleId, chunks } : null;
    }
    case 'end': {
      const r = isObj(v.result) ? v.result : null;
      const winner = r && (r.winner === 'p1' || r.winner === 'p2' || r.winner === null) ? r.winner : undefined;
      const turns = r ? int(r.turns, 0, 10_000) : null;
      return winner !== undefined && turns !== null ? { type: 'end', battleId, result: { winner, turns, seed: [0, 0, 0, 0] as never, inputLog: [] } } : null;
    }
    case 'invalid-team': {
      const problems = Array.isArray(v.problems) && v.problems.length <= 50 ? v.problems.map(p => str(p, 300)) : null;
      return problems && problems.every(p => p !== null) ? { type: 'invalid-team', battleId, problems: problems as string[] } : null;
    }
    case 'error': {
      const message = str(v.message, 300);
      return message ? { type: 'error', battleId, message } : null;
    }
    default:
      return null;
  }
}

export function parseToGuest(data: unknown): ToGuest | null {
  if (!isObj(data)) return null;
  if (data.k === 'lobby') {
    const lobby = parseLobby(data.lobby);
    return lobby && { k: 'lobby', lobby };
  }
  if (data.k === 'engine') {
    const msg = parseEngine(data.msg);
    return msg && { k: 'engine', msg };
  }
  return null;
}
