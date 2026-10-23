// Renders a catalog FxSpec as absolutely positioned elements on the stage.
// Positions are computed in pixels from the stage size; timing and motion live
// in CSS (index.css, "Move effects"), driven by per-element custom properties.
import { Fragment, type CSSProperties, type ReactNode } from 'react';
import type { Anchor, FxSpec, Layer, Shape } from './catalog';
import { foeSide, HORIZON, posKey, sideOfPos, spotPoint, type Point, type Pos } from './geometry';
import { itemIconStyle } from '../../sprites';

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

const GLYPHS = '0123456789ABCDEF';

/** Streams of digital code (hex and binary) rising in columns around a spot. */
function CodeStreams({ layer, ctx }: { layer: Extract<Layer, { kind: 'code' }>; ctx: Ctx }) {
  const at = ctx[layer.at];
  const spread = layer.spread * ctx.k;
  const dur = layer.dur ?? 1400;
  return (
    <>
      {Array.from({ length: layer.columns }, (_, c) => {
        const r1 = rand(ctx.seed, c, 11), r2 = rand(ctx.seed, c, 12), r3 = rand(ctx.seed, c, 13);
        const x = at.x + ((layer.columns > 1 ? c / (layer.columns - 1) : 0.5) - 0.5) * spread * 2 + (r1 - 0.5) * 14 * ctx.k;
        const text = Array.from({ length: 7 + Math.floor(r2 * 5) }, (_, g) => GLYPHS[Math.floor(rand(ctx.seed, c * 31 + g, 14) * (r3 < 0.5 ? 2 : 16))]).join('');
        return (
          <span key={c} className="fxl fx-code" style={css({
            '--x': px(x), '--y': px(at.y + (r2 - 0.3) * 40 * ctx.k), '--c': layer.color,
            '--delay': ms((layer.delay ?? 0) + r3 * 450), '--dur': ms(dur * (0.75 + r1 * 0.4)),
          })}>{text}</span>
        );
      })}
    </>
  );
}

function Orbs({ layer, ctx }: { layer: Extract<Layer, { kind: 'orb' }>; ctx: Ctx }) {
  const count = layer.count ?? 1;
  // Through the target: on past it by two-thirds of the way again. Reverse: from the target back to the user.
  const far = layer.through ? 1.65 : 1;
  // From beyond: where a throw that went through the target ended up (that same two-thirds further on), back to it.
  const beyond = { x: ctx.target.x + (ctx.target.x - ctx.user.x) * 0.65, y: ctx.target.y + (ctx.target.y - ctx.user.y) * 0.65 };
  const [from, to] = layer.fromBeyond ? [beyond, ctx.target] : layer.reverse ? [ctx.target, ctx.user] : [ctx.user, ctx.target];
  const dx = (to.x - from.x) * far, dy = (to.y - from.y) * far;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const shape: Shape = layer.shape ?? 'dot';
  // A windup (Gaia Force): grown above the user's head, then pulled back over it, away from the target; kept on the stage.
  const s = layer.size * ctx.k;
  const rise = -Math.max(0, Math.min(s * 0.6, from.y - s / 2 - 6));
  const back = Math.max(s * 0.35 - from.x, Math.min(ctx.w - s * 0.35 - from.x, -dx * 0.12));
  const lift = -Math.max(0, Math.min(s * 0.15, from.y + rise - s / 2 - 6));
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const jitter = count > 1 ? (rand(ctx.seed, i, 7) - 0.5) * 36 * ctx.k : 0;
        return (
          <span
            key={i}
            className={`fxl fx-orb2 ${layer.arc ? 'arc' : ''} ${layer.through ? 'through' : ''} ${layer.fromBeyond ? 'from-beyond' : ''} ${layer.spin ? 'spin' : ''} ${layer.windup ? 'windup' : ''} ${shape === 'dot' ? 'glow' : ''}`}
            style={css({
              '--x': px(from.x), '--y': px(from.y + jitter), '--dx': px(dx), '--dy': px(dy), '--lift': px(-Math.min(90, Math.abs(dx) * 0.25)),
              ...(layer.windup ? { '--rise': px(rise), '--bx': px(back), '--by': px(lift) } : {}),
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
      // Zigzag from the top of the stage down to the target (or the user).
      const at = layer.at === 'user' ? user : target;
      const steps = 7;
      const pts: string[] = [];
      for (let s = 0; s <= steps; s++) {
        const y = (at.y * s) / steps;
        const x = s === 0 || s === steps ? 0 : (s % 2 ? 1 : -1) * (10 + rand(ctx.seed, s, 9) * 14);
        pts.push(`${x + 40},${y}`);
      }
      return (
        <svg key={i} className="fxl fx-bolt" width={80} height={Math.max(1, at.y)} style={css({ '--x': px(at.x), '--y': '0px', '--c': layer.color, '--delay': delay, '--dur': '450ms' })} aria-hidden>
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
    case 'column': {
      const at = layer.at === 'user' ? user : target;
      return <span key={i} className="fxl fx-column" style={css({ '--x': px(at.x), '--y': px(at.ground ?? at.y + 50 * ctx.k), '--c': layer.color, '--c2': layer.color2 ?? '#ffffff', '--delay': delay, '--dur': '650ms' })} />;
    }
    case 'screen':
      return <span key={i} className={`fxl fx-screen ${layer.mode}`} style={css({ '--c': layer.color, '--delay': delay, '--dur': ms(layer.dur ?? 400) })} />;
    case 'ground':
      // The ground starts where the sky ends (the horizon of every battle background).
      return <span key={i} className="fxl fx-ground" style={css({ '--x': '0px', '--y': px(ctx.h * HORIZON), '--c': layer.color, '--delay': delay, '--dur': ms(layer.dur ?? 700) })} />;
    case 'datagrid':
      return <span key={i} className="fxl fx-datagrid" style={css({ '--c': layer.color, '--delay': delay, '--dur': ms(layer.dur ?? 2000) })} />;
    case 'code': return <CodeStreams key={i} layer={layer} ctx={ctx} />;
    case 'wireframe': {
      const p = anchor(layer.at);
      return (
        <span key={i} className="fxl fx-wire" style={css({ '--x': px(p.x), '--y': px(p.y), '--s': px(layer.size * ctx.k), '--c': layer.color, '--delay': delay, '--dur': ms(layer.dur ?? 1500) })}>
          <span className="wire lon" /><span className="wire lon two" /><span className="wire lon three" /><span className="wire lat" /><span className="wire lat two" />
        </span>
      );
    }
    case 'label': {
      // Over the Pokémon, or under its feet when there's no room above (the opponents near the top of the stage).
      // A critical hit's text stays over the Pokémon (over its head, or as high as the stage allows).
      const p = anchor(layer.at);
      const above = p.y - 70 * ctx.k;
      const y = layer.variant === 'crit'
        ? Math.max(p.y - (p.size ?? 110 * ctx.k) * 0.42, 12 * ctx.k)
        : above >= 24 * ctx.k ? above : (p.ground ?? p.y + 60 * ctx.k) + 16 * ctx.k;
      return <span key={i} className={`fxl fx-label${layer.variant ? ` ${layer.variant}` : ''}`} style={css({ '--x': px(p.x), '--y': px(y), '--c': layer.color, '--delay': delay, '--dur': ms(layer.dur ?? 1000) })}>{layer.text}</span>;
    }
    case 'balloon': {
      // Tied to the Pokémon, beside its head on the side away from the foe (the opponents face left, yours right).
      const p = anchor(layer.at);
      const h = p.size ?? 110 * ctx.k;
      const s = Math.min(30 * ctx.k, h * 0.3);
      const away = p.x > ctx.w / 2 ? 1 : -1;
      const y = Math.max(p.y - h * 0.42, s * 0.75 + 4);
      return (
        <span key={i} className={`fxl fx-balloon${layer.pop ? ' pop' : ''}`} style={css({
          '--x': px(p.x + away * (h * 0.24 + s * 0.3)), '--y': px(y), '--s': px(s), '--len': px(Math.max(h * 0.22, s * 0.6)), '--c': layer.color, '--delay': delay, '--dur': ms(layer.dur ?? 1000),
        })}>
          <span className="balloon-rise">
            <span className="balloon-string" />
            <span className="balloon-body" />
            {layer.pop && Array.from({ length: 8 }, (_, c) => {
              const a = (c / 8) * Math.PI * 2 + rand(ctx.seed, c, 31) * 0.6;
              const d = s * (0.9 + rand(ctx.seed, c, 32) * 0.7);
              return <span key={c} className="scrap" style={css({ '--tx': px(Math.cos(a) * d), '--ty': px(Math.sin(a) * d), '--rot': deg(rand(ctx.seed, c, 33) * 540 - 270) })} />;
            })}
          </span>
        </span>
      );
    }
    case 'banner':
      return <span key={i} className="fxl fx-banner" style={css({ '--x': '0px', '--y': px(ctx.h * 0.4), '--c': layer.color, '--delay': delay, '--dur': ms(layer.dur ?? 1200) })}>{layer.text}</span>;
    case 'meteor': {
      // Falls from above the stage (leaning in from the user's side) onto the target; its shadow grows underneath.
      const ground = (target.ground ?? target.y + 50 * ctx.k) - target.y;
      return (
        <span key={i} className="fxl fx-meteor" style={css({
          '--x': px(target.x), '--y': px(target.y), '--fy': px(-(target.y + layer.size * ctx.k)), '--fx': px((user.x - target.x) * 0.35), '--gy': px(ground),
          '--s': px(layer.size * ctx.k), '--c': layer.color, '--c2': layer.color2 ?? '#ffffff', '--delay': delay, '--dur': ms(layer.dur ?? 600),
        })}>
          <span className="meteor-shadow" />
          <span className="meteor-body"><span className={`shape sh-${layer.shape}`} /></span>
        </span>
      );
    }
    case 'vortex': {
      const p = anchor(layer.at);
      return (
        <span key={i} className="fxl fx-vortex" style={css({
          '--x': px(p.x), '--y': px(p.ground ?? p.y + 40 * ctx.k), '--s': px(layer.size * ctx.k), '--c': layer.color, '--c2': layer.color2 ?? '#ffffff', '--delay': delay, '--dur': ms(layer.dur ?? 1200),
        })}>
          <span className="core" /><span className="spin r1" /><span className="spin r2" /><span className="spin r3" /><span className="spin r4" />
        </span>
      );
    }
    case 'rays': {
      const p = anchor(layer.at);
      return <span key={i} className="fxl fx-rays" style={css({ '--x': px(p.x), '--y': px(p.y), '--s': px(layer.size * ctx.k), '--c': layer.color, '--delay': delay, '--dur': ms(layer.dur ?? 800) })} />;
    }
    case 'gauntlets': {
      // Sized from the measured sprite when there is one. Pair: ice forms around both arms (at the sides of the
      // sprite, a little above its centre), winds up, then both fly into the target from either side and shatter.
      // One-two: the second just after the first. Barrage: one after another from alternating sides, or (around)
      // from every side of the target at once.
      const h = user.size ?? layer.size * ctx.k * 1.9;
      const style = layer.style ?? 'pair';
      const s = h * { pair: 0.3, 'one-two': 0.42, barrage: 0.3 }[style];
      const around = style === 'barrage' && !!layer.around;
      const fists: { dir: 1 | -1; stagger: number; n: number }[] =
        style === 'pair' ? [{ dir: -1, stagger: 0, n: 0 }, { dir: 1, stagger: 0, n: 1 }]
        : style === 'one-two' ? [{ dir: -1, stagger: 0, n: 0 }, { dir: 1, stagger: 260, n: 1 }]
        : Array.from({ length: layer.count ?? 6 }, (_, n) => ({ dir: (n % 2 ? 1 : -1) as 1 | -1, stagger: n * (layer.gap ?? 70), n }));
      const fist = ({ dir, stagger, n }: { dir: 1 | -1; stagger: number; n: number }) => {
        // Where each barrage fist lands: a little around the target's middle.
        const jx = style === 'barrage' ? (rand(ctx.seed, n, 51) - 0.5) * h * 0.5 : 0;
        const jy = style === 'barrage' ? (rand(ctx.seed, n, 52) - 0.5) * h * 0.4 : 0;
        // Around: each fist comes in from a different angle, from just outside the target.
        const a = n * 2.4 + rand(ctx.seed, n, 53) * 0.6;
        const [ox, oy] = around ? [Math.cos(a) * h * 0.95, Math.sin(a) * h * 0.7] : [dir * h * 0.3, -h * 0.2];
        // A barrage fist's knuckles (the top of the fist) face where it's going.
        const [ex, ey] = around ? [jx - ox, jy - oy] : [target.x - user.x + jx - ox, target.y - user.y + jy - oy];
        const r = style === 'barrage' ? (Math.atan2(ey, ex) * 180) / Math.PI + 90 : dir * 14;
        return css({
          '--ox': px(ox), '--oy': px(oy), '--ix': px(dir * s * (style === 'pair' ? 0.55 : 0.25)), '--r': deg(r),
          '--jx': px(jx), '--jy': px(jy), '--stagger': ms(stagger),
        });
      };
      const origin = around ? target : user;
      return (
        <span key={i} className={`fxl fx-gauntlets ${style}${style === 'pair' ? '' : layer.shape === 'rugged' ? ' rugged' : ' fists'} mat-${layer.material ?? 'ice'}`} style={css({
          '--x': px(origin.x), '--y': px(origin.y), '--tx': px(around ? 0 : target.x - user.x), '--ty': px(around ? 0 : target.y - user.y), '--s': px(s),
          '--c': layer.color, '--c2': layer.color2 ?? '#ffffff', '--delay': delay, '--dur': ms(layer.dur ?? 2000),
        })}>
          {fists.map(f => <span key={f.n} className="gauntlet" style={fist(f)}><span className="ice" /></span>)}
        </span>
      );
    }
    case 'speedlines': {
      // Over the whole stage, converging on the Pokémon; its middle stays clear.
      const p = anchor(layer.at);
      return <span key={i} className="fxl fx-speedlines" style={css({ '--x': '0px', '--y': '0px', '--cx': px(p.x), '--cy': px(p.y), '--sw': px(ctx.w), '--sh': px(ctx.h), '--c': layer.color, '--delay': delay, '--dur': ms(layer.dur ?? 600) })} />;
    }
    case 'cocoon': {
      const p = anchor(layer.at);
      return (
        <span key={i} className="fxl fx-cocoon" style={css({ '--x': px(p.x), '--y': px(p.y), '--s': px(layer.size * ctx.k), '--delay': delay, '--dur': ms(layer.dur ?? 1100) })}>
          <span className="swirl" />
        </span>
      );
    }
    case 'megasymbol': {
      const p = anchor(layer.at);
      return (
        <svg key={i} className="fxl fx-megasym" viewBox="0 0 100 100" width={layer.size * ctx.k} height={layer.size * ctx.k} style={css({ '--x': px(p.x), '--y': px(p.y - 34 * ctx.k), '--delay': delay, '--dur': ms(layer.dur ?? 850) })} aria-hidden>
          <defs>
            <linearGradient id="fx-mega-rainbow" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ff5ea8" /><stop offset="0.35" stopColor="#ffe45e" /><stop offset="0.65" stopColor="#5ec8ff" /><stop offset="1" stopColor="#b06bff" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="42" fill="none" stroke="url(#fx-mega-rainbow)" strokeWidth="8" />
          <path d="M36 20 C 72 36, 28 64, 64 80" fill="none" stroke="#ffffff" strokeWidth="8" strokeLinecap="round" />
          <path d="M64 20 C 28 36, 72 64, 36 80" fill="none" stroke="url(#fx-mega-rainbow)" strokeWidth="8" strokeLinecap="round" />
          <circle cx="50" cy="50" r="7" fill="#ffffff" />
        </svg>
      );
    }
    case 'berry': {
      // In front of the Pokémon's face, about head height, on the side it faces (the opponents face left, your
      // Pokémon right); a stolen Berry flies over from in front of its holder first.
      const s = 36 * ctx.k;
      const mouth = (q: Point) => {
        const h = q.size ?? 110 * ctx.k;
        const toward = q.x > ctx.w / 2 ? -1 : 1;
        return { x: q.x + toward * h * 0.3, y: Math.max(q.y - h * 0.3, s * 0.6 + 4) };
      };
      const { x, y } = mouth(anchor(layer.at));
      const from = layer.from ? mouth(anchor(layer.from)) : null;
      return (
        <span key={i} className={`fxl fx-berry${from ? ' stolen' : ''}`} style={css({
          '--x': px(x), '--y': px(y), '--fx': px(from ? from.x - x : 0), '--fy': px(from ? from.y - y : 0), '--s': px(s), '--c': layer.color, '--delay': delay, '--dur': ms(layer.dur ?? 1000),
        })}>
          <span className="berry-body">
            <span className="berry-bites" style={itemIconStyle(layer.item, Math.round(s)) ?? undefined}>{itemIconStyle(layer.item) ? null : <span className="berry-fallback" />}</span>
          </span>
          {Array.from({ length: 6 }, (_, c) => {
            const a = (c / 6) * Math.PI * 2 + rand(ctx.seed, c, 21) * 0.8;
            const d = s * (0.55 + rand(ctx.seed, c, 22) * 0.45);
            return <span key={c} className={`crumb${c % 2 ? ' late' : ''}`} style={css({ '--tx': px(Math.cos(a) * d), '--ty': px(Math.sin(a) * d * 0.7 + s * 0.25) })} />;
          })}
        </span>
      );
    }
    case 'sash': {
      // Across the Pokémon's body, sized from its sprite: it wraps around (drawn in from one end), glows, then tears.
      const p = anchor(layer.at);
      const w = (p.size ?? 110 * ctx.k) * 0.8;
      return (
        <span key={i} className="fxl fx-sash" style={css({ '--x': px(p.x), '--y': px(p.y), '--w': px(w), '--c': layer.color, '--c2': layer.color2, '--delay': delay, '--dur': ms(layer.dur ?? 900) })}>
          <span className="sash-band"><span className="half left" /><span className="half right" /><span className="sash-shine" /></span>
        </span>
      );
    }
    case 'item': {
      // Held up in front of the Pokémon, about chest height on the side it faces (the opponents face left, yours right),
      // under its name tag; from there it's thrown at `to` (Red Card) or sinks into the Pokémon (--ax/--ay).
      const p = anchor(layer.at);
      const h = p.size ?? 110 * ctx.k;
      const s = 32 * ctx.k;
      const toward = p.x > ctx.w / 2 ? -1 : 1;
      const x = p.x + toward * h * 0.48, y = Math.max(p.y - h * 0.2, s + 4);
      const to = layer.to ? anchor(layer.to) : null;
      const icon = itemIconStyle(layer.item, Math.round(s));
      const bits = layer.use === 'crumble' ? 8 : layer.use === 'burst' || layer.use === 'press' ? 10 : 0;
      return (
        <span key={i} className={`fxl fx-item use-${layer.use}`} style={css({
          '--x': px(x), '--y': px(y), '--s': px(s), '--c': layer.color, '--c2': layer.color2, '--delay': delay, '--dur': ms(layer.dur ?? 1000),
          '--ax': px(p.x - x), '--ay': px(p.y - y), '--tx': px(to ? to.x - x : 0), '--ty': px(to ? to.y - y : 0), '--spin': deg(toward * 540),
        })}>
          <span className="item-glow" />
          <span className="item-body">
            {icon ? <span className="item-icon" style={icon} /> : <span className="item-icon item-fallback" />}
            <span className="item-glint" />
          </span>
          {Array.from({ length: bits }, (_, c) => {
            const a = (c / bits) * Math.PI * 2 + rand(ctx.seed, c, 51) * 0.7;
            const d = s * (0.8 + rand(ctx.seed, c, 52) * 0.8);
            // Herb bits flutter down as they fly; sparkles fly straight out.
            const fall = layer.use === 'crumble' ? s * (0.5 + rand(ctx.seed, c, 53) * 0.6) : 0;
            return <span key={c} className={`item-bit${c % 2 ? ' alt' : ''}`} style={css({ '--bx': px(Math.cos(a) * d), '--by': px(Math.sin(a) * d * 0.8 + fall), '--rot': deg(rand(ctx.seed, c, 54) * 400 - 200) })} />;
          })}
        </span>
      );
    }
    case 'web': {
      // Radial threads and three rings of thread between them, spun over the spot.
      const p = anchor(layer.at);
      const s = layer.size * ctx.k;
      const spokes = 8;
      const ring = (r: number) => Array.from({ length: spokes }, (_, k) => {
        const a = (k / spokes) * Math.PI * 2 + 0.2;
        return `${50 + Math.cos(a) * r},${50 + Math.sin(a) * r}`;
      }).join(' ');
      return (
        <svg key={i} className="fxl fx-web" viewBox="0 0 100 100" width={s} height={s}
          style={css({ '--x': px(p.x), '--y': px(p.y), '--c': layer.color, '--delay': delay, '--dur': ms(layer.dur ?? 900) })} aria-hidden>
          {Array.from({ length: spokes }, (_, k) => {
            const a = (k / spokes) * Math.PI * 2 + 0.2;
            return <line key={k} x1="50" y1="50" x2={50 + Math.cos(a) * 48} y2={50 + Math.sin(a) * 48} />;
          })}
          {[14, 28, 42].map(r => <polygon key={r} points={ring(r)} />)}
        </svg>
      );
    }
    case 'smoke': {
      // At the Pokémon's feet (its ground line): puffs roll out both ways along the ground, swelling and thinning out,
      // from either side of the jets so they stay in sight.
      const p = anchor(layer.at);
      const y = p.ground ?? p.y + 55 * ctx.k;
      const spread = layer.spread * ctx.k;
      const dur = layer.dur ?? 900;
      return (
        <Fragment key={i}>
          {layer.glow && <span className="fxl fx-heat" style={css({ '--x': px(p.x), '--y': px(y), '--s': px(spread * 1.1), '--c': layer.glow, '--delay': delay, '--dur': ms(dur * 0.6) })} />}
          {Array.from({ length: layer.count }, (_, k) => {
            const r1 = rand(ctx.seed, k, 11), r2 = rand(ctx.seed, k, 12), r3 = rand(ctx.seed, k, 13);
            const dir = k % 2 ? 1 : -1;
            return (
              <span key={k} className="fxl fx-smoke" style={css({
                '--x': px(p.x + dir * (0.15 + r1 * 0.2) * spread), '--y': px(y - r3 * 8 * ctx.k),
                '--tx': px(dir * spread * (0.45 + r2 * 0.55)), '--ty': px(-spread * (0.05 + r3 * 0.25)),
                '--s': px(layer.size * ctx.k * (0.7 + r3 * 0.6)), '--c': layer.color2 && k % 3 === 2 ? layer.color2 : layer.color,
                '--delay': ms((layer.delay ?? 0) + r1 * 120), '--dur': ms(dur * (0.8 + r2 * 0.4)),
              })} />
            );
          })}
        </Fragment>
      );
    }
    case 'gust': {
      // Streaks start behind the user and sweep past it toward the foe, spread around the line between them; every
      // fourth is a leaf riding the wind.
      const dx = target.x - user.x, dy = target.y - user.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len;
      const ang = deg((Math.atan2(dy, dx) * 180) / Math.PI);
      const dist = Math.max(ctx.w, len * 1.4);
      return (
        <Fragment key={i}>
          {Array.from({ length: layer.count }, (_, c) => {
            const r1 = rand(ctx.seed, c, 41), r2 = rand(ctx.seed, c, 42), r3 = rand(ctx.seed, c, 43);
            const side = (r1 - 0.5) * ctx.h * 0.7;
            const back = ctx.w * (0.18 + r2 * 0.2);
            const x = user.x - ux * back - uy * side, y = user.y - uy * back + ux * side;
            const leaf = layer.leaves !== false && c % 4 === 3;
            return (
              <span key={c} className={`fxl fx-gust ${leaf ? 'leaf' : 'streak'}`} style={css({
                '--x': px(x), '--y': px(y), '--ang': ang, '--dist': px(dist), '--len': px(ctx.w * (0.1 + r3 * 0.12)), '--c': layer.color,
                '--delay': ms((layer.delay ?? 0) + r2 * 260), '--dur': ms((layer.dur ?? 900) * (0.7 + r1 * 0.35)),
              })}>
                {leaf && <span className="shape sh-leaf" style={css({ '--s': px(12 * ctx.k), '--c': '#7ac74c' })} />}
              </span>
            );
          })}
        </Fragment>
      );
    }
    case 'fractal': {
      // Each ring: a circle of code glyphs (SVG text on a circular path), squashed into an orbit and tilted its own way.
      const p = anchor(layer.at);
      return (
        <span key={i} className="fxl fx-fractal" style={css({ '--x': px(p.x), '--y': px(p.y), '--s': px(layer.size * ctx.k), '--c': layer.color, '--delay': delay, '--dur': ms(layer.dur ?? 1500) })}>
          {Array.from({ length: layer.rings ?? 3 }, (_, r) => {
            const id = `fractal-${ctx.seed}-${i}-${r}`;
            const text = Array.from({ length: 44 }, (_, g) => GLYPHS[Math.floor(rand(ctx.seed, r * 61 + g, 15) * 16)]).join('');
            return (
              <span key={r} className={`ring${r % 2 ? ' rev' : ''}`} style={css({ '--tilt': deg(-28 + r * 28 + (rand(ctx.seed, r, 16) - 0.5) * 10), '--rs': `${1 - r * 0.14}` })}>
                <svg viewBox="0 0 100 100" aria-hidden>
                  <defs><path id={id} d="M50,50 m-44,0 a44,44 0 1,1 88,0 a44,44 0 1,1 -88,0" /></defs>
                  <text><textPath href={`#${id}`}>{text}</textPath></text>
                </svg>
              </span>
            );
          })}
        </span>
      );
    }
    case 'merge': {
      // From below the stage, off to the side nearer the middle, curving up into the Pokémon.
      const p = anchor(layer.at);
      const fromX = (p.x < ctx.w / 2 ? 1 : -1) * ctx.w * 0.22;
      return (
        <span key={i} className="fxl fx-merge" style={css({
          '--x': px(p.x), '--y': px(p.y), '--fx': px(fromX), '--fy': px(ctx.h - p.y + layer.size * ctx.k), '--s': px(layer.size * ctx.k),
          '--c': layer.color, '--c2': layer.color2 ?? '#ffffff', '--delay': delay, '--dur': ms(layer.dur ?? 800),
        })} />
      );
    }
    case 'sphere': {
      const p = anchor(layer.at);
      return (
        <span key={i} className="fxl fx-sphere" style={css({ '--x': px(p.x), '--y': px(p.y), '--s': px(layer.size * ctx.k), '--c': layer.color, '--c2': layer.color2 ?? '#ffffff', '--delay': delay, '--dur': ms(layer.dur ?? 900) })}>
          <span className="swirl" />
        </span>
      );
    }
    case 'scan': {
      const p = anchor(layer.at);
      const h = p.size ?? 110 * ctx.k;
      return <span key={i} className="fxl fx-scan" style={css({ '--x': px(p.x), '--y': px(p.y), '--h': px(h), '--w': px(h * 1.1), '--c': layer.color, '--delay': delay, '--dur': ms(layer.dur ?? 500) })} />;
    }
    case 'pillar': {
      const p = anchor(layer.at);
      return (
        <span key={i} className="fxl fx-pillar" style={css({
          '--x': px(p.x), '--y': '0px', '--h': px(p.ground ?? p.y + 50 * ctx.k), '--w': px(layer.width * ctx.k), '--c': layer.color, '--c2': layer.color2 ?? '#ffffff', '--delay': delay, '--dur': ms(layer.dur ?? 700),
        })} />
      );
    }
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
    case 'bolt': case 'column': return l.at !== 'user';
    case 'orb': case 'beam': case 'slash': case 'jaws': case 'crack': case 'meteor': case 'gauntlets': return true;
    case 'vortex': case 'rays': case 'pillar': case 'cocoon': case 'megasymbol': case 'label': case 'balloon':
    case 'fractal': case 'merge': case 'sphere': case 'scan': case 'web': case 'smoke': return l.at === 'target';
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
  // Dimming and the digital grid go behind the sprites (the Pokémon stay lit); everything else is drawn over them.
  const isBack = (l: Layer) => (l.kind === 'screen' && l.mode === 'dim') || l.kind === 'datagrid';
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
