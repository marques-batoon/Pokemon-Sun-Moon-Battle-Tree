// What a move turns into as a Z-Move, for the move buttons: name, type,
// category, power and (for status moves) the Z-Power bonus.
import type { Move } from '@pkmn/data';
import { gen7 } from '../../team/dex';

export interface ZMoveInfo {
  name: string;
  type: string;
  category: string;
  /** Base power as shown on the button ('—' for status moves). */
  power: string;
  /** Status Z-Moves: the extra effect, e.g. "+1 Atk" or "resets lowered stats". */
  effect: string | null;
}

const STAT_LABEL: Record<string, string> = { atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe', accuracy: 'Accuracy', evasion: 'Evasion' };
const EFFECT_LABEL: Record<string, string> = {
  clearnegativeboost: 'resets lowered stats',
  heal: 'restores all HP',
  healreplacement: 'heals the replacement',
  crit2: 'critical-hit ratio +2',
  redirect: 'draws in attacks',
  curse: 'Ghost: restores all HP; others: +1 Atk',
};

function boostText(boost: Partial<Record<string, number>>): string {
  const entries = Object.entries(boost).filter((e): e is [string, number] => !!e[1]);
  const stats = ['atk', 'def', 'spa', 'spd', 'spe'];
  if (entries.length === 5 && stats.every(s => boost[s] === entries[0][1])) return `+${entries[0][1]} all stats`;
  return entries.map(([stat, n]) => `${n > 0 ? '+' : ''}${n} ${STAT_LABEL[stat] ?? stat}`).join(', ');
}

/**
 * `zName` is the Z-Move the simulator offers for `base` (request.canZMove).
 * Type Z-Moves (Breakneck Blitz, …, and the custom Poliwrathium Z moves) are
 * stored with power 1 and take their power and category from the base move;
 * exclusive Z-Moves (Catastropika, …) have their own.
 */
export function zMoveInfo(base: Move, zName: string): ZMoveInfo {
  if (base.category === 'Status') {
    const z = base.zMove;
    const effect = z?.boost ? boostText(z.boost) : z?.effect ? EFFECT_LABEL[z.effect] ?? null : null;
    return { name: zName, type: base.type, category: 'Status', power: '—', effect };
  }
  const zMove = gen7.moves.get(zName);
  if (zMove && zMove.basePower > 1) {
    return { name: zMove.name, type: zMove.type, category: zMove.category, power: String(zMove.basePower), effect: null };
  }
  const power = base.zMove?.basePower;
  return { name: zName, type: zMove?.type ?? base.type, category: base.category, power: power ? String(power) : 'var.', effect: null };
}
