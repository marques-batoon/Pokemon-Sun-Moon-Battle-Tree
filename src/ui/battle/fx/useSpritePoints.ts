import { useLayoutEffect, useState, type RefObject } from 'react';
import type { Point, Pos } from './geometry';

const same = (a: Point | undefined, b: Point | undefined) =>
  a === b || (!!a && !!b && Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1 && Math.abs((a.ground ?? 0) - (b.ground ?? 0)) < 1);
const POSITIONS: Pos[] = ['p1a', 'p1b', 'p2a', 'p2b'];

/**
 * Where each Pokémon's sprite is on the stage (centre and ground line), by
 * field position, measured from the rendered sprites whenever `trigger`
 * changes. Positions without a visible sprite are left out, and effects fall
 * back to the default spots.
 */
export function useSpritePoints(stageRef: RefObject<HTMLElement | null>, trigger: unknown): Partial<Record<Pos, Point>> {
  const [points, setPoints] = useState<Partial<Record<Pos, Point>>>({});
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const base = stage.getBoundingClientRect();
    const next: Partial<Record<Pos, Point>> = {};
    for (const pos of POSITIONS) {
      const spot = stage.querySelector(`.spot[data-pos="${pos}"]`);
      if (!spot) continue;
      // A Substitute doll stands in for the Pokémon (unless it has stepped aside for the Pokémon's own move).
      const el = spot.querySelector('.sub-doll:not(:has(.aside))') ?? spot.querySelector('.poke-sprite');
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      // Sprites have empty space above the Pokémon, so its visual centre sits a little low.
      next[pos] = { x: r.left - base.left + r.width / 2, y: r.top - base.top + r.height * 0.56, ground: r.bottom - base.top - 2 };
    }
    setPoints(prev => (POSITIONS.every(p => same(prev[p], next[p])) ? prev : next));
  }, [stageRef, trigger]);
  return points;
}
