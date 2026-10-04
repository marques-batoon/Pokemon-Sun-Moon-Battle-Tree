import type { CSSProperties } from 'react';
import { SHIELD_CONDITIONS, type BattleAnimation } from '../../client/playback';
import { SHIELD_COLORS } from './fx/catalog';
import { foeSide, positionsOf, spotPoint, type Point, type Pos, type Side } from './fx/geometry';

interface Props {
  side: Side;
  /** Active lasting screens on this side (reflect, lightscreen, auroraveil, safeguard, mist). */
  conditions: string[];
  anim: BattleAnimation | null;
  size: { w: number; h: number };
  points: Partial<Record<Pos, Point>>;
  doubles?: boolean;
}

/**
 * Lasting screens as translucent barriers in front of a side's Pokémon:
 * Reflect white, Light Screen yellow, Aurora Veil light blue (Safeguard
 * lilac, Mist pale green). A screen that just wore off fades away.
 */
export function ShieldWalls({ side, conditions, anim, size, points, doubles = false }: Props) {
  if (!size.w || !size.h) return null;
  const walls = conditions.map(id => ({ id, ending: false }));
  if (anim?.kind === 'side-end' && anim.side === side && anim.condition && !conditions.includes(anim.condition)) {
    walls.push({ id: anim.condition, ending: true });
  }
  if (!walls.length) return null;
  // In Doubles the screen covers both Pokémon: stand in front of the middle of the pair.
  const centre = (s: Side): Point => {
    const ps = positionsOf(s, doubles).map(p => points[p] ?? spotPoint(p, size.w, size.h, doubles));
    return { x: ps.reduce((a, p) => a + p.x, 0) / ps.length, y: ps.reduce((a, p) => a + p.y, 0) / ps.length };
  };
  const me = centre(side);
  const them = centre(foeSide(side));
  const k = Math.min(1.7, Math.max(0.7, size.w / 600));
  return (
    <>
      {walls.map(wall => {
        // Each kind of screen has its own slot, a little further out than the one before, so stacked
        // screens stay visible and none of them moves when another goes up or wears off.
        const i = Math.max(0, (SHIELD_CONDITIONS as readonly string[]).indexOf(wall.id));
        const t = (side === 'p1' ? 0.33 : 0.27) + i * 0.045;
        const style = {
          '--x': `${me.x + (them.x - me.x) * t}px`,
          '--y': `${me.y + (them.y - me.y) * t}px`,
          '--h': `${(side === 'p1' ? 128 : 104) * k - i * 6}px`,
          '--wmul': doubles ? 1.8 : 1,
          '--k': k,
          '--c': SHIELD_COLORS[wall.id] ?? '#ffffff',
        } as CSSProperties;
        return <span key={wall.id} className={`shield-wall shield-${wall.id} ${wall.ending ? 'ending' : ''}`} style={style} aria-hidden />;
      })}
    </>
  );
}
