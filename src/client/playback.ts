// Turns protocol lines into timed animation events. The BattleClient plays
// them one at a time: apply the line (state + log), show its animation, wait
// its duration, then move to the next line.
import type { Battle as ClientBattle } from '@pkmn/client';
import { paradoxKindOfForm } from '../data/custom/paradox';
import { classifyMove, type MoveFx } from './move-class';

export type AnimationKind =
  | 'move' | 'zpower' | 'hit' | 'residual' | 'heal' | 'switch-out' | 'switch-in' | 'faint'
  | 'mega-start' | 'mega' | 'forme' | 'status' | 'boost' | 'unboost' | 'miss' | 'text'
  /** Paradox Evolution: the charge-up, then the change; `condition` is "ancient" or "future". */
  | 'paradox-start' | 'paradox'
  /** Substitute: the doll appears, takes a hit, or breaks. */
  | 'sub-start' | 'sub-hit' | 'sub-end'
  /** Leech Seed takes hold of the target. */
  | 'seeded'
  /** HP drained from `side` to `target` (Leech Seed at the end of the turn). */
  | 'leech'
  /** `side` heals with HP drained from `target` (Giga Drain, Drain Punch...). */
  | 'absorb'
  /** A lasting screen (Reflect, Light Screen, Aurora Veil, Safeguard, Mist) goes up or wears off. */
  | 'side-start' | 'side-end'
  /** A terrain or room (Trick Room, Magic Room, Wonder Room, Gravity) starts or ends; `condition` is its id. */
  | 'field-start' | 'field-end'
  /** The Pokémon can't move: `condition` is why (par, slp, frz, flinch, recharge...). */
  | 'cant'
  /** Confusion takes hold, or the Pokémon is checked for confusion before moving. */
  | 'confused'
  /** Infatuation takes hold, or holds the Pokémon back. */
  | 'infatuated'
  /** Protect (or Detect, King's Shield, Spiky Shield, Baneful Bunker) blocks a move aimed at `side`. */
  | 'blocked'
  /** A status condition is cured (woke up, thawed, healed...). */
  | 'cure';

export type { MoveFx, MoveFxKind } from './move-class';

export interface BattleAnimation {
  /** Unique per event; components use it to restart CSS animations. */
  id: number;
  kind: AnimationKind;
  /** The Pokémon acting (move user, the one switching, fainting, getting hit...). */
  side: 'p1' | 'p2' | null;
  /** Its active slot (0 = a, 1 = b; always 0 in Singles). */
  slot?: number;
  /** For moves: the side being targeted (same as side for self-targeting moves). */
  target: 'p1' | 'p2' | null;
  targetSlot?: number;
  /** Doubles spread moves (Rock Slide, Earthquake...): every Pokémon hit. */
  spread?: { side: 'p1' | 'p2'; slot: number }[];
  moveName?: string;
  moveType?: string;
  moveCategory?: 'Physical' | 'Special' | 'Status';
  /** What the move does, for picking its animation. */
  fx?: MoveFx;
  /** The move didn't animate (charging turn, or it missed outright). */
  still?: boolean;
  /** For hits/heals: HP change as a percentage of max HP (negative = damage). */
  hpDelta?: number;
  /**
   * The condition involved: side condition (reflect, lightscreen...), field condition (electricterrain,
   * trickroom...), status (brn, par, psn, tox, slp, frz) or what damaged the Pokémon (brn, psn, confusion...).
   */
  condition?: string;
  /** Duration at normal speed, in ms. */
  durationMs: number;
}

/** Base durations (normal speed) by protocol command. Lines that print nothing take 0. */
const DURATION: Record<string, number> = {
  move: 900,
  '-damage': 600,
  '-heal': 500,
  switch: 650,
  drag: 650,
  replace: 400,
  faint: 700,
  detailschange: 900,
  '-formechange': 550,
  '-mega': 300,
  '-zpower': 1100,
  '-status': 450,
  '-curestatus': 350,
  '-boost': 450,
  '-unboost': 450,
  '-miss': 450,
  '-immune': 450,
  '-fail': 450,
  cant: 500,
  '-weather': 450,
  '-fieldstart': 450,
  '-sidestart': 450,
  turn: 250,
};
const TEXT_DURATION = 350;
export const SWITCH_OUT_MS = 400;
export const MEGA_START_MS = 1000;
export const PARADOX_START_MS = 1100;
export const SUB_START_MS = 900;
export const SUB_END_MS = 750;
export const SUB_HIT_MS = 500;
export const SEEDED_MS = 650;
export const DRAIN_MS = 900;
export const SIDE_MS = 650;
export const FIELD_MS = 800;
export const STATUS_MS = 700;
export const CANT_MS = 750;
export const CONFUSED_MS = 750;
export const BLOCKED_MS = 550;

/** Side conditions shown as a lasting screen in front of the side's Pokémon. */
export const SHIELD_CONDITIONS = ['reflect', 'lightscreen', 'auroraveil', 'safeguard', 'mist'] as const;

const toId = (s: string | undefined) => (s ?? '').replace(/^move: /i, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const isShield = (id: string) => (SHIELD_CONDITIONS as readonly string[]).includes(id);

/** Terrains and rooms shown on the field while they last. */
export const TERRAINS = ['electricterrain', 'grassyterrain', 'psychicterrain', 'mistyterrain'] as const;
export const ROOMS = ['trickroom', 'magicroom', 'wonderroom', 'gravity'] as const;
const isFieldLayer = (id: string) => (TERRAINS as readonly string[]).includes(id) || (ROOMS as readonly string[]).includes(id);

/** Protection that blocks moves for a turn (the simulator reports them all as "move: Protect"). */
const PROTECTIONS = new Set(['protect', 'detect', 'kingsshield', 'spikyshield', 'banefulbunker', 'matblock', 'wideguard', 'quickguard', 'craftyshield']);

/** Move animation length (normal speed) by what the move does. */
export function moveDuration(fx: MoveFx): number {
  if (fx.kind === 'z') return 1700;
  if (fx.kind === 'attack') return fx.category === 'Special' ? 1000 : 900;
  return 800;
}

const sideOf = (ident: string | undefined): 'p1' | 'p2' | null =>
  ident?.startsWith('p1') ? 'p1' : ident?.startsWith('p2') ? 'p2' : null;
/** Active slot from an ident like "p1b: Garchomp" (0 when there's no letter). */
const slotOf = (ident: string | undefined): number => (/^p[12]b/.test(ident ?? '') ? 1 : 0);
/** Side and slot of the Pokémon an ident names. */
const at = (ident: string | undefined) => ({ side: sideOf(ident), slot: slotOf(ident) });

/** Percent HP from a protocol health string like "120/184" or "0 fnt". */
function hpPercent(health: string | undefined): number | null {
  if (!health) return null;
  const [hp] = health.split(' ');
  if (hp === '0') return 0;
  const [cur, max] = hp.split('/').map(Number);
  return max ? (cur / max) * 100 : null;
}

export interface PlannedStep {
  animation: Omit<BattleAnimation, 'id'> | null;
  /** Apply the protocol line in this step (false for the "before" steps). */
  applyLine: boolean;
}

/**
 * Plans the steps for one protocol line given the battle state *before* it is
 * applied. Most lines are one step; a switch-in replacing a healthy Pokémon
 * first plays a switch-out, and Mega Evolution plays a charge-up before the
 * sprite changes.
 */
export function planLine(args: readonly string[], kwArgs: Record<string, unknown>, battle: ClientBattle, hasText: boolean): PlannedStep[] {
  const cmd = args[0];
  const base = DURATION[cmd] ?? (hasText ? TEXT_DURATION : 0);
  const step = (animation: Omit<BattleAnimation, 'id'> | null): PlannedStep => ({ animation, applyLine: true });

  switch (cmd) {
    case 'move': {
      const side = sideOf(args[1]);
      const slot = slotOf(args[1]);
      const target = sideOf(args[3]) ?? side;
      const targetSlot = args[3] ? slotOf(args[3]) : slot;
      // "[spread] p2a,p2b": every Pokémon a spread move hit.
      const spread = typeof kwArgs.spread === 'string' && kwArgs.spread
        ? kwArgs.spread.split(',').map(id => at(id.trim())).filter((t): t is { side: 'p1' | 'p2'; slot: number } => !!t.side)
        : undefined;
      const fx = classifyMove(args[2]);
      // [still]: the move didn't animate in the game either (e.g. charging turn, or it missed).
      const still = 'still' in kwArgs || 'miss' in kwArgs;
      return [step({
        kind: 'move', side, slot, target, targetSlot, spread, moveName: args[2], moveType: fx.type, moveCategory: fx.category, fx, still,
        durationMs: still ? 450 : moveDuration(fx),
      })];
    }
    case '-zpower':
      return [step({ kind: 'zpower', ...at(args[1]), target: null, durationMs: base })];
    case '-damage':
    case '-heal': {
      // Silent HP changes (e.g. max HP changing with a new form) just update the bar.
      if ('silent' in kwArgs) return [step(null)];
      const { side, slot } = at(args[1]);
      const mon = side ? battle[side].active[slot] : null;
      const before = mon && mon.maxhp ? (mon.hp / mon.maxhp) * 100 : null;
      const after = hpPercent(args[2]);
      const hpDelta = before !== null && after !== null ? after - before : undefined;
      const from = toId(kwArgs.from as string | undefined);
      const other = sideOf(kwArgs.of as string | undefined);
      const otherSlot = slotOf(kwArgs.of as string | undefined);
      // Drained HP: the life energy flows from the drained Pokémon to the one healing.
      if (cmd === '-damage' && from === 'leechseed' && other) return [step({ kind: 'leech', side, slot, target: other, targetSlot: otherSlot, hpDelta, durationMs: DRAIN_MS })];
      if (cmd === '-heal' && from === 'drain' && other) return [step({ kind: 'absorb', side, slot, target: other, targetSlot: otherSlot, hpDelta, durationMs: DRAIN_MS })];
      const kind = cmd === '-heal' ? 'heal' : 'from' in kwArgs ? 'residual' : 'hit';
      // Residual damage remembers its cause (burn, poison, confusion, weather...) for its animation.
      return [step({ kind, side, slot, target: null, hpDelta, condition: from || undefined, durationMs: base })];
    }
    case 'switch':
    case 'drag': {
      const { side, slot } = at(args[1]);
      const current = side ? battle[side].active[slot] : null;
      const steps: PlannedStep[] = [];
      if (current && !current.fainted && current.hp > 0) {
        steps.push({ animation: { kind: 'switch-out', side, slot, target: null, durationMs: SWITCH_OUT_MS }, applyLine: false });
      }
      steps.push(step({ kind: 'switch-in', side, slot, target: null, durationMs: base }));
      return steps;
    }
    case 'faint':
      return [step({ kind: 'faint', ...at(args[1]), target: null, durationMs: base })];
    case 'detailschange': {
      const who = at(args[1]);
      const paradox = paradoxKindOfForm((args[2] ?? '').split(',')[0]);
      if (paradox) {
        return [
          { animation: { kind: 'paradox-start', ...who, target: null, condition: paradox, durationMs: PARADOX_START_MS }, applyLine: false },
          step({ kind: 'paradox', ...who, target: null, condition: paradox, durationMs: 1000 }),
        ];
      }
      const isMega = /-Mega/.test(args[2] ?? '');
      if (!isMega) return [step({ kind: 'forme', ...who, target: null, durationMs: DURATION['-formechange'] })];
      return [
        { animation: { kind: 'mega-start', ...who, target: null, durationMs: MEGA_START_MS }, applyLine: false },
        step({ kind: 'mega', ...who, target: null, durationMs: base }),
      ];
    }
    case '-formechange':
      return [step({ kind: 'forme', ...at(args[1]), target: null, durationMs: base })];
    case '-start':
    case '-end':
    case '-activate': {
      const effect = toId(args[2]);
      const who = at(args[1]);
      if (effect === 'substitute') {
        if (cmd === '-start') return [step({ kind: 'sub-start', ...who, target: null, durationMs: SUB_START_MS })];
        if (cmd === '-end') return [step({ kind: 'sub-end', ...who, target: null, durationMs: SUB_END_MS })];
        if ('damage' in kwArgs) return [step({ kind: 'sub-hit', ...who, target: null, durationMs: SUB_HIT_MS })];
      }
      if (effect === 'leechseed' && cmd === '-start') return [step({ kind: 'seeded', ...who, target: null, durationMs: SEEDED_MS })];
      if (effect === 'confusion' && cmd !== '-end') return [step({ kind: 'confused', ...who, target: null, durationMs: CONFUSED_MS })];
      if (effect === 'attract' && cmd !== '-end') return [step({ kind: 'infatuated', ...who, target: null, durationMs: CONFUSED_MS })];
      if (cmd === '-activate' && PROTECTIONS.has(effect)) return [step({ kind: 'blocked', ...who, target: null, condition: effect, durationMs: BLOCKED_MS })];
      return [step(base > 0 ? { kind: 'text', side: null, target: null, durationMs: base } : null)];
    }
    case '-block': {
      // @pkmn/protocol turns "-activate ... move: Protect" into "-block".
      const effect = toId(args[2]);
      if (PROTECTIONS.has(effect)) return [step({ kind: 'blocked', ...at(args[1]), target: null, condition: effect, durationMs: BLOCKED_MS })];
      return [step(base > 0 ? { kind: 'text', side: null, target: null, durationMs: base } : null)];
    }
    case '-fieldstart':
    case '-fieldend': {
      const condition = toId(args[1]);
      if (!isFieldLayer(condition)) return [step(base > 0 ? { kind: 'text', side: null, target: null, durationMs: base } : null)];
      return [step({ kind: cmd === '-fieldstart' ? 'field-start' : 'field-end', ...at(kwArgs.of as string | undefined), target: null, condition, durationMs: FIELD_MS })];
    }
    case 'cant':
      return [step({ kind: 'cant', ...at(args[1]), target: null, condition: toId(args[2]), durationMs: CANT_MS })];
    case '-curestatus':
      return [step({ kind: 'cure', ...at(args[1]), target: null, condition: toId(args[2]), durationMs: base })];
    case '-sidestart':
    case '-sideend': {
      const condition = toId(args[2]);
      if (!isShield(condition)) return [step(base > 0 ? { kind: 'text', side: null, target: null, durationMs: base } : null)];
      return [step({ kind: cmd === '-sidestart' ? 'side-start' : 'side-end', side: sideOf(args[1]), target: null, condition, durationMs: SIDE_MS })];
    }
    case '-status':
      return [step({ kind: 'status', ...at(args[1]), target: null, condition: toId(args[2]), durationMs: STATUS_MS })];
    case '-boost':
    case '-unboost':
      return [step({ kind: cmd === '-boost' ? 'boost' : 'unboost', ...at(args[1]), target: null, durationMs: base })];
    case '-miss':
    case '-immune':
    case '-fail':
      const id = cmd === '-miss' && args[2] ? args[2] : args[1];
      return [step({ kind: 'miss', ...at(id), target: null, durationMs: base })];
    default:
      return [step(base > 0 ? { kind: 'text', side: null, target: null, durationMs: base } : null)];
  }
}
