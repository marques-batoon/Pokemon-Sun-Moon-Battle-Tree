import { BattleStreams, Teams, type Battle, type PokemonSet, type PRNGSeed, type SideID } from '@pkmn/sim';
import type { BattleAI } from '../ai/types';
import { applyFlatRules, registerBattleTreeFormats, simFormatId, type BattleTreeFormat } from './format';
import { derivedPrng } from './prng';
import type { SimRequest } from './sim-types';

type PlayerStream = ReturnType<typeof BattleStreams.getPlayerStreams>['p1'];

export interface PlayerSpec {
  name: string;
  team: PokemonSet[];
}

export interface SessionOptions {
  format: BattleTreeFormat;
  /**
   * true (default): Showdown-style Team Preview, each side brings 3 of its team.
   * false (game rule): teams are exactly the Pokémon brought, lead first; no preview.
   */
  teamPreview?: boolean;
  seed: PRNGSeed;
  p1: PlayerSpec;
  p2: PlayerSpec;
  /** Controls p2 (the Battle Tree opponent). */
  p2AI: BattleAI;
  /**
   * Multi Battles: the player's partner (p3) and the second opponent (p4, AI). The partner is
   * an AI, or a person (online Multi) when `ai` is left out: their protocol goes to
   * `onOutput` and their choices come in through choose(choice, 'p3').
   */
  p3?: PlayerSpec & ({ ai: BattleAI } | { ai?: undefined; onOutput: (chunk: string) => void });
  p4?: PlayerSpec & { ai: BattleAI };
  /** Optional controller for p1, for headless autoplay (tests, debugging). */
  p1AI?: BattleAI;
  /** Every protocol chunk from p1's point of view (what the player is allowed to see). */
  onP1Output?: (chunk: string) => void;
  onWarning?: (message: string) => void;
}

export interface BattleResult {
  /** Side that won, or null on a tie. In Multi Battles, p1 means the player and partner won. */
  winner: SideID | null;
  turns: number;
  seed: PRNGSeed;
  /** Simulator input log (seed, teams, every choice). Replaying it reproduces the battle. */
  inputLog: string[];
}

/**
 * One battle between the player (p1) and an AI (p2). Runs anywhere @pkmn/sim
 * runs: inside the Web Worker for the app, directly in Node for tests.
 */
export class BattleSession {
  readonly done: Promise<BattleResult>;
  private readonly stream = new BattleStreams.BattleStream();
  private readonly streams = BattleStreams.getPlayerStreams(this.stream);
  private resolveDone!: (r: BattleResult) => void;
  private finished = false;
  private readonly opts: SessionOptions;
  /** Who answers each side's requests (none: a person, through choose()). Can change mid-battle (takeOver). */
  private readonly ais: Partial<Record<SideID, BattleAI>> = {};
  /** Each side's latest unanswered request, so an AI taking over can answer it. */
  private readonly pending: Partial<Record<SideID, SimRequest>> = {};

  constructor(opts: SessionOptions) {
    this.opts = opts;
    registerBattleTreeFormats();
    this.done = new Promise(resolve => { this.resolveDone = resolve; });
  }

  /** The live simulator battle (read-only for callers). */
  get battle(): Battle {
    if (!this.stream.battle) throw new Error('Battle not started');
    return this.stream.battle;
  }

  start(): void {
    const { format, seed, p1, p2, p3, p4, p1AI, p2AI, teamPreview = true } = this.opts;
    const multi = format === 'multi';
    if (multi && (!p3 || !p4)) throw new Error('A Multi Battle needs a partner and two opponents.');
    Object.assign(this.ais, { p1: p1AI, p2: p2AI, ...(multi ? { p3: p3!.ai, p4: p4!.ai } : {}) });
    void this.pump(this.streams.p2, 'p2');
    if (multi) {
      void this.pump(this.streams.p3, 'p3', p3!.ai ? undefined : p3!.onOutput);
      void this.pump(this.streams.p4, 'p4');
    }
    void this.pump(this.streams.p1, 'p1', this.opts.onP1Output);
    const player = (id: SideID, spec: PlayerSpec) => `>player ${id} ${JSON.stringify({ name: spec.name, team: Teams.pack(applyFlatRules(spec.team)) })}`;
    void this.streams.omniscient.write([
      `>start ${JSON.stringify({ formatid: simFormatId(format, teamPreview), seed })}`,
      player('p1', p1),
      player('p2', p2),
      ...(multi ? [player('p3', p3!), player('p4', p4!)] : []),
    ].join('\n'));
  }

  /**
   * Sends a person's choice ("team 123", "move 1", "move 2 zmove", "switch 3", ...): the
   * player's (p1), or an online partner's (p3). Ignored for sides an AI controls.
   */
  choose(choice: string, side: 'p1' | 'p3' = 'p1'): void {
    if (this.finished || (side === 'p3' && this.ais.p3)) return;
    delete this.pending[side];
    void this.streams[side].write(choice);
  }

  /** An AI takes over a side from now on (an online partner left), answering any request they left open. */
  takeOver(side: 'p3', ai: BattleAI): void {
    if (this.finished || this.ais[side]) return;
    this.ais[side] = ai;
    const request = this.pending[side];
    if (request) this.answer(this.streams[side], side, request);
  }

  stop(): void {
    this.finished = true;
    void this.stream.writeEnd();
  }

  private readonly prngs: Partial<Record<SideID, ReturnType<typeof derivedPrng>>> = {};

  private async pump(stream: PlayerStream, side: SideID, onChunk?: (chunk: string) => void) {
    for await (const chunk of stream) {
      // Once an AI has taken over, the person who left no longer gets this side's view.
      if (!this.ais[side] || side === 'p1') onChunk?.(chunk);
      for (const line of chunk.split('\n')) {
        const ai = this.ais[side];
        if (line.startsWith('|request|')) {
          const request = JSON.parse(line.slice('|request|'.length)) as SimRequest;
          if ('wait' in request && request.wait) continue;
          this.pending[side] = request;
          if (ai) this.answer(stream, side, request);
        } else if (ai && line.startsWith('|error|')) {
          this.opts.onWarning?.(`${ai.name} AI (${side}) made an invalid choice: ${line}`);
          void stream.write('default');
        }
      }
      this.checkEnded();
    }
  }

  private answer(stream: PlayerStream, side: SideID, request: SimRequest) {
    const ai = this.ais[side]!;
    const prng = (this.prngs[side] ??= derivedPrng(this.opts.seed, `ai-${side}`));
    delete this.pending[side];
    void stream.write(ai.choose({ request, battle: this.battle, side, prng }));
  }

  private checkEnded() {
    const battle = this.stream.battle;
    if (this.finished || !battle?.ended) return;
    this.finished = true;
    // Multi Battles: the winner is the allied pair ("Player & Sina"); report it as the player's side or not.
    const winnerSide = battle.sides.find(s => s.name === battle.winner || (s.allySide && `${s.name} & ${s.allySide.name}` === battle.winner));
    const winner = !winnerSide ? null : winnerSide.id === 'p3' ? 'p1' : winnerSide.id === 'p4' ? 'p2' : winnerSide.id;
    this.resolveDone({
      winner,
      turns: battle.turn,
      seed: this.opts.seed,
      inputLog: [...battle.inputLog],
    });
  }
}
