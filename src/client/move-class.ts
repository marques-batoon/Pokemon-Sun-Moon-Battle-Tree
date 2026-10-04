// Classifies a move for animation purposes (what kind of effect to show).
import { gen7 } from '../team/dex';

export type MoveFxKind =
  /** Damaging move: animation depends on type and physical/special. */
  | 'attack'
  /** Damaging Z-Move: oversized animation. */
  | 'z'
  /** Raises the user's own stats (Swords Dance, Dragon Dance, Calm Mind...). */
  | 'powerup'
  /** Lowers the target's stats (Growl, Screech, Charm...). */
  | 'debuff'
  /** Inflicts a status or condition on the target (Thunder Wave, Will-O-Wisp, Confuse Ray, Leech Seed...). */
  | 'inflict'
  /** Protects the user this turn (Protect, Detect, King's Shield, Spiky Shield, Baneful Bunker...). */
  | 'protect'
  /** Restores the user's HP (Recover, Roost, Rest, Wish...). */
  | 'heal'
  /** Changes the field or a side (weather, terrain, rooms, screens, hazards, Tailwind). */
  | 'field'
  /** Forces the target out (Roar, Whirlwind). */
  | 'phaze'
  /** Substitute: the user puts up a decoy doll. */
  | 'substitute'
  | 'other';

export interface MoveFx {
  kind: MoveFxKind;
  moveId: string;
  type: string;
  category: 'Physical' | 'Special' | 'Status';
  /** For 'inflict': the status or volatile applied (par, slp, brn, psn, tox, confusion, ...). */
  condition?: string;
  /** For 'field': which flavour (weather, terrain, room, screen, hazard, tailwind). */
  field?: 'weather' | 'terrain' | 'room' | 'screen' | 'hazard' | 'tailwind' | 'other';
}

const PROTECT = new Set(['protect', 'detect', 'kingsshield', 'spikyshield', 'banefulbunker', 'endure', 'wideguard', 'quickguard', 'matblock', 'craftyshield']);
const HAZARDS = new Set(['stealthrock', 'spikes', 'toxicspikes', 'stickyweb']);
const SCREENS = new Set(['reflect', 'lightscreen', 'auroraveil', 'safeguard', 'mist', 'luckychant']);
const INFLICT_VOLATILES = new Set(['confusion', 'attract', 'yawn', 'leechseed', 'taunt', 'encore', 'torment', 'disable', 'embargo', 'healblock', 'nightmare', 'curse', 'perishsong', 'partiallytrapped', 'telekinesis', 'gastroacid', 'foresight', 'miracleeye']);

export function classifyMove(name: string): MoveFx {
  const move = gen7.moves.get(name);
  const base = { moveId: move?.id ?? name, type: move?.type ?? 'Normal', category: (move?.category ?? 'Status') as MoveFx['category'] };
  if (!move) return { ...base, kind: 'other' };
  if (move.category !== 'Status') return { ...base, kind: move.isZ ? 'z' : 'attack' };

  if (move.id === 'substitute') return { ...base, kind: 'substitute' };
  if (PROTECT.has(move.id) || move.stallingMove) return { ...base, kind: 'protect' };
  if (move.forceSwitch) return { ...base, kind: 'phaze' };
  if (move.heal || move.flags.heal || ['rest', 'wish', 'swallow', 'painsplit', 'healingwish', 'lunardance'].includes(move.id)) return { ...base, kind: 'heal' };
  if (move.weather) return { ...base, kind: 'field', field: 'weather' };
  if (move.terrain) return { ...base, kind: 'field', field: 'terrain' };
  if (move.pseudoWeather) return { ...base, kind: 'field', field: 'room' };
  if (move.sideCondition) {
    const id = move.sideCondition.toLowerCase();
    const field = id === 'tailwind' ? 'tailwind' : HAZARDS.has(id) ? 'hazard' : SCREENS.has(id) ? 'screen' : 'other';
    return { ...base, kind: 'field', field };
  }
  if (move.status) return { ...base, kind: 'inflict', condition: move.status };
  const volatile = move.volatileStatus ? move.volatileStatus.toLowerCase() : null;
  if (volatile && INFLICT_VOLATILES.has(volatile) && move.target !== 'self') return { ...base, kind: 'inflict', condition: volatile };

  const boosts = Object.values(move.boosts ?? {}) as number[];
  const selfTarget = move.target === 'self' || move.target === 'adjacentAllyOrSelf' || move.target === 'allySide';
  if (boosts.some(b => b > 0) && selfTarget) return { ...base, kind: 'powerup' };
  if (move.id === 'bellydrum' || move.id === 'stockpile' || (move.id === 'curse' && move.target !== 'normal')) return { ...base, kind: 'powerup' };
  if (selfTarget && volatile && ['focusenergy', 'aquaring', 'ingrain', 'magnetrise', 'charge', 'laserfocus', 'minimize', 'defensecurl'].includes(volatile)) return { ...base, kind: 'powerup' };
  if (boosts.some(b => b < 0) && !selfTarget) return { ...base, kind: 'debuff' };
  return { ...base, kind: 'other' };
}
