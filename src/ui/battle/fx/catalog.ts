// Battle animation catalog. Every animation is a list of layers built from a
// small set of primitives (rendered by MoveEffects.tsx, styled in index.css).
// Attacks have a distinct look per type, with separate physical (contact at
// the target) and special (something travels from the user) versions.
import type { MoveFx } from '../../../client/move-class';
import { typeColor } from '../../types';

export type Anchor = 'user' | 'target';
export type Shape =
  | 'dot' | 'flame' | 'drop' | 'bubble' | 'spark' | 'leaf' | 'shard' | 'star' | 'rock' | 'gem'
  | 'feather' | 'wisp' | 'scale' | 'heart' | 'blob' | 'crescent';
export type Motion = 'burst' | 'rise' | 'fall' | 'swirl' | 'converge' | 'spray';

export type Layer =
  /** Projectile(s) travelling from user to target. */
  | { kind: 'orb'; color: string; color2?: string; size: number; shape?: Shape; arc?: boolean; count?: number; gap?: number; delay?: number; dur?: number }
  /** Beam stretching from user to target. */
  | { kind: 'beam'; color: string; color2?: string; width: number; wavy?: boolean; delay?: number; dur?: number }
  /** Lightning from the sky onto the target. */
  | { kind: 'bolt'; color: string; delay?: number }
  | { kind: 'particles'; at: Anchor; shape: Shape; motion: Motion; color: string; color2?: string; count: number; size: number; spread: number; delay?: number; dur?: number }
  /** Expanding rings at a spot, or rings travelling along the user→target path. */
  | { kind: 'rings'; at: Anchor | 'path'; color: string; count: number; size: number; rainbow?: boolean; delay?: number; dur?: number }
  /** Claw / blade streaks across the target. */
  | { kind: 'slash'; color: string; count: number; angle: number; width?: number; cross?: boolean; delay?: number }
  /** Hit flash, on the target unless `at` says otherwise. */
  | { kind: 'impact'; color: string; size: number; star?: boolean; at?: Anchor; delay?: number }
  | { kind: 'aura'; at: Anchor; color: string; size: number; delay?: number; dur?: number }
  | { kind: 'shield'; color: string; spiky?: boolean; delay?: number }
  /** Translucent barrier in front of the user (screens, guards). */
  | { kind: 'wall'; color: string; delay?: number }
  | { kind: 'arrows'; at: Anchor; dir: 'up' | 'down'; color: string; delay?: number }
  /** Cracks in the ground under the target. */
  | { kind: 'crack'; color: string; delay?: number }
  /** Fangs closing on the target. */
  | { kind: 'jaws'; color: string; delay?: number }
  /** Pillar erupting from the ground at the target. */
  | { kind: 'column'; color: string; color2?: string; delay?: number }
  /** Whole-stage flash, dim or tint. */
  | { kind: 'screen'; color: string; mode: 'flash' | 'dim' | 'tint'; delay?: number; dur?: number }
  /** A wave of colour sweeping across the ground (terrains spreading). */
  | { kind: 'ground'; color: string; delay?: number; dur?: number };

export interface FxSpec {
  layers: Layer[];
  shake?: 'light' | 'strong';
}

export const TYPES = ['Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy'] as const;
export type TypeName = (typeof TYPES)[number];

const D = 260; // contact delay: when a physical lunge reaches the target

export const ATTACKS: Record<TypeName, { physical: FxSpec; special: FxSpec }> = {
  Normal: {
    physical: { shake: 'light', layers: [
      { kind: 'impact', color: '#ffffff', size: 95, star: true, delay: D },
      { kind: 'particles', at: 'target', shape: 'star', motion: 'burst', color: '#ffffff', count: 6, size: 10, spread: 55, delay: D },
    ] },
    special: { layers: [
      { kind: 'rings', at: 'path', color: '#f4f4f4', count: 3, size: 60, dur: 600 },
      { kind: 'impact', color: '#e8e8e8', size: 115, delay: 520 },
    ] },
  },
  Fire: {
    physical: { layers: [
      { kind: 'impact', color: '#ff7a1a', size: 90, delay: D },
      { kind: 'particles', at: 'target', shape: 'flame', motion: 'rise', color: '#ff5a00', color2: '#ffd23f', count: 11, size: 18, spread: 42, delay: D },
    ] },
    special: { layers: [
      { kind: 'orb', color: '#ff8c1a', color2: '#ffe066', size: 36, shape: 'flame', dur: 520 },
      { kind: 'particles', at: 'target', shape: 'flame', motion: 'burst', color: '#ff6a00', color2: '#ffd23f', count: 13, size: 20, spread: 75, delay: 500 },
      { kind: 'screen', color: '#ff6a00', mode: 'tint', delay: 480, dur: 400 },
    ] },
  },
  Water: {
    physical: { layers: [
      { kind: 'impact', color: '#4d8cff', size: 90, delay: D },
      { kind: 'particles', at: 'target', shape: 'drop', motion: 'spray', color: '#5aa2ff', color2: '#cfe6ff', count: 13, size: 11, spread: 65, delay: D },
    ] },
    special: { layers: [
      { kind: 'beam', color: '#3b7cff', color2: '#cfe8ff', width: 18, wavy: true, dur: 650 },
      { kind: 'particles', at: 'target', shape: 'bubble', motion: 'burst', color: '#9ad0ff', count: 11, size: 15, spread: 65, delay: 470 },
    ] },
  },
  Electric: {
    physical: { layers: [
      { kind: 'particles', at: 'target', shape: 'spark', motion: 'burst', color: '#ffe14d', color2: '#ffffff', count: 13, size: 20, spread: 58, delay: D },
      { kind: 'impact', color: '#fff07a', size: 82, star: true, delay: D },
    ] },
    special: { layers: [
      { kind: 'bolt', color: '#ffe14d', delay: 180 },
      { kind: 'screen', color: '#fff7a8', mode: 'flash', delay: 300, dur: 260 },
      { kind: 'particles', at: 'target', shape: 'spark', motion: 'burst', color: '#ffe14d', count: 11, size: 18, spread: 62, delay: 330 },
    ] },
  },
  Grass: {
    physical: { layers: [
      { kind: 'slash', color: '#4caf50', count: 2, angle: -30, delay: D },
      { kind: 'particles', at: 'target', shape: 'leaf', motion: 'burst', color: '#7ac74c', color2: '#c6f08a', count: 9, size: 15, spread: 62, delay: D + 40 },
    ] },
    special: { layers: [
      { kind: 'orb', color: '#7ac74c', color2: '#d8f7a8', size: 20, shape: 'leaf', count: 5, gap: 70, dur: 560 },
      { kind: 'particles', at: 'target', shape: 'leaf', motion: 'swirl', color: '#5fb83a', color2: '#c6f08a', count: 11, size: 15, spread: 58, delay: 520 },
    ] },
  },
  Ice: {
    physical: { layers: [
      { kind: 'particles', at: 'target', shape: 'shard', motion: 'fall', color: '#bff3ff', color2: '#ffffff', count: 8, size: 17, spread: 50, delay: 180 },
      { kind: 'impact', color: '#96d9d6', size: 88, delay: 420 },
      { kind: 'screen', color: '#e6fbff', mode: 'flash', delay: 420, dur: 220 },
    ] },
    special: { layers: [
      { kind: 'beam', color: '#7fe3ff', color2: '#ffffff', width: 13, dur: 560 },
      { kind: 'particles', at: 'target', shape: 'shard', motion: 'burst', color: '#cdf6ff', color2: '#ffffff', count: 13, size: 15, spread: 68, delay: 460 },
      { kind: 'screen', color: '#bfefff', mode: 'tint', delay: 460, dur: 400 },
    ] },
  },
  Fighting: {
    physical: { shake: 'strong', layers: [
      { kind: 'impact', color: '#e2552d', size: 115, star: true, delay: D },
      { kind: 'particles', at: 'target', shape: 'star', motion: 'burst', color: '#ffb347', count: 7, size: 15, spread: 65, delay: D },
    ] },
    special: { layers: [
      { kind: 'orb', color: '#6fa8ff', color2: '#eef5ff', size: 42, dur: 560 },
      { kind: 'rings', at: 'target', color: '#7fb2ff', count: 2, size: 95, delay: 540 },
    ] },
  },
  Poison: {
    physical: { layers: [
      { kind: 'slash', color: '#a33ea1', count: 1, angle: -45, width: 9, delay: D },
      { kind: 'particles', at: 'target', shape: 'drop', motion: 'fall', color: '#c860e8', color2: '#8a2f9e', count: 8, size: 11, spread: 42, delay: D + 60 },
    ] },
    special: { layers: [
      { kind: 'orb', color: '#9b3fb5', color2: '#d78cf0', size: 26, shape: 'blob', arc: true, count: 3, gap: 90, dur: 620 },
      { kind: 'particles', at: 'target', shape: 'blob', motion: 'burst', color: '#b54fd6', color2: '#7a2a94', count: 11, size: 15, spread: 62, delay: 640 },
    ] },
  },
  Ground: {
    physical: { shake: 'strong', layers: [
      { kind: 'crack', color: '#6e4f22', delay: 140 },
      { kind: 'particles', at: 'target', shape: 'rock', motion: 'rise', color: '#b08a4f', color2: '#7a5a2b', count: 11, size: 15, spread: 75, delay: 200 },
    ] },
    special: { shake: 'light', layers: [
      { kind: 'crack', color: '#8a6a35', delay: 100 },
      { kind: 'column', color: '#e2bf65', color2: '#a0522d', delay: 300 },
      { kind: 'particles', at: 'target', shape: 'rock', motion: 'burst', color: '#c9a15a', count: 9, size: 13, spread: 62, delay: 420 },
    ] },
  },
  Flying: {
    physical: { layers: [
      { kind: 'slash', color: '#8fa8ff', count: 3, angle: -18, delay: 200 },
      { kind: 'particles', at: 'target', shape: 'feather', motion: 'burst', color: '#ffffff', color2: '#b7c6ff', count: 9, size: 16, spread: 62, delay: 250 },
    ] },
    special: { layers: [
      { kind: 'orb', color: '#a9bcff', color2: '#ffffff', size: 34, shape: 'crescent', count: 3, gap: 80, dur: 500 },
      { kind: 'particles', at: 'target', shape: 'dot', motion: 'swirl', color: '#a9bcff', count: 13, size: 9, spread: 58, delay: 470 },
    ] },
  },
  Psychic: {
    physical: { layers: [
      { kind: 'rings', at: 'target', color: '#f95587', count: 3, size: 85, delay: D },
      { kind: 'impact', color: '#ff7aa8', size: 92, delay: D + 40 },
    ] },
    special: { layers: [
      { kind: 'rings', at: 'path', color: '#f95587', count: 4, size: 52, dur: 620 },
      { kind: 'screen', color: '#f95587', mode: 'tint', delay: 420, dur: 420 },
      { kind: 'rings', at: 'target', color: '#c77dff', count: 2, size: 115, delay: 560 },
    ] },
  },
  Bug: {
    physical: { layers: [
      { kind: 'slash', color: '#a6b91a', count: 2, angle: 45, cross: true, delay: D },
      { kind: 'particles', at: 'target', shape: 'dot', motion: 'burst', color: '#c8d95a', count: 9, size: 9, spread: 52, delay: D + 40 },
    ] },
    special: { layers: [
      { kind: 'rings', at: 'path', color: '#a6b91a', count: 3, size: 56, dur: 560 },
      { kind: 'particles', at: 'target', shape: 'spark', motion: 'burst', color: '#d5e86b', count: 11, size: 13, spread: 58, delay: 520 },
    ] },
  },
  Rock: {
    physical: { shake: 'light', layers: [
      { kind: 'particles', at: 'target', shape: 'rock', motion: 'fall', color: '#8d7a43', color2: '#5e5030', count: 6, size: 23, spread: 46, delay: 150 },
      { kind: 'impact', color: '#b6a136', size: 92, delay: 460 },
    ] },
    special: { layers: [
      { kind: 'orb', color: '#f1df7a', color2: '#ffffff', size: 22, shape: 'gem', count: 4, gap: 60, dur: 560 },
      { kind: 'particles', at: 'target', shape: 'gem', motion: 'burst', color: '#fff1a8', color2: '#9ee7ff', count: 11, size: 12, spread: 62, delay: 520 },
    ] },
  },
  Ghost: {
    physical: { layers: [
      { kind: 'slash', color: '#5b3d82', count: 3, angle: -35, delay: D },
      { kind: 'particles', at: 'target', shape: 'wisp', motion: 'rise', color: '#8a63c2', color2: '#2d1b47', count: 9, size: 17, spread: 46, delay: D + 40 },
    ] },
    special: { layers: [
      { kind: 'screen', color: '#1a0b2e', mode: 'dim', dur: 900 },
      { kind: 'orb', color: '#4b2a72', color2: '#b28ae0', size: 42, dur: 620 },
      { kind: 'particles', at: 'target', shape: 'wisp', motion: 'burst', color: '#8f6ad6', color2: '#2d1b47', count: 11, size: 19, spread: 68, delay: 600 },
    ] },
  },
  Dragon: {
    physical: { layers: [
      { kind: 'slash', color: '#6f35fc', count: 3, angle: -40, width: 7, delay: D },
      { kind: 'particles', at: 'target', shape: 'scale', motion: 'burst', color: '#8f6bff', color2: '#5fd0ff', count: 9, size: 12, spread: 58, delay: D + 40 },
    ] },
    special: { layers: [
      { kind: 'beam', color: '#6f35fc', color2: '#66c7ff', width: 20, wavy: true, dur: 620 },
      { kind: 'rings', at: 'target', color: '#8d6bff', count: 3, size: 105, delay: 520 },
    ] },
  },
  Dark: {
    physical: { layers: [
      { kind: 'jaws', color: '#2e2430', delay: 200 },
      { kind: 'impact', color: '#705746', size: 82, delay: 470 },
    ] },
    special: { layers: [
      { kind: 'screen', color: '#000000', mode: 'dim', dur: 900 },
      { kind: 'rings', at: 'user', color: '#3a2c3f', count: 3, size: 220, dur: 800 },
      { kind: 'particles', at: 'target', shape: 'dot', motion: 'burst', color: '#705746', count: 9, size: 11, spread: 52, delay: 520 },
    ] },
  },
  Steel: {
    physical: { layers: [
      { kind: 'impact', color: '#d7d7e8', size: 102, star: true, delay: D },
      { kind: 'particles', at: 'target', shape: 'star', motion: 'burst', color: '#ffffff', count: 9, size: 11, spread: 62, delay: D + 10 },
      { kind: 'screen', color: '#ffffff', mode: 'flash', delay: D, dur: 200 },
    ] },
    special: { layers: [
      { kind: 'beam', color: '#e6e6f4', color2: '#9fa6c8', width: 22, dur: 560 },
      { kind: 'screen', color: '#ffffff', mode: 'flash', delay: 460, dur: 220 },
      { kind: 'particles', at: 'target', shape: 'star', motion: 'burst', color: '#e8e8ff', count: 11, size: 12, spread: 68, delay: 490 },
    ] },
  },
  Fairy: {
    physical: { layers: [
      { kind: 'particles', at: 'target', shape: 'heart', motion: 'burst', color: '#ff8fc7', count: 9, size: 15, spread: 58, delay: D },
      { kind: 'impact', color: '#ffb3da', size: 86, delay: D },
      { kind: 'particles', at: 'target', shape: 'dot', motion: 'swirl', color: '#ffd6ec', count: 11, size: 6, spread: 46, delay: D },
    ] },
    special: { layers: [
      { kind: 'orb', color: '#ffc2e2', color2: '#ffffff', size: 46, dur: 660 },
      { kind: 'screen', color: '#ffb3da', mode: 'tint', delay: 600, dur: 400 },
      { kind: 'particles', at: 'target', shape: 'star', motion: 'burst', color: '#ffd1ea', count: 13, size: 12, spread: 72, delay: 630 },
    ] },
  },
};

const asType = (t: string): TypeName => (TYPES as readonly string[]).includes(t) ? t as TypeName : 'Normal';
const delayed = (l: Layer, by: number): Layer => ({ ...l, delay: (l.delay ?? 0) + by });

/** Damaging Z-Move: a charged-up giant orb crashes into the target, then the type's own effect, bigger. */
export function zMoveSpec(type: string): FxSpec {
  const t = asType(type);
  const c = typeColor(t).bg;
  return {
    shake: 'strong',
    layers: [
      { kind: 'screen', color: '#000000', mode: 'dim', dur: 1700 },
      { kind: 'aura', at: 'user', color: c, size: 220, dur: 700 },
      { kind: 'orb', color: c, color2: '#ffffff', size: 110, delay: 450, dur: 650 },
      ...ATTACKS[t].special.layers.filter(l => l.kind !== 'screen').map(l => delayed(l, 700)),
      { kind: 'impact', color: c, size: 240, star: true, delay: 1080 },
      { kind: 'screen', color: c, mode: 'flash', delay: 1080, dur: 350 },
    ],
  };
}

/** Z-Power charge-up before any Z-Move. */
export const Z_POWER: FxSpec = { layers: [
  { kind: 'screen', color: '#000000', mode: 'dim', dur: 1100 },
  { kind: 'particles', at: 'user', shape: 'dot', motion: 'converge', color: '#ffe066', color2: '#ff9ff3', count: 18, size: 9, spread: 120 },
  { kind: 'aura', at: 'user', color: '#ffd43b', size: 200, dur: 1100 },
  { kind: 'rings', at: 'user', color: '#ffd43b', count: 2, size: 180, rainbow: true, delay: 450 },
] };

/** Mega Evolution: rainbow energy gathers, then a white burst reveals the Mega forme. */
export const MEGA_START: FxSpec = { layers: [
  { kind: 'screen', color: '#000000', mode: 'dim', dur: 1000 },
  { kind: 'particles', at: 'user', shape: 'dot', motion: 'converge', color: '#ff5ea8', color2: '#5ec8ff', count: 20, size: 10, spread: 130 },
  { kind: 'rings', at: 'user', color: '#ffffff', count: 3, size: 190, rainbow: true, delay: 150 },
  { kind: 'aura', at: 'user', color: '#ffffff', size: 180, delay: 300, dur: 700 },
] };
export const MEGA_BURST: FxSpec = { shake: 'light', layers: [
  { kind: 'screen', color: '#ffffff', mode: 'flash', dur: 450 },
  { kind: 'particles', at: 'user', shape: 'star', motion: 'burst', color: '#fff6a8', color2: '#ff9ff3', count: 16, size: 15, spread: 120 },
  { kind: 'rings', at: 'user', color: '#ffffff', count: 1, size: 230, rainbow: true },
] };

/**
 * Paradox Evolution. Ancient: the past wells up (amber dimness, stone shards
 * pulled in, a primal quake and a burst of sunlit rock). Future: the future
 * glitches in (cold neon, circuit sparks converging, scan rings, a crisp flash
 * of light).
 */
export const PARADOX_START: Record<'ancient' | 'future', FxSpec> = {
  ancient: { shake: 'light', layers: [
    { kind: 'screen', color: '#2a1606', mode: 'dim', dur: 1100 },
    { kind: 'screen', color: '#c8862a', mode: 'tint', delay: 200, dur: 900 },
    { kind: 'particles', at: 'user', shape: 'rock', motion: 'converge', color: '#b07a3a', color2: '#6b4a2b', count: 16, size: 16, spread: 150 },
    { kind: 'particles', at: 'user', shape: 'shard', motion: 'rise', color: '#ffcf7a', color2: '#d9822b', count: 10, size: 12, spread: 90, delay: 350 },
    { kind: 'rings', at: 'user', color: '#e0a548', count: 3, size: 200, delay: 200 },
    { kind: 'aura', at: 'user', color: '#ffb347', size: 190, delay: 450, dur: 650 },
  ] },
  future: { layers: [
    { kind: 'screen', color: '#020814', mode: 'dim', dur: 1100 },
    { kind: 'particles', at: 'user', shape: 'spark', motion: 'converge', color: '#3ef0ff', color2: '#c86bff', count: 22, size: 9, spread: 150 },
    { kind: 'rings', at: 'user', color: '#3ef0ff', count: 4, size: 180, delay: 150 },
    { kind: 'particles', at: 'user', shape: 'gem', motion: 'swirl', color: '#9ffcff', color2: '#7c5cff', count: 8, size: 10, spread: 70, delay: 400 },
    { kind: 'aura', at: 'user', color: '#7ff6ff', size: 170, delay: 450, dur: 650 },
  ] },
};
export const PARADOX_BURST: Record<'ancient' | 'future', FxSpec> = {
  ancient: { shake: 'strong', layers: [
    { kind: 'screen', color: '#ffd59a', mode: 'flash', dur: 450 },
    { kind: 'ground', color: '#c8862a', dur: 700 },
    { kind: 'particles', at: 'user', shape: 'rock', motion: 'burst', color: '#c08a4a', color2: '#ffd27f', count: 14, size: 16, spread: 140 },
    { kind: 'rings', at: 'user', color: '#ffbf5e', count: 1, size: 240 },
  ] },
  future: { shake: 'light', layers: [
    { kind: 'screen', color: '#c9fbff', mode: 'flash', dur: 400 },
    { kind: 'particles', at: 'user', shape: 'spark', motion: 'burst', color: '#3ef0ff', color2: '#ffffff', count: 18, size: 11, spread: 130 },
    { kind: 'rings', at: 'user', color: '#7ff6ff', count: 2, size: 230 },
  ] },
};

/** Substitute: a puff of smoke while the user builds its decoy... */
export const SUBSTITUTE_MOVE: FxSpec = { layers: [
  { kind: 'particles', at: 'user', shape: 'wisp', motion: 'converge', color: '#ffffff', color2: '#dfe6ee', count: 12, size: 26, spread: 90 },
  { kind: 'aura', at: 'user', color: '#ffffff', size: 150, delay: 250, dur: 550 },
] };
/** ...then the doll drops in behind a cloud. */
export const SUB_START: FxSpec = { layers: [
  { kind: 'particles', at: 'user', shape: 'wisp', motion: 'burst', color: '#ffffff', color2: '#e4e9f0', count: 14, size: 30, spread: 70, delay: 380, dur: 600 },
  { kind: 'rings', at: 'user', color: '#ffffff', count: 1, size: 150, delay: 420 },
] };
/** The doll takes the hit. */
export const SUB_HIT: FxSpec = { layers: [
  { kind: 'particles', at: 'user', shape: 'star', motion: 'burst', color: '#ffffff', color2: '#ffe680', count: 6, size: 11, spread: 50 },
] };
/** The doll breaks. */
export const SUB_END: FxSpec = { shake: 'light', layers: [
  { kind: 'impact', color: '#ffffff', size: 110, star: true, at: 'user' },
  { kind: 'particles', at: 'user', shape: 'wisp', motion: 'burst', color: '#ffffff', color2: '#d6dde6', count: 12, size: 26, spread: 75, delay: 80 },
  { kind: 'particles', at: 'user', shape: 'shard', motion: 'burst', color: '#d9c6a0', count: 7, size: 12, spread: 70, delay: 60 },
] };

/** Leech Seed takes root: seeds burst into sprouts on the target. */
export const SEEDED: FxSpec = { layers: [
  { kind: 'particles', at: 'user', shape: 'leaf', motion: 'rise', color: '#5fb83a', color2: '#b6e86a', count: 9, size: 14, spread: 45 },
  { kind: 'aura', at: 'user', color: '#7ac74c', size: 120, dur: 500 },
] };

/** HP drained from one Pokémon to the other: glowing life energy streams across. */
export function drainSpec(kind: 'leech' | 'absorb'): FxSpec {
  const color = kind === 'leech' ? '#7ac74c' : '#9df07f';
  return { layers: [
    { kind: 'particles', at: 'user', shape: kind === 'leech' ? 'leaf' : 'dot', motion: 'converge', color, color2: '#e8ffd6', count: 8, size: 10, spread: 55, dur: 380 },
    { kind: 'orb', color, color2: '#f4ffe8', size: 22, arc: true, count: 6, gap: 60, delay: 150, dur: 480 },
    { kind: 'aura', at: 'target', color: '#8af0a0', size: 140, delay: 520, dur: 380 },
    { kind: 'particles', at: 'target', shape: 'dot', motion: 'rise', color: '#8af0a0', color2: '#ffffff', count: 9, size: 8, spread: 45, delay: 560, dur: 340 },
  ] };
}

/** Colours of the lasting screens (the move animation and the barrier that stays up). */
export const SHIELD_COLORS: Record<string, string> = {
  reflect: '#ffffff',
  lightscreen: '#ffe14d',
  auroraveil: '#a8e6ff',
  safeguard: '#e2a8ff',
  mist: '#bfeee6',
};

export const STATUS_COLORS: Record<string, string> = {
  par: '#ffe14d', slp: '#b39dff', brn: '#ff7a1a', psn: '#b54fd6', tox: '#8a2f9e', frz: '#9fe7ff',
  confusion: '#ffe680', attract: '#ff7fb0', leechseed: '#7ac74c', yawn: '#c7b8ff', taunt: '#ff5a4a',
};
const INFLICT_SHAPE: Record<string, Shape> = {
  par: 'spark', slp: 'bubble', brn: 'flame', psn: 'bubble', tox: 'bubble', confusion: 'star', attract: 'heart', leechseed: 'leaf', yawn: 'bubble',
};
/** Protect and its variants (move animation, blocked hits and the bubble that stays up for the turn). */
export const SHIELDS: Record<string, { color: string; spiky?: boolean }> = {
  protect: { color: '#7fd3ff' }, detect: { color: '#9fe0ff' }, kingsshield: { color: '#d0d0e0' },
  spikyshield: { color: '#6cbf4b', spiky: true }, banefulbunker: { color: '#a33ea1', spiky: true },
};
const HAZARD_LOOK: Record<string, { color: string; shape: Shape }> = {
  stealthrock: { color: '#b6a136', shape: 'rock' }, spikes: { color: '#9a9aa8', shape: 'shard' },
  toxicspikes: { color: '#a33ea1', shape: 'shard' }, stickyweb: { color: '#f0f0f0', shape: 'dot' },
};
const FIELD_TINT: Record<string, string> = {
  raindance: '#4d7cff', sunnyday: '#ffb347', sandstorm: '#c2a15a', hail: '#e6f6ff',
  electricterrain: '#f7d02c', grassyterrain: '#7ac74c', psychicterrain: '#f95587', mistyterrain: '#ffb3da',
};

/** Animation for a move, by what it does. */
export function moveSpec(fx: MoveFx): FxSpec {
  const t = asType(fx.type);
  const c = typeColor(t).bg;
  switch (fx.kind) {
    case 'attack':
      return ATTACKS[t][fx.category === 'Physical' ? 'physical' : 'special'];
    case 'z':
      return zMoveSpec(t);
    case 'powerup':
      return { layers: [
        { kind: 'particles', at: 'user', shape: 'dot', motion: 'converge', color: '#ffd36b', color2: c, count: 12, size: 8, spread: 80 },
        { kind: 'aura', at: 'user', color: '#ff7a3d', size: 160, delay: 150, dur: 650 },
        { kind: 'arrows', at: 'user', dir: 'up', color: '#ff5a3a', delay: 250 },
      ] };
    case 'debuff':
      return { layers: [
        { kind: 'rings', at: 'path', color: c, count: 3, size: 50, dur: 560 },
        { kind: 'arrows', at: 'target', dir: 'down', color: '#5aa0ff', delay: 460 },
      ] };
    case 'inflict': {
      const cond = fx.condition ?? '';
      const col = STATUS_COLORS[cond] ?? c;
      const shape = INFLICT_SHAPE[cond] ?? 'dot';
      return { layers: [
        { kind: 'orb', color: col, color2: '#ffffff', size: 20, shape, arc: shape === 'leaf' || shape === 'bubble', count: 3, gap: 70, dur: 520 },
        { kind: 'particles', at: 'target', shape, motion: cond === 'confusion' || cond === 'attract' ? 'swirl' : cond === 'slp' || cond === 'yawn' ? 'rise' : 'burst', color: col, count: 10, size: 14, spread: 52, delay: 480 },
      ] };
    }
    case 'protect': {
      if (fx.moveId === 'endure') return { layers: [{ kind: 'aura', at: 'user', color: '#ff9c5a', size: 170, dur: 700 }, { kind: 'arrows', at: 'user', dir: 'up', color: '#ff9c5a', delay: 200 }] };
      const s = SHIELDS[fx.moveId];
      if (!s) return { layers: [{ kind: 'wall', color: '#ffd36b' }] };
      return { layers: [{ kind: 'shield', color: s.color, spiky: s.spiky }, ...(fx.moveId === 'kingsshield' ? [{ kind: 'particles', at: 'user', shape: 'star', motion: 'burst', color: '#ffffff', count: 5, size: 12, spread: 70, delay: 300 } as Layer] : [])] };
    }
    case 'heal':
      return { layers: [
        { kind: 'aura', at: 'user', color: '#6fe08a', size: 140, dur: 700 },
        { kind: 'particles', at: 'user', shape: 'dot', motion: 'rise', color: '#8af0a0', color2: '#ffffff', count: 13, size: 8, spread: 55, delay: 100 },
      ] };
    case 'field':
      switch (fx.field) {
        case 'weather':
        case 'terrain': {
          const col = FIELD_TINT[fx.moveId] ?? c;
          return { layers: [
            { kind: 'aura', at: 'user', color: col, size: 150, dur: 500 },
            { kind: 'rings', at: 'user', color: col, count: 2, size: 260, delay: 200 },
            { kind: 'screen', color: col, mode: 'tint', delay: 300, dur: 500 },
          ] };
        }
        case 'room':
          return { layers: [
            { kind: 'screen', color: '#c77dff', mode: 'flash', dur: 400 },
            { kind: 'rings', at: 'user', color: '#c77dff', count: 3, size: 300, delay: 100 },
          ] };
        case 'screen': {
          // The barrier itself goes up on the next event (-sidestart) and stays on the field.
          const col = SHIELD_COLORS[fx.moveId] ?? '#ffe680';
          return { layers: [
            { kind: 'particles', at: 'user', shape: 'gem', motion: 'converge', color: col, color2: '#ffffff', count: 12, size: 10, spread: 85 },
            { kind: 'aura', at: 'user', color: col, size: 160, delay: 200, dur: 550 },
          ] };
        }
        case 'hazard': {
          const h = HAZARD_LOOK[fx.moveId] ?? { color: c, shape: 'rock' as Shape };
          return { layers: [
            { kind: 'orb', color: h.color, size: 16, shape: h.shape, arc: true, count: 4, gap: 80, dur: 560 },
            { kind: 'particles', at: 'target', shape: h.shape, motion: 'fall', color: h.color, count: 6, size: 12, spread: 70, delay: 520 },
          ] };
        }
        case 'tailwind':
          return { layers: [
            { kind: 'rings', at: 'path', color: '#e6f4ff', count: 5, size: 70, dur: 650 },
            { kind: 'screen', color: '#d8f0ff', mode: 'tint', dur: 500 },
          ] };
        default:
          return { layers: [{ kind: 'aura', at: 'user', color: c, size: 140, dur: 600 }] };
      }
    case 'substitute':
      return SUBSTITUTE_MOVE;
    case 'phaze':
      return { layers: [
        { kind: 'rings', at: 'path', color: '#eef4ff', count: 3, size: 70, dur: 500 },
        { kind: 'particles', at: 'target', shape: 'dot', motion: 'swirl', color: '#ffffff', count: 12, size: 8, spread: 60, delay: 400 },
      ] };
    default:
      return { layers: [
        { kind: 'aura', at: 'user', color: c, size: 130, dur: 600 },
        { kind: 'particles', at: 'user', shape: 'star', motion: 'burst', color: c, count: 6, size: 11, spread: 60, delay: 150 },
      ] };
  }
}

/** Colours of terrains and rooms (their lasting look on the field and the moment they start). */
export const FIELD_COLORS: Record<string, string> = {
  electricterrain: '#f7d02c', grassyterrain: '#5fb83a', psychicterrain: '#f95587', mistyterrain: '#ffb3da',
  trickroom: '#c77dff', magicroom: '#ff7ad9', wonderroom: '#7ab8ff', gravity: '#6b5a8e',
};

/** A terrain spreads over the ground, or a room unfolds around the field. */
export function fieldSpec(condition: string, ending: boolean): FxSpec {
  const color = FIELD_COLORS[condition] ?? '#ffffff';
  if (ending) return { layers: [{ kind: 'screen', color, mode: 'tint', dur: 600 }] };
  if (condition.endsWith('terrain')) {
    return { layers: [
      { kind: 'ground', color, dur: 750 },
      { kind: 'screen', color, mode: 'tint', delay: 100, dur: 600 },
    ] };
  }
  return { layers: [
    { kind: 'screen', color, mode: 'flash', dur: 450 },
    { kind: 'rings', at: 'user', color, count: 3, size: 340, delay: 100, dur: 650 },
  ] };
}

/** A status condition takes hold. Particles only: no filled glow or screen flash over the Pokémon. */
export function statusSpec(condition: string): FxSpec {
  const color = STATUS_COLORS[condition] ?? '#ffffff';
  switch (condition) {
    case 'par': return { layers: [
      { kind: 'particles', at: 'user', shape: 'spark', motion: 'burst', color, color2: '#ffffff', count: 12, size: 18, spread: 60 },
      { kind: 'particles', at: 'user', shape: 'spark', motion: 'burst', color, count: 8, size: 14, spread: 40, delay: 250 },
    ] };
    case 'brn': return { layers: [
      { kind: 'particles', at: 'user', shape: 'flame', motion: 'rise', color, color2: '#ffd23f', count: 12, size: 18, spread: 48 },
      { kind: 'particles', at: 'user', shape: 'flame', motion: 'burst', color, count: 6, size: 14, spread: 40, delay: 200 },
    ] };
    case 'psn':
    case 'tox': return { layers: [
      { kind: 'particles', at: 'user', shape: 'bubble', motion: 'rise', color, color2: condition === 'tox' ? '#5a1f6e' : '#d78cf0', count: condition === 'tox' ? 14 : 10, size: 15, spread: 48 },
      { kind: 'particles', at: 'user', shape: 'blob', motion: 'burst', color, count: 6, size: 10, spread: 40, delay: 150 },
    ] };
    case 'slp': return { layers: [
      { kind: 'particles', at: 'user', shape: 'bubble', motion: 'rise', color, color2: '#e6deff', count: 9, size: 16, spread: 40 },
      { kind: 'particles', at: 'user', shape: 'star', motion: 'swirl', color: '#e6deff', count: 5, size: 9, spread: 45, delay: 150 },
    ] };
    case 'frz': return { layers: [
      { kind: 'particles', at: 'user', shape: 'shard', motion: 'burst', color, color2: '#ffffff', count: 12, size: 16, spread: 60 },
      { kind: 'particles', at: 'user', shape: 'shard', motion: 'fall', color: '#e6fbff', count: 6, size: 12, spread: 45, delay: 200 },
    ] };
    default: return { layers: [{ kind: 'particles', at: 'user', shape: 'dot', motion: 'burst', color, count: 8, size: 9, spread: 45 }] };
  }
}

/** The Pokémon can't move (fully paralyzed, fast asleep, frozen solid, flinched...). */
export function cantSpec(condition: string): FxSpec {
  switch (condition) {
    case 'par': return { layers: [
      { kind: 'particles', at: 'user', shape: 'spark', motion: 'burst', color: STATUS_COLORS.par, color2: '#ffffff', count: 14, size: 20, spread: 55 },
    ] };
    case 'slp': return { layers: [
      { kind: 'particles', at: 'user', shape: 'bubble', motion: 'rise', color: STATUS_COLORS.slp, color2: '#e6deff', count: 6, size: 18, spread: 36 },
    ] };
    case 'frz': return { layers: [
      { kind: 'particles', at: 'user', shape: 'shard', motion: 'burst', color: STATUS_COLORS.frz, color2: '#ffffff', count: 8, size: 14, spread: 50 },
      { kind: 'particles', at: 'user', shape: 'shard', motion: 'fall', color: '#dff8ff', count: 6, size: 14, spread: 40 },
    ] };
    case 'flinch': return { layers: [{ kind: 'particles', at: 'user', shape: 'star', motion: 'burst', color: '#ffffff', count: 6, size: 12, spread: 45 }] };
    case 'attract': return INFATUATED;
    default: return { layers: [{ kind: 'particles', at: 'user', shape: 'dot', motion: 'rise', color: '#9aa3b5', count: 6, size: 8, spread: 40 }] };
  }
}

/** Confusion: dizzy stars spin around the Pokémon. */
export const CONFUSED: FxSpec = { layers: [
  { kind: 'particles', at: 'user', shape: 'star', motion: 'swirl', color: STATUS_COLORS.confusion, color2: '#ffffff', count: 8, size: 14, spread: 55, dur: 700 },
] };

/** Infatuation: hearts float around the Pokémon. */
export const INFATUATED: FxSpec = { layers: [
  { kind: 'particles', at: 'user', shape: 'heart', motion: 'rise', color: STATUS_COLORS.attract, color2: '#ffd0e2', count: 8, size: 15, spread: 45, dur: 700 },
] };

/** A move bounces off Protect (or one of its variants). */
export function blockedSpec(variant: string): FxSpec {
  const s = SHIELDS[variant] ?? SHIELDS.protect;
  return { layers: [
    { kind: 'shield', color: s.color, spiky: s.spiky },
    { kind: 'impact', color: s.color, size: 90, star: true, at: 'user', delay: 120 },
  ] };
}

/** A status condition is cured. */
export const CURE: FxSpec = { layers: [
  { kind: 'particles', at: 'user', shape: 'star', motion: 'rise', color: '#ffffff', color2: '#b8ffcf', count: 10, size: 11, spread: 45 },
] };

/** End-of-turn damage from a lasting cause; null when the plain hurt animation is enough. */
export function residualSpec(cause: string | undefined): FxSpec | null {
  switch (cause) {
    case 'brn': return { layers: [{ kind: 'particles', at: 'user', shape: 'flame', motion: 'rise', color: STATUS_COLORS.brn, color2: '#ffd23f', count: 10, size: 17, spread: 45 }] };
    case 'psn':
    case 'tox': return { layers: [{ kind: 'particles', at: 'user', shape: 'bubble', motion: 'rise', color: STATUS_COLORS.psn, color2: '#5a1f6e', count: 10, size: 15, spread: 45 }] };
    case 'confusion': return { layers: [
      ...CONFUSED.layers,
      { kind: 'impact', color: '#ffffff', size: 80, at: 'user', delay: 250 },
    ] };
    case 'sandstorm': return { layers: [{ kind: 'particles', at: 'user', shape: 'rock', motion: 'swirl', color: '#c9a15a', count: 8, size: 10, spread: 50 }] };
    case 'hail': return { layers: [{ kind: 'particles', at: 'user', shape: 'shard', motion: 'fall', color: '#e6f6ff', count: 8, size: 11, spread: 50 }] };
    default: return null;
  }
}
