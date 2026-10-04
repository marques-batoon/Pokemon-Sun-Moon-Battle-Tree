// Messages between the UI thread and the battle engine (Web Worker in the app,
// in-process in tests). Type-only imports keep @pkmn/sim off the UI thread.
import type { PokemonSet } from '@pkmn/sim';
import type { BattleTreeFormat } from './format-constants';
import type { TeamValidation } from '../team/types';
import type { BattleResult } from './session';

/** 'heuristic' approximates the in-game Battle Tree AI; 'random' picks any legal option. */
export type AIKind = 'heuristic' | 'random';

/** Showdown export text, or already-parsed sets. */
export type TeamInput = string | PokemonSet[];

export type OpponentSpec =
  /** Fixed test opponent: three of Super Red's sets. */
  | { kind: 'test-fixture' }
  | { kind: 'team'; name: string; team: PokemonSet[] };

export type ToEngine =
  | {
    type: 'start';
    battleId: string;
    format: BattleTreeFormat;
    /** Default true. false = game rule: player.team is the 3 brought (lead first), no Team Preview. */
    teamPreview?: boolean;
    /** Any text; hashed into the simulator seed. Same text + same choices = same battle. */
    seedText: string;
    player: { name: string; team: TeamInput };
    opponent: OpponentSpec;
    ai: AIKind;
  }
  | { type: 'choose'; battleId: string; choice: string }
  | { type: 'stop'; battleId: string }
  | { type: 'validate'; requestId: number; format: BattleTreeFormat; sets: PokemonSet[] };

export type FromEngine =
  | { type: 'started'; battleId: string; seed: string; opponentName: string; playerTeam: PokemonSet[] }
  /** Protocol chunks from the player's (p1) point of view, in order. */
  | { type: 'chunks'; battleId: string; chunks: string[] }
  | { type: 'end'; battleId: string; result: BattleResult }
  | { type: 'invalid-team'; battleId: string; problems: string[] }
  | { type: 'warning'; battleId: string; message: string }
  | { type: 'error'; battleId: string; message: string }
  | { type: 'validation'; requestId: number; result: TeamValidation };
