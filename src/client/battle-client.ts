import { Battle as ClientBattle } from '@pkmn/client';
import type { PokemonSet } from '@pkmn/data';
import { Protocol } from '@pkmn/protocol';
import { LogFormatter } from '@pkmn/view';
import type { BattleTreeFormat } from '../engine/format-constants';
import type { AIKind, FromEngine, OpponentSpec, TeamInput } from '../engine/protocol';
import type { BattleResult } from '../engine/session';
import type { SimRequest } from '../engine/sim-types';
import { gens } from '../team/dex';
import { nextTimers, NO_TIMERS, type FieldTimers } from './field-timers';
import { planLine, type BattleAnimation, type PlannedStep } from './playback';
import type { EngineTransport } from './transport';

export type { BattleAnimation } from './playback';

export interface LogEntry {
  id: number;
  kind: 'turn' | 'line' | 'error' | 'info';
  text: string;
}

export type BattlePhase = 'idle' | 'starting' | 'active' | 'ended' | 'invalid-team' | 'error';

export interface BattleSnapshot {
  rev: number;
  phase: BattlePhase;
  battleId: string | null;
  seedText: string | null;
  seed: string | null;
  opponentName: string | null;
  /** Battle state as the player sees it. Mutable object owned by the client; re-read on every rev. */
  battle: ClientBattle | null;
  /** The player's current request, or null if none is pending. */
  request: SimRequest | null;
  /** The player has answered the current request and is waiting for the turn to resolve. */
  awaiting: boolean;
  /** Events are still being played back (controls stay hidden until this is false). */
  playing: boolean;
  /** The event currently animating, if any. */
  animation: BattleAnimation | null;
  /** While events play back: the move being carried out (kept through its hits and effects until the next move). */
  currentMove: CurrentMove | null;
  /** While events play back: the log text of the event on screen ("It's super effective!"). */
  caption: string | null;
  /** Turn counters of timed field effects (weather, terrain, rooms, Tailwind), in step with playback. */
  fieldTimers: FieldTimers;
  log: LogEntry[];
  result: BattleResult | null;
  problems: string[];
  error: string | null;
}

export interface CurrentMove {
  name: string;
  type: string;
  category: 'Physical' | 'Special' | 'Status';
  /** Who is using it. */
  side: 'p1' | 'p2' | null;
  /** The log line announcing it ("The opposing Charizard used Flare Blitz!"). */
  text: string;
}

export interface StartOptions {
  format: BattleTreeFormat;
  /** Default true. false = game rule: player.team is the 3 brought, lead first, no Team Preview. */
  teamPreview?: boolean;
  seedText: string;
  player: { name: string; team: TeamInput };
  opponent: OpponentSpec;
  ai: AIKind;
}

type QueueItem =
  | { kind: 'line'; line: string; steps?: PlannedStep[]; text?: string }
  | { kind: 'request'; line: string }
  | { kind: 'end'; result: BattleResult };

const EMPTY: BattleSnapshot = {
  rev: 0, phase: 'idle', battleId: null, seedText: null, seed: null, opponentName: null, battle: null,
  request: null, awaiting: false, playing: false, animation: null, currentMove: null, caption: null, fieldTimers: NO_TIMERS, log: [], result: null, problems: [], error: null,
};

/**
 * UI-side view of one battle. Sends choices to the engine and rebuilds the
 * player's view of the battle from the protocol stream, playing events back
 * one at a time: each protocol line updates the state and the log, shows its
 * animation, and the next line waits until that animation is over.
 * Subscribe with useSyncExternalStore(client.subscribe, client.getSnapshot).
 */
export class BattleClient {
  private snapshot = EMPTY;
  private readonly listeners = new Set<() => void>();
  private formatter: LogFormatter | null = null;
  private logId = 0;
  private animId = 0;
  private nextBattle = 0;
  /** Several clients can share one worker; prefixes keep their battle ids apart. */
  private readonly idPrefix = Math.random().toString(36).slice(2, 8);
  private readonly unlisten: () => void;
  private readonly transport: EngineTransport;
  private queue: QueueItem[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** Animation speed multiplier on durations: 0 = instant (no animations), 1 = normal, 2 = slow. */
  private speed: number;

  constructor(transport: EngineTransport, opts: { speed?: number } = {}) {
    this.transport = transport;
    this.speed = opts.speed ?? 0;
    this.unlisten = transport.listen(msg => this.receive(msg));
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  getSnapshot = () => this.snapshot;

  setSpeed(speed: number): void {
    // Unknown values play at normal speed rather than silently turning playback off.
    this.speed = Number.isFinite(speed) ? Math.max(0, speed) : 1;
    if (this.speed === 0) this.skipAnimations();
  }

  /** Applies everything still queued at once (the "skip" button). */
  skipAnimations(): void {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    this.pump(true);
  }

  start(opts: StartOptions): string {
    if (this.snapshot.battleId) this.transport.send({ type: 'stop', battleId: this.snapshot.battleId });
    this.resetQueue();
    const battleId = `${this.idPrefix}-${++this.nextBattle}`;
    this.formatter = null;
    this.set({ ...EMPTY, phase: 'starting', battleId, seedText: opts.seedText });
    this.transport.send({ type: 'start', battleId, ...opts });
    return battleId;
  }

  choose(choice: string): void {
    const { battleId, request, phase, playing } = this.snapshot;
    if (!battleId || !request || phase !== 'active' || playing) return;
    this.transport.send({ type: 'choose', battleId, choice });
    this.set({ ...this.snapshot, awaiting: true });
  }

  dispose(): void {
    if (this.snapshot.battleId) this.transport.send({ type: 'stop', battleId: this.snapshot.battleId });
    this.resetQueue();
    this.unlisten();
    this.listeners.clear();
  }

  private resetQueue() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.queue = [];
  }

  private receive(msg: FromEngine) {
    if (!('battleId' in msg)) return;
    if (msg.battleId !== this.snapshot.battleId && msg.battleId !== '*') return;
    switch (msg.type) {
      case 'started': {
        const battle = new ClientBattle(gens, null, [msg.playerTeam as PokemonSet[]]);
        this.formatter = new LogFormatter('p1', battle);
        this.set({ ...this.snapshot, phase: 'active', battle, seed: msg.seed, opponentName: msg.opponentName });
        return;
      }
      case 'chunks': {
        const items: QueueItem[] = [];
        let request: QueueItem | null = null;
        for (const chunk of msg.chunks) {
          for (const line of chunk.split('\n')) {
            if (!line) continue;
            if (line.startsWith('|request|')) request = { kind: 'request', line };
            else items.push({ kind: 'line', line });
          }
        }
        // The request describes the state after this batch's log, so it goes last.
        if (request) items.push(request);
        return this.enqueue(items);
      }
      case 'end':
        return this.enqueue([{ kind: 'end', result: msg.result }]);
      case 'invalid-team':
        this.set({ ...this.snapshot, phase: 'invalid-team', problems: msg.problems });
        return;
      case 'warning':
        this.set({ ...this.snapshot, log: [...this.snapshot.log, this.entry('info', `[engine] ${msg.message}`)] });
        return;
      case 'error':
        this.set({ ...this.snapshot, phase: 'error', error: msg.message });
        return;
    }
  }

  private enqueue(items: QueueItem[]) {
    this.queue.push(...items);
    if (!this.timer) this.pump(false);
  }

  /**
   * Plays queued items. With speed 0 (or when skipping) everything is applied
   * in one go; otherwise one step at a time with a timer between steps.
   */
  private pump(instant: boolean) {
    const { battle } = this.snapshot;
    if (!battle || !this.formatter) return;
    const draft = { ...this.snapshot, log: [...this.snapshot.log] };
    const animate = !instant && this.speed > 0;

    while (this.queue.length) {
      const item = this.queue[0];
      const delay = this.step(item, draft, battle, animate);
      if (animate && delay > 0) {
        draft.playing = true;
        this.set(draft);
        this.timer = setTimeout(() => { this.timer = null; this.pump(false); }, delay * this.speed);
        return;
      }
    }
    draft.playing = false;
    draft.animation = null;
    draft.currentMove = null;
    draft.caption = null;
    this.set(draft);
  }

  /**
   * Runs the next step of the head item, removing the item once fully applied.
   * Returns the animation duration (ms at normal speed) of the step.
   */
  private step(item: QueueItem, draft: BattleSnapshot, battle: ClientBattle, animate: boolean): number {
    if (item.kind === 'end') {
      this.queue.shift();
      Object.assign(draft, { phase: 'ended', request: null, awaiting: false, result: item.result, animation: null });
      return 0;
    }
    if (item.kind === 'request') {
      this.queue.shift();
      const json = item.line.slice('|request|'.length);
      if (json) {
        battle.add(item.line);
        const parsed = JSON.parse(json) as SimRequest;
        draft.request = 'wait' in parsed && parsed.wait ? null : parsed;
        draft.awaiting = false;
      }
      draft.animation = null;
      return 0;
    }

    const { line } = item;
    if (line.startsWith('|error|')) {
      // e.g. "[Invalid choice] Can't switch: ..." - the sim keeps the old request open.
      this.queue.shift();
      draft.log.push(this.entry('error', line.slice('|error|'.length)));
      draft.awaiting = false;
      return 0;
    }

    const { args, kwArgs } = Protocol.parseBattleLine(line);
    if (!item.steps) {
      // Plan against the state before the line is applied (the formatter needs that state too).
      item.text = this.formatter!.formatText(args, kwArgs);
      item.steps = planLine(args as readonly string[], kwArgs as Record<string, unknown>, battle, !!item.text.trim());
    }
    const step = item.steps.shift()!;
    if (step.applyLine) {
      const lines = (item.text ?? '').split('\n').map(t => t.trim()).filter(Boolean);
      for (const t of lines) draft.log.push(this.entry(line.startsWith('|turn|') ? 'turn' : 'line', t));
      if (lines.length) draft.caption = lines.join(' ');
      if (args[0] === 'turn') draft.currentMove = null;
      draft.fieldTimers = nextTimers(draft.fieldTimers, args as readonly string[], kwArgs as Record<string, unknown>);
      battle.add(args, kwArgs);
    }
    const anim = step.animation;
    if (anim?.kind === 'move' && anim.moveName) {
      draft.currentMove = {
        name: anim.moveName, type: anim.moveType ?? '???', category: anim.moveCategory ?? 'Status', side: anim.side,
        text: draft.caption ?? `${anim.moveName}`,
      };
    }
    if (!item.steps.length) this.queue.shift();
    if (!animate || !step.animation) {
      if (animate) draft.animation = null;
      return 0;
    }
    draft.animation = { ...step.animation, id: ++this.animId };
    return step.animation.durationMs;
  }

  private entry(kind: LogEntry['kind'], text: string): LogEntry {
    return { id: ++this.logId, kind, text };
  }

  private set(next: BattleSnapshot) {
    this.snapshot = { ...next, rev: next.rev + 1 };
    this.listeners.forEach(l => l());
  }
}
