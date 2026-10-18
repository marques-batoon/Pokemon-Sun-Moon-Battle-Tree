// Which sprite animation and which catalog effect each battle event gets.
import type { CSSProperties } from 'react';
import { ABSORB_ABILITIES, type BattleAnimation } from '../../../client/playback';
import {
  abilitySpec, BALLOON_IN, BALLOON_POP, berrySpec, immuneSpec, sashSpec, SKY_DROP, SKY_DROPPED, SOLAR_CHARGE, blockedSpec, cantSpec, chargedSpec, CRIT, CONFUSED, CURE, drainSpec, fieldSpec, INFATUATED, MEGA_BURST, MEGA_START, moveSpec, PARADOX_BURST, PARADOX_START, residualSpec, SEEDED, statusSpec,
  SUB_END, SUB_HIT, SUB_START, warpBurst, warpStart, Z_POWER, futureHitSpec, matrixTheme, type FxSpec, type Layer,
} from './catalog';
import { BIG_MOVE_MOTION } from './big-moves';
import { foeSide, posKey, shakeDelay, type Pos, type Side } from './geometry';
import { isDarkWarp, isMatrix } from '../../../data/custom/digimon';
import { typeColor } from '../../types';

/** Is the animation's acting Pokémon at this position? */
export const actsAt = (anim: BattleAnimation | null, side: Side, slot = 0) => !!anim && anim.side === side && (anim.slot ?? 0) === slot;

/**
 * The immune Pokémon's part in a type-chart immunity, by the type that blocks the move (immuneSpec): a Ghost turns
 * see-through, a Normal type shrugs, a Ground type grounds the charge, a Flying type rises clear, a Dark type's aura
 * flares, Steel gleams, a Fairy glows pink.
 */
const IMMUNE_CLASS: Record<string, string> = {
  ghost: 'fx-intangible', normal: 'fx-unfazed', ground: 'fx-grounded', flying: 'fx-hover', dark: 'fx-dark-guard', steel: 'fx-metal-glint', fairy: 'fx-fairy-glow',
};

/**
 * Hitmonchan's Z-Moves move both Pokémon (catalog Z_SIGNATURE): Hitmonchan himself (default: the physical Z-Move
 * charge, fx-zuser) and the target, timed to the punches. By side, as they move toward or away from the other side.
 */
const SIGNATURE_SPRITES: Record<string, { user?: string; target?: string }> = {
  superdrainpunch: { user: 'fx-drainer', target: 'fx-drain-smashed' },
  skyrocketpunch: { target: 'fx-launched' },
  punchingbarrage: { target: 'fx-pummeled' },
  glacialguardbreaker: { target: 'fx-smashed' },
  infernalfuryfist: { user: 'fx-inferno', target: 'fx-smashed' },
  thunderboltblitzkrieg: { user: 'fx-blitz', target: 'fx-blitzed' },
};

/**
 * The moves over 100 power (BIG_MOVE_MOTION): the user charges in, leaps, dives from the sky or rampages at its
 * target (else it casts the move from where it stands), or explodes. By side, as it moves toward the other side.
 */
function bigMoveClass(id: string, side: Side, atFoe: boolean): string | null {
  const motion = BIG_MOVE_MOTION[id];
  if (!motion) return null;
  const toward = motion === 'charge' || motion === 'leap' || motion === 'dive' || motion === 'rampage';
  return `fx-sig-${toward && !atFoe ? 'cast' : motion}-${side}`;
}

const hitsTarget = (l: Layer) => l.kind === 'impact' && (l.at ?? 'target') === 'target';
const sendsOff = (l: Layer) =>
  ['orb', 'beam', 'bolt', 'meteor', 'slash', 'column', 'gust'].includes(l.kind) || hitsTarget(l) || (l.kind === 'rings' && l.at === 'path')
  || ((l.kind === 'vortex' || l.kind === 'pillar') && l.at === 'target');
const firstDelay = (layers: Layer[]) => (layers.length ? Math.min(...layers.map(l => l.delay ?? 0)) : null);

/**
 * CSS variables for a sprite's animation: in a move over 100 power, --hit, when the user's motion peaks (the moment
 * it reaches the target, sends the move off, or blows up), from the move's layers; in a Matrix Evolution, its colours.
 */
export function spriteVars(side: Side, slot: number, anim: BattleAnimation | null): CSSProperties | undefined {
  // Matrix Evolution: the Digimon glows in its Tamer's D-Arc colour, and the new form in its own light.
  if ((anim?.kind === 'warp-start' || anim?.kind === 'warp') && isMatrix(anim.condition) && actsAt(anim, side, slot)) {
    const t = matrixTheme(anim.condition);
    return { '--matrix': t.tamer, '--matrix-light': t.light } as CSSProperties;
  }
  if (anim?.kind !== 'move' || !anim.fx || anim.still || anim.fx.kind !== 'attack' || !actsAt(anim, side, slot)) return undefined;
  const motion = BIG_MOVE_MOTION[anim.fx.moveId];
  if (!motion || motion === 'rampage') return undefined;
  const { layers } = moveSpec(anim.fx);
  const hit = motion === 'explode'
    ? firstDelay(layers.filter(l => l.kind === 'impact' && l.at === 'user'))
    : firstDelay(layers.filter(motion === 'cast' ? sendsOff : hitsTarget));
  return { '--hit': `${hit ?? 500}ms` } as CSSProperties;
}

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
  const signature = anim.kind === 'move' && anim.fx && !anim.still ? SIGNATURE_SPRITES[anim.fx.moveId] : undefined;
  if (signature?.target && anim.target && !actsAt(anim, side, slot) && anim.target === side && (anim.targetSlot ?? 0) === slot) return `${signature.target}-${side}`;
  if (!actsAt(anim, side, slot)) return '';
  switch (anim.kind) {
    case 'move': {
      const fx = anim.fx;
      if (anim.still || !fx) return `fx-power-${v}`;
      if (signature?.user) return `${signature.user}-${side}`;
      const atFoe = !!anim.target && anim.target !== side;
      if (fx.kind === 'attack') {
        const big = bigMoveClass(fx.moveId, side, atFoe);
        if (big) return big;
      }
      switch (fx.kind) {
        // Physical Z-Moves charge at the target; special ones are unleashed from where the user stands.
        case 'z': return fx.category === 'Special' ? `fx-zcast-${side}` : `fx-zuser-${side}`;
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
    case 'charged': return `fx-powerup-${v}`;
    case 'berry': return `fx-munch-${v}`;
    case 'balloon-pop': return `fx-balloon-drop-${v}`;
    case 'balloon-in': return 'fx-balloon-float';
    case 'sash': return `fx-brace-${v}`;
    case 'sky-dropped': return `fx-dropped-${side}`;
    case 'solar-charge': return 'fx-solar-charge';
    case 'immune': return IMMUNE_CLASS[(anim.condition ?? '').split('-')[1] ?? ''] ?? 'fx-unfazed';
    case 'ability': {
      // The Pokémon with the Ability: it glows as it heals, powers up for a boost, or floats (Levitate).
      const id = anim.condition ?? '';
      if (id === 'levitate') return 'fx-levitate';
      if (id === 'airballoon') return 'fx-balloon-float';
      if (['waterabsorb', 'voltabsorb', 'dryskin'].includes(id)) return `fx-absorb-${v}`;
      if ((ABSORB_ABILITIES as readonly string[]).includes(id)) return `fx-powerup-${v}`;
      return `fx-power-${v}`;
    }
    case 'confused': return `fx-dizzy-${v}`;
    case 'infatuated': return `fx-smitten-${v}`;
    case 'switch-out': return 'fx-switch-out';
    case 'switch-in': return `fx-switch-in-${side}`;
    case 'faint': return 'fx-faint';
    case 'mega-start': return 'fx-mega-start';
    case 'mega': return 'fx-mega-burst';
    case 'paradox-start': return `fx-paradox-${anim.condition === 'future' ? 'future' : 'ancient'}-start`;
    case 'paradox': return `fx-paradox-${anim.condition === 'future' ? 'future' : 'ancient'}-burst`;
    case 'warp-start': return isMatrix(anim.condition) ? 'fx-matrix-start' : 'fx-warp-start';
    case 'warp': return isMatrix(anim.condition) ? 'fx-matrix-burst' : isDarkWarp(anim.condition) ? 'fx-warp-burst dark' : 'fx-warp-burst';
    case 'forme': return `fx-transform-${v}`;
    case 'miss': return `fx-dodge-${v}`;
    default: return '';
  }
}

/** The catalog animation for an event, if it has one. */
export function effectSpec(anim: BattleAnimation): FxSpec | null {
  switch (anim.kind) {
    case 'move': {
      if (!anim.fx || anim.still) return null;
      const spec = moveSpec(anim.fx);
      // Z-Moves announce themselves: the name sweeps across the stage.
      if (anim.fx.kind !== 'z' || !anim.moveName) return spec;
      return { ...spec, layers: [...spec.layers, { kind: 'banner', text: `${anim.moveName}!`, color: typeColor(anim.fx.type).bg, dur: 1000 }] };
    }
    case 'zpower': return Z_POWER;
    case 'mega-start': return MEGA_START;
    case 'mega': return MEGA_BURST;
    case 'paradox-start': return PARADOX_START[anim.condition === 'future' ? 'future' : 'ancient'];
    case 'paradox': return PARADOX_BURST[anim.condition === 'future' ? 'future' : 'ancient'];
    case 'warp-start': return warpStart(anim.condition);
    case 'warp': return warpBurst(anim.condition);
    case 'sub-start': return SUB_START;
    case 'sub-hit': return anim.crit ? { ...SUB_HIT, layers: [...SUB_HIT.layers, ...CRIT.layers] } : SUB_HIT;
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
    case 'ability': return abilitySpec(anim.condition ?? '', anim.label);
    case 'charged': return chargedSpec(anim.label);
    case 'berry': return anim.label ? berrySpec(anim.label, !!anim.target) : null;
    case 'balloon-pop': return BALLOON_POP;
    case 'balloon-in': return BALLOON_IN;
    case 'sash': return sashSpec(anim.condition ?? 'focussash');
    case 'immune': return immuneSpec(anim.condition ?? '');
    case 'sky-drop': return SKY_DROP;
    case 'sky-dropped': return SKY_DROPPED;
    case 'solar-charge': return SOLAR_CHARGE;
    case 'future-hit': return futureHitSpec(anim.condition ?? 'futuresight');
    case 'hit': return anim.crit ? CRIT : null;
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
  // An Ability taking in a move: the attack comes from the move's user (else the opposing side) into the Pokémon with it.
  if (anim.kind === 'ability' || anim.kind === 'immune') return anim.side ? { user: anim.target ? posKey(anim.target, anim.targetSlot) : posKey(foeSide(anim.side)), targets: [posKey(anim.side, anim.slot)] } : null;
  // Terrains and rooms can start or end without anyone causing it (they run out).
  if (anim.kind === 'field-start' || anim.kind === 'field-end') return { user: posKey(anim.side ?? 'p1', anim.slot), targets: [] };
  if (!anim.side) return null;
  const targets = anim.spread?.length
    ? anim.spread.map(t => posKey(t.side, t.slot))
    : anim.target ? [posKey(anim.target, anim.targetSlot)] : [];
  return { user: posKey(anim.side, anim.slot), targets };
}

/**
 * Where effects are drawn, from the measured sprites. A Pokémon dropped by Sky Drop is measured as its fall starts,
 * up in the sky, so its effects use its usual spot on the ground instead.
 */
export function effectPoints<T>(anim: BattleAnimation | null, points: Partial<Record<Pos, T>>): Partial<Record<Pos, T>> {
  if (anim?.kind !== 'sky-dropped' || !anim.side) return points;
  const { [posKey(anim.side, anim.slot)]: _inTheSky, ...rest } = points;
  return rest;
}

/** Screen-shake class and start delay for the stage while an effect plays. */
export function shakeProps(spec: FxSpec | null, anim: BattleAnimation | null): { className: string; style?: CSSProperties } {
  if (!spec?.shake || !anim) return { className: '' };
  return { className: `fx-shake-${spec.shake}-${anim.id % 2 ? 'a' : 'b'}`, style: { '--delay': `${shakeDelay(spec)}ms` } as CSSProperties };
}
