import type { FxSpec } from './catalog';

export type Side = 'p1' | 'p2';
/** A field position: side + active slot (a = left/first, b = right/second; Singles only uses a). */
export type Pos = 'p1a' | 'p1b' | 'p2a' | 'p2b';
/** ground: y of the line the Pokémon stands on, when known. */
export interface Point { x: number; y: number; ground?: number }

export const posKey = (side: Side, slot = 0): Pos => `${side}${slot === 1 ? 'b' : 'a'}` as Pos;
export const sideOfPos = (pos: Pos): Side => pos.slice(0, 2) as Side;
export const foeSide = (side: Side): Side => (side === 'p1' ? 'p2' : 'p1');
/** Positions in use: a only in Singles, a and b in Doubles. */
export const positionsOf = (side: Side, doubles: boolean): Pos[] => (doubles ? [posKey(side, 0), posKey(side, 1)] : [posKey(side, 0)]);

/**
 * Sprite centres as fractions of the stage, for when a sprite hasn't been
 * measured (kept in sync with the .spot / .at-* positions in index.css).
 * Doubles: the player's a/b stand left to right at the bottom; the foe's b
 * stands left of its a at the top, facing the player's a (as in Showdown).
 */
const SINGLES: Record<Pos, Point> = { p1a: { x: 0.24, y: 0.68 }, p1b: { x: 0.24, y: 0.68 }, p2a: { x: 0.74, y: 0.32 }, p2b: { x: 0.74, y: 0.32 } };
const DOUBLES: Record<Pos, Point> = { p1a: { x: 0.17, y: 0.72 }, p1b: { x: 0.41, y: 0.75 }, p2a: { x: 0.85, y: 0.34 }, p2b: { x: 0.63, y: 0.31 } };

export const spotPoint = (pos: Pos, w: number, h: number, doubles = false): Point => {
  const f = (doubles ? DOUBLES : SINGLES)[pos];
  return { x: f.x * w, y: f.y * h };
};

/** When a spec's screen shake should start: at its first impact-like layer. */
export function shakeDelay(spec: FxSpec): number {
  const hits = spec.layers.filter(l => l.kind === 'impact' || l.kind === 'crack' || l.kind === 'column' || l.kind === 'bolt');
  return hits.length ? Math.min(...hits.map(l => l.delay ?? 0)) : 250;
}
