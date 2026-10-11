import { useEffect, useState, type CSSProperties } from 'react';
import { classifyMove } from '../../client/move-class';
import { WARP_DIGIMON } from '../../data/custom/digimon';
import {
  BLOCKED_MS, CANT_MS, CONFUSED_MS, DRAIN_MS, FIELD_MS, MEGA_START_MS, moveDuration, ROOMS, SEEDED_MS, SIDE_MS, STATUS_MS, SUB_END_MS, SUB_HIT_MS,
  SUB_START_MS, WARP_MS, WARP_START_MS, type BattleAnimation,
} from '../../client/playback';
import { ANIMATION_SPEED_FACTOR } from '../../settings/settings-store';
import { gen7 } from '../../team/dex';
import { useAppSettings } from '../useAppSettings';
import { useElementSize } from '../useElementSize';
import { MoveEffects } from './fx/MoveEffects';
import { effectAnchors, effectSpec, shakeProps } from './fx/stage-fx';
import { useSpritePoints } from './fx/useSpritePoints';
import { FieldLayers } from './FieldLayers';
import { ShieldWalls } from './ShieldWalls';
import { StageSpot } from './StageSpot';

type Side = 'p1' | 'p2';
type Step = Omit<BattleAnimation, 'id'>;

/** One physical and one special example per type, then status families, draining moves and Z-Moves. */
const GROUPS: { label: string; moves: string[] }[] = [
  { label: 'Physical', moves: ['Return', 'Flare Blitz', 'Waterfall', 'Wild Charge', 'Leaf Blade', 'Icicle Crash', 'Close Combat', 'Poison Jab', 'Earthquake', 'Brave Bird', 'Zen Headbutt', 'X-Scissor', 'Stone Edge', 'Shadow Claw', 'Outrage', 'Crunch', 'Iron Head', 'Play Rough'] },
  { label: 'Special', moves: ['Hyper Voice', 'Flamethrower', 'Hydro Pump', 'Thunderbolt', 'Energy Ball', 'Ice Beam', 'Aura Sphere', 'Sludge Bomb', 'Earth Power', 'Air Slash', 'Psychic', 'Bug Buzz', 'Power Gem', 'Shadow Ball', 'Dragon Pulse', 'Dark Pulse', 'Flash Cannon', 'Moonblast'] },
  { label: 'Status', moves: ['Swords Dance', 'Calm Mind', 'Growl', 'Screech', 'Thunder Wave', 'Will-O-Wisp', 'Toxic', 'Spore', 'Confuse Ray', 'Attract', 'Leech Seed', 'Substitute', 'Protect', 'Detect', "King's Shield", 'Spiky Shield', 'Baneful Bunker', 'Recover', 'Roost', 'Rain Dance', 'Sunny Day', 'Electric Terrain', 'Grassy Terrain', 'Psychic Terrain', 'Misty Terrain', 'Trick Room', 'Magic Room', 'Wonder Room', 'Gravity', 'Reflect', 'Light Screen', 'Aurora Veil', 'Safeguard', 'Mist', 'Stealth Rock', 'Spikes', 'Tailwind', 'Roar'] },
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
  { label: 'Signature (Digimon)', moves: ['Gaia Force', 'Cocytus Pulse', 'Pepper Breath', 'Fox Fire'] },
];
/** Z-Moves whose category comes from the base move (type Z-Moves and Poliwrath's: power-1 placeholders); signature ones have their own. */
const zFromBaseMove = (name: string) => classifyMove(name).kind === 'z' && gen7.moves.get(name)?.basePower === 1;
const SPECIES: Record<Side, [string, string]> = { p1: ['Salamence', 'Salamence-Mega'], p2: ['Garchomp', 'Garchomp-Mega'] };
/** Warp Digivolution preview: the chosen Digimon steps in, then becomes its warp form. */
const baseOfWarp = (form: string) => WARP_DIGIMON.find(d => d.warp.name === form)?.base.name ?? form;
const other = (s: Side): Side => (s === 'p1' ? 'p2' : 'p1');

/** What the preview stage shows besides the sprites (what the battle state would hold). */
interface FieldState {
  mega: Record<Side, boolean>;
  /** Warp Digivolution preview: the Digimon (stage 1) or its warp form (stage 2) stands in. */
  digimon: Record<Side, { form: string; stage: 1 | 2 } | null>;
  sub: Record<Side, boolean>;
  seeded: Record<Side, boolean>;
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
  status: { p1: undefined, p2: undefined }, confused: { p1: false, p2: false }, infatuated: { p1: false, p2: false },
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
    case 'move': return step.fx?.kind === 'protect' && step.fx.moveId !== 'endure' ? { ...f, protect: { ...f.protect, [s]: step.fx.moveId } } : f;
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
    case 'side-start': return step.condition && !f.shields[s].includes(step.condition) ? { ...f, shields: { ...f.shields, [s]: [...f.shields[s], step.condition] } } : f;
    case 'side-end': return { ...f, shields: { ...f.shields, [s]: f.shields[s].filter(c => c !== step.condition) } };
    default: return f;
  }
}

/** `zCategory`: a type Z-Move's category comes from its base move (Physical or Special). */
function moveSteps(name: string, side: Side, f: FieldState, zCategory: 'Physical' | 'Special' = 'Physical'): Step[] {
  const classified = classifyMove(name);
  const fx = zFromBaseMove(name) ? { ...classified, category: zCategory } : classified;
  const foe = other(side);
  const target = fx.category === 'Status' && ['powerup', 'protect', 'heal', 'substitute', 'field'].includes(fx.kind) && fx.field !== 'hazard' ? side : foe;
  const steps: Step[] = [];
  if (fx.kind === 'z') steps.push({ kind: 'zpower', side, target: null, durationMs: 1100 });
  steps.push({ kind: 'move', side, target, moveName: name, moveType: fx.type, moveCategory: fx.category, fx, durationMs: moveDuration(fx) });
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
  if (fx.field === 'screen' && !f.shields[side].includes(fx.moveId)) {
    steps.push({ kind: 'side-start', side, target: null, condition: fx.moveId, durationMs: SIDE_MS });
  }
  if (fx.category !== 'Status' && f.protect[foe]) {
    steps.push({ kind: 'blocked', side: foe, target: null, condition: f.protect[foe]!, durationMs: BLOCKED_MS });
  } else if (fx.category !== 'Status') {
    steps.push(f.sub[foe]
      ? { kind: 'sub-hit', side: foe, target: null, durationMs: SUB_HIT_MS }
      : { kind: 'hit', side: foe, target: null, hpDelta: -38, durationMs: 600 });
    if (gen7.moves.get(name)?.drain) steps.push({ kind: 'absorb', side, target: foe, hpDelta: 19, durationMs: DRAIN_MS });
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
  const [side, setSide] = useState<Side>('p1');
  const [warpForm, setWarpForm] = useState(WARP_DIGIMON[0].warp.name);
  const [field, setField] = useState<FieldState>(EMPTY);
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
  const anyShields = field.shields.p1.length + field.shields.p2.length > 0;
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
        <button className="primary" onClick={() => play(moveSteps(move, side, field, zCategory))}>Play</button>
        <button disabled={field.mega[side]} onClick={() => play([
          { kind: 'mega-start', side, target: null, durationMs: MEGA_START_MS },
          { kind: 'mega', side, target: null, durationMs: 900 },
        ])}>Mega Evolve</button>
        <select aria-label="Digimon" value={warpForm} onChange={e => setWarpForm(e.target.value)}>
          {WARP_DIGIMON.map(d => <option key={d.warp.name} value={d.warp.name}>{d.base.name} → {d.warp.name}</option>)}
        </select>
        <button disabled={field.digimon[side]?.form === warpForm && field.digimon[side]?.stage === 2} onClick={() => play([
          { kind: 'warp-start', side, target: null, condition: warpForm, durationMs: WARP_START_MS },
          { kind: 'warp', side, target: null, condition: warpForm, durationMs: WARP_MS },
        ])}>Warp Digivolve</button>
        <button disabled={!subSide} onClick={() => subSide && play([{ kind: 'sub-end', side: subSide, target: null, durationMs: SUB_END_MS }])}>Break Substitute</button>
        <label>
          Inflict on {side === 'p1' ? 'opponent' : 'you'}{' '}
          <select value="" onChange={e => { const c = e.target.value; e.target.value = ''; if (c) play([statusStep(other(side), c)]); }}>
            <option value="">status…</option>
            {MAJOR_STATUS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <button disabled={!held.length} onClick={() => play(held)}>Held back</button>
        <button onClick={endTurn}>End turn</button>
        <button disabled={!anyShields} onClick={() => play((['p1', 'p2'] as const).flatMap(s => field.shields[s].map(c => (
          { kind: 'side-end', side: s, target: null, condition: c, durationMs: SIDE_MS } as Step
        ))))}>Screens wear off</button>
        <button onClick={() => { setRun(null); setField(EMPTY); }}>Reset</button>
      </div>
      <div ref={stageRef} className="stage" style={{ '--spd': speed } as CSSProperties}>
        <div className={`stage-field ${shake.className}`} style={shake.style}>
          <FieldLayers terrain={field.terrain} rooms={field.rooms} anim={anim} />
          {(['p2', 'p1'] as const).map(s => (
            <StageSpot
              key={s} side={s} pokemon={{ species: field.digimon[s] ? (field.digimon[s]!.stage === 2 ? field.digimon[s]!.form : baseOfWarp(field.digimon[s]!.form)) : SPECIES[s][field.mega[s] ? 1 : 0] }} anim={anim}
              substitute={field.sub[s]} seeded={field.seeded[s]} status={field.status[s]} confused={field.confused[s]}
              infatuated={field.infatuated[s]} protect={field.protect[s]}
            />
          ))}
          {(['p2', 'p1'] as const).map(s => (
            <ShieldWalls key={s} side={s} conditions={field.shields[s]} anim={anim} size={size} points={points} />
          ))}
          {spec && anchors && <MoveEffects key={anim!.id} spec={spec} user={anchors.user} targets={anchors.targets} size={size} points={points} seed={anim!.id} />}
        </div>
        {anim?.moveName && <div className="anim-preview-label">{anim.moveName}</div>}
      </div>
    </details>
  );
}
