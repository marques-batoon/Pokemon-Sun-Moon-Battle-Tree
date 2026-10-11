import { useId, type ReactNode } from 'react';
import type { BattleBackground } from '../../settings/settings-store';
import { useAppSettings } from '../useAppSettings';

/*
 * Battle scenery, drawn in SVG and CSS (no image files, so it also works offline). Each scene has a
 * sky part above the horizon, anchored to it (wide stages crop its top, narrow ones its sides), and a
 * ground part below it. The horizon (--horizon in index.css, HORIZON in fx/geometry.ts) is the same
 * for every scene. The grass field is all CSS (index.css), as are the textures of the other grounds.
 */

type Pt = [number, number];
type Part = (id: string) => ReactNode;

const SKY_BOX = { viewBox: '0 0 1000 200', preserveAspectRatio: 'xMidYMax slice' } as const;
const GROUND_BOX = { viewBox: '0 0 1000 400', preserveAspectRatio: 'none' } as const;
const LINE = { vectorEffect: 'non-scaling-stroke' } as const;

const pts = (list: Pt[]) => list.map(p => p.map(n => +n.toFixed(1)).join(',')).join(' ');
const parsePts = (s: string): Pt[] => s.trim().split(/\s+/).map(p => p.split(',').map(Number) as Pt);

/** Pebbles, leaves...: scattered at random (always the same), smaller and denser toward the horizon. */
function scatter(n: number, seed: number, colors: string[], size: [number, number]) {
  let s = seed;
  const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  return Array.from({ length: n }, (_, i) => {
    const t = rnd() ** 1.3;
    const r = size[0] + (size[1] - size[0]) * t;
    return { key: i, cx: +(rnd() * 1000).toFixed(1), cy: +(4 + 392 * t).toFixed(1), rx: +r.toFixed(1), ry: +(r * 1.1).toFixed(1), fill: colors[i % colors.length], angle: Math.round(rnd() * 180) };
  });
}

/** Vertical gradient (top to bottom). */
function VGrad({ id, stops }: { id: string; stops: [number, string, number?][] }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      {stops.map(([o, c, a]) => <stop key={o} offset={o} stopColor={c} stopOpacity={a ?? 1} />)}
    </linearGradient>
  );
}

function Cloud({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill="#ffffff">
      <ellipse cx="0" cy="0" rx="44" ry="10" opacity="0.85" />
      <ellipse cx="-14" cy="-7" rx="20" ry="10" opacity="0.9" />
      <ellipse cx="12" cy="-9" rx="24" ry="12" opacity="0.9" />
    </g>
  );
}

function PokeBall({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g transform={`translate(${x} ${y})`} stroke="#1d1d24" strokeWidth={r / 6}>
      <circle r={r} fill="#ffffff" />
      <path d={`M${-r} 0 A${r} ${r} 0 0 1 ${r} 0 Z`} fill="#e3350d" />
      <circle r={r / 3} fill="#ffffff" />
    </g>
  );
}

// ---- Pokémon Stadium: floodlit stands full of fans, a battle field with white lines ----

const stadiumSky: Part = id => (
  <svg {...SKY_BOX}>
    <defs>
      <VGrad id={`${id}-roof`} stops={[[0, '#0f1530'], [1, '#2a3368']]} />
      <radialGradient id={`${id}-glow`}>
        <stop offset="0" stopColor="#fffbe6" stopOpacity="0.95" />
        <stop offset="0.35" stopColor="#fff4c2" stopOpacity="0.4" />
        <stop offset="1" stopColor="#fff4c2" stopOpacity="0" />
      </radialGradient>
      <pattern id={`${id}-fans`} width="18" height="13" patternUnits="userSpaceOnUse">
        <circle cx="3" cy="4" r="2.4" fill="#f2c94c" /><circle cx="9" cy="3.5" r="2.4" fill="#eb5757" /><circle cx="15" cy="4.5" r="2.4" fill="#e9eef8" />
        <circle cx="6" cy="10" r="2.4" fill="#56ccf2" /><circle cx="12" cy="10.5" r="2.4" fill="#f2994a" /><circle cx="17.5" cy="10" r="2.4" fill="#9b8cf2" />
      </pattern>
      <pattern id={`${id}-fans2`} width="22" height="12" patternUnits="userSpaceOnUse">
        <circle cx="4" cy="4" r="2.1" fill="#e9eef8" /><circle cx="11" cy="3" r="2.1" fill="#6fcf97" /><circle cx="18" cy="4" r="2.1" fill="#eb5757" />
        <circle cx="7" cy="9.5" r="2.1" fill="#f2c94c" /><circle cx="15" cy="9" r="2.1" fill="#56ccf2" />
      </pattern>
    </defs>
    <rect width="1000" height="200" fill={`url(#${id}-roof)`} />
    {[150, 390, 610, 850].map(x => (
      <g key={x}>
        <circle cx={x} cy="66" r="50" fill={`url(#${id}-glow)`} />
        <rect x={x - 15} y="59" width="30" height="13" rx="2" fill="#fffdf0" />
        <path d={`M${x - 15} 65.5 h30 M${x - 5} 59 v13 M${x + 5} 59 v13`} stroke="#c9c19a" strokeWidth="1" />
      </g>
    ))}
    <rect y="94" width="1000" height="38" fill="#323c78" />
    <rect y="96" width="1000" height="34" fill={`url(#${id}-fans2)`} opacity="0.7" />
    <rect y="130" width="1000" height="5" fill="#8ea2e0" />
    <rect y="135" width="1000" height="45" fill="#3a458c" />
    <rect y="137" width="1000" height="42" fill={`url(#${id}-fans)`} opacity="0.9" />
    <rect y="179" width="1000" height="21" fill="#1f5fc8" />
    {Array.from({ length: 10 }, (_, i) => i).filter(i => i !== 4 && i !== 5).map(i => (
      <rect key={i} x={i * 100 + 10} y="184" width="80" height="12" rx="2" fill={i % 2 ? '#f6c945' : '#e9f0ff'} opacity="0.9" />
    ))}
    <rect x="410" y="183" width="180" height="14" rx="3" fill="#0f2f73" />
    <PokeBall x={500} y={190} r={6} />
    <rect y="179" width="1000" height="2" fill="#bcd3ff" />
  </svg>
);

const stadiumGround: Part = id => (
  <svg {...GROUND_BOX}>
    <defs>
      <VGrad id={`${id}-floor`} stops={[[0, '#5ea883'], [0.08, '#74c597'], [1, '#55ab7d']]} />
      <VGrad id={`${id}-shade`} stops={[[0, '#000000', 0.3], [1, '#000000', 0]]} />
    </defs>
    <rect width="1000" height="400" fill={`url(#${id}-floor)`} />
    {[[16, 36], [60, 90], [124, 168], [216, 278], [334, 400]].map(([a, b]) => (
      <rect key={a} y={a} width="1000" height={b - a} fill="#000000" opacity="0.05" />
    ))}
    <rect width="1000" height="22" fill={`url(#${id}-shade)`} />
    <g fill="none" stroke="#f4fff8" strokeWidth="3" opacity="0.9">
      <path {...LINE} d="M130 16 L870 16 L1060 400 L-60 400 Z" fill="#ffffff" fillOpacity="0.05" />
      <path {...LINE} d="M33 212 L967 212" />
      <ellipse {...LINE} cx="500" cy="212" rx="125" ry="48" />
    </g>
    <ellipse cx="500" cy="212" rx="22" ry="8.5" fill="#f4fff8" opacity="0.9" />
  </svg>
);

// ---- Mountain: snowy peaks behind green-grey ridges, a rocky dirt ground ----

const FAR_RANGE = parsePts('0,200 0,130 70,98 120,120 175,74 235,116 290,96 345,130 405,66 475,122 525,92 585,128 645,62 715,118 765,90 825,126 885,78 945,118 1000,96 1000,200');
const MID_RANGE = '0,200 0,158 55,138 125,164 195,124 265,158 335,136 425,166 505,128 575,160 655,138 725,164 805,126 875,156 945,140 1000,152 1000,200';

/** Snow on each peak of a ridge line, a little way down both slopes with a ragged edge. */
function snowCaps(ridge: Pt[], highest: number): string[] {
  const caps: string[] = [];
  for (let i = 1; i < ridge.length - 1; i++) {
    const [px, py] = ridge[i];
    const [lx, ly] = ridge[i - 1];
    const [rx, ry] = ridge[i + 1];
    if (py > highest || py >= ly || py >= ry) continue;
    const t = py < 80 ? 0.32 : 0.22;
    const a: Pt = [px + (lx - px) * t, py + (ly - py) * t];
    const b: Pt = [px + (rx - px) * t, py + (ry - py) * t];
    const at = (u: number, drop: number): Pt => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u + drop];
    caps.push(pts([[px, py], a, at(0.25, -3), at(0.45, 5), at(0.7, -2), b]));
  }
  return caps;
}
const SNOW = snowCaps(FAR_RANGE, 100);

const mountainSky: Part = id => (
  <svg {...SKY_BOX}>
    <defs><VGrad id={`${id}-sky`} stops={[[0, '#7fbbea'], [1, '#dcedf8']]} /></defs>
    <rect width="1000" height="200" fill={`url(#${id}-sky)`} />
    <Cloud x={300} y={80} /><Cloud x={720} y={66} s={1.2} />
    <polygon points={pts(FAR_RANGE)} fill="#a5b7cc" />
    {SNOW.map(p => <polygon key={p} points={p} fill="#f5f9fd" />)}
    <polygon points={MID_RANGE} fill="#6f8c7c" />
    <path d="M0 200 L0 182 Q130 164 260 184 T520 180 T780 182 T1000 178 L1000 200 Z" fill="#a08664" />
  </svg>
);

const PEBBLES = scatter(90, 7, ['#8a6d47', '#e8d6b0', '#6f655c', '#a8927a'], [1.6, 7]);
const STRATA = scatter(10, 3, ['#8f7350'], [40, 120]);

const mountainGround: Part = () => (
  <svg {...GROUND_BOX}>
    {STRATA.map(({ key, cx, cy, rx }) => <ellipse key={key} cx={cx} cy={cy} rx={rx} ry={rx / 30 + 1} fill="#8f7350" opacity="0.22" />)}
    {PEBBLES.map(({ key, cx, cy, rx, ry, fill }) => <ellipse key={key} cx={cx} cy={cy} rx={rx} ry={ry} fill={fill} opacity="0.6" />)}
    <g fill="#8d8a86" stroke="#5f5a54" strokeWidth="1.5">
      <path {...LINE} d="M40 70 L58 42 L92 34 L118 52 L124 72 Z" />
      <path {...LINE} d="M560 22 L572 10 L592 8 L602 22 Z" />
      <path {...LINE} d="M0 160 L0 120 L22 112 L44 130 L50 160 Z" />
    </g>
    <g fill="#ffffff" opacity="0.25">
      <path d="M58 42 L92 34 L80 50 Z" /><path d="M572 10 L592 8 L584 16 Z" />
    </g>
  </svg>
);

// ---- Ocean: open sea under a bright sky, gentle waves ----

/** Wave crests: small and close together near the horizon, bigger and further apart up close. */
const WAVES = Array.from({ length: 11 }, (_, i) => {
  const t = i / 10;
  const y = 8 + 386 * t ** 1.5;
  const len = 24 + 110 * t;
  const amp = 2 + 9 * t;
  const gap = len * 1.9;
  let d = '';
  for (let x = -gap + (i % 2) * gap / 2; x < 1000 + gap; x += gap) d += `M${x.toFixed(1)} ${y.toFixed(1)} q${(len / 2).toFixed(1)} ${(-amp).toFixed(1)} ${len.toFixed(1)} 0 `;
  return { d, opacity: 0.3 + 0.35 * t, width: 1 + 1.6 * t };
});

const oceanSky: Part = id => (
  <svg {...SKY_BOX}>
    <defs>
      <VGrad id={`${id}-sky`} stops={[[0, '#4ea8ea'], [1, '#cdeeff']]} />
      <VGrad id={`${id}-haze`} stops={[[0, '#ffffff', 0], [1, '#ffffff', 0.5]]} />
      <radialGradient id={`${id}-sun`}>
        <stop offset="0" stopColor="#fff6c8" stopOpacity="0.9" />
        <stop offset="1" stopColor="#fff6c8" stopOpacity="0" />
      </radialGradient>
    </defs>
    <rect width="1000" height="200" fill={`url(#${id}-sky)`} />
    <circle cx="700" cy="84" r="72" fill={`url(#${id}-sun)`} />
    <circle cx="700" cy="84" r="20" fill="#fff9de" />
    <Cloud x={300} y={96} /><Cloud x={530} y={70} s={0.8} /><Cloud x={870} y={104} s={1.1} />
    <path d="M418 80 q6 -6 12 0 q6 -6 12 0 M452 70 q5 -5 10 0 q5 -5 10 0" fill="none" stroke="#2d4a66" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M120 200 Q170 168 215 178 Q260 160 310 200 Z" fill="#4f8c86" />
    <path d="M790 200 Q820 186 850 190 Q875 184 905 200 Z" fill="#6aa39a" />
    <rect y="176" width="1000" height="24" fill={`url(#${id}-haze)`} />
  </svg>
);

const oceanGround: Part = id => (
  <svg {...GROUND_BOX}>
    <defs><VGrad id={`${id}-sea`} stops={[[0, '#1c6cb6'], [0.4, '#2c8ccf'], [1, '#56bfe2']]} /></defs>
    <rect width="1000" height="400" fill={`url(#${id}-sea)`} />
    <rect width="1000" height="3" fill="#ffffff" opacity="0.35" />
    <g className="waves" fill="none" stroke="#ffffff" strokeLinecap="round">
      {WAVES.map(w => <path key={w.d.slice(0, 24)} {...LINE} d={w.d} opacity={w.opacity} strokeWidth={w.width} />)}
    </g>
  </svg>
);

// ---- Forest: rows of trees with sunbeams through them, a mossy forest floor ----

/** A three-tier conifer standing on (x, base). */
function conifer(x: number, base: number, h: number, w: number): string {
  const tiers: [number, number, number][] = [[base - h, base - h * 0.55, w * 0.55], [base - h * 0.78, base - h * 0.28, w * 0.78], [base - h * 0.52, base - h * 0.04, w]];
  return tiers.map(([apex, bottom, half]) => `M${x} ${apex} L${x + half} ${bottom} L${x - half} ${bottom} Z`).join(' ');
}
/** A deterministic wobble so the tree lines don't look stamped out. */
const wobble = (i: number, n: number) => ((i * 37 + 11) % n) - n / 2;

const FAR_CANOPY = Array.from({ length: 28 }, (_, i) => ({ cx: i * 38, cy: 172 + wobble(i, 10), r: 30 + wobble(i + 3, 12) }));
const FAR_PINES = Array.from({ length: 14 }, (_, i) => conifer(20 + i * 74 + wobble(i, 20), 192, 92 + wobble(i, 26), 26)).join(' ');
const MID_PINES = Array.from({ length: 9 }, (_, i) => conifer(60 + i * 112 + wobble(i, 30), 200, 118 + wobble(i + 5, 30), 34)).join(' ');
const NEAR_PINES = [conifer(30, 206, 210, 80), conifer(975, 206, 220, 84)].join(' ');
const BUSHES = Array.from({ length: 30 }, (_, i) => ({ cx: i * 35 + wobble(i, 12), cy: 198, r: 15 + wobble(i + 2, 8) }));

const forestSky: Part = id => (
  <svg {...SKY_BOX}>
    <defs><VGrad id={`${id}-sky`} stops={[[0, '#99cfb8'], [1, '#e4f3d6']]} /></defs>
    <rect width="1000" height="200" fill={`url(#${id}-sky)`} />
    <g fill="#9cc596">{FAR_CANOPY.map(c => <circle key={c.cx} {...c} />)}</g>
    <path d={FAR_PINES} fill="#78a87f" />
    <path d={MID_PINES} fill="#4a8550" />
    <g fill="#fffbe0" opacity="0.2">
      <path d="M180 0 L262 0 L430 200 L300 200 Z" />
      <path d="M330 0 L372 0 L530 200 L458 200 Z" />
      <path d="M560 0 L590 0 L700 200 L650 200 Z" />
    </g>
    <path d={NEAR_PINES} fill="#2c5d36" />
    <g fill="#3c7641">{BUSHES.map(c => <circle key={c.cx} {...c} />)}<rect y="190" width="1000" height="10" /></g>
  </svg>
);

const LEAVES = scatter(140, 11, ['#9a6a2c', '#c58a35', '#24532a', '#7ab352', '#b5772e'], [1.4, 6]);

const forestGround: Part = () => (
  <svg {...GROUND_BOX}>
    {LEAVES.map(({ key, cx, cy, rx, ry, fill, angle }) => (
      <ellipse key={key} cx={cx} cy={cy} rx={rx * 1.3} ry={ry * 0.6} fill={fill} opacity="0.7" transform={`rotate(${angle} ${cx} ${cy})`} />
    ))}
  </svg>
);

const SKIES: Partial<Record<BattleBackground, Part>> = { stadium: stadiumSky, mountain: mountainSky, ocean: oceanSky, forest: forestSky };
const GROUNDS: Partial<Record<BattleBackground, Part>> = { stadium: stadiumGround, mountain: mountainGround, ocean: oceanGround, forest: forestGround };

/** The scenery behind the battle: the one picked in Settings, or `kind` (Settings' previews). */
export function StageBackdrop({ kind }: { kind?: BattleBackground }) {
  const { battleBackground } = useAppSettings();
  const bg = kind ?? battleBackground;
  const id = `bg${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <div className={`stage-backdrop bg-${bg}`} aria-hidden="true">
      <div className="backdrop-sky">{SKIES[bg]?.(id)}</div>
      <div className="backdrop-ground">{GROUNDS[bg]?.(id)}</div>
    </div>
  );
}
