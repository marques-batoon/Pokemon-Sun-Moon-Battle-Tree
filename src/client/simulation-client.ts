import type { PokemonSet } from '@pkmn/data';
import type { AIKind, SimMatch } from '../engine/protocol';
import type { EngineTransport } from './transport';

/** A simulated match: which duo won (0: the first) and the battle's input log (for replays). */
export interface SimOutcome { winner: 0 | 1; inputLog: string[] }

/** A battle played again from its input log: what p1 saw, chunk by chunk, and p1's team. */
export interface Replay { chunks: string[]; team: PokemonSet[] }

/**
 * Asks the engine to fight matches with AIs on every side (tournament matches the player isn't in), and to play
 * finished battles again from their input logs (replays).
 */
export class SimulationClient {
  private nextId = 0;
  private readonly pending = new Map<number, { resolve: (v: never) => void; reject: (e: Error) => void }>();
  private readonly transport: EngineTransport;

  constructor(transport: EngineTransport) {
    this.transport = transport;
    transport.listen(msg => {
      if (msg.type !== 'simulated' && msg.type !== 'replayed') return;
      const waiting = this.pending.get(msg.requestId);
      this.pending.delete(msg.requestId);
      if (!waiting) return;
      if (msg.error !== undefined) waiting.reject(new Error(msg.error));
      else if (msg.type === 'simulated') waiting.resolve(msg.winners.map((winner, i) => ({ winner, inputLog: msg.inputLogs[i] })) as never);
      else waiting.resolve({ chunks: msg.chunks, team: msg.team } as never);
    });
  }

  /** Which duo won each match (0: the first) and its input log, in order. */
  simulate(matches: SimMatch[], ai: AIKind): Promise<SimOutcome[]> {
    if (!matches.length) return Promise.resolve([]);
    return this.request(requestId => this.transport.send({ type: 'simulate', requestId, matches, ai }));
  }

  /** A finished battle played again from its input log. */
  replay(inputLog: string[]): Promise<Replay> {
    return this.request(requestId => this.transport.send({ type: 'replay', requestId, inputLog }));
  }

  private request<T>(send: (requestId: number) => void): Promise<T> {
    const requestId = ++this.nextId;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(requestId, { resolve: resolve as (v: never) => void, reject });
      send(requestId);
    });
  }
}
