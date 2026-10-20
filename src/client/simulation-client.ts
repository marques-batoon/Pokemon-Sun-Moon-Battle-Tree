import type { AIKind, SimMatch } from '../engine/protocol';
import type { EngineTransport } from './transport';

/** Asks the engine to fight matches with AIs on every side (tournament matches the player isn't in). */
export class SimulationClient {
  private nextId = 0;
  private readonly pending = new Map<number, { resolve: (w: (0 | 1)[]) => void; reject: (e: Error) => void }>();
  private readonly transport: EngineTransport;

  constructor(transport: EngineTransport) {
    this.transport = transport;
    transport.listen(msg => {
      if (msg.type !== 'simulated') return;
      const waiting = this.pending.get(msg.requestId);
      this.pending.delete(msg.requestId);
      if (msg.winners) waiting?.resolve(msg.winners);
      else waiting?.reject(new Error(msg.error));
    });
  }

  /** Which side won each match (0: the first duo), in order. */
  simulate(matches: SimMatch[], ai: AIKind): Promise<(0 | 1)[]> {
    if (!matches.length) return Promise.resolve([]);
    const requestId = ++this.nextId;
    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      this.transport.send({ type: 'simulate', requestId, matches, ai });
    });
  }
}
