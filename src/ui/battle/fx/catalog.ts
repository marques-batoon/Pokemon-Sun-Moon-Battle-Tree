// Battle animation catalog. Every animation is a list of layers built from a
// small set of primitives (rendered by MoveEffects.tsx, styled in index.css).
// Attacks have a distinct look per type, with separate physical (contact at
// the target) and special (something travels from the user) versions.
import type { MoveFx } from '../../../client/move-class';
import { WARP_DIGIMON } from '../../../data/custom/digimon';
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
  | { kind: 'ground'; color: string; delay?: number; dur?: number }
  /** Digital space: a glowing grid over the whole stage with a scan line, behind the sprites (Warp Digivolution). */
  | { kind: 'datagrid'; color: string; delay?: number; dur?: number }
  /** Columns of digital code streaming up around a spot. */
  | { kind: 'code'; at: Anchor; color: string; columns: number; spread: number; delay?: number; dur?: number }
  /** A spinning wireframe sphere of data closing in around a spot. */
  | { kind: 'wireframe'; at: Anchor; color: string; size: number; delay?: number; dur?: number }
  /** Big text sweeping across the stage. */
  | { kind: 'banner'; text: string; color: string; delay?: number; dur?: number }
  /** A huge shape falling from the sky onto the target (a boulder, a body slam, a dive). */
  | { kind: 'meteor'; shape: Shape; color: string; color2?: string; size: number; delay?: number; dur?: number }
  /** A spinning whirlpool / black hole / drill, flattened onto the ground at a spot. */
  | { kind: 'vortex'; at: Anchor; color: string; color2?: string; size: number; delay?: number; dur?: number }
  /** A sunburst of rays at a spot. */
  | { kind: 'rays'; at: Anchor; color: string; size: number; delay?: number; dur?: number }
  /** A column of light from the top of the stage down onto a spot. */
  | { kind: 'pillar'; at: Anchor; color: string; color2?: string; width: number; delay?: number; dur?: number };

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

/**
 * Damaging Z-Moves: an oversized, 2.2-second animation for each type, one for a physical Z-Move and
 * one for a special one (the category is the base move's, from the engine's hint), built around the
 * Z-Move's name (Hydro Vortex is a whirlpool, Continental Crush drops a mountain, Black Hole Eclipse
 * opens a black hole...). Signature Z-Moves (Catastropika, Oceanic Operetta...) have their own
 * (Z_SIGNATURE). All open dim, climax around 1.3 s with a flash and a strong shake, and linger.
 */
const pt = (at: Anchor, shape: Shape, motion: Motion, color: string, color2: string | undefined, count: number, size: number, spread: number, delay = 0, dur?: number): Layer =>
  ({ kind: 'particles', at, shape, motion, color, ...(color2 ? { color2 } : {}), count, size, spread, delay, ...(dur ? { dur } : {}) });

type ZPair = { physical: Layer[]; special: Layer[] };
const Z_MOVES: Record<TypeName, ZPair> = {
  // Breakneck Blitz: the user builds unstoppable momentum and slams into the target.
  Normal: {
    physical: [
      { kind: 'aura', at: 'user', color: '#fff3c4', size: 260, dur: 700 },
      pt('user', 'dot', 'converge', '#ffffff', '#ffe9a8', 18, 10, 130),
      { kind: 'rings', at: 'path', color: '#ffffff', count: 6, size: 100, delay: 450, dur: 700 },
      { kind: 'impact', color: '#ffffff', size: 320, star: true, delay: 1250 },
      { kind: 'rays', at: 'target', color: '#fff3c4', size: 360, delay: 1250, dur: 800 },
      { kind: 'rings', at: 'target', color: '#ffe9a8', count: 3, size: 300, delay: 1300, dur: 700 },
      pt('target', 'star', 'burst', '#ffffff', '#ffe066', 22, 18, 170, 1280),
    ],
    special: [
      { kind: 'aura', at: 'user', color: '#ffffff', size: 280, dur: 800 },
      { kind: 'rays', at: 'user', color: '#fff3c4', size: 320, delay: 100, dur: 800 },
      { kind: 'orb', color: '#ffffff', color2: '#ffe9a8', size: 180, delay: 750, dur: 550 },
      { kind: 'impact', color: '#ffe9a8', size: 340, delay: 1300 },
      { kind: 'rings', at: 'target', color: '#ffffff', count: 4, size: 320, delay: 1300, dur: 700 },
      pt('target', 'star', 'burst', '#ffffff', '#ffe9a8', 20, 16, 170, 1320),
    ],
  },
  // Inferno Overdrive: the user is wreathed in an inferno and unleashes it at full power.
  Fire: {
    physical: [
      { kind: 'rays', at: 'user', color: '#ff8c1a', size: 280, dur: 800 },
      pt('user', 'flame', 'rise', '#ff5a00', '#ffd23f', 18, 24, 70, 0, 800),
      { kind: 'rings', at: 'path', color: '#ff6a00', count: 5, size: 100, delay: 500, dur: 650 },
      { kind: 'column', color: '#ff5a00', color2: '#ffe066', delay: 1150 },
      { kind: 'column', color: '#ff8c1a', color2: '#fff3b0', delay: 1300 },
      { kind: 'ground', color: '#ff5a00', delay: 1250, dur: 700 },
      pt('target', 'flame', 'burst', '#ff5a00', '#ffd23f', 28, 28, 190, 1280),
      { kind: 'impact', color: '#ff6a00', size: 320, star: true, delay: 1280 },
    ],
    special: [
      pt('user', 'flame', 'converge', '#ff6a00', '#ffd23f', 24, 20, 190, 0, 800),
      { kind: 'aura', at: 'user', color: '#ff8c1a', size: 300, delay: 200, dur: 800 },
      { kind: 'orb', color: '#ff5a00', color2: '#fff3b0', size: 200, shape: 'flame', arc: true, delay: 800, dur: 500 },
      { kind: 'rays', at: 'target', color: '#ff8c1a', size: 380, delay: 1300, dur: 850 },
      { kind: 'impact', color: '#ff6a00', size: 360, delay: 1300 },
      pt('target', 'flame', 'burst', '#ff5a00', '#ffd23f', 30, 30, 200, 1300),
      { kind: 'screen', color: '#ff6a00', mode: 'tint', delay: 1250, dur: 700 },
    ],
  },
  // Hydro Vortex: a huge whirlpool swallows the target.
  Water: {
    physical: [
      pt('user', 'drop', 'swirl', '#5aa2ff', '#cfe6ff', 16, 16, 80, 0, 700),
      { kind: 'rings', at: 'path', color: '#3b7cff', count: 4, size: 90, delay: 350, dur: 600 },
      { kind: 'vortex', at: 'target', color: '#3b7cff', color2: '#cfe8ff', size: 300, delay: 550, dur: 1500 },
      pt('target', 'bubble', 'swirl', '#9ad0ff', undefined, 22, 18, 130, 650, 1100),
      { kind: 'column', color: '#3b7cff', color2: '#cfe8ff', delay: 1300 },
      { kind: 'impact', color: '#5aa2ff', size: 300, delay: 1350 },
      pt('target', 'drop', 'spray', '#5aa2ff', '#cfe6ff', 24, 16, 150, 1350),
    ],
    special: [
      { kind: 'beam', color: '#3b7cff', color2: '#cfe8ff', width: 60, wavy: true, delay: 350, dur: 1000 },
      { kind: 'beam', color: '#ffffff', color2: '#9ad0ff', width: 22, wavy: true, delay: 400, dur: 950 },
      { kind: 'vortex', at: 'target', color: '#3b7cff', color2: '#ffffff', size: 320, delay: 900, dur: 1200 },
      pt('target', 'bubble', 'burst', '#9ad0ff', undefined, 20, 20, 160, 1300),
      pt('target', 'drop', 'spray', '#5aa2ff', '#cfe6ff', 24, 16, 150, 1350),
      { kind: 'screen', color: '#3b7cff', mode: 'tint', delay: 900, dur: 900 },
    ],
  },
  // Gigavolt Havoc: a giant spear of electricity, hurled.
  Electric: {
    physical: [
      pt('user', 'spark', 'converge', '#ffe14d', '#ffffff', 22, 18, 150, 0, 700),
      { kind: 'aura', at: 'user', color: '#ffe14d', size: 260, dur: 700 },
      { kind: 'orb', color: '#ffe14d', color2: '#ffffff', size: 120, shape: 'spark', delay: 800, dur: 420 },
      { kind: 'bolt', color: '#ffe14d', delay: 1150 },
      { kind: 'bolt', color: '#fff7a8', delay: 1250 },
      { kind: 'bolt', color: '#ffffff', delay: 1350 },
      { kind: 'rays', at: 'target', color: '#ffe14d', size: 340, delay: 1250, dur: 800 },
      pt('target', 'spark', 'burst', '#ffe14d', '#ffffff', 26, 22, 180, 1260),
    ],
    special: [
      pt('user', 'spark', 'converge', '#ffe14d', '#ffffff', 24, 16, 170, 0, 800),
      { kind: 'beam', color: '#ffe14d', color2: '#ffffff', width: 54, delay: 700, dur: 700 },
      { kind: 'pillar', at: 'target', color: '#ffe14d', color2: '#ffffff', width: 110, delay: 1150, dur: 700 },
      { kind: 'bolt', color: '#ffe14d', delay: 1200 },
      { kind: 'bolt', color: '#ffffff', delay: 1350 },
      pt('target', 'spark', 'burst', '#ffe14d', '#ffffff', 28, 22, 190, 1300),
    ],
  },
  // Bloom Doom: the power of plants blossoms all around, then bursts.
  Grass: {
    physical: [
      { kind: 'ground', color: '#5fb83a', delay: 100, dur: 1100 },
      pt('target', 'heart', 'rise', '#ff9ccf', '#ffffff', 16, 16, 130, 400, 900),
      pt('target', 'leaf', 'swirl', '#7ac74c', '#c6f08a', 18, 18, 120, 500, 900),
      { kind: 'column', color: '#5fb83a', color2: '#c6f08a', delay: 1150 },
      { kind: 'rays', at: 'target', color: '#a8e070', size: 340, delay: 1250, dur: 800 },
      { kind: 'impact', color: '#7ac74c', size: 320, star: true, delay: 1280 },
      pt('target', 'leaf', 'burst', '#7ac74c', '#c6f08a', 26, 20, 180, 1300),
    ],
    special: [
      pt('user', 'leaf', 'converge', '#7ac74c', '#c6f08a', 22, 18, 170, 0, 800),
      { kind: 'vortex', at: 'target', color: '#7ac74c', color2: '#ff9ccf', size: 300, delay: 400, dur: 1300 },
      pt('target', 'heart', 'swirl', '#ff9ccf', '#ffffff', 20, 16, 130, 500, 1000),
      { kind: 'beam', color: '#5fb83a', color2: '#e6ffd0', width: 44, wavy: true, delay: 800, dur: 600 },
      { kind: 'rays', at: 'target', color: '#ffb6dc', size: 360, delay: 1300, dur: 800 },
      pt('target', 'heart', 'burst', '#ff9ccf', '#ffffff', 26, 18, 190, 1300),
    ],
  },
  // Subzero Slammer: the temperature plummets and a giant slab of ice slams down.
  Ice: {
    physical: [
      { kind: 'screen', color: '#bfefff', mode: 'tint', dur: 1500 },
      pt('user', 'shard', 'converge', '#bff3ff', '#ffffff', 16, 18, 140, 0, 700),
      { kind: 'meteor', shape: 'shard', color: '#bff3ff', color2: '#ffffff', size: 150, delay: 700, dur: 600 },
      { kind: 'crack', color: '#9fe8ff', delay: 1280 },
      { kind: 'impact', color: '#c9f6ff', size: 320, delay: 1280 },
      pt('target', 'shard', 'burst', '#cdf6ff', '#ffffff', 24, 22, 180, 1300),
      pt('target', 'wisp', 'rise', '#e6fbff', undefined, 12, 28, 110, 1400),
    ],
    special: [
      { kind: 'aura', at: 'user', color: '#9fe8ff', size: 270, dur: 700 },
      { kind: 'beam', color: '#7fe3ff', color2: '#ffffff', width: 52, delay: 550, dur: 900 },
      { kind: 'vortex', at: 'target', color: '#cdf6ff', color2: '#ffffff', size: 300, delay: 950, dur: 1150 },
      pt('target', 'shard', 'burst', '#cdf6ff', '#ffffff', 26, 20, 180, 1300),
      { kind: 'rings', at: 'target', color: '#ffffff', count: 3, size: 300, delay: 1300 },
      { kind: 'screen', color: '#e6fbff', mode: 'tint', delay: 1000, dur: 900 },
    ],
  },
  // All-Out Pummeling: a relentless barrage of energy fists.
  Fighting: {
    physical: [
      { kind: 'aura', at: 'user', color: '#e0503a', size: 260, dur: 700 },
      { kind: 'orb', color: '#ff7a3d', color2: '#fff0c0', size: 46, count: 8, gap: 70, delay: 500, dur: 380 },
      { kind: 'impact', color: '#ff7a3d', size: 160, star: true, delay: 880 },
      { kind: 'impact', color: '#ffb36b', size: 180, star: true, delay: 1020 },
      { kind: 'impact', color: '#ff7a3d', size: 200, star: true, delay: 1160 },
      { kind: 'impact', color: '#ffffff', size: 340, star: true, delay: 1320 },
      { kind: 'rays', at: 'target', color: '#ff8c5a', size: 340, delay: 1320, dur: 800 },
      pt('target', 'star', 'burst', '#ffb36b', '#ffffff', 22, 18, 180, 1340),
    ],
    special: [
      pt('user', 'dot', 'converge', '#6b8cff', '#ffffff', 24, 12, 170, 0, 800),
      { kind: 'orb', color: '#4d6bff', color2: '#ffffff', size: 150, delay: 650, dur: 550 },
      { kind: 'orb', color: '#6b8cff', color2: '#ffffff', size: 40, count: 6, gap: 60, arc: true, delay: 750, dur: 450 },
      { kind: 'rings', at: 'target', color: '#6b8cff', count: 4, size: 300, delay: 1250 },
      { kind: 'rays', at: 'target', color: '#8fa6ff', size: 340, delay: 1300, dur: 800 },
      { kind: 'impact', color: '#6b8cff', size: 340, delay: 1300 },
    ],
  },
  // Acid Downpour: a poison swamp, then a torrent of toxic rain.
  Poison: {
    physical: [
      { kind: 'ground', color: '#8a30b0', delay: 100, dur: 1200 },
      { kind: 'vortex', at: 'target', color: '#a040c0', color2: '#e0a8ff', size: 280, delay: 300, dur: 1300 },
      pt('target', 'bubble', 'fall', '#b45fd6', '#e0a8ff', 30, 18, 120, 600, 900),
      pt('target', 'drop', 'spray', '#a040c0', '#e0a8ff', 22, 16, 150, 1300),
      { kind: 'impact', color: '#b45fd6', size: 300, delay: 1300 },
      { kind: 'screen', color: '#8a30b0', mode: 'tint', delay: 600, dur: 1100 },
    ],
    special: [
      pt('user', 'bubble', 'converge', '#b45fd6', undefined, 20, 18, 160, 0, 700),
      { kind: 'beam', color: '#a040c0', color2: '#e0a8ff', width: 52, wavy: true, delay: 550, dur: 900 },
      pt('target', 'bubble', 'fall', '#b45fd6', '#e0a8ff', 28, 18, 120, 900, 800),
      pt('target', 'bubble', 'burst', '#b45fd6', '#e0a8ff', 24, 20, 180, 1300),
      { kind: 'rays', at: 'target', color: '#c070e0', size: 320, delay: 1300, dur: 800 },
      { kind: 'screen', color: '#8a30b0', mode: 'tint', delay: 1100, dur: 800 },
    ],
  },
  // Tectonic Rage: the user dives deep into the ground and the earth erupts.
  Ground: {
    physical: [
      { kind: 'ground', color: '#c8a050', delay: 100, dur: 1300 },
      { kind: 'crack', color: '#7a5a2a', delay: 600 },
      { kind: 'column', color: '#b07a3a', color2: '#e8c890', delay: 1100 },
      { kind: 'column', color: '#c8a050', color2: '#fff0c8', delay: 1250 },
      pt('target', 'rock', 'burst', '#b07a3a', '#6b4a2b', 26, 24, 190, 1250),
      { kind: 'rings', at: 'target', color: '#c8a050', count: 3, size: 320, delay: 1300 },
      { kind: 'impact', color: '#c8a050', size: 340, delay: 1280 },
    ],
    special: [
      pt('user', 'rock', 'rise', '#b07a3a', '#e8c890', 18, 20, 100, 0, 800),
      { kind: 'vortex', at: 'target', color: '#b07a3a', color2: '#e8c890', size: 300, delay: 450, dur: 1200 },
      { kind: 'crack', color: '#7a5a2a', delay: 1000 },
      { kind: 'column', color: '#b07a3a', color2: '#e8c890', delay: 1250 },
      pt('target', 'rock', 'burst', '#b07a3a', '#e8c890', 28, 24, 200, 1300),
      { kind: 'rays', at: 'target', color: '#e8c890', size: 340, delay: 1300, dur: 800 },
    ],
  },
  // Supersonic Skystrike: the user soars into the sky and dives at the target.
  Flying: {
    physical: [
      pt('user', 'feather', 'rise', '#cfe0ff', '#ffffff', 16, 20, 80, 0, 800),
      { kind: 'rings', at: 'user', color: '#cfe0ff', count: 3, size: 220, delay: 100 },
      { kind: 'meteor', shape: 'star', color: '#e6efff', color2: '#ffffff', size: 110, delay: 750, dur: 550 },
      { kind: 'slash', color: '#ffffff', count: 2, angle: 50, cross: true, width: 10, delay: 1250 },
      { kind: 'impact', color: '#9ab8ff', size: 330, star: true, delay: 1300 },
      { kind: 'rings', at: 'target', color: '#cfe0ff', count: 3, size: 300, delay: 1320 },
      pt('target', 'feather', 'burst', '#cfe0ff', '#ffffff', 22, 20, 180, 1300),
    ],
    special: [
      { kind: 'rings', at: 'path', color: '#cfe0ff', count: 7, size: 90, delay: 250, dur: 1000 },
      pt('target', 'wisp', 'swirl', '#e6efff', undefined, 20, 26, 140, 800, 900),
      { kind: 'pillar', at: 'target', color: '#cfe0ff', color2: '#ffffff', width: 120, delay: 1150, dur: 700 },
      pt('target', 'feather', 'burst', '#cfe0ff', '#ffffff', 24, 20, 190, 1300),
      { kind: 'impact', color: '#9ab8ff', size: 330, delay: 1300 },
    ],
  },
  // Shattered Psyche: the user seizes the target with psychic power and hurls it about.
  Psychic: {
    physical: [
      { kind: 'rings', at: 'target', color: '#ff5f9e', count: 4, size: 220, delay: 250, dur: 800 },
      pt('target', 'gem', 'converge', '#ff8fbf', '#ffffff', 18, 16, 170, 400, 800),
      { kind: 'vortex', at: 'target', color: '#ff5f9e', color2: '#ffd0e4', size: 260, delay: 500, dur: 1000 },
      { kind: 'impact', color: '#ff5f9e', size: 330, star: true, delay: 1280 },
      pt('target', 'shard', 'burst', '#ff5f9e', '#ffd0e4', 26, 20, 190, 1300),
      { kind: 'screen', color: '#ff5f9e', mode: 'tint', delay: 1000, dur: 800 },
    ],
    special: [
      { kind: 'aura', at: 'user', color: '#ff5f9e', size: 290, dur: 800 },
      { kind: 'rays', at: 'user', color: '#ff8fbf', size: 300, delay: 150, dur: 800 },
      { kind: 'beam', color: '#ff5f9e', color2: '#ffd0e4', width: 50, wavy: true, delay: 700, dur: 700 },
      { kind: 'rings', at: 'target', color: '#ff5f9e', count: 4, size: 320, rainbow: true, delay: 1250 },
      pt('target', 'gem', 'burst', '#ff8fbf', '#ffffff', 26, 18, 190, 1300),
    ],
  },
  // Savage Spin-Out: silk wraps the target, which is spun and flung.
  Bug: {
    physical: [
      { kind: 'rings', at: 'target', color: '#e8ffc0', count: 6, size: 180, delay: 300, dur: 900 },
      { kind: 'vortex', at: 'target', color: '#a8c040', color2: '#e8ffc0', size: 240, delay: 650, dur: 900 },
      { kind: 'slash', color: '#8aa82a', count: 3, angle: -20, width: 8, delay: 1150 },
      { kind: 'impact', color: '#c8e060', size: 320, star: true, delay: 1300 },
      pt('target', 'spark', 'burst', '#a8c040', '#e8ff9a', 24, 18, 180, 1300),
    ],
    special: [
      { kind: 'orb', color: '#a8c040', color2: '#e8ff9a', size: 30, count: 9, gap: 60, arc: true, delay: 350, dur: 550 },
      { kind: 'vortex', at: 'target', color: '#a8c040', color2: '#e8ff9a', size: 280, delay: 800, dur: 1100 },
      pt('target', 'spark', 'swirl', '#a8c040', '#e8ff9a', 22, 18, 130, 900, 900),
      { kind: 'impact', color: '#a8c040', size: 320, delay: 1300 },
      { kind: 'rings', at: 'target', color: '#c8e060', count: 3, size: 300, delay: 1300 },
    ],
  },
  // Continental Crush: a mountain of rock is summoned and dropped on the target.
  Rock: {
    physical: [
      pt('user', 'rock', 'rise', '#b8a038', '#7a6a2a', 14, 22, 90, 0, 800),
      { kind: 'meteor', shape: 'rock', color: '#b8a038', color2: '#7a6a2a', size: 220, delay: 650, dur: 650 },
      { kind: 'crack', color: '#6b5a2a', delay: 1300 },
      { kind: 'impact', color: '#b8a038', size: 360, delay: 1300 },
      pt('target', 'rock', 'burst', '#b8a038', '#7a6a2a', 26, 24, 200, 1320),
      { kind: 'ground', color: '#b8a038', delay: 1300, dur: 600 },
    ],
    special: [
      { kind: 'orb', color: '#b8a038', color2: '#e8d890', size: 48, shape: 'rock', count: 6, gap: 80, arc: true, delay: 350, dur: 550 },
      { kind: 'meteor', shape: 'rock', color: '#d0b850', color2: '#7a6a2a', size: 160, delay: 800, dur: 550 },
      pt('target', 'rock', 'burst', '#b8a038', '#e8d890', 26, 24, 190, 1320),
      { kind: 'rays', at: 'target', color: '#e8d890', size: 330, delay: 1320, dur: 800 },
      { kind: 'impact', color: '#d0b850', size: 330, delay: 1320 },
    ],
  },
  // Never-Ending Nightmare: ghostly hands reach up from the ground and drag the target down.
  Ghost: {
    physical: [
      { kind: 'screen', color: '#2a1840', mode: 'dim', delay: 150, dur: 1800 },
      { kind: 'vortex', at: 'target', color: '#5b3e8f', color2: '#c8a8ff', size: 300, delay: 300, dur: 1400 },
      pt('target', 'wisp', 'converge', '#8a5cc8', '#c8a8ff', 24, 26, 190, 400, 900),
      { kind: 'jaws', color: '#8a5cc8', delay: 1200 },
      { kind: 'impact', color: '#8a5cc8', size: 320, delay: 1300 },
      pt('target', 'crescent', 'burst', '#c8a8ff', undefined, 16, 20, 180, 1300),
    ],
    special: [
      pt('user', 'wisp', 'rise', '#8a5cc8', '#c8a8ff', 18, 24, 90, 0, 800),
      { kind: 'orb', color: '#5b3e8f', color2: '#c8a8ff', size: 130, shape: 'crescent', delay: 700, dur: 600 },
      { kind: 'vortex', at: 'target', color: '#5b3e8f', color2: '#c8a8ff', size: 300, delay: 1000, dur: 1100 },
      { kind: 'rings', at: 'target', color: '#8a5cc8', count: 3, size: 300, delay: 1300 },
      pt('target', 'wisp', 'burst', '#c8a8ff', '#8a5cc8', 22, 24, 190, 1300),
    ],
  },
  // Devastating Drake: the user's aura takes the shape of a dragon and strikes.
  Dragon: {
    physical: [
      { kind: 'aura', at: 'user', color: '#6f35fc', size: 320, dur: 800 },
      pt('user', 'scale', 'converge', '#8f6bff', '#c9b8ff', 22, 18, 170, 0, 800),
      { kind: 'rings', at: 'path', color: '#8f6bff', count: 5, size: 110, delay: 550, dur: 650 },
      { kind: 'slash', color: '#c9b8ff', count: 2, angle: 30, cross: true, width: 12, delay: 1220 },
      { kind: 'impact', color: '#6f35fc', size: 340, star: true, delay: 1300 },
      { kind: 'rays', at: 'target', color: '#8f6bff', size: 360, delay: 1300, dur: 800 },
      pt('target', 'scale', 'burst', '#8f6bff', '#c9b8ff', 26, 20, 190, 1300),
    ],
    special: [
      pt('user', 'scale', 'converge', '#8f6bff', '#c9b8ff', 22, 18, 170, 0, 800),
      { kind: 'rays', at: 'user', color: '#8f6bff', size: 300, delay: 100, dur: 800 },
      { kind: 'beam', color: '#6f35fc', color2: '#c9b8ff', width: 66, delay: 700, dur: 800 },
      pt('target', 'scale', 'burst', '#8f6bff', '#c9b8ff', 28, 20, 200, 1300),
      { kind: 'impact', color: '#6f35fc', size: 360, delay: 1300 },
    ],
  },
  // Black Hole Eclipse: a black hole opens and pulls the target in.
  Dark: {
    physical: [
      { kind: 'screen', color: '#000000', mode: 'dim', delay: 200, dur: 1800 },
      { kind: 'vortex', at: 'target', color: '#1c1c28', color2: '#7b5cff', size: 320, delay: 300, dur: 1500 },
      pt('target', 'dot', 'converge', '#3a2f45', '#7b5cff', 26, 14, 210, 400, 900),
      { kind: 'slash', color: '#7b5cff', count: 2, angle: -35, cross: true, width: 10, delay: 1200 },
      { kind: 'impact', color: '#5a4870', size: 320, delay: 1300 },
      pt('target', 'crescent', 'burst', '#7b5cff', '#3a2f45', 16, 20, 180, 1300),
    ],
    special: [
      { kind: 'screen', color: '#000000', mode: 'dim', delay: 200, dur: 1800 },
      { kind: 'vortex', at: 'target', color: '#1c1c28', color2: '#7b5cff', size: 340, delay: 350, dur: 1500 },
      pt('target', 'wisp', 'converge', '#3a2f45', '#7b5cff', 24, 24, 210, 450, 900),
      { kind: 'orb', color: '#1c1c28', color2: '#7b5cff', size: 160, delay: 800, dur: 500 },
      { kind: 'rays', at: 'target', color: '#7b5cff', size: 360, delay: 1300, dur: 800 },
      { kind: 'impact', color: '#7b5cff', size: 360, delay: 1300 },
    ],
  },
  // Corkscrew Crash: the user spins like a drill and rams the target.
  Steel: {
    physical: [
      pt('user', 'spark', 'swirl', '#d0d0e0', '#ffffff', 18, 16, 80, 0, 800),
      { kind: 'vortex', at: 'user', color: '#b8b8d0', color2: '#ffffff', size: 200, dur: 900 },
      { kind: 'rings', at: 'path', color: '#d0d0e0', count: 5, size: 90, delay: 600, dur: 600 },
      { kind: 'slash', color: '#e0e0f0', count: 4, angle: 30, width: 7, delay: 1150 },
      { kind: 'impact', color: '#e0e0f0', size: 330, star: true, delay: 1300 },
      pt('target', 'spark', 'burst', '#d0d0e0', '#ffffff', 26, 18, 190, 1300),
    ],
    special: [
      { kind: 'aura', at: 'user', color: '#d0d0e0', size: 280, dur: 700 },
      { kind: 'beam', color: '#b8b8d0', color2: '#ffffff', width: 56, delay: 600, dur: 850 },
      { kind: 'vortex', at: 'target', color: '#b8b8d0', color2: '#ffffff', size: 260, delay: 1000, dur: 1000 },
      pt('target', 'gem', 'burst', '#d0d0e0', '#ffffff', 26, 18, 190, 1300),
      { kind: 'rays', at: 'target', color: '#ffffff', size: 340, delay: 1300, dur: 800 },
    ],
  },
  // Twinkle Tackle: the user whisks the target into a charming space and plays with it.
  Fairy: {
    physical: [
      pt('user', 'star', 'swirl', '#ff9ff3', '#ffffff', 16, 16, 80, 0, 800),
      { kind: 'rings', at: 'target', color: '#ff9ff3', count: 4, size: 280, rainbow: true, delay: 300, dur: 900 },
      pt('target', 'heart', 'swirl', '#ff9ff3', '#ffffff', 20, 16, 130, 500, 900),
      { kind: 'rings', at: 'path', color: '#ff9ff3', count: 4, size: 90, delay: 700, dur: 500 },
      { kind: 'impact', color: '#ff9ff3', size: 330, star: true, delay: 1280 },
      pt('target', 'star', 'burst', '#ffe066', '#ffffff', 24, 18, 190, 1300),
    ],
    special: [
      pt('user', 'star', 'converge', '#ff9ff3', '#ffffff', 22, 16, 170, 0, 800),
      { kind: 'beam', color: '#ff9ff3', color2: '#ffffff', width: 50, wavy: true, delay: 650, dur: 800 },
      { kind: 'vortex', at: 'target', color: '#ff9ff3', color2: '#ffffff', size: 280, delay: 1000, dur: 1000 },
      pt('target', 'heart', 'burst', '#ff9ff3', '#ffffff', 26, 18, 190, 1300),
      { kind: 'rings', at: 'target', color: '#ff9ff3', count: 3, size: 300, rainbow: true, delay: 1300 },
    ],
  },
};

/** Signature Z-Moves (one Pokémon's own, with a fixed category), and the custom Poliwrathium Z-Moves. */
const Z_SIGNATURE: Record<string, { type: TypeName; layers: Layer[] }> = {
  // Pikachu leaps high, wreathed in electricity, and comes crashing down.
  catastropika: { type: 'Electric', layers: [
    pt('user', 'spark', 'converge', '#ffe14d', '#ffffff', 24, 18, 160, 0, 700),
    { kind: 'aura', at: 'user', color: '#ffe14d', size: 260, dur: 700 },
    { kind: 'meteor', shape: 'spark', color: '#ffe14d', color2: '#ffffff', size: 160, delay: 700, dur: 600 },
    { kind: 'bolt', color: '#ffffff', delay: 1250 },
    { kind: 'rays', at: 'target', color: '#ffe14d', size: 380, delay: 1300, dur: 800 },
    pt('target', 'spark', 'burst', '#ffe14d', '#ffffff', 30, 24, 210, 1300),
  ] },
  // Pikachu in a cap: a storm of lightning bolts, all at once.
  '10000000voltthunderbolt': { type: 'Electric', layers: [
    { kind: 'rays', at: 'user', color: '#ffe14d', size: 300, dur: 900 },
    { kind: 'beam', color: '#ffe14d', color2: '#ffffff', width: 30, delay: 600, dur: 800 },
    { kind: 'beam', color: '#ff9f43', color2: '#ffffff', width: 18, delay: 680, dur: 750 },
    { kind: 'beam', color: '#5ec8ff', color2: '#ffffff', width: 14, delay: 760, dur: 700 },
    { kind: 'pillar', at: 'target', color: '#ffe14d', color2: '#ffffff', width: 130, delay: 1200, dur: 700 },
    { kind: 'bolt', color: '#ffe14d', delay: 1250 },
    { kind: 'bolt', color: '#ffffff', delay: 1350 },
    pt('target', 'spark', 'burst', '#ffe14d', '#ffffff', 30, 22, 210, 1320),
  ] },
  // Alolan Raichu surfs its tail on psychic energy, then strikes with lightning.
  stokedsparksurfer: { type: 'Electric', layers: [
    { kind: 'rings', at: 'path', color: '#ff8fbf', count: 6, size: 90, delay: 200, dur: 900 },
    { kind: 'orb', color: '#ffe14d', color2: '#ff8fbf', size: 70, shape: 'spark', arc: true, delay: 500, dur: 650 },
    { kind: 'pillar', at: 'target', color: '#ffe14d', color2: '#ffd0e4', width: 110, delay: 1150, dur: 700 },
    { kind: 'bolt', color: '#ffe14d', delay: 1250 },
    pt('target', 'spark', 'burst', '#ffe14d', '#ff8fbf', 26, 22, 190, 1300),
    { kind: 'impact', color: '#ffe14d', size: 320, star: true, delay: 1300 },
  ] },
  // Snorlax takes a running leap and body-slams the target flat.
  pulverizingpancake: { type: 'Normal', layers: [
    { kind: 'aura', at: 'user', color: '#fff3c4', size: 280, dur: 700 },
    { kind: 'meteor', shape: 'blob', color: '#3f6f8f', color2: '#e8dcc0', size: 240, delay: 650, dur: 650 },
    { kind: 'crack', color: '#6b5a2a', delay: 1300 },
    { kind: 'rings', at: 'target', color: '#e8dcc0', count: 4, size: 340, delay: 1300 },
    { kind: 'impact', color: '#ffffff', size: 380, delay: 1300 },
    pt('target', 'star', 'burst', '#ffffff', '#ffe066', 24, 20, 200, 1320),
  ] },
  // Decidueye fires a rain of arrow-quills from above.
  sinisterarrowraid: { type: 'Ghost', layers: [
    { kind: 'screen', color: '#1a1030', mode: 'dim', delay: 100, dur: 1900 },
    pt('user', 'feather', 'rise', '#5b3e8f', '#c8a8ff', 16, 20, 90, 0, 800),
    pt('target', 'shard', 'fall', '#8a5cc8', '#ffffff', 30, 22, 130, 650, 700),
    { kind: 'orb', color: '#5b3e8f', color2: '#ffffff', size: 34, shape: 'shard', count: 8, gap: 55, delay: 700, dur: 400 },
    { kind: 'impact', color: '#8a5cc8', size: 320, star: true, delay: 1300 },
    pt('target', 'feather', 'burst', '#c8a8ff', '#5b3e8f', 24, 20, 190, 1300),
  ] },
  // Incineroar summons a wrestling ring and drops on the target from the top rope.
  maliciousmoonsault: { type: 'Dark', layers: [
    { kind: 'rings', at: 'target', color: '#ff5a3a', count: 3, size: 320, delay: 150, dur: 900 },
    pt('user', 'flame', 'rise', '#ff5a00', '#ffd23f', 18, 22, 80, 0, 800),
    { kind: 'meteor', shape: 'crescent', color: '#3a2f45', color2: '#ff5a00', size: 170, delay: 750, dur: 550 },
    { kind: 'impact', color: '#ff5a3a', size: 360, star: true, delay: 1300 },
    { kind: 'ground', color: '#ff5a00', delay: 1300, dur: 600 },
    pt('target', 'flame', 'burst', '#ff5a00', '#ffd23f', 28, 26, 200, 1300),
  ] },
  // Primarina sings and drops a huge balloon of water on the target.
  oceanicoperetta: { type: 'Water', layers: [
    pt('user', 'bubble', 'rise', '#9ad0ff', '#ffffff', 20, 20, 100, 0, 900),
    { kind: 'rings', at: 'user', color: '#9ad0ff', count: 4, size: 240, delay: 100, dur: 800 },
    { kind: 'orb', color: '#5aa2ff', color2: '#ffffff', size: 210, shape: 'bubble', arc: true, delay: 750, dur: 550 },
    { kind: 'column', color: '#3b7cff', color2: '#cfe8ff', delay: 1300 },
    { kind: 'rays', at: 'target', color: '#9ad0ff', size: 360, delay: 1300, dur: 800 },
    pt('target', 'drop', 'spray', '#5aa2ff', '#ffffff', 28, 18, 190, 1320),
  ] },
  // A Tapu's giant guardian form appears and crushes the target.
  guardianofalola: { type: 'Fairy', layers: [
    { kind: 'rays', at: 'user', color: '#ffd36b', size: 320, dur: 900 },
    { kind: 'meteor', shape: 'gem', color: '#ff9ff3', color2: '#ffd36b', size: 230, delay: 650, dur: 650 },
    { kind: 'rings', at: 'target', color: '#ffd36b', count: 4, size: 340, rainbow: true, delay: 1300 },
    { kind: 'impact', color: '#ff9ff3', size: 380, delay: 1300 },
    pt('target', 'star', 'burst', '#ffd36b', '#ff9ff3', 28, 20, 200, 1320),
  ] },
  // Marshadow strikes seven times as a shadow, then steals the target's soul.
  soulstealing7starstrike: { type: 'Ghost', layers: [
    { kind: 'screen', color: '#000000', mode: 'dim', delay: 100, dur: 1900 },
    ...[0, 1, 2, 3, 4, 5, 6].map((i): Layer => ({ kind: 'impact', color: i % 2 ? '#8a5cc8' : '#ff5a3a', size: 140 + i * 20, star: true, delay: 500 + i * 110 })),
    { kind: 'slash', color: '#8a5cc8', count: 3, angle: 25, width: 8, delay: 900 },
    { kind: 'vortex', at: 'target', color: '#1c1c28', color2: '#8a5cc8', size: 280, delay: 1200, dur: 900 },
    pt('target', 'wisp', 'rise', '#c8a8ff', '#8a5cc8', 18, 26, 110, 1300),
  ] },
  // Kommo-o clangs its scales and unleashes a soul-shaking wave of sound.
  clangoroussoulblaze: { type: 'Dragon', layers: [
    { kind: 'rays', at: 'user', color: '#ffd36b', size: 320, dur: 900 },
    pt('user', 'scale', 'burst', '#ffd36b', '#8f6bff', 20, 18, 140, 200),
    { kind: 'rings', at: 'path', color: '#ffd36b', count: 7, size: 110, delay: 450, dur: 900 },
    { kind: 'rings', at: 'target', color: '#8f6bff', count: 4, size: 320, rainbow: true, delay: 1250 },
    { kind: 'impact', color: '#ffd36b', size: 360, delay: 1300 },
    pt('target', 'scale', 'burst', '#8f6bff', '#ffd36b', 28, 20, 200, 1320),
  ] },
  // Lycanroc rides a wave of rock that erupts in jagged spires around the target.
  splinteredstormshards: { type: 'Rock', layers: [
    { kind: 'ground', color: '#b8a038', delay: 100, dur: 1300 },
    { kind: 'column', color: '#b8a038', color2: '#fff0c8', delay: 800 },
    { kind: 'column', color: '#d0b850', color2: '#ffffff', delay: 1000 },
    { kind: 'column', color: '#b8a038', color2: '#fff0c8', delay: 1200 },
    pt('target', 'shard', 'burst', '#e8d890', '#b8a038', 28, 26, 200, 1300),
    { kind: 'impact', color: '#d0b850', size: 340, star: true, delay: 1300 },
  ] },
  // Mimikyu drags the target under its disguise for a "friendly" hug.
  letssnuggleforever: { type: 'Fairy', layers: [
    { kind: 'screen', color: '#1c1408', mode: 'dim', delay: 200, dur: 1800 },
    { kind: 'vortex', at: 'target', color: '#3a2f20', color2: '#ffe066', size: 300, delay: 400, dur: 1300 },
    pt('target', 'wisp', 'converge', '#3a2f20', '#ffe066', 22, 26, 190, 500, 800),
    { kind: 'jaws', color: '#ffe066', delay: 1150 },
    pt('target', 'heart', 'burst', '#ff9ff3', '#ffe066', 24, 18, 190, 1300),
    { kind: 'impact', color: '#ffe066', size: 330, delay: 1300 },
  ] },
  // Solgaleo charges as a blazing sun.
  searingsunrazesmash: { type: 'Steel', layers: [
    { kind: 'rays', at: 'user', color: '#ffb000', size: 360, dur: 1000 },
    { kind: 'aura', at: 'user', color: '#ffd27f', size: 300, delay: 200, dur: 800 },
    { kind: 'rings', at: 'path', color: '#ffd27f', count: 5, size: 120, delay: 700, dur: 550 },
    { kind: 'pillar', at: 'target', color: '#ffb000', color2: '#ffffff', width: 140, delay: 1200, dur: 700 },
    { kind: 'impact', color: '#ffd27f', size: 380, star: true, delay: 1300 },
    pt('target', 'spark', 'burst', '#ffd27f', '#ffffff', 28, 20, 200, 1300),
  ] },
  // Lunala draws the moon's power into a maelstrom of light.
  menacingmoonrazemaelstrom: { type: 'Ghost', layers: [
    { kind: 'screen', color: '#000010', mode: 'dim', delay: 100, dur: 1900 },
    { kind: 'orb', color: '#c8a8ff', color2: '#ffffff', size: 150, shape: 'crescent', delay: 550, dur: 600 },
    { kind: 'vortex', at: 'target', color: '#5b3e8f', color2: '#c8d8ff', size: 320, delay: 900, dur: 1200 },
    { kind: 'pillar', at: 'target', color: '#c8a8ff', color2: '#ffffff', width: 130, delay: 1200, dur: 700 },
    pt('target', 'crescent', 'burst', '#c8d8ff', '#c8a8ff', 22, 22, 190, 1300),
  ] },
  // Ultra Necrozma fires a pillar of blinding light from the sky.
  lightthatburnsthesky: { type: 'Psychic', layers: [
    { kind: 'rays', at: 'user', color: '#ffffff', size: 360, dur: 1000 },
    { kind: 'rings', at: 'user', color: '#ffffff', count: 4, size: 300, rainbow: true, delay: 200, dur: 900 },
    { kind: 'pillar', at: 'target', color: '#fff7c0', color2: '#ffffff', width: 170, delay: 1050, dur: 900 },
    { kind: 'rays', at: 'target', color: '#ffffff', size: 400, delay: 1300, dur: 900 },
    pt('target', 'star', 'burst', '#ffffff', '#ffe066', 28, 20, 210, 1320),
  ] },
  // Mew gathers psychic energy into a sphere that explodes like a supernova.
  genesissupernova: { type: 'Psychic', layers: [
    pt('user', 'gem', 'converge', '#ff8fbf', '#ffffff', 24, 16, 180, 0, 800),
    { kind: 'orb', color: '#ff5f9e', color2: '#ffffff', size: 180, delay: 700, dur: 600 },
    { kind: 'vortex', at: 'target', color: '#ff5f9e', color2: '#ffd0e4', size: 300, delay: 1100, dur: 1000 },
    { kind: 'rays', at: 'target', color: '#ff8fbf', size: 420, delay: 1300, dur: 900 },
    { kind: 'rings', at: 'target', color: '#ffffff', count: 4, size: 340, rainbow: true, delay: 1320 },
  ] },
  // Poliwrathium Z (custom): a whirling barrage of punches, then a free decoy.
  omegawrath: { type: 'Fighting', layers: [
    pt('user', 'drop', 'swirl', '#5aa2ff', '#cfe6ff', 16, 16, 80, 0, 800),
    { kind: 'orb', color: '#e0503a', color2: '#5aa2ff', size: 44, count: 8, gap: 65, delay: 500, dur: 380 },
    { kind: 'impact', color: '#5aa2ff', size: 170, star: true, delay: 900 },
    { kind: 'impact', color: '#e0503a', size: 200, star: true, delay: 1080 },
    { kind: 'impact', color: '#ffffff', size: 340, star: true, delay: 1300 },
    { kind: 'rays', at: 'target', color: '#ff8c5a', size: 340, delay: 1300, dur: 800 },
  ] },
  riptiderocketrush: { type: 'Water', layers: [
    { kind: 'rings', at: 'user', color: '#5aa2ff', count: 3, size: 240, dur: 700 },
    { kind: 'rings', at: 'path', color: '#3b7cff', count: 7, size: 100, delay: 400, dur: 750 },
    { kind: 'column', color: '#3b7cff', color2: '#cfe8ff', delay: 1250 },
    { kind: 'impact', color: '#5aa2ff', size: 340, star: true, delay: 1300 },
    pt('target', 'drop', 'spray', '#5aa2ff', '#ffffff', 28, 18, 190, 1300),
  ] },
  glacialguardiangauntlet: { type: 'Ice', layers: [
    { kind: 'screen', color: '#bfefff', mode: 'tint', dur: 1700 },
    { kind: 'meteor', shape: 'shard', color: '#cdf6ff', color2: '#ffffff', size: 200, delay: 650, dur: 650 },
    { kind: 'crack', color: '#9fe8ff', delay: 1300 },
    { kind: 'impact', color: '#c9f6ff', size: 360, delay: 1300 },
    pt('target', 'shard', 'burst', '#cdf6ff', '#ffffff', 28, 22, 200, 1320),
  ] },
};

/** Total length of a damaging Z-Move's animation (playback uses the same). */
export const Z_MOVE_MS = 2200;
const zFrame = (type: TypeName, layers: Layer[]): FxSpec => ({
  shake: 'strong',
  layers: [
    { kind: 'screen', color: '#000000', mode: 'dim', dur: Z_MOVE_MS },
    ...layers,
    { kind: 'screen', color: typeColor(type).bg, mode: 'flash', delay: 1300, dur: 450 },
  ],
});

/** Damaging Z-Move of a type, physical or special (see Z_MOVES). */
export function zMoveSpec(type: string, category: 'Physical' | 'Special' = 'Physical'): FxSpec {
  const t = asType(type);
  return zFrame(t, Z_MOVES[t][category === 'Special' ? 'special' : 'physical']);
}

/** A signature Z-Move's own animation (Catastropika, Oceanic Operetta...), or null. */
export function signatureZMoveSpec(moveId: string): FxSpec | null {
  const z = Z_SIGNATURE[moveId];
  return z ? zFrame(z.type, z.layers) : null;
}
/** Ids of the signature Z-Moves that have their own animation. */
export const SIGNATURE_Z_MOVES = Object.keys(Z_SIGNATURE);

/**
 * Signature moves with their own animation, after the Digimon attacks they're named for.
 * Gaia Force (WarGreymon's Terra Force): energy gathers into a giant sun over the user, which is
 * hurled at the target and explodes in fire. Cocytus Pulse (MetalGarurumon's Cocytus Breath): a
 * freezing blast of breath that frosts the field and shatters into ice at the target.
 */
export const SIGNATURE_MOVES: Record<string, FxSpec> = {
  gaiaforce: { shake: 'strong', layers: [
    { kind: 'screen', color: '#1a0800', mode: 'dim', dur: 1500 },
    { kind: 'particles', at: 'user', shape: 'flame', motion: 'converge', color: '#ff9a1f', color2: '#fff3b0', count: 22, size: 16, spread: 170, dur: 700 },
    { kind: 'aura', at: 'user', color: '#ffb000', size: 280, delay: 100, dur: 900 },
    { kind: 'rings', at: 'user', color: '#ffd27f', count: 3, size: 230, delay: 150, dur: 650 },
    { kind: 'orb', color: '#ff9a1f', color2: '#fff3b0', size: 160, arc: true, delay: 850, dur: 450 },
    { kind: 'impact', color: '#ff6a00', size: 320, star: true, delay: 1300 },
    { kind: 'particles', at: 'target', shape: 'flame', motion: 'burst', color: '#ff5a00', color2: '#ffd23f', count: 22, size: 28, spread: 160, delay: 1300 },
    { kind: 'ground', color: '#ff6a00', delay: 1300, dur: 500 },
    { kind: 'screen', color: '#ffd27f', mode: 'flash', delay: 1300, dur: 400 },
  ] },
  cocytuspulse: { shake: 'light', layers: [
    { kind: 'screen', color: '#bfefff', mode: 'tint', dur: 1300 },
    { kind: 'particles', at: 'user', shape: 'wisp', motion: 'converge', color: '#e6fbff', color2: '#9fe8ff', count: 12, size: 24, spread: 90, dur: 500 },
    { kind: 'beam', color: '#9fe8ff', color2: '#ffffff', width: 38, wavy: true, delay: 350, dur: 800 },
    { kind: 'beam', color: '#ffffff', color2: '#e6fbff', width: 14, delay: 400, dur: 750 },
    { kind: 'particles', at: 'target', shape: 'wisp', motion: 'rise', color: '#e6fbff', count: 10, size: 28, spread: 90, delay: 800 },
    { kind: 'particles', at: 'target', shape: 'shard', motion: 'burst', color: '#cdf6ff', color2: '#ffffff', count: 18, size: 20, spread: 110, delay: 850 },
    { kind: 'impact', color: '#c9f6ff', size: 220, delay: 850 },
    { kind: 'screen', color: '#e6fbff', mode: 'flash', delay: 900, dur: 350 },
  ] },
};

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

/**
 * Warp Digivolution (the Digimon anime's sequence, in this app's style): the stage drops into a
 * digital space of grid and streaming code, "WARP DIGIVOLVE" flashes across, the Digimon becomes a
 * light silhouette that surges bigger through its in-between forms (sprite class fx-warp-start)
 * inside a spinning wireframe of data, armour pieces fly in, and a white flash. Then the new form
 * bursts out with its name, in its own element (fire for WarGreymon, ice for MetalGarurumon).
 */
export const WARP_START: FxSpec = { layers: [
  { kind: 'screen', color: '#00040e', mode: 'dim', dur: 2600 },
  { kind: 'datagrid', color: '#2bd9ff', delay: 100, dur: 2500 },
  { kind: 'rings', at: 'user', color: '#ffffff', count: 3, size: 210, rainbow: true, delay: 60, dur: 620 },
  { kind: 'code', at: 'user', color: '#7dffb0', columns: 11, spread: 120, delay: 150, dur: 1500 },
  { kind: 'banner', text: 'Warp Digivolve!', color: '#ff9a1f', delay: 250, dur: 1500 },
  { kind: 'code', at: 'user', color: '#5ec8ff', columns: 9, spread: 95, delay: 850, dur: 1400 },
  { kind: 'wireframe', at: 'user', color: '#5ec8ff', size: 190, delay: 700, dur: 1700 },
  { kind: 'particles', at: 'user', shape: 'dot', motion: 'swirl', color: '#7dffb0', color2: '#5ec8ff', count: 14, size: 9, spread: 80, delay: 900, dur: 1200 },
  { kind: 'particles', at: 'user', shape: 'shard', motion: 'converge', color: '#ffd54a', color2: '#e6edf5', count: 14, size: 20, spread: 170, delay: 1550, dur: 650 },
  { kind: 'aura', at: 'user', color: '#ffffff', size: 210, delay: 1850, dur: 750 },
  { kind: 'screen', color: '#ffffff', mode: 'flash', delay: 2300, dur: 320 },
] };
/** How a warp form bursts out, by its first type. */
const WARP_BURST_STYLE: Record<string, { flash: string; ring: string; shape: Shape; color: string; color2: string }> = {
  Fire: { flash: '#fff1c2', ring: '#ff9a1f', shape: 'flame', color: '#ff6a00', color2: '#ffd23f' },
  Ice: { flash: '#e6fbff', ring: '#7fe3ff', shape: 'shard', color: '#bff3ff', color2: '#4d8cff' },
};
const DEFAULT_BURST = WARP_BURST_STYLE.Fire;

export function warpBurst(form = ''): FxSpec {
  const type = WARP_DIGIMON.find(d => d.warp.name === form)?.warp.types[0] ?? '';
  const st = WARP_BURST_STYLE[type] ?? DEFAULT_BURST;
  return { shake: 'strong', layers: [
    { kind: 'screen', color: st.flash, mode: 'flash', dur: 450 },
    { kind: 'rings', at: 'user', color: st.ring, count: 2, size: 260 },
    { kind: 'particles', at: 'user', shape: st.shape, motion: 'burst', color: st.color, color2: st.color2, count: 16, size: 20, spread: 150 },
    { kind: 'particles', at: 'user', shape: 'star', motion: 'burst', color: '#ffd54a', color2: '#ffffff', count: 10, size: 14, spread: 120, delay: 80 },
    ...(form ? [{ kind: 'banner', text: `${form}!`, color: st.ring, delay: 180, dur: 1050 } as Layer] : []),
  ] };
}

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
      return SIGNATURE_MOVES[fx.moveId] ?? ATTACKS[t][fx.category === 'Physical' ? 'physical' : 'special'];
    case 'z':
      return signatureZMoveSpec(fx.moveId) ?? zMoveSpec(t, fx.category === 'Special' ? 'Special' : 'Physical');
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
