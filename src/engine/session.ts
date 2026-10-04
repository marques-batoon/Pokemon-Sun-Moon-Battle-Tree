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
  /** Optional controller for p1, for headless autoplay (tests, debugging). */
  p1AI?: BattleAI;
  /** Every protocol chunk from p1's point of view (what the player is allowed to see). */
  onP1Output?: (chunk: string) => void;
  onWarning?: (message: string) => void;
}

export interface BattleResult {
  /** Side that won, or null on a tie. */
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
    const { format, seed, p1, p2, p1AI, p2AI, teamPreview = true } = this.opts;
    void this.pump(this.streams.p2, 'p2', p2AI);
    void this.pump(this.streams.p1, 'p1', p1AI, this.opts.onP1Output);
    void this.streams.omniscient.write([
      `>start ${JSON.stringify({ formatid: simFormatId(format, teamPreview), seed })}`,
      `>player p1 ${JSON.stringify({ name: p1.name, team: Teams.pack(applyFlatRules(p1.team)) })}`,
      `>player p2 ${JSON.stringify({ name: p2.name, team: Teams.pack(applyFlatRules(p2.team)) })}`,
    ].join('\n'));
  }

  /** Sends the player's choice ("team 123", "move 1", "move 2 zmove", "switch 3", ...). */
  choose(choice: string): void {
    if (this.finished) return;
    void this.streams.p1.write(choice);
  }

  stop(): void {
    this.finished = true;
    void this.stream.writeEnd();
  }

  private async pump(stream: PlayerStream, side: SideID, ai?: BattleAI, onChunk?: (chunk: string) => void) {
    const prng = ai ? derivedPrng(this.opts.seed, `ai-${side}`) : null;
    for await (const chunk of stream) {
      onChunk?.(chunk);
      for (const line of chunk.split('\n')) {
        if (ai && prng && line.startsWith('|request|')) {
          const request = JSON.parse(line.slice('|request|'.length)) as SimRequest;
          if ('wait' in request && request.wait) continue;
          const choice = ai.choose({ request, battle: this.battle, side, prng });
          void stream.write(choice);
        } else if (ai && line.startsWith('|error|')) {
          this.opts.onWarning?.(`${ai.name} AI (${side}) made an invalid choice: ${line}`);
          void stream.write('default');
        }
      }
      this.checkEnded();
    }
  }

  private checkEnded() {
    const battle = this.stream.battle;
    if (this.finished || !battle?.ended) return;
    this.finished = true;
    const winnerSide = battle.sides.find(s => s.name === battle.winner);
    this.resolveDone({
      winner: winnerSide ? winnerSide.id : null,
      turns: battle.turn,
      seed: this.opts.seed,
      inputLog: [...battle.inputLog],
    });
  }
}
