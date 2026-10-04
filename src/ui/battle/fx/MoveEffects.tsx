// Renders a catalog FxSpec as absolutely positioned elements on the stage.
// Positions are computed in pixels from the stage size; timing and motion live
// in CSS (index.css, "Move effects"), driven by per-element custom properties.
import { Fragment, type CSSProperties, type ReactNode } from 'react';
import type { Anchor, FxSpec, Layer, Shape } from './catalog';
import { foeSide, posKey, sideOfPos, spotPoint, type Point, type Pos } from './geometry';

type Vars = Record<`--${string}`, string | number>;
const px = (n: number) => `${Math.round(n * 10) / 10}px`;
const ms = (n: number | undefined) => `${Math.round(n ?? 0)}ms`;
const deg = (n: number) => `${Math.round(n * 10) / 10}deg`;
const css = (v: Vars) => v as CSSProperties;

/** Deterministic pseudo-random in [0, 1) so renders stay pure and repeatable. */
function rand(seed: number, i: number, salt: number): number {
  const s = Math.sin(seed * 12.9898 + i * 78.233 + salt * 37.719) * 43758.5453;
  return s - Math.floor(s);
}

/** k: size multiplier so effects keep their proportions on wide and narrow stages. */
interface Ctx { user: Point; target: Point; seed: number; w: number; h: number; k: number }

function Particles({ layer, ctx }: { layer: Extract<Layer, { kind: 'particles' }>; ctx: Ctx }) {
  const at = ctx[layer.at];
  const items: ReactNode[] = [];
  const dur = layer.dur ?? 650;
  const spread = layer.spread * ctx.k;
  for (let i = 0; i < layer.count; i++) {
    const r1 = rand(ctx.seed, i, 1), r2 = rand(ctx.seed, i, 2), r3 = rand(ctx.seed, i, 3);
    const angle = (i / layer.count) * Math.PI * 2 + r1 * 0.7;
    const dist = spread * (0.55 + r2 * 0.45);
    let sx = 0, sy = 0, tx = 0, ty = 0, mx = 0, my = 0;
    switch (layer.motion) {
      case 'burst': tx = Math.cos(angle) * dist; ty = Math.sin(angle) * dist; break;
      case 'converge': sx = Math.cos(angle) * dist * 1.3; sy = Math.sin(angle) * dist * 1.3; break;
      case 'rise': sx = tx = (r1 - 0.5) * spread * 1.6; sy = spread * (0.2 + r3 * 0.4); ty = -spread * (0.9 + r2 * 0.6); break;
      case 'fall': sx = tx = (r1 - 0.5) * spread * 1.6; sy = -ctx.h * 0.35 - r2 * 40; ty = (r3 - 0.3) * spread * 0.4; break;
      case 'spray': {
        const a = -Math.PI / 2 + (r1 - 0.5) * 2.2;
        mx = Math.cos(a) * dist * 0.8; my = Math.sin(a) * dist * 0.9;
        tx = Math.cos(a) * dist * 1.1; ty = my + dist * 0.7;
        break;
      }
      case 'swirl': break;
    }
    const color = layer.color2 && i % 2 ? layer.color2 : layer.color;
    const size = layer.size * ctx.k * (0.7 + r3 * 0.6);
    items.push(
      <span
        key={i}
        className={`fxl fx-p m-${layer.motion}`}
        style={css({
          '--x': px(at.x), '--y': px(at.y), '--sx': px(sx), '--sy': px(sy), '--tx': px(tx), '--ty': px(ty), '--mx': px(mx), '--my': px(my),
          '--a0': deg((angle * 180) / Math.PI), '--r': px(dist * 0.8), '--rot': deg(r2 * 360 - 180),
          '--s': px(size), '--c': color, '--delay': ms((layer.delay ?? 0) + r3 * 90), '--dur': ms(dur * (0.85 + r1 * 0.3)),
        })}
      >
        <span className={`shape sh-${layer.shape}`} />
      </span>,
    );
  }
  return <>{items}</>;
}

function Orbs({ layer, ctx }: { layer: Extract<Layer, { kind: 'orb' }>; ctx: Ctx }) {
  const count = layer.count ?? 1;
  const dx = ctx.target.x - ctx.user.x, dy = ctx.target.y - ctx.user.y;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const shape: Shape = layer.shape ?? 'dot';
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const jitter = count > 1 ? (rand(ctx.seed, i, 7) - 0.5) * 36 * ctx.k : 0;
        return (
          <span
            key={i}
            className={`fxl fx-orb2 ${layer.arc ? 'arc' : ''} ${shape === 'dot' ? 'glow' : ''}`}
            style={css({
              '--x': px(ctx.user.x), '--y': px(ctx.user.y + jitter), '--dx': px(dx), '--dy': px(dy), '--lift': px(-Math.min(90, Math.abs(dx) * 0.25)),
              '--s': px(layer.size * ctx.k), '--c': layer.color, '--c2': layer.color2 ?? '#ffffff', '--ang': deg(angle),
              '--delay': ms((layer.delay ?? 0) + i * (layer.gap ?? 80)), '--dur': ms(layer.dur ?? 500),
            })}
          >
            <span className={`shape sh-${shape}`} />
          </span>
        );
      })}
    </>
  );
}

function renderLayer(layer: Layer, i: number, ctx: Ctx): ReactNode {
  const { user, target } = ctx;
  const delay = ms(layer.delay);
  const anchor = (a: Anchor) => ctx[a];
  switch (layer.kind) {
    case 'particles': return <Particles key={i} layer={layer} ctx={ctx} />;
    case 'orb': return <Orbs key={i} layer={layer} ctx={ctx} />;
    case 'beam': {
      const dx = target.x - user.x, dy = target.y - user.y;
      return (
        <span key={i} className={`fxl fx-beam ${layer.wavy ? 'wavy' : ''}`} style={css({
          '--x': px(user.x), '--y': px(user.y), '--len': px(Math.hypot(dx, dy)), '--ang': deg((Math.atan2(dy, dx) * 180) / Math.PI),
          '--w': px(layer.width * ctx.k), '--c': layer.color, '--c2': layer.color2 ?? '#ffffff', '--delay': delay, '--dur': ms(layer.dur ?? 600),
        })} />
      );
    }
    case 'bolt': {
      // Zigzag from the top of the stage down to the target.
      const steps = 7;
      const pts: string[] = [];
      for (let s = 0; s <= steps; s++) {
        const y = (target.y * s) / steps;
        const x = s === 0 || s === steps ? 0 : (s % 2 ? 1 : -1) * (10 + rand(ctx.seed, s, 9) * 14);
        pts.push(`${x + 40},${y}`);
      }
      return (
        <svg key={i} className="fxl fx-bolt" width={80} height={Math.max(1, target.y)} style={css({ '--x': px(target.x), '--y': '0px', '--c': layer.color, '--delay': delay, '--dur': '450ms' })} aria-hidden>
          <polyline className="glow" points={pts.join(' ')} />
          <polyline className="core" points={pts.join(' ')} />
        </svg>
      );
    }
    case 'rings': {
      const dur = layer.dur ?? 520;
      if (layer.at === 'path') {
        const dx = target.x - user.x, dy = target.y - user.y;
        return Array.from({ length: layer.count }, (_, r) => (
          <span key={`${i}-${r}`} className="fxl fx-ring travel" style={css({
            '--x': px(user.x), '--y': px(user.y), '--dx': px(dx), '--dy': px(dy), '--s': px(layer.size * ctx.k), '--c': layer.color,
            '--delay': ms((layer.delay ?? 0) + (r * dur) / (layer.count + 1)), '--dur': ms(dur * 0.75),
          })} />
        ));
      }
      const p = anchor(layer.at);
      return Array.from({ length: layer.count }, (_, r) => (
        <span key={`${i}-${r}`} className={`fxl fx-ring ${layer.rainbow ? 'rainbow' : ''}`} style={css({
          '--x': px(p.x), '--y': px(p.y), '--s': px(layer.size * ctx.k), '--c': layer.color,
          '--delay': ms((layer.delay ?? 0) + r * 140), '--dur': ms(dur),
        })} />
      ));
    }
    case 'slash':
      return Array.from({ length: layer.count }, (_, s) => {
        const angle = layer.cross ? (s % 2 ? -layer.angle : layer.angle) : layer.angle;
        const off = layer.cross ? 0 : (s - (layer.count - 1) / 2) * 22 * ctx.k;
        return (
          <span key={`${i}-${s}`} className="fxl fx-slash" style={css({
            '--x': px(target.x), '--y': px(target.y), '--ang': deg(angle), '--off': px(off), '--w': px((layer.width ?? 5) * ctx.k), '--c': layer.color,
            '--delay': ms((layer.delay ?? 0) + s * 70), '--dur': '360ms',
          })} />
        );
      });
    case 'impact': {
      const p = anchor(layer.at ?? 'target');
      return (
        <span key={i} className={`fxl fx-impact2 ${layer.star ? 'star' : ''}`} style={css({
          '--x': px(p.x), '--y': px(p.y), '--s': px(layer.size * ctx.k), '--c': layer.color, '--delay': delay, '--dur': '380ms',
        })} />
      );
    }
    case 'aura': {
      const p = anchor(layer.at);
      return <span key={i} className="fxl fx-aura2" style={css({ '--x': px(p.x), '--y': px(p.y), '--s': px(layer.size * ctx.k), '--c': layer.color, '--delay': delay, '--dur': ms(layer.dur ?? 600) })} />;
    }
    case 'shield':
      return <span key={i} className={`fxl fx-shield ${layer.spiky ? 'spiky' : ''}`} style={css({ '--x': px(user.x), '--y': px(user.y), '--c': layer.color, '--delay': delay, '--dur': '780ms' })} />;
    case 'wall': {
      // Just in front of the user, towards the opponent.
      const x = user.x + (target.x - user.x) * 0.22, y = user.y + (target.y - user.y) * 0.22;
      return <span key={i} className="fxl fx-wall" style={css({ '--x': px(x), '--y': px(y), '--c': layer.color, '--delay': delay, '--dur': '780ms' })} />;
    }
    case 'arrows': {
      const p = anchor(layer.at);
      return [-28, 0, 28].map((ox, a) => (
        <span key={`${i}-${a}`} className={`fxl fx-arrow ${layer.dir}`} style={css({
          '--x': px(p.x + ox * ctx.k), '--y': px(p.y + (a === 1 ? -10 : 8) * ctx.k), '--c': layer.color, '--delay': ms((layer.delay ?? 0) + a * 90), '--dur': '520ms',
        })} />
      ));
    }
    case 'crack':
      return (
        <svg key={i} className="fxl fx-crack" width={180} height={60} viewBox="0 0 180 60" style={css({ '--x': px(target.x), '--y': px(target.ground ?? target.y + 52 * ctx.k), '--c': layer.color, '--delay': delay, '--dur': '700ms' })} aria-hidden>
          {['90,30 70,22 52,30 30,18 8,26', '90,30 112,38 128,28 150,40 172,32', '70,22 62,8', '128,28 138,12', '52,30 46,48', '112,38 118,54'].map(p => (
            <polyline key={p} points={p} pathLength={1} />
          ))}
        </svg>
      );
    case 'jaws':
      return (
        <span key={i} className="fxl fx-jaws" style={css({ '--x': px(target.x), '--y': px(target.y), '--c': layer.color, '--delay': delay, '--dur': '480ms' })}>
          <span className="fang top" /><span className="fang bottom" />
        </span>
      );
    case 'column':
      return <span key={i} className="fxl fx-column" style={css({ '--x': px(target.x), '--y': px(target.ground ?? target.y + 50 * ctx.k), '--c': layer.color, '--c2': layer.color2 ?? '#ffffff', '--delay': delay, '--dur': '650ms' })} />;
    case 'screen':
      return <span key={i} className={`fxl fx-screen ${layer.mode}`} style={css({ '--c': layer.color, '--delay': delay, '--dur': ms(layer.dur ?? 400) })} />;
    case 'ground':
      // The ground starts where the sky ends (46% down, as in the .stage background).
      return <span key={i} className="fxl fx-ground" style={css({ '--x': '0px', '--y': px(ctx.h * 0.46), '--c': layer.color, '--delay': delay, '--dur': ms(layer.dur ?? 700) })} />;
  }
}

interface Props {
  spec: FxSpec;
  /** Position of the Pokémon acting (the "user" anchor). */
  user: Pos;
  /** Positions targeted; target-side layers are drawn on each (Doubles spread moves). Empty: the opposing a slot. */
  targets?: Pos[];
  size: { w: number; h: number };
  /** Measured sprite positions; positions left out use the default spots. */
  points?: Partial<Record<Pos, Point>>;
  /** Double Battle layout (default spots differ). */
  doubles?: boolean;
  seed: number;
}

/** Layers drawn at or towards the target (once per target); the rest are drawn once, at the user or on the whole stage. */
function aimsAtTarget(l: Layer): boolean {
  switch (l.kind) {
    case 'orb': case 'beam': case 'bolt': case 'slash': case 'jaws': case 'crack': case 'column': return true;
    case 'impact': return (l.at ?? 'target') === 'target';
    case 'particles': case 'aura': case 'arrows': return l.at === 'target';
    case 'rings': return l.at !== 'user';
    default: return false;
  }
}

/** One animation's effect layers. Mount with a fresh key per event so CSS animations restart. */
export function MoveEffects({ spec, user, targets = [], size, points = {}, doubles = false, seed }: Props) {
  if (!size.w || !size.h) return null;
  const others = targets.filter(t => t !== user);
  const aims = others.length ? others : [posKey(foeSide(sideOfPos(user)))];
  const k = Math.min(1.7, Math.max(0.7, size.w / 600));
  const at = (p: Pos) => points[p] ?? spotPoint(p, size.w, size.h, doubles);
  const ctxFor = (target: Pos, i: number): Ctx => ({ user: at(user), target: at(target), seed: seed + i * 17, w: size.w, h: size.h, k });
  const style = { '--k': k } as CSSProperties;
  // Dimming goes behind the sprites (the Pokémon stay lit); everything else is drawn over them.
  const isBack = (l: Layer) => l.kind === 'screen' && l.mode === 'dim';
  const front = spec.layers.filter(l => !isBack(l));
  return (
    <>
      <div className="move-fx back" style={style} aria-hidden>{spec.layers.filter(isBack).map((l, i) => renderLayer(l, i, ctxFor(aims[0], 0)))}</div>
      <div className="move-fx" style={style} aria-hidden>
        {front.map((l, i) => (aimsAtTarget(l) ? null : renderLayer(l, i, ctxFor(aims[0], 0))))}
        {aims.map((target, t) => (
          <Fragment key={target}>{front.map((l, i) => (aimsAtTarget(l) ? renderLayer(l, i, ctxFor(target, t)) : null))}</Fragment>
        ))}
      </div>
    </>
  );
}
