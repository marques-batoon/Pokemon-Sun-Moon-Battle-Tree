// Shapes of the raw `|request|` JSON the simulator sends to a player. Mirrors
// @pkmn/sim's sim/side.ts, which doesn't export these from its package entry.

export interface SimRequestPokemon {
  /** `"p1: Garchomp"` */
  ident: string;
  /** `"Garchomp, L50, M"` */
  details: string;
  /** `"183/183"`, `"0 fnt"`, `"95/183 par"` */
  condition: string;
  active: boolean;
  stats: Record<'atk' | 'def' | 'spa' | 'spd' | 'spe', number>;
  moves: string[];
  baseAbility: string;
  ability?: string;
  item: string;
  pokeball: string;
}

export interface SimRequestMove {
  move: string;
  id: string;
  pp?: number;
  maxpp?: number;
  target?: string;
  disabled?: string | boolean;
}

export interface SimRequestActive {
  moves: SimRequestMove[];
  trapped?: boolean;
  maybeTrapped?: boolean;
  maybeDisabled?: boolean;
  canMegaEvo?: boolean;
  canUltraBurst?: boolean;
  /** One entry per move slot: the Z-Move it becomes, or null. */
  canZMove?: ({ move: string; target: string } | null)[] | null;
}

export interface SimRequestSide {
  name: string;
  id: 'p1' | 'p2' | 'p3' | 'p4';
  pokemon: SimRequestPokemon[];
}

export type SimRequest =
  | { teamPreview: true; maxChosenTeamSize?: number; side: SimRequestSide; rqid?: number }
  | { forceSwitch: boolean[]; side: SimRequestSide; rqid?: number; noCancel?: boolean }
  | { active: SimRequestActive[]; side: SimRequestSide; rqid?: number; noCancel?: boolean }
  | { wait: true; side: SimRequestSide; rqid?: number };

export const isTeamPreview = (r: SimRequest): r is Extract<SimRequest, { teamPreview: true }> => 'teamPreview' in r && !!r.teamPreview;
export const isForceSwitch = (r: SimRequest): r is Extract<SimRequest, { forceSwitch: boolean[] }> => 'forceSwitch' in r && !!r.forceSwitch;
export const isMoveRequest = (r: SimRequest): r is Extract<SimRequest, { active: SimRequestActive[] }> => 'active' in r && !!r.active && !isForceSwitch(r);
export const isWait = (r: SimRequest): boolean => 'wait' in r && !!r.wait;

export const isFainted = (p: SimRequestPokemon) => p.condition.endsWith(' fnt');
