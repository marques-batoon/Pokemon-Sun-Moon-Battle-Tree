import { BattleStreams, Dex, Teams, TeamValidator, type PokemonSet } from '@pkmn/sim';
import { createAI } from '../ai';
import { FORMAT_IDS, IGNORED_VALIDATOR_PROBLEMS, registerBattleTreeFormats, type BattleTreeFormat } from './format';
import { testOpponentTeam } from './fixtures';
import type { TeamValidation } from '../team/types';
import type { AIKind, FromEngine, OpponentSpec, SimMatch, TeamInput, ToEngine } from './protocol';
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
 * Fights Multi Battles with AIs on all four sides (tournament matches the player isn't in), one after another, and
 * returns which side won each (0: the first duo) with the battle's input log. A tie (rare) is settled by a coin flip
 * seeded like the battle.
 */
export async function simulateMatches(matches: readonly SimMatch[], ai: AIKind): Promise<{ winner: 0 | 1; inputLog: string[] }[]> {
  const done: { winner: 0 | 1; inputLog: string[] }[] = [];
  for (const match of matches) {
    const [a, b] = match.sides;
    const session = new BattleSession({
      format: 'multi',
      teamPreview: false,
      seed: seedFromString(match.seedText),
      p1: a.trainers[0], p1AI: createAI(ai),
      p2: b.trainers[0], p2AI: createAI(ai),
      p3: { ...a.trainers[1], ai: createAI(ai) },
      p4: { ...b.trainers[1], ai: createAI(ai) },
    });
    session.start();
    const { winner, inputLog } = await session.done;
    done.push({ winner: winner === 'p1' ? 0 : winner === 'p2' ? 1 : (new Rng(`${match.seedText}|tie`).next() < 0.5 ? 0 : 1), inputLog });
  }
  return done;
}

/**
 * Plays a finished battle again from its simulator input log (its seed, teams and every choice: the same battle,
 * turn for turn) and returns what p1 saw, chunk by chunk, with p1's team. As in a live battle, each side's choices
 * are sent one at a time, as that side's requests come (an invalid one gets the next recorded choice, as the AI's
 * "default" did); the battle's dice only depend on its seed and the choices (BattleSession keeps the AI off them).
 */
export async function replayBattle(inputLog: readonly string[]): Promise<{ chunks: string[]; team: PokemonSet[] }> {
  registerBattleTreeFormats();
  const p1 = inputLog.find(line => line.startsWith('>player p1 '));
  if (!inputLog[0]?.startsWith('>start ') || !p1) throw new Error('Not a battle input log.');
  const team = Teams.unpack((JSON.parse(p1.slice('>player p1 '.length)) as { team: string }).team) ?? [];
  const sides = ['p1', 'p2', 'p3', 'p4'] as const;
  const queues: Record<(typeof sides)[number], string[]> = { p1: [], p2: [], p3: [], p4: [] };
  for (const line of inputLog) {
    const m = /^>(p[1-4]) (.*)$/.exec(line);
    if (m) queues[m[1] as (typeof sides)[number]].push(m[2]);
  }
  const battleStream = new BattleStreams.BattleStream();
  const streams = BattleStreams.getPlayerStreams(battleStream);
  const chunks: string[] = [];
  const present = sides.filter(side => inputLog.some(line => line.startsWith(`>player ${side} `)));
  let ending = false;
  const pumps = present.map(async side => {
    for await (const chunk of streams[side]) {
      if (side === 'p1') chunks.push(chunk);
      for (const line of chunk.split('\n')) {
        const waiting = line.startsWith('|request|') && !(JSON.parse(line.slice('|request|'.length)) as { wait?: boolean }).wait;
        if ((waiting || line.startsWith('|error|')) && queues[side].length) void streams[side].write(queues[side].shift()!);
      }
      if (battleStream.battle?.ended && !ending) {
        ending = true;
        void streams.omniscient.writeEnd();
      }
    }
  });
  await streams.omniscient.write(inputLog.filter(line => line.startsWith('>start ') || line.startsWith('>player ')).join('\n'));
  await Promise.all(pumps);
  return { chunks, team };
}

/**
 * The battle engine behind the worker boundary: owns simulator sessions and
 * speaks the ToEngine/FromEngine protocol. Transport-agnostic so tests can run
 * it in-process.
 */
export class EngineHost {
  private readonly sessions = new Map<string, BattleSession>();
  private readonly pending = new Map<string, string[]>();
  private readonly aiKinds = new Map<string, AIKind>();
  private readonly emit: (msg: FromEngine) => void;

  constructor(emit: (msg: FromEngine) => void) {
    this.emit = emit;
  }

  handle(msg: ToEngine): void {
    try {
      switch (msg.type) {
        case 'start': return this.start(msg);
        case 'choose': return this.sessions.get(msg.battleId)?.choose(msg.choice, msg.side ?? 'p1');
        case 'takeover': return this.sessions.get(msg.battleId)?.takeOver(msg.side, createAI(this.aiKinds.get(msg.battleId) ?? 'heuristic'));
        case 'stop': return this.stop(msg.battleId);
        case 'validate':
          this.emit({ type: 'validation', requestId: msg.requestId, result: validateTeamDetailed(msg.format, msg.sets) });
          return;
        case 'simulate':
          void simulateMatches(msg.matches, msg.ai).then(
            done => this.emit({ type: 'simulated', requestId: msg.requestId, winners: done.map(d => d.winner), inputLogs: done.map(d => d.inputLog) }),
            err => this.emit({ type: 'simulated', requestId: msg.requestId, error: err instanceof Error ? err.message : String(err) }),
          );
          return;
        case 'replay':
          void replayBattle(msg.inputLog).then(
            ({ chunks, team }) => this.emit({ type: 'replayed', requestId: msg.requestId, chunks, team }),
            err => this.emit({ type: 'replayed', requestId: msg.requestId, error: err instanceof Error ? err.message : String(err) }),
          );
          return;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (msg.type === 'validate') this.emit({ type: 'validation', requestId: msg.requestId, result: { team: [`Validator error: ${message}`], sets: msg.sets.map(() => []) } });
      else if (msg.type === 'simulate') this.emit({ type: 'simulated', requestId: msg.requestId, error: message });
      else if (msg.type === 'replay') this.emit({ type: 'replayed', requestId: msg.requestId, error: message });
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
    const multi = msg.format === 'multi';
    if (multi && (!msg.partner || !msg.opponent2)) throw new Error('A Multi Battle needs a partner and two opponents.');
    // An online partner's team comes from another person: check it like the player's.
    const human = multi && !!msg.partner!.human;
    const partnerProblems = human ? validatePlayerTeam(msg.format, msg.partner!.team) : [];
    if (partnerProblems.length) {
      this.emit({ type: 'invalid-team', battleId: msg.battleId, problems: partnerProblems.map(p => `${msg.partner!.name}'s team: ${p}`) });
      return;
    }
    this.aiKinds.set(msg.battleId, msg.ai);
    const partner = !multi ? null : human
      ? { name: msg.partner!.name, team: msg.partner!.team, onOutput: (chunk: string) => this.queue(msg.battleId, chunk, 'p3') }
      : { name: msg.partner!.name, team: msg.partner!.team, ai: createAI(msg.ai) };
    const opponent2 = multi ? this.buildOpponent(msg.opponent2!, `${msg.seedText}|second`) : null;
    const session = new BattleSession({
      format: msg.format,
      teamPreview: msg.teamPreview ?? true,
      seed,
      p1: { name: msg.player.name, team: playerTeam },
      p2: opponent,
      p2AI: createAI(msg.ai),
      ...(multi ? { p3: partner!, p4: { ...opponent2!, ai: createAI(msg.ai) } } : {}),
      onP1Output: chunk => this.queue(msg.battleId, chunk),
      onWarning: message => this.emit({ type: 'warning', battleId: msg.battleId, message }),
    });
    this.sessions.set(msg.battleId, session);
    this.emit({ type: 'started', battleId: msg.battleId, seed, opponentName: opponent2 ? `${opponent.name} & ${opponent2.name}` : opponent.name, playerTeam });
    session.start();
    void session.done.then(result => {
      this.flush(msg.battleId);
      this.flush(msg.battleId, 'p3');
      this.emit({ type: 'end', battleId: msg.battleId, result });
      this.sessions.delete(msg.battleId);
      this.aiKinds.delete(msg.battleId);
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
    this.pending.delete(`${battleId}|p3`);
    this.aiKinds.delete(battleId);
  }

  /**
   * Batches chunks produced in the same task. The simulator emits a turn's
   * |request| just before that turn's log; batching lets the UI apply the
   * request after the log it belongs with.
   */
  private queue(battleId: string, chunk: string, side?: 'p3') {
    const key = side ? `${battleId}|${side}` : battleId;
    const list = this.pending.get(key);
    if (list) { list.push(chunk); return; }
    this.pending.set(key, [chunk]);
    setTimeout(() => this.flush(battleId, side), 0);
  }

  private flush(battleId: string, side?: 'p3') {
    const key = side ? `${battleId}|${side}` : battleId;
    const chunks = this.pending.get(key);
    if (!chunks?.length) return;
    this.pending.delete(key);
    this.emit({ type: 'chunks', battleId, chunks, ...(side && { side }) });
  }
}
