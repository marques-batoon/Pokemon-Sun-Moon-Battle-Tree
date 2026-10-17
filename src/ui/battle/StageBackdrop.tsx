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
    <rect className="day" width="1000" height="200" fill={`url(#${id}-roof)`} />
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
    <g className="day">
      <rect width="1000" height="200" fill={`url(#${id}-sky)`} />
      <Cloud x={300} y={80} /><Cloud x={720} y={66} s={1.2} />
    </g>
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
    <g className="day">
      <rect width="1000" height="200" fill={`url(#${id}-sky)`} />
      <circle cx="700" cy="84" r="72" fill={`url(#${id}-sun)`} />
      <circle cx="700" cy="84" r="20" fill="#fff9de" />
      <Cloud x={300} y={96} /><Cloud x={530} y={70} s={0.8} /><Cloud x={870} y={104} s={1.1} />
      <path d="M418 80 q6 -6 12 0 q6 -6 12 0 M452 70 q5 -5 10 0 q5 -5 10 0" fill="none" stroke="#2d4a66" strokeWidth="1.6" strokeLinecap="round" />
    </g>
    <path d="M120 200 Q170 168 215 178 Q260 160 310 200 Z" fill="#4f8c86" />
    <path d="M790 200 Q820 186 850 190 Q875 184 905 200 Z" fill="#6aa39a" />
    <rect className="day" y="176" width="1000" height="24" fill={`url(#${id}-haze)`} />
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
    <rect className="day" width="1000" height="200" fill={`url(#${id}-sky)`} />
    <g fill="#9cc596">{FAR_CANOPY.map(c => <circle key={c.cx} {...c} />)}</g>
    <path d={FAR_PINES} fill="#78a87f" />
    <path d={MID_PINES} fill="#4a8550" />
    <g className="day" fill="#fffbe0" opacity="0.2">
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

// ---- Battle Tree (the default): the arena at the top of the giant tree on Poni Island. Leafy canopy and huge
// branches overhead, the sea far below past a wooden railing, a round stone floor with a hala tree emblem. ----

const CANOPY = Array.from({ length: 24 }, (_, i) => ({ cx: i * 44 + wobble(i, 16), cy: 36 + wobble(i + 4, 22), r: 40 + wobble(i + 1, 14) }));
const LEAF_TONES = ['#2f6f30', '#3f8a3a', '#4f9a3e'];
const POSTS = Array.from({ length: 17 }, (_, i) => 20 + i * 60);
const BUSHES_RAIL = [90, 260, 470, 640, 830].map((x, i) => ({ x, r: 16 + wobble(i, 8) }));
const MOSS = scatter(70, 23, ['#4c8a39', '#79b85a', '#3d7330'], [1.5, 5]);

/**
 * The floor emblem: a hala tree (Pandanus tectorius), native to Hawaiʻi (Alola is based on Hawaiʻi, and Kahuna Hala
 * is named after it; on request): stilt roots propping up the trunk, forking branches that each end in a tuft of
 * long, drooping, sword-shaped leaves, and pineapple-like hala fruit.
 */
function halaTuft(cx: number, cy: number, len: number): string {
  const n = 13;
  return Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (i / (n - 1) - 0.5) * Math.PI * 1.75;
    const side = Math.abs(Math.cos(a));
    const l = len * (0.75 + 0.25 * side);
    const mx = cx + Math.cos(a) * l * 0.55, my = cy + Math.sin(a) * l * 0.55 - 8;
    const tx = cx + Math.cos(a) * l, ty = cy + Math.sin(a) * l + l * 0.45 * side;
    return `M${cx} ${cy} Q${mx.toFixed(1)} ${my.toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)}`;
  }).join(' ');
}
const HALA_TUFTS: [number, number, number][] = [[-62, -42, 54], [58, -50, 54], [0, -80, 50]];
const HALA_FRUIT: [number, number][] = [[-48, -16], [70, -24]];

const treeSky: Part = id => (
  <svg {...SKY_BOX}>
    <defs>
      <VGrad id={`${id}-sky`} stops={[[0, '#59b4ee'], [1, '#c4e8fb']]} />
      <VGrad id={`${id}-sea`} stops={[[0, '#7ccbea'], [1, '#4aa6d6']]} />
    </defs>
    <g className="day">
      <rect width="1000" height="200" fill={`url(#${id}-sky)`} />
      <Cloud x={330} y={118} s={0.9} /><Cloud x={690} y={104} />
    </g>
    <rect y="164" width="1000" height="22" fill={`url(#${id}-sea)`} />
    <path d="M280 168 Q310 156 340 160 Q365 154 390 168 Z M620 168 Q650 160 676 163 Q700 158 724 168 Z" fill="#78a996" />
    <g fill="#6b4528">
      <path d="M0 0 L160 0 C135 60 118 130 96 200 L0 200 Z" />
      <path d="M1000 0 L840 0 C865 60 882 130 904 200 L1000 200 Z" />
    </g>
    <g fill="none" stroke="#6b4528" strokeLinecap="round">
      <path d="M120 84 C240 52 330 70 440 34" strokeWidth="18" />
      <path d="M880 84 C760 52 670 70 560 34" strokeWidth="18" />
      <path d="M300 64 C330 40 360 34 390 14" strokeWidth="9" />
      <path d="M700 64 C670 40 640 34 610 14" strokeWidth="9" />
    </g>
    <g fill="none" stroke="#4f321c" strokeWidth="3" opacity="0.55" strokeLinecap="round">
      <path d="M40 10 C30 70 24 130 14 196 M90 20 C78 80 66 140 52 196 M960 10 C970 70 976 130 986 196 M910 20 C922 80 934 140 948 196" />
    </g>
    {LEAF_TONES.map((fill, t) => (
      <g key={fill} fill={fill}>{CANOPY.map((c, i) => <circle key={i} cx={c.cx - t * 6} cy={c.cy + (2 - t) * 10} r={c.r - t * 8} />)}</g>
    ))}
    <rect y="178" width="1000" height="22" fill="#8b5e34" />
    <rect y="178" width="1000" height="5" fill="#b07f4e" />
    <g fill="#6d4626">{POSTS.map(x => <rect key={x} x={x - 4} y="172" width="8" height="28" rx="2" />)}</g>
    <g fill="#c09060">{POSTS.map(x => <rect key={x} x={x - 6} y="170" width="12" height="5" rx="2" />)}</g>
    <g fill="#3f8a3a">{BUSHES_RAIL.map(b => <circle key={b.x} cx={b.x} cy="192" r={b.r} />)}</g>
    <g fill="#5aa845">{BUSHES_RAIL.map(b => <circle key={b.x} cx={b.x - 6} cy="188" r={b.r * 0.6} />)}</g>
  </svg>
);

const treeGround: Part = id => (
  <svg {...GROUND_BOX}>
    <defs>
      <radialGradient id={`${id}-floor`} cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#f1e3bf" />
        <stop offset="0.65" stopColor="#ddc596" />
        <stop offset="1" stopColor="#c7a46e" />
      </radialGradient>
    </defs>
    <rect width="1000" height="400" fill="#5f9c47" />
    {MOSS.map(({ key, cx, cy, rx, ry, fill }) => <ellipse key={key} cx={cx} cy={cy} rx={rx} ry={ry} fill={fill} opacity="0.7" />)}
    <ellipse cx="500" cy="232" rx="650" ry="232" fill={`url(#${id}-floor)`} />
    <g fill="none" stroke="#a5824f" strokeWidth="3" opacity="0.8">
      <ellipse {...LINE} cx="500" cy="232" rx="650" ry="232" strokeWidth="6" stroke="#8b6a3e" />
      <ellipse {...LINE} cx="500" cy="232" rx="440" ry="156" />
      <ellipse {...LINE} cx="500" cy="232" rx="190" ry="66" />
      <path {...LINE} d={Array.from({ length: 16 }, (_, k) => {
        const a = (k / 16) * Math.PI * 2;
        return `M${(500 + 190 * Math.cos(a)).toFixed(1)} ${(232 + 66 * Math.sin(a)).toFixed(1)} L${(500 + 440 * Math.cos(a)).toFixed(1)} ${(232 + 156 * Math.sin(a)).toFixed(1)}`;
      }).join(' ')} strokeWidth="2" opacity="0.7" />
    </g>
    <g transform="translate(500 232) scale(1 0.36)">
      <circle r="150" fill="#e4f1d4" stroke="#4f8a3c" strokeWidth="10" />
      <g stroke="#6b4528" fill="none" strokeLinecap="round">
        <path d="M-2 70 Q-30 88 -56 122 M-2 72 Q-16 94 -24 124 M0 74 L2 126 M2 72 Q18 94 28 124 M2 70 Q32 88 58 122" strokeWidth="6" />
        <path d="M0 76 C-4 50 4 30 0 8" strokeWidth="16" />
        <path d="M0 10 C-20 -6 -40 -20 -62 -42 M0 10 C20 -8 40 -26 58 -50 M0 8 C2 -24 0 -52 0 -80" strokeWidth="10" />
      </g>
      {HALA_FRUIT.map(([cx, cy]) => (
        <g key={cx}>
          <ellipse cx={cx} cy={cy} rx="15" ry="19" fill="#f0a23a" stroke="#c46a1c" strokeWidth="3" />
          <path d={`M${cx - 12} ${cy - 6} L${cx + 12} ${cy - 6} M${cx - 14} ${cy + 4} L${cx + 14} ${cy + 4} M${cx - 6} ${cy - 17} L${cx - 6} ${cy + 17} M${cx + 6} ${cy - 17} L${cx + 6} ${cy + 17}`} stroke="#c46a1c" strokeWidth="2" />
        </g>
      ))}
      {HALA_TUFTS.map(([cx, cy, len], i) => (
        <g key={i} fill="none" strokeLinecap="round">
          <path d={halaTuft(cx, cy, len)} stroke="#2f6f30" strokeWidth="9" />
          <path d={halaTuft(cx, cy, len * 0.9)} stroke="#5aa845" strokeWidth="4" />
        </g>
      ))}
    </g>
    <g fill="#000000" opacity="0.07">
      <ellipse cx="160" cy="40" rx="140" ry="22" /><ellipse cx="820" cy="30" rx="160" ry="20" /><ellipse cx="470" cy="12" rx="120" ry="10" />
    </g>
  </svg>
);

// ---- Spiral Mountain (Digimon Adventure): the summit of the Dark Masters' twisted mountain, overlooking the Digital
// World far below at dusk: a digital grid across the sky and a data sphere, Infinity Mountain, forests, a server
// city and the sea beyond a sea of clouds, twisted rock spires at the edge, and a rocky summit carved with a spiral
// whose groove carries a flow of glowing data. ----

/** The carved spiral on the summit, three turns out from the middle of the floor. */
const SUMMIT_SPIRAL = (() => {
  let d = '';
  for (let t = 0; t <= 6 * Math.PI; t += 0.08) {
    const r = 18 + 32 * t;
    d += `${d ? 'L' : 'M'}${(500 + r * Math.cos(t)).toFixed(1)} ${(250 + r * Math.sin(t) * 0.42).toFixed(1)} `;
  }
  return d;
})();
const SUMMIT_ROCKS = scatter(60, 31, ['#3a3048', '#857598', '#5a4c6c'], [1.5, 6]);
/** Grid lines across the sky, converging down toward the horizon. */
const SKY_GRID = [
  ...[34, 62, 96].map(y => `M0 ${y} Q500 ${y - 22} 1000 ${y}`),
  ...Array.from({ length: 19 }, (_, i) => -400 + i * 100).map(x => `M${x} 0 L${(500 + (x - 500) * 0.55).toFixed(0)} 130`),
].join(' ');
const DATA_BITS = Array.from({ length: 16 }, (_, i) => ({ x: 40 + i * 61 + wobble(i, 30), y: 40 + ((i * 53) % 90), s: 3 + (i % 3) }));
const CITY = Array.from({ length: 12 }, (_, i) => ({ x: 668 + i * 11, h: 10 + ((i * 7) % 5) * 7 }));

const spiralSky: Part = id => (
  <svg {...SKY_BOX}>
    <defs>
      <VGrad id={`${id}-sky`} stops={[[0, '#160f3c'], [0.45, '#4a2c70'], [0.8, '#b8637c'], [1, '#f0ae86']]} />
      <radialGradient id={`${id}-sun`}>
        <stop offset="0" stopColor="#d6fbff" stopOpacity="0.9" />
        <stop offset="1" stopColor="#7af2ff" stopOpacity="0" />
      </radialGradient>
    </defs>
    <rect className="day" width="1000" height="200" fill={`url(#${id}-sky)`} />
    <path d={SKY_GRID} fill="none" stroke="#7af2ff" strokeWidth="1" opacity="0.16" />
    <g transform="translate(760 80)">
      <circle r="64" fill={`url(#${id}-sun)`} />
      <circle r="21" fill="#e9fdff" />
      <circle r="30" fill="none" stroke="#7af2ff" strokeWidth="2" strokeDasharray="7 5" opacity="0.8" />
      <circle r="39" fill="none" stroke="#7af2ff" strokeWidth="1" strokeDasharray="3 6" opacity="0.6" />
    </g>
    <g fill="#8af6ff" opacity="0.55">{DATA_BITS.map(b => <rect key={b.x} x={b.x} y={b.y} width={b.s} height={b.s} transform={`rotate(45 ${b.x} ${b.y})`} />)}</g>
    {/* Infinity Mountain, where the children first looked out over File Island. */}
    <path d="M370 184 L452 148 L484 106 L502 88 L520 108 L552 150 L640 184 Z" fill="#6c5c92" />
    <path d="M484 106 L502 88 L520 108 L508 104 L502 112 L494 102 Z" fill="#a99ad0" opacity="0.7" />
    <g fill="#556a86">{[250, 280, 310, 340, 600, 630, 820, 850, 880].map((x, i) => <circle key={x} cx={x} cy={180 + (i % 2) * 2} r={12 + (i % 3) * 3} />)}</g>
    <g fill="#5d5288">{CITY.map(c => <rect key={c.x} x={c.x} y={184 - c.h} width="9" height={c.h} />)}</g>
    <g fill="#ffd98a">{CITY.filter((_, i) => i % 2 === 0).map(c => <rect key={c.x} x={c.x + 3} y={184 - c.h + 4} width="2" height="2" />)}</g>
    <rect y="182" width="1000" height="8" fill="#9c8fc6" opacity="0.8" />
    <g fill="#f6d6e6" opacity="0.85">{Array.from({ length: 14 }, (_, i) => <ellipse key={i} cx={i * 78 + wobble(i, 20)} cy={194} rx={60} ry={9} />)}</g>
    <g fill="#43375a">
      <path d="M0 200 L0 96 Q26 78 44 98 Q64 124 54 156 Q86 166 112 200 Z" />
      <path d="M1000 200 L1000 104 Q974 84 954 104 Q934 132 946 160 Q914 170 888 200 Z" />
    </g>
    <g fill="none" stroke="#6d5e85" strokeWidth="3" opacity="0.8">
      <path d="M4 112 Q30 100 42 118 M8 142 Q36 132 50 150 M12 172 Q48 164 74 182" />
      <path d="M996 120 Q970 108 958 124 M992 150 Q964 140 950 158 M988 178 Q952 170 926 186" />
    </g>
  </svg>
);

const spiralGround: Part = id => (
  <svg {...GROUND_BOX}>
    <defs><VGrad id={`${id}-rock`} stops={[[0, '#544766'], [0.1, '#76668a'], [1, '#4a3e5a']]} /></defs>
    <rect width="1000" height="400" fill={`url(#${id}-rock)`} />
    {SUMMIT_ROCKS.map(({ key, cx, cy, rx, ry, fill }) => <ellipse key={key} cx={cx} cy={cy} rx={rx} ry={ry} fill={fill} opacity="0.65" />)}
    <path {...LINE} d={SUMMIT_SPIRAL} fill="none" stroke="#33293f" strokeWidth="9" strokeLinecap="round" />
    <path {...LINE} d={SUMMIT_SPIRAL} fill="none" stroke="#a090c0" strokeWidth="2.5" transform="translate(0 -5)" opacity="0.8" />
    <path {...LINE} className="data-flow" d={SUMMIT_SPIRAL} fill="none" stroke="#6ef2ff" strokeWidth="2" strokeDasharray="14 22" opacity="0.65" />
  </svg>
);

// ---- Night (the dark theme): each scene's sky becomes a night sky with stars and the moon behind its scenery; the
// scenery and the ground are dimmed (index.css). The day sky, sun, clouds and sunbeams (class "day") are hidden. ----

/** Night sky colours (top, horizon) and where the moon is (none at Spiral Mountain, whose data sphere stays). */
const NIGHT: Record<BattleBackground, { top: string; low: string; moon?: Pt }> = {
  battletree: { top: '#060c22', low: '#1f3a6c', moon: [612, 124] },
  grass: { top: '#08112a', low: '#22385f', moon: [560, 116] },
  stadium: { top: '#03050f', low: '#141a3c', moon: [520, 30] },
  mountain: { top: '#070c22', low: '#2a3a66', moon: [590, 106] },
  ocean: { top: '#050f26', low: '#1d3d6e', moon: [520, 114] },
  forest: { top: '#06121c', low: '#1c3a46', moon: [430, 104] },
  spiralmountain: { top: '#07041a', low: '#3a1d56' },
};
/** Stars: small ones everywhere, fewer and fainter toward the horizon; some twinkle. */
const STARS = (() => {
  let seed = 41;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  return Array.from({ length: 110 }, (_, i) => {
    const y = rnd() ** 1.25 * 176;
    return { key: i, cx: +(rnd() * 1000).toFixed(1), cy: +y.toFixed(1), r: +(0.5 + rnd() * (y < 120 ? 1.3 : 0.8)).toFixed(2), o: +(0.95 - (y / 176) * 0.5 - rnd() * 0.2).toFixed(2), twinkle: i % 7 === 0 };
  });
})();

function nightSky(scene: BattleBackground, id: string): ReactNode {
  const n = NIGHT[scene];
  return (
    <svg {...SKY_BOX} className="night-sky">
      <defs>
        <VGrad id={`${id}-night`} stops={[[0, n.top], [1, n.low]]} />
        <radialGradient id={`${id}-moonglow`}>
          <stop offset="0" stopColor="#fdf6d8" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fdf6d8" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1000" height="200" fill={`url(#${id}-night)`} />
      <g fill="#ffffff">
        {STARS.map(st => <circle key={st.key} className={st.twinkle ? 'twinkle' : undefined} cx={st.cx} cy={st.cy} r={st.r} opacity={Math.max(0.2, st.o)} style={{ animationDelay: `${(st.key % 5) * 0.6}s` }} />)}
      </g>
      {n.moon && (
        <g transform={`translate(${n.moon[0]} ${n.moon[1]})`}>
          <circle r="46" fill={`url(#${id}-moonglow)`} />
          <circle r="15" fill="#fbf3d2" />
          <circle cx="-4" cy="-3" r="3" fill="#e6dcb4" opacity="0.7" /><circle cx="5" cy="4" r="2.2" fill="#e6dcb4" opacity="0.6" /><circle cx="3" cy="-7" r="1.5" fill="#e6dcb4" opacity="0.6" />
        </g>
      )}
    </svg>
  );
}

const SKIES: Partial<Record<BattleBackground, Part>> = { battletree: treeSky, stadium: stadiumSky, mountain: mountainSky, ocean: oceanSky, forest: forestSky, spiralmountain: spiralSky };
const GROUNDS: Partial<Record<BattleBackground, Part>> = { battletree: treeGround, stadium: stadiumGround, mountain: mountainGround, ocean: oceanGround, forest: forestGround, spiralmountain: spiralGround };

/** The scenery behind the battle: the one picked in Settings, or `kind` (Settings' previews). */
export function StageBackdrop({ kind }: { kind?: BattleBackground }) {
  const { battleBackground } = useAppSettings();
  const bg = kind ?? battleBackground;
  const id = `bg${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <div className={`stage-backdrop bg-${bg}`} aria-hidden="true">
      <div className="backdrop-sky">{nightSky(bg, id)}{SKIES[bg]?.(id)}</div>
      <div className="backdrop-ground">{GROUNDS[bg]?.(id)}</div>
    </div>
  );
}
