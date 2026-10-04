import type { PokemonSet, StatID } from '@pkmn/data';
import type { BattleTreeFormat } from '../engine/format-constants';

export type { PokemonSet, StatID };

export const STAT_IDS: StatID[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
export const STAT_LABELS: Record<StatID, string> = { hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe' };

export const MAX_TEAM_SIZE = 6;
export const MAX_EV_TOTAL = 510;
export const MAX_EV_STAT = 252;
export const MAX_IV = 31;
export const DEFAULT_LEVEL = 50;

export interface SavedTeam {
  id: string;
  name: string;
  format: BattleTreeFormat;
  /** 0-6 sets, in registration order. */
  sets: PokemonSet[];
  createdAt: number;
  updatedAt: number;
}

/** Validator output from the engine, attributed per slot where possible. */
export interface TeamValidation {
  /** Team-wide problems (clauses, team size). */
  team: string[];
  /** Problems for sets[i]. */
  sets: string[][];
}
