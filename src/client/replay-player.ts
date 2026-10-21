import type { PokemonSet } from '@pkmn/data';
import { BattleClient, type StartOptions } from './battle-client';
import type { FromEngine, ToEngine } from '../engine/protocol';
import type { EngineTransport } from './transport';

/**
 * A replayed battle's protocol (what p1 saw) split at each turn: segment 0 runs up to "|turn|1" (the leads coming
 * out), segment k from there up to "|turn|k+1", and the last one to the end. Requests are left out (nobody chooses).
 */
export function splitTurns(chunks: readonly string[]): string[][] {
  const segments: string[][] = [[]];
  for (const line of chunks.flatMap(c => c.split('\n'))) {
    if (!line || line.startsWith('|request|')) continue;
    segments[segments.length - 1].push(line);
    if (line.startsWith('|turn|')) segments.push([]);
  }
  if (!segments[segments.length - 1].length) segments.pop();
  return segments;
}

export interface ReplayState {
  /** The client showing the battle (a new one after each jump back or forward). */
  client: BattleClient;
  /** Segments applied so far: k means the battle is at the start of turn k (or over, when k = total). */
  at: number;
  total: number;
  /** Autoplay is paused (it stops after the turn on screen). */
  paused: boolean;
}

/** Stands in for the engine: the client's "start" is answered at once, and the replay feeds it the battle. */
class ReplayTransport implements EngineTransport {
  private readonly handlers = new Set<(msg: FromEngine) => void>();
  battleId: string | null = null;
  private readonly team: PokemonSet[];
  constructor(team: PokemonSet[]) {
    this.team = team;
  }
  send(msg: ToEngine): void {
    if (msg.type !== 'start') return;
    this.battleId = msg.battleId;
    this.emit({ type: 'started', battleId: msg.battleId, seed: '', opponentName: '', playerTeam: this.team });
  }
  listen(handler: (msg: FromEngine) => void) { this.handlers.add(handler); return () => { this.handlers.delete(handler); }; }
  dispose() { this.handlers.clear(); }
  emit(msg: FromEngine) { this.handlers.forEach(h => h(msg)); }
  feed(lines: string[]) { if (this.battleId) this.emit({ type: 'chunks', battleId: this.battleId, chunks: [lines.join('\n')] }); }
}

const START: StartOptions = { format: 'multi', seedText: 'replay', player: { name: '', team: [] }, opponent: { kind: 'test-fixture' }, ai: 'heuristic' };

/**
 * Plays a finished battle back turn by turn through an ordinary BattleClient (so it looks exactly like the battle):
 * it plays on by itself, and can jump to the previous or next turn at any time (a jump rebuilds the battle up to that
 * turn instantly, then carries on animated).
 */
export class ReplayPlayer {
  private readonly segments: string[][];
  private readonly team: PokemonSet[];
  /** Animation speed (Settings), read whenever a turn starts playing. */
  private readonly speed: () => number;
  private transport!: ReplayTransport;
  private client!: BattleClient;
  private unsubscribe: (() => void) | null = null;
  private at = 0;
  private paused = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private state!: ReplayState;
  private readonly listeners = new Set<() => void>();

  constructor(chunks: readonly string[], team: PokemonSet[], speed: () => number) {
    this.segments = splitTurns(chunks);
    this.team = team;
    this.speed = speed;
    this.rebuild(0);
    this.schedule();
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  getState = (): ReplayState => this.state;

  /** Turns in the battle (its last "|turn|" number). */
  get turns(): number {
    return Math.max(0, this.segments.length - 1);
  }

  /** On to the start of the next turn: the turn on screen finishes at once (or the next one is applied). */
  next(): void {
    this.clearTimer();
    if (this.client.getSnapshot().playing) this.client.skipAnimations();
    else if (this.at < this.segments.length) this.rebuild(this.at + 1);
    this.emit();
    this.schedule();
  }

  /** Back to the start of the previous turn (the one before the turn on screen, or being played). */
  previous(): void {
    const current = this.client.getSnapshot().playing ? this.at - 1 : this.at;
    this.rebuild(Math.max(0, current - 1));
    this.schedule();
  }

  /** Pause or carry on playing by itself. */
  togglePause(): void {
    this.paused = !this.paused;
    this.clearTimer();
    this.emit();
    this.schedule();
  }

  dispose(): void {
    this.clearTimer();
    this.unsubscribe?.();
    this.client.dispose();
    this.listeners.clear();
  }

  /** A fresh client with the first `n` segments applied instantly. */
  private rebuild(n: number) {
    this.clearTimer();
    this.unsubscribe?.();
    this.client?.dispose();
    this.transport = new ReplayTransport(this.team);
    this.client = new BattleClient(this.transport, { speed: 0, perspective: 'p1' });
    this.client.start(START);
    for (const segment of this.segments.slice(0, n)) this.transport.feed(segment);
    this.at = Math.min(n, this.segments.length);
    this.unsubscribe = this.client.subscribe(() => this.schedule());
    this.emit();
  }

  /** Autoplay: once the turn on screen has finished, the next one starts after a short pause. */
  private schedule() {
    if (this.paused || this.timer || this.at >= this.segments.length || this.client.getSnapshot().playing) return;
    const speed = this.speed();
    this.timer = setTimeout(() => {
      this.timer = null;
      if (this.paused || this.client.getSnapshot().playing || this.at >= this.segments.length) return;
      this.client.setSpeed(this.speed());
      this.transport.feed(this.segments[this.at]);
      this.at++;
      this.emit();
      this.schedule();
    }, this.at === 0 ? 300 : 700 * (speed > 0 ? speed : 1.4));
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private emit() {
    this.state = { client: this.client, at: this.at, total: this.segments.length, paused: this.paused };
    this.listeners.forEach(l => l());
  }
}
