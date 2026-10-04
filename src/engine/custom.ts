// Battle logic for the custom content in src/data/custom (and the field-effect
// turn counts the battle screen shows). Runs where the simulator runs.
import type { ActiveMove, Battle, Move, Pokemon } from '@pkmn/sim';
import { CUSTOM_MEGAS, POLIWRATHIUM_Z } from '../data/custom';

const toId = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const POLIWRATHIUM_ID = toId(POLIWRATHIUM_Z.item);

type Handler = (this: Battle, ...args: unknown[]) => unknown;
type Entry = Record<string, unknown>;

/**
 * Field effects whose start message gets a "[turns] N" tag with the real
 * duration (5, or 8 with Damp Rock, Terrain Extender...), so the battle screen
 * can show "2/5". Weather lives in Conditions; terrains, rooms and Tailwind are
 * conditions inside their moves.
 */
const TIMED_WEATHER = ['raindance', 'sunnyday', 'sandstorm', 'hail'];
const TIMED_MOVES: Record<string, 'onFieldStart' | 'onSideStart'> = {
  electricterrain: 'onFieldStart', grassyterrain: 'onFieldStart', psychicterrain: 'onFieldStart', mistyterrain: 'onFieldStart',
  trickroom: 'onFieldStart', magicroom: 'onFieldStart', wonderroom: 'onFieldStart', gravity: 'onFieldStart',
  tailwind: 'onSideStart',
};
const START_MESSAGES = new Set(['-weather', '-fieldstart', '-sidestart']);

/** Wraps a start handler so the start message it prints carries the effect's duration. */
function tagTurns(original: Handler | undefined): Handler {
  return function (this: Battle, ...args: unknown[]) {
    const turns = (this.effectState as { duration?: number } | undefined)?.duration;
    if (!original) return undefined;
    if (!turns) return original.apply(this, args);
    const own = Object.prototype.hasOwnProperty.call(this, 'add');
    const add = this.add;
    this.add = ((...parts: unknown[]) => {
      if (typeof parts[0] === 'string' && START_MESSAGES.has(parts[0])) parts.push(`[turns] ${turns}`);
      return add.apply(this, parts as Parameters<Battle['add']>);
    }) as Battle['add'];
    try {
      return original.apply(this, args);
    } finally {
      if (own) this.add = add; else delete (this as Partial<Battle>).add;
    }
  };
}

/** Adds handlers (functions can't live in the shared data) to the mod data built from the shared layers. */
export function addCustomBattleLogic(data: Record<string, Record<string, Entry>>, parent: { Conditions: Record<string, Entry>; Moves: Record<string, Entry> }) {
  // Mega Stones can't be knocked off or swapped away from the Pokémon that uses them.
  for (const m of CUSTOM_MEGAS) {
    Object.assign(data.Items[toId(m.megaStone)], {
      onTakeItem(item: { megaStone?: Record<string, string> }, source: Pokemon) {
        return !item.megaStone?.[source.baseSpecies.baseSpecies];
      },
    });
  }
  Object.assign(data.Items[POLIWRATHIUM_ID], { onTakeItem: false });
  // Omega Wrath also sets up a Substitute, without the usual HP cost.
  const omega = Object.values(POLIWRATHIUM_Z.moves).find(z => z.substitute);
  if (omega) {
    Object.assign(data.Moves[toId(omega.name)], {
      onAfterMoveSecondarySelf(this: Battle, source: Pokemon) {
        source.addVolatile('substitute');
      },
    });
  }

  data.Conditions ??= {};
  for (const id of TIMED_WEATHER) {
    data.Conditions[id] = { inherit: true, onFieldStart: tagTurns(parent.Conditions[id].onFieldStart as Handler) };
  }
  for (const [id, hook] of Object.entries(TIMED_MOVES)) {
    const condition = parent.Moves[id].condition as Entry;
    data.Moves[id] = { ...data.Moves[id], inherit: true, condition: { ...condition, [hook]: tagTurns(condition[hook] as Handler) } };
  }
}

type Actions = Battle['actions'];
const proto = (self: Actions) => Object.getPrototypeOf(self) as Actions;

/**
 * Poliwrathium Z in the engine: Poliwrath's damaging Fighting / Water / Ice
 * moves become its own Z-Moves, with the base move's Z power and category (as
 * Fightinium / Waterium / Icium Z would give). Everything else is unchanged.
 */
export const CUSTOM_ACTIONS = {
  getZMove(this: Actions, move: Move, pokemon: Pokemon, skipChecks?: boolean): string | undefined {
    const item = pokemon.getItem();
    if (item.id !== POLIWRATHIUM_ID) return proto(this).getZMove.call(this, move, pokemon, skipChecks);
    if (!skipChecks) {
      if (pokemon.side.zMoveUsed || !item.itemUser?.includes(pokemon.species.name)) return undefined;
      if (!pokemon.getMoveData(move)?.pp) return undefined;
    }
    const z = POLIWRATHIUM_Z.moves[move.type];
    return z && move.category !== 'Status' && move.zMove?.basePower ? z.name : undefined;
  },
  getActiveZMove(this: Actions, move: Move, pokemon: Pokemon): ActiveMove {
    const z = pokemon?.getItem().id === POLIWRATHIUM_ID && move.category !== 'Status' ? POLIWRATHIUM_Z.moves[move.type] : undefined;
    if (!z) return proto(this).getActiveZMove.call(this, move, pokemon);
    const zMove = this.dex.getActiveMove(z.name);
    zMove.basePower = move.zMove!.basePower!;
    zMove.category = move.category;
    zMove.priority = move.priority;
    zMove.isZOrMaxPowered = true;
    return zMove;
  },
};
