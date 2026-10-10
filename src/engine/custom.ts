// Battle logic for the custom content in src/data/custom (and the field-effect
// turn counts the battle screen shows). Runs where the simulator runs.
import type { ActiveMove, Battle, Effect, Move, Pokemon, Side } from '@pkmn/sim';
import { CUSTOM_MEGAS, POLIWRATHIUM_Z } from '../data/custom';
import { isWarpForm, isWarpItem, WARP_DIGIMON } from '../data/custom/digimon';
import { PARADOX_ABILITIES, PARADOX_ITEMS, paradoxFormForSet, paradoxKindOfItem } from '../data/custom/paradox';

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
const TIMED_WEATHER = ['raindance', 'sunnyday', 'sandstorm', 'hail', 'snowscape'];
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
  // Mega Stones (and warp items) can't be knocked off or swapped away from the Pokémon that uses them.
  for (const stone of [...CUSTOM_MEGAS.map(m => m.megaStone), ...WARP_DIGIMON.map(d => d.item)]) {
    Object.assign(data.Items[toId(stone)], {
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
    if (!parent.Conditions[id]) continue;
    data.Conditions[id] = { inherit: true, onFieldStart: tagTurns(parent.Conditions[id].onFieldStart as Handler) };
  }

  addParadoxLogic(data);
  for (const [id, hook] of Object.entries(TIMED_MOVES)) {
    const condition = parent.Moves[id].condition as Entry;
    data.Moves[id] = { ...data.Moves[id], inherit: true, condition: { ...condition, [hook]: tagTurns(condition[hook] as Handler) } };
  }
}

/**
 * Paradox Evolution: the Paradoxorbs can't be taken away, and Protosynthesis /
 * Quark Drive (as this app defines them) boost the highest stat while the
 * Pokémon is on the field, with no weather, terrain or Booster Energy needed.
 */
function addParadoxLogic(data: Record<string, Record<string, Entry>>) {
  for (const item of Object.values(PARADOX_ITEMS)) Object.assign(data.Items[toId(item)], { onTakeItem: false });
  for (const ability of Object.values(PARADOX_ABILITIES)) {
    Object.assign(data.Abilities[toId(ability)], {
      onStart(this: Battle, pokemon: Pokemon) {
        // Mid-Paradox-Evolution the boost waits for the switch-in, after the evolution message.
        if (pokemon.m.paradoxEvolving) return;
        pokemon.addVolatile('paradoxboost', pokemon, this.effect);
      },
      onEnd(pokemon: Pokemon) {
        pokemon.removeVolatile('paradoxboost');
      },
    });
  }
  /**
   * The boost itself: a flat 1.3x (Speed: 1.5x) on the stat that's highest when
   * it starts (stat stages counted, like the games; ties go Atk > Def > SpA >
   * SpD > Spe). A volatile, so switching out ends it and Haze can't touch it.
   */
  const boost = (stat: string, factor: number | [number, number]) => function (this: Battle, _value: number, pokemon: Pokemon) {
    if ((this.effectState as { bestStat?: string }).bestStat !== stat || pokemon.ignoringAbility()) return;
    return this.chainModify(factor as never);
  };
  data.Conditions.paradoxboost = {
    name: 'Paradox Boost',
    noCopy: true,
    onStart(this: Battle, pokemon: Pokemon, _source: Pokemon, effect: Effect) {
      const ability = effect?.effectType === 'Ability' ? effect : pokemon.getAbility();
      const state = this.effectState as { bestStat?: string; ability?: string };
      state.bestStat = pokemon.getBestStat(false, true);
      state.ability = ability.name;
      this.add('-start', pokemon, `${ability.id}${state.bestStat}`);
    },
    onModifyAtkPriority: 5,
    onModifyAtk: boost('atk', [5325, 4096]),
    onModifyDefPriority: 6,
    onModifyDef: boost('def', [5325, 4096]),
    onModifySpAPriority: 5,
    onModifySpA: boost('spa', [5325, 4096]),
    onModifySpDPriority: 6,
    onModifySpD: boost('spd', [5325, 4096]),
    onModifySpe: boost('spe', 1.5),
    onEnd(this: Battle, pokemon: Pokemon) {
      this.add('-end', pokemon, (this.effectState as { ability?: string }).ability ?? 'Protosynthesis');
    },
  };
}

/**
 * Turns a Pokémon holding a Paradoxorb into its Paradox form, permanently for
 * the battle (switching keeps it). Any number of Pokémon can do this in one
 * battle. Runs before the switch-in effects, so the original Ability never
 * activates (no Intimidate from a Salamence becoming Roaring Moon).
 */
function paradoxEvolve(battle: Battle, pokemon: Pokemon) {
  if (!pokemon.hp) return;
  const kind = paradoxKindOfItem(pokemon.item);
  const form = paradoxFormForSet(pokemon.species.name, pokemon.item);
  if (!kind || !form) return; // no orb, or already evolved
  const item = pokemon.getItem();
  const who = displayName(pokemon);
  battle.add('-activate', pokemon, `item: ${item.name}`, '[silent]');
  battle.add('message', `${who}'s ${item.name} is resonating with ${kind === 'ancient' ? 'the ancient past' : 'the distant future'}!`);
  // Paradox Pokémon are genderless.
  if (battle.dex.species.get(form).gender === 'N') (pokemon as { gender: string }).gender = '';
  pokemon.m.paradoxEvolving = true;
  pokemon.formeChange(form, battle.dex.conditions.get('paradoxevolution'), true);
  pokemon.m.paradoxEvolving = false;
  battle.add('message', `${who} Paradox Evolved into ${form}!`);
}

/** How the messages name a Pokémon: the player's side (p1, and the partner's p3) without "The opposing". */
const displayName = (pokemon: Pokemon) => (pokemon.side.n % 2 === 0 ? pokemon.name : `The opposing ${pokemon.name}`);

/**
 * Warp Digivolution: Mega Evolution for the Digimon (custom addition). Same timing (before moves,
 * on the turn it's chosen) and the same lasting forme change, with its own messages; no "-mega"
 * line, so the battle screen plays the warp animation instead of the Mega one.
 */
function warpDigivolve(battle: Battle, pokemon: Pokemon, form: string) {
  const item = pokemon.getItem();
  const who = displayName(pokemon);
  battle.add('-activate', pokemon, `item: ${item.name}`, '[silent]');
  battle.add('message', `${who}'s ${item.name} is overflowing with power!`);
  pokemon.formeChange(form, battle.dex.conditions.get('warpdigivolution'), true);
  // As for Mega Evolution: it counts as an action for Truant, and there's no going back.
  pokemon.moveThisTurnResult = true;
  pokemon.formeRegression = true;
  battle.add('message', `${who} warp-digivolve to... ${form}!`);
}

type Actions = Battle['actions'];
const proto = (self: Actions) => Object.getPrototypeOf(self) as Actions;

/**
 * Engine hooks for the custom content. Poliwrathium Z: Poliwrath's damaging
 * Fighting / Water / Ice moves become its own Z-Moves, with the base move's Z
 * power and category (as Fightinium / Waterium / Icium Z would give).
 * Everything else is unchanged.
 */
export const CUSTOM_ACTIONS = {
  /**
   * Warp Digivolution goes through the Mega Evolution action, but every Digimon on a team can do
   * it, and it doesn't use up the team's one Mega Evolution (nor does a Mega use up the warps).
   */
  runMegaEvo(this: Actions, pokemon: Pokemon): boolean {
    const form = pokemon.canMegaEvo;
    if (typeof form === 'string' && isWarpForm(form)) {
      warpDigivolve(this.battle, pokemon, form);
      pokemon.canMegaEvo = false;
      this.battle.runEvent('AfterMega', pokemon);
      return true;
    }
    const warps = pokemon.side.pokemon.filter(p => p !== pokemon && isWarpForm(p.canMegaEvo || null)).map(p => [p, p.canMegaEvo] as const);
    const done = proto(this).runMegaEvo.call(this, pokemon);
    for (const [p, canMegaEvo] of warps) p.canMegaEvo = canMegaEvo;
    return done;
  },
  /** Paradox Evolution happens as a Pokémon holding a Paradoxorb comes in, before its switch-in effects. */
  runSwitch(this: Actions, pokemon: Pokemon): boolean {
    const switchers = [pokemon];
    for (const action of this.battle.queue.list) {
      if (action.choice !== 'runSwitch') break;
      switchers.push(action.pokemon!);
    }
    for (const p of switchers) paradoxEvolve(this.battle, p);
    return proto(this).runSwitch.call(this, pokemon);
  },
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

/**
 * Side hooks: choosing Warp Digivolution doesn't count as the turn's (or battle's) one Mega
 * Evolution, so a Digimon can warp alongside a Mega, or alongside another Digimon.
 */
export const CUSTOM_SIDE = {
  chooseMove(this: Side, ...args: Parameters<Side['chooseMove']>): boolean {
    const original = (Object.getPrototypeOf(this) as Side).chooseMove;
    const pokemon = this.active[this.getChoiceIndex()];
    if (args[2] !== 'mega' || !pokemon || !isWarpItem(pokemon.item)) return original.apply(this, args);
    const megaChosen = this.choice.mega;
    this.choice.mega = false;
    try {
      return original.apply(this, args);
    } finally {
      this.choice.mega = megaChosen;
    }
  },
};
