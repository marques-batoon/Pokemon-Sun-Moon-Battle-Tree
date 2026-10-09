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
    /**
     * Multi Battles: the player's partner (2 Pokémon) and the second opponent. `human`: another
     * person plays the partner (online): their team is checked like the player's, their view
     * comes back as 'chunks' with side 'p3', and their choices go in as 'choose' with side 'p3'.
     */
    partner?: { name: string; team: PokemonSet[]; human?: boolean };
    opponent2?: OpponentSpec;
    ai: AIKind;
  }
  /** side: whose choice it is (default p1, the player; p3 is an online partner). */
  | { type: 'choose'; battleId: string; choice: string; side?: 'p1' | 'p3' }
  /** The AI plays the online partner from now on (they left or are taking too long). */
  | { type: 'takeover'; battleId: string; side: 'p3' }
  | { type: 'stop'; battleId: string }
  | { type: 'validate'; requestId: number; format: BattleTreeFormat; sets: PokemonSet[] };

export type FromEngine =
  | { type: 'started'; battleId: string; seed: string; opponentName: string; playerTeam: PokemonSet[] }
  /** Protocol chunks from the player's (p1) point of view, in order; side 'p3': an online partner's view. */
  | { type: 'chunks'; battleId: string; chunks: string[]; side?: 'p3' }
  | { type: 'end'; battleId: string; result: BattleResult }
  | { type: 'invalid-team'; battleId: string; problems: string[] }
  | { type: 'warning'; battleId: string; message: string }
  | { type: 'error'; battleId: string; message: string }
  | { type: 'validation'; requestId: number; result: TeamValidation };
