import type { BattleTreeFormat } from '../engine/format-constants';
import type { PokemonSet, TeamValidation } from '../team/types';
import type { EngineTransport } from './transport';

/** Asks the engine (which owns Showdown's TeamValidator) to check a team. */
export class ValidationClient {
  private nextId = 0;
  private readonly pending = new Map<number, (r: TeamValidation) => void>();
  private readonly transport: EngineTransport;

  constructor(transport: EngineTransport) {
    this.transport = transport;
    transport.listen(msg => {
      if (msg.type !== 'validation') return;
      this.pending.get(msg.requestId)?.(msg.result);
      this.pending.delete(msg.requestId);
    });
  }

  validate(format: BattleTreeFormat, sets: PokemonSet[]): Promise<TeamValidation> {
    const requestId = ++this.nextId;
    return new Promise(resolve => {
      this.pending.set(requestId, resolve);
      this.transport.send({ type: 'validate', requestId, format, sets });
    });
  }
}
