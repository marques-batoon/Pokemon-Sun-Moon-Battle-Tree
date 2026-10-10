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
  | { kind: 'banner'; text: string; color: string; delay?: number; dur?: number };

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
 * Damaging Z-Moves: an oversized animation per type, different for a physical Z-Move (the user's
 * charge ends in a crash at the target) and a special one (a huge blast from the user). The category
 * is the base move's, from the engine's hint (playback). Each opens dim and ends in a flash.
 */
type ZPair = { physical: Layer[]; special: Layer[] };
const Z_MOVES: Record<TypeName, ZPair> = {
  Normal: {
    physical: [
      { kind: 'particles', at: 'user', shape: 'dot', motion: 'converge', color: '#ffffff', color2: '#ffe9a8', count: 16, size: 10, spread: 110 },
      { kind: 'rings', at: 'path', color: '#ffffff', count: 4, size: 90, delay: 350, dur: 600 },
      { kind: 'impact', color: '#ffffff', size: 200, star: true, delay: 900 },
      { kind: 'impact', color: '#ffe9a8', size: 270, delay: 1000 },
      { kind: 'particles', at: 'target', shape: 'star', motion: 'burst', color: '#ffffff', color2: '#ffe066', count: 16, size: 16, spread: 140, delay: 950 },
    ],
    special: [
      { kind: 'aura', at: 'user', color: '#ffffff', size: 240, dur: 700 },
      { kind: 'orb', color: '#ffffff', color2: '#ffe9a8', size: 130, delay: 600, dur: 600 },
      { kind: 'rings', at: 'target', color: '#ffffff', count: 3, size: 260, delay: 1150, dur: 600 },
      { kind: 'impact', color: '#ffe9a8', size: 280, delay: 1150 },
    ],
  },
  Fire: {
    physical: [
      { kind: 'particles', at: 'user', shape: 'flame', motion: 'rise', color: '#ff5a00', color2: '#ffd23f', count: 14, size: 22, spread: 60, dur: 700 },
      { kind: 'rings', at: 'path', color: '#ff8c1a', count: 3, size: 80, delay: 400, dur: 550 },
      { kind: 'column', color: '#ff6a00', color2: '#ffe066', delay: 900 },
      { kind: 'particles', at: 'target', shape: 'flame', motion: 'burst', color: '#ff5a00', color2: '#ffd23f', count: 20, size: 26, spread: 150, delay: 950 },
      { kind: 'ground', color: '#ff6a00', delay: 950, dur: 600 },
    ],
    special: [
      { kind: 'particles', at: 'user', shape: 'flame', motion: 'converge', color: '#ff6a00', color2: '#ffd23f', count: 18, size: 18, spread: 160 },
      { kind: 'aura', at: 'user', color: '#ff8c1a', size: 260, delay: 200, dur: 700 },
      { kind: 'orb', color: '#ff6a00', color2: '#ffe066', size: 150, shape: 'flame', delay: 650, dur: 600 },
      { kind: 'particles', at: 'target', shape: 'flame', motion: 'burst', color: '#ff5a00', color2: '#ffd23f', count: 24, size: 28, spread: 170, delay: 1200 },
      { kind: 'impact', color: '#ff6a00', size: 300, delay: 1200 },
      { kind: 'screen', color: '#ff6a00', mode: 'tint', delay: 1150, dur: 500 },
    ],
  },
  Water: {
    physical: [
      { kind: 'particles', at: 'user', shape: 'drop', motion: 'swirl', color: '#5aa2ff', color2: '#cfe6ff', count: 14, size: 14, spread: 70, dur: 600 },
      { kind: 'rings', at: 'target', color: '#3b7cff', count: 4, size: 220, delay: 650, dur: 800 },
      { kind: 'particles', at: 'target', shape: 'bubble', motion: 'swirl', color: '#9ad0ff', count: 18, size: 16, spread: 110, delay: 700, dur: 900 },
      { kind: 'column', color: '#3b7cff', color2: '#cfe8ff', delay: 1000 },
      { kind: 'impact', color: '#5aa2ff', size: 240, delay: 1100 },
    ],
    special: [
      { kind: 'beam', color: '#3b7cff', color2: '#cfe8ff', width: 46, wavy: true, delay: 450, dur: 900 },
      { kind: 'beam', color: '#ffffff', color2: '#9ad0ff', width: 18, wavy: true, delay: 500, dur: 850 },
      { kind: 'particles', at: 'target', shape: 'drop', motion: 'spray', color: '#5aa2ff', color2: '#cfe6ff', count: 22, size: 14, spread: 120, delay: 900 },
      { kind: 'particles', at: 'target', shape: 'bubble', motion: 'burst', color: '#9ad0ff', count: 14, size: 18, spread: 110, delay: 1000 },
      { kind: 'screen', color: '#3b7cff', mode: 'tint', delay: 900, dur: 600 },
    ],
  },
  Electric: {
    physical: [
      { kind: 'particles', at: 'user', shape: 'spark', motion: 'converge', color: '#ffe14d', color2: '#ffffff', count: 18, size: 16, spread: 120 },
      { kind: 'aura', at: 'user', color: '#ffe14d', size: 220, dur: 600 },
      { kind: 'bolt', color: '#ffe14d', delay: 700 },
      { kind: 'bolt', color: '#fff7a8', delay: 900 },
      { kind: 'impact', color: '#fff07a', size: 240, star: true, delay: 950 },
      { kind: 'particles', at: 'target', shape: 'spark', motion: 'burst', color: '#ffe14d', color2: '#ffffff', count: 20, size: 20, spread: 140, delay: 950 },
    ],
    special: [
      { kind: 'particles', at: 'user', shape: 'spark', motion: 'converge', color: '#ffe14d', color2: '#ffffff', count: 22, size: 16, spread: 150 },
      { kind: 'beam', color: '#ffe14d', color2: '#ffffff', width: 40, delay: 600, dur: 700 },
      { kind: 'bolt', color: '#ffe14d', delay: 1000 },
      { kind: 'bolt', color: '#ffffff', delay: 1150 },
      { kind: 'particles', at: 'target', shape: 'spark', motion: 'burst', color: '#ffe14d', count: 24, size: 20, spread: 160, delay: 1050 },
    ],
  },
  Grass: {
    physical: [
      { kind: 'ground', color: '#5fb83a', delay: 200, dur: 900 },
      { kind: 'column', color: '#5fb83a', color2: '#c6f08a', delay: 800 },
      { kind: 'particles', at: 'target', shape: 'leaf', motion: 'burst', color: '#7ac74c', color2: '#c6f08a', count: 20, size: 18, spread: 140, delay: 900 },
      { kind: 'particles', at: 'target', shape: 'heart', motion: 'rise', color: '#ff9ccf', color2: '#ffffff', count: 12, size: 14, spread: 90, delay: 1000 },
      { kind: 'impact', color: '#7ac74c', size: 240, delay: 950 },
    ],
    special: [
      { kind: 'particles', at: 'user', shape: 'leaf', motion: 'converge', color: '#7ac74c', color2: '#c6f08a', count: 18, size: 16, spread: 150 },
      { kind: 'aura', at: 'user', color: '#7ac74c', size: 230, delay: 150, dur: 650 },
      { kind: 'beam', color: '#5fb83a', color2: '#e6ffd0', width: 36, wavy: true, delay: 600, dur: 800 },
      { kind: 'particles', at: 'target', shape: 'heart', motion: 'burst', color: '#ff9ccf', color2: '#ffffff', count: 20, size: 16, spread: 150, delay: 1050 },
      { kind: 'particles', at: 'target', shape: 'leaf', motion: 'swirl', color: '#7ac74c', count: 14, size: 16, spread: 100, delay: 1100 },
    ],
  },
  Ice: {
    physical: [
      { kind: 'particles', at: 'user', shape: 'shard', motion: 'converge', color: '#bff3ff', color2: '#ffffff', count: 14, size: 16, spread: 120 },
      { kind: 'particles', at: 'target', shape: 'shard', motion: 'fall', color: '#bff3ff', color2: '#ffffff', count: 16, size: 26, spread: 80, delay: 500 },
      { kind: 'crack', color: '#9fe8ff', delay: 950 },
      { kind: 'impact', color: '#96d9d6', size: 240, delay: 950 },
      { kind: 'particles', at: 'target', shape: 'shard', motion: 'burst', color: '#cdf6ff', color2: '#ffffff', count: 18, size: 18, spread: 140, delay: 1000 },
      { kind: 'screen', color: '#bfefff', mode: 'tint', delay: 950, dur: 500 },
    ],
    special: [
      { kind: 'aura', at: 'user', color: '#9fe8ff', size: 230, dur: 600 },
      { kind: 'beam', color: '#7fe3ff', color2: '#ffffff', width: 40, delay: 500, dur: 800 },
      { kind: 'particles', at: 'target', shape: 'shard', motion: 'burst', color: '#cdf6ff', color2: '#ffffff', count: 22, size: 18, spread: 150, delay: 1000 },
      { kind: 'particles', at: 'target', shape: 'wisp', motion: 'rise', color: '#e6fbff', count: 10, size: 26, spread: 80, delay: 1100 },
      { kind: 'rings', at: 'target', color: '#ffffff', count: 2, size: 240, delay: 1050 },
    ],
  },
  Fighting: {
    physical: [
      { kind: 'aura', at: 'user', color: '#e0503a', size: 220, dur: 600 },
      { kind: 'impact', color: '#ff7a3d', size: 150, star: true, delay: 500 },
      { kind: 'impact', color: '#ff7a3d', size: 170, star: true, delay: 650 },
      { kind: 'impact', color: '#ffb36b', size: 190, star: true, delay: 800 },
      { kind: 'slash', color: '#e0503a', count: 2, angle: 35, cross: true, width: 8, delay: 700 },
      { kind: 'impact', color: '#ffffff', size: 240, star: true, delay: 950 },
      { kind: 'particles', at: 'target', shape: 'star', motion: 'burst', color: '#ffb36b', color2: '#ffffff', count: 16, size: 16, spread: 140, delay: 1000 },
    ],
    special: [
      { kind: 'particles', at: 'user', shape: 'dot', motion: 'converge', color: '#6b8cff', color2: '#ffffff', count: 20, size: 12, spread: 150 },
      { kind: 'orb', color: '#4d6bff', color2: '#ffffff', size: 120, delay: 600, dur: 600 },
      { kind: 'rings', at: 'target', color: '#6b8cff', count: 3, size: 240, delay: 1150 },
      { kind: 'impact', color: '#6b8cff', size: 260, delay: 1150 },
    ],
  },
  Poison: {
    physical: [
      { kind: 'particles', at: 'target', shape: 'bubble', motion: 'fall', color: '#b45fd6', color2: '#e0a8ff', count: 20, size: 18, spread: 90, delay: 300, dur: 900 },
      { kind: 'ground', color: '#a040c0', delay: 700, dur: 700 },
      { kind: 'particles', at: 'target', shape: 'drop', motion: 'spray', color: '#a040c0', color2: '#e0a8ff', count: 16, size: 14, spread: 120, delay: 1000 },
      { kind: 'impact', color: '#b45fd6', size: 220, delay: 1050 },
      { kind: 'screen', color: '#a040c0', mode: 'tint', delay: 900, dur: 600 },
    ],
    special: [
      { kind: 'particles', at: 'user', shape: 'bubble', motion: 'converge', color: '#b45fd6', count: 16, size: 16, spread: 140 },
      { kind: 'beam', color: '#a040c0', color2: '#e0a8ff', width: 42, wavy: true, delay: 550, dur: 800 },
      { kind: 'particles', at: 'target', shape: 'bubble', motion: 'burst', color: '#b45fd6', color2: '#e0a8ff', count: 22, size: 18, spread: 150, delay: 1000 },
      { kind: 'particles', at: 'target', shape: 'drop', motion: 'spray', color: '#a040c0', count: 14, size: 14, spread: 110, delay: 1050 },
      { kind: 'screen', color: '#a040c0', mode: 'tint', delay: 1000, dur: 500 },
    ],
  },
  Ground: {
    physical: [
      { kind: 'ground', color: '#c8a050', delay: 100, dur: 900 },
      { kind: 'crack', color: '#7a5a2a', delay: 600 },
      { kind: 'column', color: '#b07a3a', color2: '#e8c890', delay: 800 },
      { kind: 'particles', at: 'target', shape: 'rock', motion: 'burst', color: '#b07a3a', color2: '#6b4a2b', count: 18, size: 22, spread: 150, delay: 900 },
      { kind: 'impact', color: '#c8a050', size: 260, delay: 950 },
    ],
    special: [
      { kind: 'particles', at: 'user', shape: 'rock', motion: 'rise', color: '#b07a3a', color2: '#e8c890', count: 14, size: 18, spread: 90 },
      { kind: 'rings', at: 'target', color: '#c8a050', count: 3, size: 260, delay: 700, dur: 700 },
      { kind: 'ground', color: '#c8a050', delay: 900, dur: 700 },
      { kind: 'crack', color: '#7a5a2a', delay: 1000 },
      { kind: 'particles', at: 'target', shape: 'rock', motion: 'burst', color: '#b07a3a', color2: '#e8c890', count: 22, size: 22, spread: 160, delay: 1000 },
    ],
  },
  Flying: {
    physical: [
      { kind: 'particles', at: 'user', shape: 'feather', motion: 'rise', color: '#cfe0ff', color2: '#ffffff', count: 12, size: 18, spread: 70 },
      { kind: 'particles', at: 'target', shape: 'feather', motion: 'fall', color: '#cfe0ff', color2: '#ffffff', count: 14, size: 18, spread: 90, delay: 650 },
      { kind: 'slash', color: '#ffffff', count: 2, angle: 45, cross: true, width: 8, delay: 900 },
      { kind: 'impact', color: '#9ab8ff', size: 240, star: true, delay: 950 },
      { kind: 'rings', at: 'target', color: '#cfe0ff', count: 2, size: 240, delay: 1000 },
    ],
    special: [
      { kind: 'rings', at: 'path', color: '#cfe0ff', count: 5, size: 80, delay: 300, dur: 900 },
      { kind: 'particles', at: 'target', shape: 'wisp', motion: 'swirl', color: '#e6efff', count: 16, size: 24, spread: 110, delay: 900 },
      { kind: 'particles', at: 'target', shape: 'feather', motion: 'burst', color: '#cfe0ff', color2: '#ffffff', count: 16, size: 18, spread: 140, delay: 1000 },
      { kind: 'impact', color: '#9ab8ff', size: 250, delay: 1050 },
    ],
  },
  Psychic: {
    physical: [
      { kind: 'rings', at: 'target', color: '#ff5f9e', count: 3, size: 200, delay: 300, dur: 700 },
      { kind: 'particles', at: 'target', shape: 'gem', motion: 'converge', color: '#ff8fbf', color2: '#ffffff', count: 14, size: 14, spread: 140, delay: 500 },
      { kind: 'particles', at: 'target', shape: 'shard', motion: 'burst', color: '#ff5f9e', color2: '#ffd0e4', count: 20, size: 18, spread: 150, delay: 1000 },
      { kind: 'impact', color: '#ff5f9e', size: 230, star: true, delay: 1000 },
      { kind: 'screen', color: '#ff5f9e', mode: 'tint', delay: 900, dur: 500 },
    ],
    special: [
      { kind: 'aura', at: 'user', color: '#ff5f9e', size: 240, dur: 700 },
      { kind: 'beam', color: '#ff5f9e', color2: '#ffd0e4', width: 40, wavy: true, delay: 600, dur: 800 },
      { kind: 'rings', at: 'target', color: '#ff5f9e', count: 3, size: 250, rainbow: true, delay: 1000 },
      { kind: 'particles', at: 'target', shape: 'gem', motion: 'burst', color: '#ff8fbf', color2: '#ffffff', count: 20, size: 16, spread: 150, delay: 1050 },
    ],
  },
  Bug: {
    physical: [
      { kind: 'rings', at: 'target', color: '#a8c040', count: 4, size: 160, delay: 400, dur: 800 },
      { kind: 'slash', color: '#8aa82a', count: 3, angle: -20, width: 7, delay: 800 },
      { kind: 'impact', color: '#c8e060', size: 220, star: true, delay: 1000 },
      { kind: 'particles', at: 'target', shape: 'spark', motion: 'burst', color: '#a8c040', color2: '#e8ff9a', count: 16, size: 16, spread: 130, delay: 1000 },
    ],
    special: [
      { kind: 'orb', color: '#a8c040', color2: '#e8ff9a', size: 26, count: 6, gap: 70, arc: true, delay: 400, dur: 600 },
      { kind: 'particles', at: 'target', shape: 'spark', motion: 'swirl', color: '#a8c040', color2: '#e8ff9a', count: 18, size: 16, spread: 110, delay: 900 },
      { kind: 'impact', color: '#a8c040', size: 240, delay: 1100 },
      { kind: 'rings', at: 'target', color: '#c8e060', count: 2, size: 230, delay: 1100 },
    ],
  },
  Rock: {
    physical: [
      { kind: 'particles', at: 'target', shape: 'rock', motion: 'fall', color: '#b8a038', color2: '#7a6a2a', count: 10, size: 42, spread: 70, delay: 300 },
      { kind: 'impact', color: '#b8a038', size: 280, delay: 950 },
      { kind: 'crack', color: '#6b5a2a', delay: 950 },
      { kind: 'particles', at: 'target', shape: 'rock', motion: 'burst', color: '#b8a038', color2: '#7a6a2a', count: 18, size: 20, spread: 160, delay: 1000 },
    ],
    special: [
      { kind: 'orb', color: '#b8a038', color2: '#e8d890', size: 42, shape: 'rock', count: 5, gap: 90, arc: true, delay: 400, dur: 600 },
      { kind: 'particles', at: 'target', shape: 'rock', motion: 'burst', color: '#b8a038', color2: '#e8d890', count: 20, size: 22, spread: 150, delay: 1100 },
      { kind: 'impact', color: '#d0b850', size: 250, delay: 1100 },
      { kind: 'rings', at: 'target', color: '#b8a038', count: 2, size: 230, delay: 1150 },
    ],
  },
  Ghost: {
    physical: [
      { kind: 'screen', color: '#2a1840', mode: 'dim', delay: 200, dur: 1300 },
      { kind: 'particles', at: 'target', shape: 'wisp', motion: 'converge', color: '#8a5cc8', color2: '#c8a8ff', count: 18, size: 24, spread: 160, delay: 300, dur: 800 },
      { kind: 'jaws', color: '#8a5cc8', delay: 900 },
      { kind: 'impact', color: '#8a5cc8', size: 240, delay: 1000 },
      { kind: 'particles', at: 'target', shape: 'crescent', motion: 'burst', color: '#c8a8ff', count: 12, size: 18, spread: 140, delay: 1000 },
    ],
    special: [
      { kind: 'particles', at: 'user', shape: 'wisp', motion: 'rise', color: '#8a5cc8', color2: '#c8a8ff', count: 14, size: 22, spread: 80 },
      { kind: 'orb', color: '#5b3e8f', color2: '#c8a8ff', size: 90, shape: 'crescent', delay: 600, dur: 650 },
      { kind: 'rings', at: 'target', color: '#8a5cc8', count: 3, size: 240, delay: 1150 },
      { kind: 'particles', at: 'target', shape: 'wisp', motion: 'burst', color: '#c8a8ff', color2: '#8a5cc8', count: 18, size: 22, spread: 150, delay: 1150 },
    ],
  },
  Dragon: {
    physical: [
      { kind: 'aura', at: 'user', color: '#6f35fc', size: 260, dur: 700 },
      { kind: 'rings', at: 'path', color: '#8f6bff', count: 3, size: 90, delay: 500, dur: 500 },
      { kind: 'slash', color: '#c9b8ff', count: 2, angle: 30, cross: true, width: 9, delay: 950 },
      { kind: 'impact', color: '#6f35fc', size: 260, star: true, delay: 1000 },
      { kind: 'particles', at: 'target', shape: 'scale', motion: 'burst', color: '#8f6bff', color2: '#c9b8ff', count: 20, size: 18, spread: 150, delay: 1000 },
    ],
    special: [
      { kind: 'particles', at: 'user', shape: 'scale', motion: 'converge', color: '#8f6bff', color2: '#c9b8ff', count: 18, size: 16, spread: 150 },
      { kind: 'beam', color: '#6f35fc', color2: '#c9b8ff', width: 50, delay: 600, dur: 800 },
      { kind: 'particles', at: 'target', shape: 'scale', motion: 'burst', color: '#8f6bff', color2: '#c9b8ff', count: 22, size: 18, spread: 160, delay: 1050 },
      { kind: 'impact', color: '#6f35fc', size: 280, delay: 1100 },
    ],
  },
  Dark: {
    physical: [
      { kind: 'particles', at: 'target', shape: 'dot', motion: 'converge', color: '#3a2f45', color2: '#7b5cff', count: 20, size: 14, spread: 180, delay: 300, dur: 800 },
      { kind: 'slash', color: '#7b5cff', count: 2, angle: -35, cross: true, width: 8, delay: 900 },
      { kind: 'impact', color: '#5a4870', size: 240, delay: 1000 },
      { kind: 'particles', at: 'target', shape: 'crescent', motion: 'burst', color: '#7b5cff', color2: '#3a2f45', count: 12, size: 18, spread: 140, delay: 1000 },
    ],
    special: [
      { kind: 'screen', color: '#000000', mode: 'dim', delay: 300, dur: 1200 },
      { kind: 'rings', at: 'target', color: '#7b5cff', count: 4, size: 280, delay: 400, dur: 900 },
      { kind: 'particles', at: 'target', shape: 'wisp', motion: 'converge', color: '#3a2f45', color2: '#7b5cff', count: 20, size: 22, spread: 180, delay: 500, dur: 800 },
      { kind: 'orb', color: '#1c1c28', color2: '#7b5cff', size: 140, delay: 700, dur: 500 },
      { kind: 'impact', color: '#7b5cff', size: 300, delay: 1150 },
    ],
  },
  Steel: {
    physical: [
      { kind: 'particles', at: 'user', shape: 'spark', motion: 'swirl', color: '#d0d0e0', color2: '#ffffff', count: 14, size: 14, spread: 70 },
      { kind: 'slash', color: '#d0d0e0', count: 4, angle: 30, width: 6, delay: 800 },
      { kind: 'impact', color: '#e0e0f0', size: 240, star: true, delay: 950 },
      { kind: 'particles', at: 'target', shape: 'spark', motion: 'burst', color: '#d0d0e0', color2: '#ffffff', count: 18, size: 16, spread: 140, delay: 950 },
    ],
    special: [
      { kind: 'aura', at: 'user', color: '#d0d0e0', size: 230, dur: 600 },
      { kind: 'beam', color: '#b8b8d0', color2: '#ffffff', width: 44, delay: 550, dur: 800 },
      { kind: 'particles', at: 'target', shape: 'gem', motion: 'burst', color: '#d0d0e0', color2: '#ffffff', count: 20, size: 16, spread: 150, delay: 1000 },
      { kind: 'impact', color: '#e0e0f0', size: 260, delay: 1100 },
    ],
  },
  Fairy: {
    physical: [
      { kind: 'particles', at: 'user', shape: 'star', motion: 'swirl', color: '#ff9ff3', color2: '#ffffff', count: 12, size: 14, spread: 70 },
      { kind: 'rings', at: 'path', color: '#ff9ff3', count: 3, size: 80, delay: 400, dur: 550 },
      { kind: 'impact', color: '#ff9ff3', size: 240, star: true, delay: 950 },
      { kind: 'particles', at: 'target', shape: 'heart', motion: 'burst', color: '#ff9ff3', color2: '#ffffff', count: 18, size: 16, spread: 140, delay: 950 },
      { kind: 'particles', at: 'target', shape: 'star', motion: 'burst', color: '#ffe066', count: 14, size: 14, spread: 120, delay: 1000 },
    ],
    special: [
      { kind: 'particles', at: 'user', shape: 'star', motion: 'converge', color: '#ff9ff3', color2: '#ffffff', count: 18, size: 14, spread: 150 },
      { kind: 'beam', color: '#ff9ff3', color2: '#ffffff', width: 40, wavy: true, delay: 600, dur: 800 },
      { kind: 'particles', at: 'target', shape: 'heart', motion: 'burst', color: '#ff9ff3', color2: '#ffffff', count: 20, size: 16, spread: 150, delay: 1050 },
      { kind: 'rings', at: 'target', color: '#ff9ff3', count: 2, size: 240, rainbow: true, delay: 1050 },
    ],
  },
};

/** Damaging Z-Move of a type, physical or special (see Z_MOVES). */
export function zMoveSpec(type: string, category: 'Physical' | 'Special' = 'Physical'): FxSpec {
  const t = asType(type);
  const c = typeColor(t).bg;
  return {
    shake: 'strong',
    layers: [
      { kind: 'screen', color: '#000000', mode: 'dim', dur: 1700 },
      ...Z_MOVES[t][category === 'Special' ? 'special' : 'physical'],
      { kind: 'screen', color: c, mode: 'flash', delay: 1080, dur: 380 },
    ],
  };
}

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
      return zMoveSpec(t, fx.category === 'Special' ? 'Special' : 'Physical');
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
