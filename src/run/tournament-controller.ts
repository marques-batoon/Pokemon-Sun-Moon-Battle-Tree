import type { BattleClient, BattleSnapshot } from '../client/battle-client';
import type { AIKind, SimMatch } from '../engine/protocol';
import type { SimOutcome } from '../client/simulation-client';
import { TRAINERS } from '../data/battle-tree';
import { checkBring, withBeaten, type RunTeam } from './controller';
import { partnerTeam, runPartner } from './partners';
import type { RunStore } from './run-store';
import { displayName } from './selection';
import {
  drawBracket, emptyResults, entrantLabel, matchCount, matchEntrants, matchSeedText, nextOpponent, playerIndex, playerMatch, roundsOf, tournamentBp,
  type TournamentEntrant, type TournamentState,
} from './tournament';
import { DEFAULT_SETTINGS, isSuperUnlocked, type RunSettings, type TreeProfile } from './types';

/** Fights matches with AIs on every side and says which duo won each, with its input log (SimulationClient.simulate). */
export type Simulate = (matches: SimMatch[], ai: AIKind) => Promise<SimOutcome[]>;

export interface StartTournamentOptions {
  team: RunTeam;
  /** A partner you own and the two of their Pokémon they bring (set ids from their offer), lead first. */
  partner: { name: string; setIds: number[] };
  settings: RunSettings;
  /** Fixed seed for a reproducible tournament; random if omitted. */
  seedText?: string;
}

export interface TournamentSnapshot {
  tournament: TournamentState | null;
  profile: TreeProfile;
  /** Your match is being played in this session. */
  inBattle: boolean;
  /** Rounds whose other matches are being simulated now. */
  simulating: readonly number[];
  /** Last problem (the engine rejected the team, a simulation failed...). */
  error: string | null;
}

/**
 * Runs the All Star Duo Tournament: draws the bracket, plays your matches through the BattleClient, has the engine
 * fight the others (Simulate), and applies BP and partner progress. Saved with the Battle Tree progress (RunStore).
 */
export class TournamentController {
  private readonly store: RunStore;
  private readonly battle: BattleClient;
  private readonly simulate: Simulate;
  private readonly now: () => number;
  private readonly playerName: () => string;
  private activeBattle: string | null = null;
  private readonly inFlight = new Map<number, Promise<void>>();
  private error: string | null = null;
  private snapshot: TournamentSnapshot;
  private readonly listeners = new Set<() => void>();

  constructor(store: RunStore, battle: BattleClient, simulate: Simulate, opts: { now?: () => number; playerName?: () => string } = {}) {
    this.store = store;
    this.battle = battle;
    this.simulate = simulate;
    this.now = opts.now ?? Date.now;
    this.playerName = opts.playerName ?? (() => 'Player');
    this.snapshot = this.build();
    store.subscribe(() => this.refresh());
    battle.subscribe(() => this.onBattle(battle.getSnapshot()));
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  getSnapshot = (): TournamentSnapshot => this.snapshot;

  get battleClient(): BattleClient {
    return this.battle;
  }

  get tournament(): TournamentState | null {
    return this.store.getState().tournament;
  }

  /** Your match was started but the app reloaded before it finished. */
  isInterrupted(): boolean {
    return this.tournament?.status === 'in-battle' && this.activeBattle === null;
  }

  /** A new tournament (replacing any saved one): the draw, you at a random place, round 1 next. */
  start(opts: StartTournamentOptions): TournamentState {
    const { profile } = this.store.getState();
    if (!isSuperUnlocked(profile, 'multi')) throw new Error('The All Star Duo Tournament opens with Super Multi, once Super Singles and Super Doubles are both unlocked.');
    checkBring(opts.team, 'multi');
    const partner = runPartner(opts.partner.name, opts.partner.setIds, profile.partners);
    const seedText = opts.seedText ?? `${this.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const settings: RunSettings = { ...DEFAULT_SETTINGS, ...opts.settings, teamPreviewEachBattle: false };
    const t = this.now();
    const tournament: TournamentState = {
      id: `tournament-${t.toString(36)}`,
      seedText,
      settings,
      team: structuredClone(opts.team),
      partner,
      entrants: drawBracket(seedText, partner.trainerId),
      results: emptyResults(),
      logs: emptyResults<string[]>(),
      shown: 0,
      round: 0,
      status: 'ready',
      bp: 0,
      history: [],
      debug: settings.ai !== 'heuristic',
      startedAt: t,
      updatedAt: t,
    };
    this.error = null;
    this.inFlight.clear();
    if (!tournament.debug) this.store.updateProfile(p => ({ ...p, tournaments: { ...p.tournaments, entered: p.tournaments.entered + 1 } }));
    this.save(tournament);
    return tournament;
  }

  /** Starts your match in the current round. Returns the battle id. */
  startBattle(): string {
    const t = this.require();
    if (t.status !== 'ready' && !this.isInterrupted()) throw new Error(`Can't start a match now (${t.status}).`);
    const foes = nextOpponent(t);
    if (!foes) throw new Error('Your opponents in this round aren\'t decided yet.');
    const [first, second] = foes.trainers;
    this.error = null;
    const battleId = this.battle.start({
      format: 'multi',
      teamPreview: false,
      seedText: matchSeedText(t.seedText, t.round, playerMatch(t, t.round)),
      player: { name: this.playerName(), team: t.team.bring.map(i => t.team.sets[i]) },
      opponent: { kind: 'team', name: first.displayName, team: first.team },
      partner: { name: displayName(TRAINERS[t.partner.trainerId]), team: partnerTeam(t.partner) },
      opponent2: { kind: 'team', name: second.displayName, team: second.team },
      ai: t.settings.ai,
    });
    this.activeBattle = battleId;
    this.save({ ...t, status: 'in-battle' });
    return battleId;
  }

  /** Interrupted match: count it as a loss, as the Battle Tree does. */
  forfeitInterrupted(): void {
    const t = this.tournament;
    if (t && this.isInterrupted()) this.recordLoss(t, 0, 'lost');
  }

  /** Interrupted match: play it again from the start (same opponents and seed). */
  restartInterrupted(): void {
    const t = this.tournament;
    if (t && this.isInterrupted()) this.save({ ...t, status: 'ready' });
  }

  /** Give up between matches: the duo you were to face goes through, and the rest of the bracket plays out. */
  retire(): void {
    const t = this.require();
    if (t.status !== 'ready' || !nextOpponent(t)) throw new Error('You can retire between matches.');
    this.recordLoss(t, 0, 'retired');
  }

  /** The bracket has shown this many rounds' results (after their animation). */
  markShown(rounds: number): void {
    const t = this.tournament;
    if (t && rounds > t.shown) this.save({ ...t, shown: Math.min(rounds, roundsOf(t)) });
  }

  /**
   * Has the engine fight round r's undecided matches (those whose two duos are known, and not yours while you're
   * still to play it). Safe to call again: a round being simulated isn't started twice.
   */
  resolveRound(round: number): Promise<void> {
    const running = this.inFlight.get(round);
    if (running) return running;
    const t = this.tournament;
    if (!t || round < 0 || round >= roundsOf(t)) return Promise.resolve();
    const out = t.status === 'lost' || t.status === 'retired' || t.status === 'won';
    const mine = out ? -1 : playerMatch(t, round);
    const todo: { match: number; pair: [number, number] }[] = [];
    for (let m = 0; m < matchCount(round, roundsOf(t)); m++) {
      if (t.results[round][m] !== null || m === mine) continue;
      const pair = matchEntrants(t, round, m);
      if (pair && pair.every(i => t.entrants[i].kind === 'duo')) todo.push({ match: m, pair });
    }
    if (!todo.length) return Promise.resolve();
    const matches: SimMatch[] = todo.map(({ match, pair }) => ({
      seedText: matchSeedText(t.seedText, round, match),
      sides: pair.map(i => simDuo(t.entrants[i])) as SimMatch['sides'],
    }));
    const id = t.id;
    const job = this.simulate(matches, t.settings.ai).then(
      outcomes => {
        const now = this.tournament;
        if (!now || now.id !== id) return;
        const results = now.results.map(r => [...r]);
        const logs = withLogs(now);
        todo.forEach(({ match, pair }, k) => {
          results[round][match] = pair[outcomes[k].winner];
          logs[round][match] = outcomes[k].inputLog;
        });
        this.save({ ...now, results, logs });
      },
      err => { this.error = `Couldn't simulate the other matches: ${err instanceof Error ? err.message : String(err)}`; },
    ).finally(() => { this.inFlight.delete(round); this.refresh(); });
    this.inFlight.set(round, job);
    this.refresh();
    return job;
  }

  /** Remove a finished tournament after its results were shown. */
  dismiss(): void {
    const t = this.tournament;
    if (t && (t.status === 'won' || t.status === 'lost' || t.status === 'retired')) this.store.setTournament(null);
  }

  private onBattle(s: BattleSnapshot) {
    if (!this.activeBattle || s.battleId !== this.activeBattle) return;
    const t = this.tournament;
    if (!t || t.status !== 'in-battle') return;
    if (s.phase === 'ended' && s.result) {
      this.activeBattle = null;
      if (s.result.winner === 'p1') this.recordWin(t, s.result.turns, s.result.inputLog);
      else this.recordLoss(t, s.result.turns, 'lost', s.result.inputLog);
    } else if (s.phase === 'invalid-team' || s.phase === 'error') {
      this.activeBattle = null;
      this.error = s.phase === 'invalid-team' ? `Team rejected: ${s.problems.join(' ')}` : `Engine error: ${s.error}`;
      this.save({ ...t, status: 'ready' });
    }
  }

  private recordWin(t: TournamentState, turns: number, inputLog: string[]) {
    const foes = nextOpponent(t)!;
    const rounds = roundsOf(t);
    const bp = t.debug ? 0 : tournamentBp(t.round, rounds);
    const results = t.results.map(r => [...r]);
    results[t.round][playerMatch(t, t.round)] = playerIndex(t);
    const logs = withLogs(t);
    logs[t.round][playerMatch(t, t.round)] = inputLog;
    const final = t.round === rounds - 1;
    if (!t.debug) {
      this.store.updateProfile(p => ({
        ...p,
        bpTotal: p.bpTotal + bp,
        // As in All Star Mode: anyone beaten here for the first time comes into the shop at 10000 BP.
        partners: withBeaten(p, foes.trainers.map(f => f.trainerId), true),
        tournaments: final ? { ...p.tournaments, won: p.tournaments.won + 1 } : p.tournaments,
      }));
    }
    const history = [...t.history, this.record(t, foes, 'win', bp, turns)];
    this.save({ ...t, results, logs, bp: t.bp + bp, history, ...(final ? { status: 'won' as const } : { status: 'ready' as const, round: t.round + 1 }) });
    // The rest of this round is fought now, so the bracket can show it and your next opponents.
    if (!final) void this.resolveRound(t.round);
  }

  /** `inputLog`: the match you lost (none when you retired, or a match counted as lost after an interruption). */
  private recordLoss(t: TournamentState, turns: number, status: 'lost' | 'retired', inputLog?: string[]) {
    const foes = nextOpponent(t)!;
    const results = t.results.map(r => [...r]);
    const pair = matchEntrants(t, t.round, playerMatch(t, t.round))!;
    results[t.round][playerMatch(t, t.round)] = pair.find(i => t.entrants[i].kind === 'duo')!;
    const logs = withLogs(t);
    if (inputLog) logs[t.round][playerMatch(t, t.round)] = inputLog;
    const history = status === 'lost' ? [...t.history, this.record(t, foes, 'loss', 0, turns)] : t.history;
    this.save({ ...t, results, logs, history, status });
    void this.resolveRound(t.round);
  }

  private record(t: TournamentState, foes: TournamentEntrant, result: 'win' | 'loss', bp: number, turns: number) {
    return { battle: t.round + 1, opponent: entrantLabel(foes), result, bp, turns, seedText: matchSeedText(t.seedText, t.round, playerMatch(t, t.round)) };
  }

  private require(): TournamentState {
    const t = this.tournament;
    if (!t) throw new Error('No tournament in progress.');
    return t;
  }

  private save(t: TournamentState) {
    this.store.setTournament({ ...t, updatedAt: this.now() });
  }

  private build(): TournamentSnapshot {
    const { tournament, profile } = this.store.getState();
    return { tournament, profile, inBattle: this.activeBattle !== null, simulating: [...this.inFlight.keys()], error: this.error };
  }

  private refresh() {
    this.snapshot = this.build();
    this.listeners.forEach(l => l());
  }
}

/** A copy of the tournament's match logs to change (empty ones for a tournament saved before replays). */
function withLogs(t: TournamentState): (string[] | null)[][] {
  return t.logs ? t.logs.map(r => [...r]) : emptyResults<string[]>(roundsOf(t));
}

/** A duo as the engine fights it: names and teams, left trainer first. */
function simDuo(e: TournamentEntrant): SimMatch['sides'][number] {
  if (e.kind !== 'duo') throw new Error('Only duos are simulated.');
  return { trainers: [{ name: e.trainers[0].displayName, team: e.trainers[0].team }, { name: e.trainers[1].displayName, team: e.trainers[1].team }] };
}
