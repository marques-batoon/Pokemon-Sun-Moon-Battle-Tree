// Turn counters for timed field effects (weather, terrain, rooms, Tailwind),
// shown as "2/5" next to them. The simulator tags each start message with the
// effect's real length ("[turns] 8" with Damp Rock, Terrain Extender...). The
// count follows the battle's turn number: the turn an effect starts on is its
// first turn, unless it starts after that turn's end-of-turn effects ("upkeep",
// e.g. a Drizzle switch-in after a faint), when its first turn is the next one.

import { sideOf } from './playback';

export interface FieldTimer {
  total: number;
  /** Battle turn that counts as the effect's first. */
  start: number;
}

export interface FieldTimers {
  /** Current battle turn (from "|turn|" lines). */
  turn: number;
  /** This turn's end-of-turn effects have happened (anything starting now counts from the next turn). */
  afterUpkeep: boolean;
  /** Keys: "weather", "terrain", a room id ("trickroom"...), or "<side>:tailwind". */
  timers: Record<string, FieldTimer>;
}

export const NO_TIMERS: FieldTimers = { turn: 0, afterUpkeep: false, timers: {} };

const toId = (s: string | undefined) => (s ?? '').replace(/^move: /i, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const TERRAINS = new Set(['electricterrain', 'grassyterrain', 'psychicterrain', 'mistyterrain']);
const fieldKey = (id: string) => (TERRAINS.has(id) ? 'terrain' : id);

/** The timers after one protocol line (the same object when nothing changed). */
export function nextTimers(state: FieldTimers, args: readonly string[], kwArgs: Record<string, unknown>): FieldTimers {
  const turns = Number(kwArgs.turns) || 0;
  const set = (timers: Record<string, FieldTimer>) => ({ ...state, timers });
  const without = (key: string): FieldTimers => {
    if (!(key in state.timers)) return state;
    const timers = { ...state.timers };
    delete timers[key];
    return set(timers);
  };
  const start = (key: string): FieldTimers => {
    if (!turns) return without(key); // permanent (e.g. primal weather): no counter
    const first = state.afterUpkeep ? state.turn + 1 : Math.max(1, state.turn);
    return set({ ...state.timers, [key]: { total: turns, start: first } });
  };
  switch (args[0]) {
    case 'turn':
      return { ...state, turn: Number(args[1]) || state.turn, afterUpkeep: false };
    case 'upkeep':
      return { ...state, afterUpkeep: true };
    case '-weather':
      if (args[1] === 'none') return without('weather');
      return 'upkeep' in kwArgs ? state : start('weather');
    case '-fieldstart':
      return start(fieldKey(toId(args[1])));
    case '-fieldend':
      return without(fieldKey(toId(args[1])));
    case '-sidestart':
    case '-sideend': {
      const side = sideOf(args[1]);
      if (!side || toId(args[2]) !== 'tailwind') return state;
      return args[0] === '-sidestart' ? start(`${side}:tailwind`) : without(`${side}:tailwind`);
    }
    default:
      return state;
  }
}

/** "2/5": which turn of the effect the current battle turn is, out of how many. */
export function timerText(state: FieldTimers, key: string): string | null {
  const t = state.timers[key];
  if (!t) return null;
  const n = Math.min(t.total, Math.max(1, state.turn - t.start + 1));
  return `${n}/${t.total}`;
}
