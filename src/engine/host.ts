import { Dex, Teams, TeamValidator, type PokemonSet } from '@pkmn/sim';
import { createAI } from '../ai';
import { FORMAT_IDS, IGNORED_VALIDATOR_PROBLEMS, registerBattleTreeFormats, type BattleTreeFormat } from './format';
import { testOpponentTeam } from './fixtures';
import type { TeamValidation } from '../team/types';
import type { FromEngine, OpponentSpec, TeamInput, ToEngine } from './protocol';
import { Rng } from '../run/rng';
import { seedFromString } from './seed';
import { BattleSession } from './session';

const keep = (problems: string[] | null) => (problems ?? []).filter(p => !IGNORED_VALIDATOR_PROBLEMS.some(r => r.test(p)));

const validators = new Map<BattleTreeFormat, TeamValidator>();
function validatorFor(format: BattleTreeFormat): TeamValidator {
  registerBattleTreeFormats();
  let v = validators.get(format);
  if (!v) validators.set(format, v = new TeamValidator(Dex.formats.get(FORMAT_IDS[format])));
  return v;
}

/** Validates a registered player team against the Battle Tree format. Returns problems (empty = legal). */
export function validatePlayerTeam(format: BattleTreeFormat, team: PokemonSet[]): string[] {
  // The validator mutates sets (levels, defaults); validate a copy.
  return keep(validatorFor(format).validateTeam(structuredClone(team)));
}

/**
 * Validation split per slot for the team builder: each set's own problems
 * (learnset, ability, item, bans, EVs) plus team-wide ones (clauses, size).
 */
export function validateTeamDetailed(format: BattleTreeFormat, team: PokemonSet[]): TeamValidation {
  const validator = validatorFor(format);
  const sets = team.map(set => keep(validator.validateSet(structuredClone(set), {})));
  const perSet = new Set(sets.flat());
  const teamProblems = validatePlayerTeam(format, team).filter(p => !perSet.has(p));
  return { team: teamProblems, sets };
}

function parseTeam(input: TeamInput): PokemonSet[] {
  return typeof input === 'string' ? Teams.import(input) ?? [] : input;
}

/**
 * The battle engine behind the worker boundary: owns simulator sessions and
 * speaks the ToEngine/FromEngine protocol. Transport-agnostic so tests can run
 * it in-process.
 */
export class EngineHost {
  private readonly sessions = new Map<string, BattleSession>();
  private readonly pending = new Map<string, string[]>();
  private readonly emit: (msg: FromEngine) => void;

  constructor(emit: (msg: FromEngine) => void) {
    this.emit = emit;
  }

  handle(msg: ToEngine): void {
    try {
      switch (msg.type) {
        case 'start': return this.start(msg);
        case 'choose': return this.sessions.get(msg.battleId)?.choose(msg.choice);
        case 'stop': return this.stop(msg.battleId);
        case 'validate':
          this.emit({ type: 'validation', requestId: msg.requestId, result: validateTeamDetailed(msg.format, msg.sets) });
          return;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (msg.type === 'validate') this.emit({ type: 'validation', requestId: msg.requestId, result: { team: [`Validator error: ${message}`], sets: msg.sets.map(() => []) } });
      else this.emit({ type: 'error', battleId: msg.battleId, message });
    }
  }

  private start(msg: Extract<ToEngine, { type: 'start' }>) {
    this.stop(msg.battleId);
    const playerTeam = parseTeam(msg.player.team);
    const problems = validatePlayerTeam(msg.format, playerTeam);
    if (problems.length) {
      this.emit({ type: 'invalid-team', battleId: msg.battleId, problems });
      return;
    }
    const seed = seedFromString(msg.seedText);
    const opponent = this.buildOpponent(msg.opponent, msg.seedText);
    const session = new BattleSession({
      format: msg.format,
      teamPreview: msg.teamPreview ?? true,
      seed,
      p1: { name: msg.player.name, team: playerTeam },
      p2: opponent,
      p2AI: createAI(msg.ai),
      onP1Output: chunk => this.queue(msg.battleId, chunk),
      onWarning: message => this.emit({ type: 'warning', battleId: msg.battleId, message }),
    });
    this.sessions.set(msg.battleId, session);
    this.emit({ type: 'started', battleId: msg.battleId, seed, opponentName: opponent.name, playerTeam });
    session.start();
    void session.done.then(result => {
      this.flush(msg.battleId);
      this.emit({ type: 'end', battleId: msg.battleId, result });
      this.sessions.delete(msg.battleId);
    });
  }

  private buildOpponent(spec: OpponentSpec, seedText: string) {
    switch (spec.kind) {
      case 'test-fixture': return testOpponentTeam(new Rng(`${seedText}|opponent`));
      case 'team': return { name: spec.name, team: spec.team };
    }
  }

  private stop(battleId: string) {
    this.sessions.get(battleId)?.stop();
    this.sessions.delete(battleId);
    this.pending.delete(battleId);
  }

  /**
   * Batches chunks produced in the same task. The simulator emits a turn's
   * |request| just before that turn's log; batching lets the UI apply the
   * request after the log it belongs with.
   */
  private queue(battleId: string, chunk: string) {
    const list = this.pending.get(battleId);
    if (list) { list.push(chunk); return; }
    this.pending.set(battleId, [chunk]);
    setTimeout(() => this.flush(battleId), 0);
  }

  private flush(battleId: string) {
    const chunks = this.pending.get(battleId);
    if (!chunks?.length) return;
    this.pending.delete(battleId);
    this.emit({ type: 'chunks', battleId, chunks });
  }
}
