// Which sprite animation and which catalog effect each battle event gets.
import type { CSSProperties } from 'react';
import type { BattleAnimation } from '../../../client/playback';
import {
  blockedSpec, cantSpec, CONFUSED, CURE, drainSpec, fieldSpec, INFATUATED, MEGA_BURST, MEGA_START, moveSpec, residualSpec, SEEDED, statusSpec,
  SUB_END, SUB_HIT, SUB_START, Z_POWER, type FxSpec,
} from './catalog';
import { posKey, shakeDelay, type Pos, type Side } from './geometry';

/** Is the animation's acting Pokémon at this position? */
export const actsAt = (anim: BattleAnimation | null, side: Side, slot = 0) => !!anim && anim.side === side && (anim.slot ?? 0) === slot;

/** Animation class for the sprite at one position. a/b variants restart CSS animations on consecutive events. */
export function spriteClass(side: Side, slot: number, anim: BattleAnimation | null): string {
  if (!anim) return '';
  const v = anim.id % 2 ? 'a' : 'b';
  // HP drain involves both Pokémon: one loses HP, the other glows as it heals.
  if (anim.kind === 'leech' || anim.kind === 'absorb') {
    const here = posKey(side, slot);
    const user = anim.side ? posKey(anim.side, anim.slot) : null;
    const other = anim.target ? posKey(anim.target, anim.targetSlot) : null;
    const drained = anim.kind === 'leech' ? user : other;
    const healer = anim.kind === 'leech' ? other : user;
    return here === drained ? `fx-drained-${v}` : here === healer ? `fx-absorb-${v}` : '';
  }
  if (!actsAt(anim, side, slot)) return '';
  switch (anim.kind) {
    case 'move': {
      const fx = anim.fx;
      if (anim.still || !fx) return `fx-power-${v}`;
      const atFoe = anim.target && anim.target !== side;
      switch (fx.kind) {
        case 'z': return `fx-zuser-${side}`;
        case 'attack': return fx.category === 'Physical' && atFoe ? `fx-lunge-${side}-${v}` : `fx-cast-${v}`;
        case 'powerup': return `fx-powerup-${v}`;
        case 'heal': return `fx-heal-${v}`;
        case 'debuff':
        case 'inflict':
        case 'phaze': return `fx-cast-${v}`;
        default: return `fx-power-${v}`;
      }
    }
    case 'zpower': return 'fx-zcharge';
    case 'hit': return `fx-hit-${v}`;
    case 'residual': return anim.condition === 'confusion' ? `fx-hit-${v}` : `fx-hurt-${v}`;
    case 'heal':
    case 'cure': return `fx-heal-${v}`;
    case 'status':
    case 'cant':
      switch (anim.condition) {
        case 'par': return `fx-jolt-${v}`;
        case 'slp':
        case 'recharge': return `fx-doze-${v}`;
        case 'frz': return `fx-freeze-${v}`;
        case 'flinch': return `fx-flinch-${v}`;
        default: return `fx-hurt-${v}`;
      }
    case 'confused': return `fx-dizzy-${v}`;
    case 'infatuated': return `fx-smitten-${v}`;
    case 'switch-out': return 'fx-switch-out';
    case 'switch-in': return `fx-switch-in-${side}`;
    case 'faint': return 'fx-faint';
    case 'mega-start': return 'fx-mega-start';
    case 'mega': return 'fx-mega-burst';
    case 'forme': return `fx-transform-${v}`;
    case 'miss': return `fx-dodge-${v}`;
    default: return '';
  }
}

/** The catalog animation for an event, if it has one. */
export function effectSpec(anim: BattleAnimation): FxSpec | null {
  switch (anim.kind) {
    case 'move': return anim.fx && !anim.still ? moveSpec(anim.fx) : null;
    case 'zpower': return Z_POWER;
    case 'mega-start': return MEGA_START;
    case 'mega': return MEGA_BURST;
    case 'sub-start': return SUB_START;
    case 'sub-hit': return SUB_HIT;
    case 'sub-end': return SUB_END;
    case 'seeded': return SEEDED;
    case 'leech':
    case 'absorb': return drainSpec(anim.kind);
    case 'status': return anim.condition ? statusSpec(anim.condition) : null;
    case 'cant': return cantSpec(anim.condition ?? '');
    case 'confused': return CONFUSED;
    case 'infatuated': return INFATUATED;
    case 'blocked': return blockedSpec(anim.condition ?? 'protect');
    case 'cure': return CURE;
    case 'residual': return residualSpec(anim.condition);
    case 'field-start':
    case 'field-end': return anim.condition ? fieldSpec(anim.condition, anim.kind === 'field-end') : null;
    default: return null;
  }
}

/**
 * Where an event's effect starts ("user") and which positions it reaches.
 * Drained HP always flows from the drained Pokémon to the one healing; spread
 * moves reach every Pokémon they hit.
 */
export function effectAnchors(anim: BattleAnimation): { user: Pos; targets: Pos[] } | null {
  if (anim.kind === 'absorb') return anim.target && anim.side ? { user: posKey(anim.target, anim.targetSlot), targets: [posKey(anim.side, anim.slot)] } : null;
  // Terrains and rooms can start or end without anyone causing it (they run out).
  if (anim.kind === 'field-start' || anim.kind === 'field-end') return { user: posKey(anim.side ?? 'p1', anim.slot), targets: [] };
  if (!anim.side) return null;
  const targets = anim.spread?.length
    ? anim.spread.map(t => posKey(t.side, t.slot))
    : anim.target ? [posKey(anim.target, anim.targetSlot)] : [];
  return { user: posKey(anim.side, anim.slot), targets };
}

/** Screen-shake class and start delay for the stage while an effect plays. */
export function shakeProps(spec: FxSpec | null, anim: BattleAnimation | null): { className: string; style?: CSSProperties } {
  if (!spec?.shake || !anim) return { className: '' };
  return { className: `fx-shake-${spec.shake}-${anim.id % 2 ? 'a' : 'b'}`, style: { '--delay': `${shakeDelay(spec)}ms` } as CSSProperties };
}
