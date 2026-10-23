import type { SemiInvulnerable } from '../../client/semi-invulnerable';
import { useEffect, useState, type CSSProperties } from 'react';
import { classifyMove } from '../../client/move-class';
import { HITMONCHANIUM_Z, POLIWRATHIUM_Z } from '../../data/custom';
import { WARP_DIGIMON, warpNames } from '../../data/custom/digimon';
import {
  abilityDuration, PARADOX_BOOST_MS, CHARGED_MOVE_MS, IMMUNE_MS, SKY_DROPPED_MS, SOLAR_CHARGE_MS, BALLOON_IN_MS, BALLOON_POP_MS, SASH_MS, STURDY_MS, ITEM_MS, MOVE_RETURN_MS, FRISK_MS, BERRY_MS, BLOCKED_MS, CANT_MS, CHARGED_MS, CONFUSED_MS, DRAIN_MS, FIELD_MS, MEGA_MS, MEGA_START_MS, FUTURE_HIT_MS, moveDuration, ROOMS, SIGNATURE_MS, SEEDED_MS, SIDE_MS, STATUS_MS, SUB_END_MS, SUB_HIT_MS,
  SUB_START_MS, WARP_MS, WARP_START_MS, type BattleAnimation,
} from '../../client/playback';
import { ANIMATION_SPEED_FACTOR } from '../../settings/settings-store';
import { gen7 } from '../../team/dex';
import { useAppSettings } from '../useAppSettings';
import { useElementSize } from '../useElementSize';
import { BOOST_STATS } from './fx/catalog';
import { horizonVar } from './fx/geometry';
import { MoveEffects } from './fx/MoveEffects';
import { SIGNATURE_MOVE_FX } from './fx/signature-moves';
import { effectAnchors, effectPoints, effectSpec, shakeProps } from './fx/stage-fx';
import { useSpritePoints } from './fx/useSpritePoints';
import { FieldLayers } from './FieldLayers';
import { StageBackdrop } from './StageBackdrop';
import { TailwindCue } from './TailwindCue';
import { ShieldWalls } from './ShieldWalls';
import { StageSpot } from './StageSpot';

type Side = 'p1' | 'p2';
type Step = Omit<BattleAnimation, 'id'>;

const SIGNATURE_MS_IDS = Object.keys(SIGNATURE_MS);
/** One physical and one special example per type, then status families, draining moves and Z-Moves. */
const GROUPS: { label: string; moves: string[] }[] = [
  { label: 'Physical', moves: ['Return', 'Fire Punch', 'Waterfall', 'Wild Charge', 'Leaf Blade', 'Icicle Crash', 'Cross Chop', 'Poison Jab', 'Earthquake', 'Drill Peck', 'Zen Headbutt', 'X-Scissor', 'Stone Edge', 'Shadow Claw', 'Dragon Claw', 'Crunch', 'Iron Head', 'Play Rough'] },
  { label: 'Special', moves: ['Hyper Voice', 'Flamethrower', 'Surf', 'Thunderbolt', 'Energy Ball', 'Ice Beam', 'Aura Sphere', 'Sludge Bomb', 'Earth Power', 'Air Slash', 'Psychic', 'Bug Buzz', 'Power Gem', 'Shadow Ball', 'Dragon Pulse', 'Dark Pulse', 'Flash Cannon', 'Moonblast'] },
  // Every move over 100 power has its own animation (catalog BIG_MOVES, plus Solar Beam): strongest first.
  { label: 'Over 100 power', moves: [...SIGNATURE_MS_IDS].map(id => gen7.moves.get(id)).filter(m => !!m && m.basePower > 100).sort((a, b) => b!.basePower - a!.basePower || a!.name.localeCompare(b!.name)).map(m => m!.name) },
  { label: 'Status', moves: ['Swords Dance', 'Calm Mind', 'Charge', 'Growl', 'Screech', 'Thunder Wave', 'Will-O-Wisp', 'Toxic', 'Spore', 'Confuse Ray', 'Attract', 'Leech Seed', 'Substitute', 'Protect', 'Detect', "King's Shield", 'Spiky Shield', 'Baneful Bunker', 'Recover', 'Roost', 'Rain Dance', 'Sunny Day', 'Electric Terrain', 'Grassy Terrain', 'Psychic Terrain', 'Misty Terrain', 'Trick Room', 'Magic Room', 'Wonder Room', 'Gravity', 'Reflect', 'Light Screen', 'Aurora Veil', 'Safeguard', 'Mist', 'Stealth Rock', 'Spikes', 'Tailwind', 'Roar'] },
  { label: 'Draining', moves: ['Giga Drain', 'Drain Punch', 'Draining Kiss', 'Leech Life', 'Horn Leech'] },
  {
    label: 'Z-Moves',
    moves: ['Breakneck Blitz', 'Inferno Overdrive', 'Hydro Vortex', 'Gigavolt Havoc', 'Bloom Doom', 'Subzero Slammer', 'All-Out Pummeling', 'Acid Downpour', 'Tectonic Rage',
      'Supersonic Skystrike', 'Shattered Psyche', 'Savage Spin-Out', 'Continental Crush', 'Never-Ending Nightmare', 'Devastating Drake', 'Black Hole Eclipse', 'Corkscrew Crash', 'Twinkle Tackle'],
  },
  {
    label: 'Signature Z-Moves',
    moves: ['Catastropika', '10,000,000 Volt Thunderbolt', 'Stoked Sparksurfer', 'Pulverizing Pancake', 'Sinister Arrow Raid', 'Malicious Moonsault', 'Oceanic Operetta',
      'Guardian of Alola', 'Soul-Stealing 7-Star Strike', 'Clangorous Soulblaze', 'Splintered Stormshards', "Let's Snuggle Forever", 'Searing Sunraze Smash',
      'Menacing Moonraze Maelstrom', 'Light That Burns the Sky', 'Genesis Supernova', 'Omega Wrath', 'Riptide Rocket Rush', 'Glacial Guardian Gauntlet'],
  },
  { label: 'Hitmonchanium Z (custom)', moves: Object.values(HITMONCHANIUM_Z.moves).map(z => z.name) },
  // Every signature move with its own animation (signature-moves.ts), by name.
  { label: 'Signature moves', moves: Object.keys(SIGNATURE_MOVE_FX).map(id => gen7.moves.get(id)!.name).sort() },
  { label: 'Signature (Digimon)', moves: ['Gaia Force', 'Cocytus Pulse', 'Pepper Breath', 'Fox Fire', 'Dramon Breaker', 'Dark Gaia Force', 'Dramon Destroyer', 'Super Shocker', 'Giga Blaster', 'Pyro Fang', 'Lightning Joust', 'Shield of Just', 'Petit Twister', 'Burst Shot', 'Giant Missile', 'Diamond Shuriken', 'Amethyst Mandala'] },
];
/** Z-Moves whose category comes from the base move (type Z-Moves and Poliwrath's: power-1 placeholders); signature ones have their own. */
const zFromBaseMove = (name: string) => classifyMove(name).kind === 'z' && gen7.moves.get(name)?.basePower === 1;
const SPECIES: Record<Side, [string, string]> = { p1: ['Salamence', 'Salamence-Mega'], p2: ['Garchomp', 'Garchomp-Mega'] };
/** Poliwrath's and Hitmonchan's own Z-Moves are previewed with them as the user. */
const POLIWRATH_Z_MOVES = new Set(Object.values(POLIWRATHIUM_Z.moves).map(z => z.name));
const HITMONCHAN_Z_MOVES = new Set(Object.values(HITMONCHANIUM_Z.moves).map(z => z.name));
const zUser = (move: string) => (POLIWRATH_Z_MOVES.has(move) ? POLIWRATHIUM_Z.user : HITMONCHAN_Z_MOVES.has(move) ? HITMONCHANIUM_Z.user : null);
/** Warp Digivolution preview: the chosen Digimon steps in, then becomes its warp form. */
const baseOfWarp = (form: string) => WARP_DIGIMON.find(d => d.warp.name === form)?.base.name ?? form;
const other = (s: Side): Side => (s === 'p1' ? 'p2' : 'p1');
/** Abilities that take in or stop a move, for the preview (the healing ones show +25%). */
const PREVIEW_ABILITIES = ['Water Absorb', 'Volt Absorb', 'Dry Skin', 'Motor Drive', 'Lightning Rod', 'Storm Drain', 'Sap Sipper', 'Flash Fire', 'Levitate', 'Elevate', 'Air Balloon', 'Soundproof'];
const HEALING_ABILITIES = new Set(['Water Absorb', 'Volt Absorb', 'Dry Skin']);
/** Berries for the preview (what each does next: HP, a cure, a stat rise, weakening a hit). */
/** Type immunities for the preview (the move's type, or what's blocked, then the immune Pokémon's type). */
const PREVIEW_IMMUNITIES = ['normal-ghost', 'fighting-ghost', 'ghost-normal', 'electric-ground', 'ground-flying', 'psychic-dark', 'poison-steel', 'dragon-fairy',
  'leechseed-grass', 'powder-grass', 'par-electric', 'brn-fire', 'psn-poison', 'sheercold-ice', 'prankster-dark'];
const typeName = (id: string) => id.charAt(0).toUpperCase() + id.slice(1);
/** What a non-type-chart immunity blocks, for the preview's labels. */
const BLOCKED_NAMES: Record<string, string> = { leechseed: 'Leech Seed', powder: 'Powder', par: 'Paralysis', brn: 'Burn', psn: 'Poison', sheercold: 'Sheer Cold', prankster: 'Prankster' };
const PREVIEW_BERRIES = ['Sitrus Berry', 'Lum Berry', 'Chesto Berry', 'Liechi Berry', 'Salac Berry', 'Occa Berry', 'Figy Berry', 'Custap Berry', 'Enigma Berry'];
/** Held items used up, for the preview; those that raise a stat show the rise next. */
const PREVIEW_ITEMS = ['White Herb', 'Mental Herb', 'Power Herb', 'Weakness Policy', 'Red Card', 'Eject Button', 'Absorb Bulb', 'Cell Battery', 'Snowball', 'Luminous Moss', 'Electric Seed', 'Grassy Seed', 'Psychic Seed', 'Misty Seed', 'Adrenaline Orb'];
const BOOSTING_ITEMS = new Set(['Weakness Policy', 'Absorb Bulb', 'Cell Battery', 'Snowball', 'Luminous Moss', 'Electric Seed', 'Grassy Seed', 'Psychic Seed', 'Misty Seed', 'Adrenaline Orb']);

/** What the preview stage shows besides the sprites (what the battle state would hold). */
interface FieldState {
  mega: Record<Side, boolean>;
  /** Warp Digivolution preview: the Digimon (stage 1) or its warp form (stage 2) stands in. */
  digimon: Record<Side, { form: string; stage: 1 | 2 } | null>;
  sub: Record<Side, boolean>;
  seeded: Record<Side, boolean>;
  /** Charge / Electromorphosis: lasts until its next move (Charge) or Electric move (Electromorphosis). */
  charged: Record<Side, boolean>;
  tailwind: Record<Side, boolean>;
  shields: Record<Side, string[]>;
  status: Record<Side, string | undefined>;
  confused: Record<Side, boolean>;
  infatuated: Record<Side, boolean>;
  protect: Record<Side, string | null>;
  terrain: string | null;
  rooms: string[];
}
const EMPTY: FieldState = {
  mega: { p1: false, p2: false }, digimon: { p1: null, p2: null }, sub: { p1: false, p2: false }, seeded: { p1: false, p2: false }, shields: { p1: [], p2: [] },
  charged: { p1: false, p2: false }, tailwind: { p1: false, p2: false }, status: { p1: undefined, p2: undefined }, confused: { p1: false, p2: false }, infatuated: { p1: false, p2: false },
  protect: { p1: null, p2: null }, terrain: null, rooms: [],
};
const MAJOR_STATUS = ['par', 'brn', 'psn', 'tox', 'slp', 'frz'];

/** State change when a step starts (as the battle client applies a line before animating it). */
function applyStep(f: FieldState, step: Step): FieldState {
  const c = step.condition;
  if (step.kind === 'field-start' && c) return c.endsWith('terrain') ? { ...f, terrain: c } : { ...f, rooms: [...f.rooms, c] };
  if (step.kind === 'field-end' && c) return c.endsWith('terrain') ? { ...f, terrain: null } : { ...f, rooms: f.rooms.filter(r => r !== c) };
  const s = step.side;
  if (!s) return f;
  switch (step.kind) {
    case 'move': {
      // Charge wears off once the Pokémon uses another move (shown as the move starts, in the preview).
      const g = f.charged[s] && step.fx?.moveId !== 'charge' ? { ...f, charged: { ...f.charged, [s]: false } } : f;
      return step.fx?.kind === 'protect' && step.fx.moveId !== 'endure' ? { ...g, protect: { ...g.protect, [s]: step.fx.moveId } } : g;
    }
    case 'charged': return { ...f, charged: { ...f.charged, [s]: true } };
    case 'status': return { ...f, status: { ...f.status, [s]: c } };
    case 'cure': return { ...f, status: { ...f.status, [s]: undefined } };
    case 'confused': return { ...f, confused: { ...f.confused, [s]: true } };
    case 'infatuated': return { ...f, infatuated: { ...f.infatuated, [s]: true } };
    case 'mega': return { ...f, mega: { ...f.mega, [s]: true } };
    case 'warp-start': return c ? { ...f, digimon: { ...f.digimon, [s]: { form: c, stage: 1 } } } : f;
    case 'warp': return c ? { ...f, digimon: { ...f.digimon, [s]: { form: c, stage: 2 } } } : f;
    case 'sub-start': return { ...f, sub: { ...f.sub, [s]: true } };
    case 'sub-end': return { ...f, sub: { ...f.sub, [s]: false } };
    case 'seeded': return { ...f, seeded: { ...f.seeded, [s]: true } };
    case 'side-start': if (step.condition === 'tailwind') return { ...f, tailwind: { ...f.tailwind, [s]: true } };
      return step.condition && !f.shields[s].includes(step.condition) ? { ...f, shields: { ...f.shields, [s]: [...f.shields[s], step.condition] } } : f;
    case 'side-end': if (step.condition === 'tailwind') return { ...f, tailwind: { ...f.tailwind, [s]: false } };
      return { ...f, shields: { ...f.shields, [s]: f.shields[s].filter(c => c !== step.condition) } };
    default: return f;
  }
}

/** `zCategory`: a type Z-Move's category comes from its base move (Physical or Special). */
function moveSteps(name: string, side: Side, f: FieldState, zCategory: 'Physical' | 'Special' = 'Physical', crit = false): Step[] {
  const classified = classifyMove(name);
  const base = zFromBaseMove(name) ? { ...classified, category: zCategory } : classified;
  // Charged (Charge, Electromorphosis): Giga Blaster's bigger animation, as in battle.
  const fx = f.charged[side] && CHARGED_MOVE_MS[base.moveId] ? { ...base, charged: true } : base;
  const foe = other(side);
  const target = fx.category === 'Status' && ['powerup', 'protect', 'heal', 'substitute', 'field'].includes(fx.kind) && fx.field !== 'hazard' ? side : foe;
  const steps: Step[] = [];
  if (fx.kind === 'z') steps.push({ kind: 'zpower', side, target: null, durationMs: 1100 });
  // Solar Beam: its charging turn (absorbing light) first.
  if (fx.moveId === 'solarbeam') steps.push({ kind: 'solar-charge', side, target: null, condition: 'solarbeam', durationMs: SOLAR_CHARGE_MS });
  steps.push({ kind: 'move', side, target, moveName: name, moveType: fx.type, moveCategory: fx.category, fx, durationMs: moveDuration(fx) });
  if (fx.moveId === 'charge') steps.push({ kind: 'charged', side, target: null, durationMs: CHARGED_MS });
  if (fx.kind === 'substitute' && !f.sub[side]) {
    steps.push({ kind: 'sub-start', side, target: null, durationMs: SUB_START_MS });
    steps.push({ kind: 'hit', side, target: null, hpDelta: -25, durationMs: 600 });
  }
  if (fx.condition === 'leechseed' && !f.sub[foe]) {
    steps.push({ kind: 'seeded', side: foe, target: null, durationMs: SEEDED_MS });
    steps.push(...drainSteps(foe));
  }
  if (fx.condition && MAJOR_STATUS.includes(fx.condition) && !f.sub[foe] && !f.status[foe]) steps.push(statusStep(foe, fx.condition));
  if (fx.condition === 'confusion' && !f.sub[foe]) steps.push({ kind: 'confused', side: foe, target: null, durationMs: CONFUSED_MS });
  if (fx.condition === 'attract') steps.push({ kind: 'infatuated', side: foe, target: null, durationMs: CONFUSED_MS });
  if (fx.field === 'terrain') steps.push({ kind: 'field-start', side, target: null, condition: fx.moveId, durationMs: FIELD_MS });
  if (fx.field === 'room' && (ROOMS as readonly string[]).includes(fx.moveId)) {
    // Rooms toggle: using one while it's up ends it.
    steps.push({ kind: f.rooms.includes(fx.moveId) ? 'field-end' : 'field-start', side, target: null, condition: fx.moveId, durationMs: FIELD_MS });
  }
  if (fx.field === 'tailwind' && !f.tailwind[side]) steps.push({ kind: 'side-start', side, target: null, condition: 'tailwind', durationMs: SIDE_MS });
  if (fx.field === 'screen' && !f.shields[side].includes(fx.moveId)) {
    steps.push({ kind: 'side-start', side, target: null, condition: fx.moveId, durationMs: SIDE_MS });
  }
  // Future Sight / Doom Desire: shown landing straight away (two turns later in battle).
  if (fx.moveId === 'futuresight' || fx.moveId === 'doomdesire') steps.push({ kind: 'future-hit', side: foe, target: null, condition: fx.moveId, durationMs: FUTURE_HIT_MS });
  if (fx.category !== 'Status' && f.protect[foe]) {
    steps.push({ kind: 'blocked', side: foe, target: null, condition: f.protect[foe]!, durationMs: BLOCKED_MS });
  } else if (fx.category !== 'Status') {
    steps.push(f.sub[foe]
      ? { kind: 'sub-hit', side: foe, target: null, crit: crit || undefined, durationMs: SUB_HIT_MS }
      : { kind: 'hit', side: foe, target: null, hpDelta: crit ? -55 : -38, crit: crit || undefined, durationMs: 600 });
    if (gen7.moves.get(name)?.drain) steps.push({ kind: 'absorb', side, target: foe, hpDelta: 19, durationMs: DRAIN_MS });
    // Bonemerang's second hit: the bone comes back, strikes again and returns to the thrower.
    if (fx.moveId === 'bonemerang' && !f.sub[foe]) {
      steps.push({ kind: 'move-return', side, target: foe, condition: 'bonemerang', durationMs: MOVE_RETURN_MS });
      steps.push({ kind: 'hit', side: foe, target: side, hpDelta: -38, condition: 'bonemerang', durationMs: 600 });
    }
  }
  return steps;
}

const statusStep = (side: Side, condition: string): Step => ({ kind: 'status', side, target: null, condition, durationMs: STATUS_MS });

/** The end of a turn: Leech Seed, burn and poison damage; Protect wears off. */
function endTurnSteps(f: FieldState): Step[] {
  const steps: Step[] = [];
  for (const s of ['p1', 'p2'] as const) {
    if (f.seeded[s]) steps.push(...drainSteps(s));
    const st = f.status[s];
    if (st === 'brn' || st === 'psn' || st === 'tox') steps.push({ kind: 'residual', side: s, target: null, condition: st === 'tox' ? 'psn' : st, hpDelta: -12, durationMs: 600 });
  }
  return steps;
}

/** A Pokémon held back by its condition (fully paralyzed, asleep, frozen, confused, in love). */
function cantSteps(f: FieldState, s: Side): Step[] {
  const st = f.status[s];
  if (st === 'par' || st === 'slp' || st === 'frz') return [{ kind: 'cant', side: s, target: null, condition: st, durationMs: CANT_MS }];
  if (f.confused[s]) return [
    { kind: 'confused', side: s, target: null, durationMs: CONFUSED_MS },
    { kind: 'residual', side: s, target: null, condition: 'confusion', hpDelta: -10, durationMs: 600 },
  ];
  if (f.infatuated[s]) return [{ kind: 'cant', side: s, target: null, condition: 'attract', durationMs: CANT_MS }];
  return [];
}

/** End-of-turn Leech Seed: the seeded Pokémon loses HP to the other one. */
function drainSteps(seeded: Side): Step[] {
  return [
    { kind: 'leech', side: seeded, target: other(seeded), hpDelta: -12, durationMs: DRAIN_MS },
    { kind: 'heal', side: other(seeded), target: null, hpDelta: 12, durationMs: 500 },
  ];
}

/** Debug tool: plays any move's animation on a stand-alone stage. */
export function AnimationPreview() {
  const settings = useAppSettings();
  const speed = ANIMATION_SPEED_FACTOR[settings.animationSpeed] || 1;
  const [move, setMove] = useState('Earthquake');
  const [zCategory, setZCategory] = useState<'Physical' | 'Special'>('Physical');
  const [crit, setCrit] = useState(false);
  const [side, setSide] = useState<Side>('p1');
  const [warpForm, setWarpForm] = useState(WARP_DIGIMON[0].warp.name);
  const [field, setField] = useState<FieldState>(EMPTY);
  // Preview of a Pokémon out of reach for a turn (Dig, Fly, Dive, Phantom Force), set by hand.
  const [hidden, setHidden] = useState<Record<Side, SemiInvulnerable | null>>({ p1: null, p2: null });
  const [run, setRun] = useState<{ steps: Step[]; index: number } | null>(null);
  const [runs, setRuns] = useState(0);
  const [stageRef, size] = useElementSize<HTMLDivElement>();

  useEffect(() => {
    if (!run) return;
    const step = run.steps[run.index];
    const t = setTimeout(() => {
      const next = run.steps[run.index + 1];
      if (next) setField(f => applyStep(f, next));
      setRun(r => (r && r.index + 1 < r.steps.length ? { ...r, index: r.index + 1 } : null));
    }, step.durationMs * speed);
    return () => clearTimeout(t);
  }, [run, speed]);

  const play = (steps: Step[]) => {
    if (!steps.length) return;
    setField(f => applyStep(f, steps[0]));
    setRuns(n => n + 1);
    setRun({ steps, index: 0 });
  };
  const anim: BattleAnimation | null = run ? { ...run.steps[run.index], id: runs * 100 + run.index } : null;
  const spec = anim ? effectSpec(anim) : null;
  const anchors = spec && anim ? effectAnchors(anim) : null;
  const shake = shakeProps(spec, anim);
  const points = useSpritePoints(stageRef, `${anim?.id}:${size.w}x${size.h}`);
  const subSide: Side | null = field.sub[side] ? side : field.sub[other(side)] ? other(side) : null;
  const anyShields = field.shields.p1.length + field.shields.p2.length > 0 || field.tailwind.p1 || field.tailwind.p2;
  const held = cantSteps(field, side);
  const endTurn = () => {
    setField(f => ({ ...f, protect: { p1: null, p2: null } }));
    const steps = endTurnSteps(field);
    if (steps.length) play(steps);
  };

  return (
    <details className="card anim-preview">
      <summary>Animation preview</summary>
      <div className="setup">
        <label>
          Move{' '}
          <select value={move} onChange={e => setMove(e.target.value)}>
            {GROUPS.map(g => (
              <optgroup key={g.label} label={g.label}>
                {g.moves.map(m => <option key={m} value={m}>{m} ({classifyMove(m).type})</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        <label>
          Used by{' '}
          <select value={side} onChange={e => setSide(e.target.value as Side)}>
            <option value="p1">You</option>
            <option value="p2">Opponent</option>
          </select>
        </label>
        {zFromBaseMove(move) && (
          <label>
            Z-Move from a{' '}
            <select value={zCategory} onChange={e => setZCategory(e.target.value as 'Physical' | 'Special')}>
              <option value="Physical">physical</option>
              <option value="Special">special</option>
            </select>{' '}move
          </label>
        )}
        <label className="small"><input type="checkbox" checked={crit} onChange={e => setCrit(e.target.checked)} /> Critical hit</label>
        <button className="primary" onClick={() => play(moveSteps(move, side, field, zCategory, crit))}>Play</button>
        <button disabled={field.mega[side]} onClick={() => play([
          { kind: 'mega-start', side, target: null, durationMs: MEGA_START_MS },
          { kind: 'mega', side, target: null, durationMs: MEGA_MS },
        ])}>Mega Evolve</button>
        <select aria-label="Digimon" value={warpForm} onChange={e => setWarpForm(e.target.value)}>
          {WARP_DIGIMON.map(d => <option key={d.warp.name} value={d.warp.name}>{d.base.name} → {d.warp.name}</option>)}
        </select>
        <button disabled={field.digimon[side]?.form === warpForm && field.digimon[side]?.stage === 2} onClick={() => play([
          { kind: 'warp-start', side, target: null, condition: warpForm, durationMs: WARP_START_MS },
          { kind: 'warp', side, target: null, condition: warpForm, durationMs: WARP_MS },
        ])}>{warpNames(warpForm).verb}</button>
        <button onClick={() => play([{ kind: 'charged', side, target: null, label: 'Electromorphosis', durationMs: CHARGED_MS }])}>Electromorphosis</button>
        <select aria-label="Paradox boost" value="" onChange={e => {
          const [label, stat] = e.target.value.split(':');
          e.target.value = '';
          if (stat) play([{ kind: 'paradox-boost', side, target: null, condition: stat, label, durationMs: PARADOX_BOOST_MS }]);
        }}>
          <option value="">Paradox boost…</option>
          {['Protosynthesis', 'Quark Drive'].map(a => (
            <optgroup key={a} label={a}>
              {Object.entries(BOOST_STATS).map(([stat, { label }]) => <option key={stat} value={`${a}:${stat}`}>{label}</option>)}
            </optgroup>
          ))}
        </select>
        <button onClick={() => play([
          { kind: 'balloon-pop', side: other(side), target: null, durationMs: BALLOON_POP_MS },
        ])}>{side === 'p1' ? "Opponent's" : 'Your'} Air Balloon pops</button>
        <label>
          {side === 'p1' ? 'You' : 'Opponent'}:{' '}
          <select aria-label="Item activates" value="" onChange={e => {
            const v = e.target.value;
            e.target.value = '';
            if (v === 'airballoon') play([{ kind: 'balloon-in', side, target: null, durationMs: BALLOON_IN_MS }]);
            else if (v === 'sturdy') play([{ kind: 'hit', side, target: null, hpDelta: -99, durationMs: 600 }, { kind: 'sturdy', side, target: null, durationMs: STURDY_MS }]);
            else if (v) play([{ kind: 'hit', side, target: null, hpDelta: -99, durationMs: 600 }, { kind: 'sash', side, target: null, condition: v, durationMs: SASH_MS }]);
          }}>
            <option value="">item…</option>
            <option value="airballoon">Comes in with an Air Balloon</option>
            <option value="focussash">Focus Sash</option>
            <option value="focusband">Focus Band</option>
            <option value="sturdy">Sturdy (Ability)</option>
          </select>
        </label>
        <button disabled={!subSide} onClick={() => subSide && play([{ kind: 'sub-end', side: subSide, target: null, durationMs: SUB_END_MS }])}>Break Substitute</button>
        <label>
          {side === 'p1' ? 'Opponent' : 'You'}{' '}takes it in{' '}
          <select aria-label="Ability takes in the move" value="" onChange={e => {
            const name = e.target.value;
            e.target.value = '';
            if (name) play([{ kind: 'ability', side: other(side), target: side, condition: name.toLowerCase().replace(/[^a-z0-9]/g, ''), label: name, hpDelta: HEALING_ABILITIES.has(name) ? 25 : undefined, durationMs: abilityDuration(name.toLowerCase().replace(/[^a-z0-9]/g, '')) }]);
          }}>
            <option value="">Ability…</option>
            {PREVIEW_ABILITIES.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label>
          No effect on {side === 'p1' ? 'opponent' : 'you'}{' '}
          <select aria-label="Type immunity" value="" onChange={e => {
            const pair = e.target.value;
            e.target.value = '';
            if (pair) play([
              { kind: 'move', side, target: other(side), moveName: 'Attack', still: true, durationMs: 450 },
              { kind: 'immune', side: other(side), target: side, condition: pair, durationMs: IMMUNE_MS },
            ]);
          }}>
            <option value="">types…</option>
            {PREVIEW_IMMUNITIES.map(p => <option key={p} value={p}>{p.split('-').map(id => BLOCKED_NAMES[id] ?? typeName(id)).join(' → ')}</option>)}
          </select>
        </label>
        <label>
          {side === 'p1' ? 'You' : 'Opponent'}{' '}eat{side === 'p1' ? '' : 's'}{' '}
          <select aria-label="Eat a Berry" value="" onChange={e => {
            const v = e.target.value;
            e.target.value = '';
            if (!v) return;
            // "steal:": Bug Bite / Pluck, eating the other Pokémon's Berry.
            const stolen = v.startsWith('steal:');
            const berry = stolen ? v.slice('steal:'.length) : v;
            play([
              { kind: 'berry', side, target: stolen ? other(side) : null, label: berry, durationMs: BERRY_MS },
              ...(berry === 'Sitrus Berry' || berry === 'Figy Berry' || berry === 'Enigma Berry' ? [{ kind: 'heal', side, target: null, hpDelta: 25, durationMs: 500 } as Step] : []),
              ...(berry === 'Liechi Berry' || berry === 'Salac Berry' ? [{ kind: 'boost', side, target: null, durationMs: 450 } as Step] : []),
            ]);
          }}>
            <option value="">Berry…</option>
            {PREVIEW_BERRIES.map(b => <option key={b} value={b}>{b}</option>)}
            <option value="steal:Sitrus Berry">Bug Bite: steal a Sitrus Berry</option>
          </select>
        </label>
        <label>
          {side === 'p1' ? 'You' : 'Opponent'}{' '}use{side === 'p1' ? '' : 's'}{' '}
          <select aria-label="Use up a held item" value="" onChange={e => {
            const item = e.target.value;
            e.target.value = '';
            if (!item) return;
            // "frisk:": your Frisk finds the other Pokémon's item.
            if (item.startsWith('frisk:')) return play([{ kind: 'frisk', side: other(side), target: side, label: item.slice('frisk:'.length), durationMs: FRISK_MS }]);
            const used: Step = { kind: 'item', side, target: item === 'Red Card' ? other(side) : null, label: item, condition: item.toLowerCase().replace(/[^a-z0-9]/g, ''), durationMs: ITEM_MS };
            // Power Herb: Solar Beam fires on its charging turn.
            if (item === 'Power Herb') {
              const [charge, ...beam] = moveSteps('Solar Beam', side, field);
              return play([charge, used, ...beam]);
            }
            play([used, ...(BOOSTING_ITEMS.has(item) ? [{ kind: 'boost', side, target: null, durationMs: 450 } as Step] : [])]);
          }}>
            <option value="">item…</option>
            {PREVIEW_ITEMS.map(t => <option key={t} value={t}>{t}</option>)}
            {['Leftovers', 'Choice Scarf', 'Life Orb', 'Air Balloon'].map(t => <option key={`frisk:${t}`} value={`frisk:${t}`}>Frisk finds: {t}</option>)}
          </select>
        </label>
        <label>
          Inflict on {side === 'p1' ? 'opponent' : 'you'}{' '}
          <select value="" onChange={e => { const c = e.target.value; e.target.value = ''; if (c) play([statusStep(other(side), c)]); }}>
            <option value="">status…</option>
            {MAJOR_STATUS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label>
          Charging turn{' '}
          <select aria-label="Charging turn" value={hidden[side] ?? ''} onChange={e => setHidden(h => ({ ...h, [side]: (e.target.value || null) as SemiInvulnerable | null }))}>
            <option value="">none</option>
            <option value="underground">Dig</option>
            <option value="sky">Fly</option>
            <option value="underwater">Dive</option>
            <option value="phantom">Phantom Force</option>
            <option value="carried">Carried off by Sky Drop</option>
          </select>
        </label>
        <button disabled={hidden[other(side)] !== 'carried'} onClick={() => {
          // Sky Drop's attack: the user comes down, and the Pokémon it carried is dropped (then takes the hit).
          setHidden(h => ({ ...h, [side]: null }));
          play([
            { kind: 'sky-dropped', side: other(side), target: null, durationMs: SKY_DROPPED_MS },
            { kind: 'hit', side: other(side), target: null, hpDelta: -30, durationMs: 600 },
          ]);
          setTimeout(() => setHidden(h => ({ ...h, [other(side)]: null })), SKY_DROPPED_MS * speed);
        }}>Sky Drop lands</button>
        <button disabled={!held.length} onClick={() => play(held)}>Held back</button>
        <button onClick={endTurn}>End turn</button>
        <button disabled={!anyShields} onClick={() => play((['p1', 'p2'] as const).flatMap(s => [...field.shields[s], ...(field.tailwind[s] ? ['tailwind'] : [])].map(c => (
          { kind: 'side-end', side: s, target: null, condition: c, durationMs: SIDE_MS } as Step
        ))))}>Screens / Tailwind wear off</button>
        <button onClick={() => { setRun(null); setField(EMPTY); setHidden({ p1: null, p2: null }); }}>Reset</button>
      </div>
      <div ref={stageRef} className={`stage${settings.sprites && settings.spriteStyle === '2d' ? ' pixel-sprites' : ''}`} style={{ '--spd': speed, ...horizonVar } as CSSProperties}>
        <StageBackdrop />
        <div className={`stage-field ${shake.className}`} style={shake.style}>
          <FieldLayers terrain={field.terrain} rooms={field.rooms} anim={anim} />
          {(['p2', 'p1'] as const).filter(s => field.tailwind[s]).map(s => <TailwindCue key={s} side={s} />)}
          {(['p2', 'p1'] as const).map(s => (
            <StageSpot
              key={s} side={s} pokemon={{ species: field.digimon[s] ? (field.digimon[s]!.stage === 2 ? field.digimon[s]!.form : baseOfWarp(field.digimon[s]!.form)) : s === side && zUser(move) && !field.mega[s] ? zUser(move)! : SPECIES[s][field.mega[s] ? 1 : 0] }} anim={anim}
              substitute={field.sub[s]} seeded={field.seeded[s]} charged={field.charged[s]} status={field.status[s]} confused={field.confused[s]}
              infatuated={field.infatuated[s]} protect={field.protect[s]} hidden={hidden[s]}
            />
          ))}
          {(['p2', 'p1'] as const).map(s => (
            <ShieldWalls key={s} side={s} conditions={field.shields[s]} anim={anim} size={size} points={points} />
          ))}
          {spec && anchors && <MoveEffects key={anim!.id} spec={spec} user={anchors.user} targets={anchors.targets} size={size} points={effectPoints(anim, points)} seed={anim!.id} />}
        </div>
        {anim?.moveName && <div className="anim-preview-label">{anim.moveName}</div>}
      </div>
    </details>
  );
}
