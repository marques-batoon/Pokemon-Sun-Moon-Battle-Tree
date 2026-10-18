// Battle logic for the custom content in src/data/custom (and the field-effect
// turn counts the battle screen shows). Runs where the simulator runs.
import type { ActiveMove, Battle, Effect, Move, Pokemon, Side } from '@pkmn/sim';
import { CUSTOM_MEGAS, HITMONCHANIUM_Z, POLIWRATHIUM_Z } from '../data/custom';
import { DIGIMON_MOVES, isWarpForm, isWarpItem, WARP_DIGIMON, warpNames } from '../data/custom/digimon';
import { PARADOX_ABILITIES, PARADOX_ITEMS, paradoxFormForSet, paradoxKindOfItem } from '../data/custom/paradox';

const toId = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const POLIWRATHIUM_ID = toId(POLIWRATHIUM_Z.item);
const HITMONCHANIUM_ID = toId(HITMONCHANIUM_Z.item);
const HITMONCHAN_Z = Object.values(HITMONCHANIUM_Z.moves);
/** Sky Rocket Punch hits a target up in the sky (Fly, Bounce, Sky Drop), like Sky Uppercut. */
const SKY_HITTERS = new Set(HITMONCHAN_Z.filter(z => z.hitsSky).map(z => toId(z.name)));

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
  Object.assign(data.Items[HITMONCHANIUM_ID], { onTakeItem: false });
  // Omega Wrath (and Hitmonchan's Omega Punch) also sets up a Substitute, without the usual HP cost.
  for (const omega of [...Object.values(POLIWRATHIUM_Z.moves), ...HITMONCHAN_Z].filter(z => z.substitute)) {
    Object.assign(data.Moves[toId(omega.name)], {
      onAfterMoveSecondarySelf(this: Battle, source: Pokemon) {
        source.addVolatile('substitute');
      },
    });
  }
  addHitmonchanLogic(data, parent);

  data.Conditions ??= {};
  data.Conditions.frz = { inherit: true, onBeforeMove: thawCheck };
  for (const id of TIMED_WEATHER) {
    if (!parent.Conditions[id]) continue;
    data.Conditions[id] = { inherit: true, onFieldStart: tagTurns(parent.Conditions[id].onFieldStart as Handler) };
  }

  addParadoxLogic(data);
  addElectromorphosis(data);
  addDigimonLogic(data);
  for (const [id, hook] of Object.entries(TIMED_MOVES)) {
    const condition = parent.Moves[id].condition as Entry;
    data.Moves[id] = { ...data.Moves[id], inherit: true, condition: { ...condition, [hook]: tagTurns(condition[hook] as Handler) } };
  }
}

/**
 * Hitmonchanium Z's moves (the data has their power, punch flag, drain, priority and stat rises): Super Drain Punch's
 * extra Sp. Def rise when Hitmonchan was at full HP as it began, Infernal Fury Fist burning Hitmonchan, Sky Rocket
 * Punch reaching a target in the sky, and Close Combat counting as a punching move when Hitmonchan uses it.
 */
function addHitmonchanLogic(data: Record<string, Record<string, Entry>>, parent: { Moves: Record<string, Entry> }) {
  for (const z of HITMONCHAN_Z) {
    const entry = data.Moves[toId(z.name)];
    if (z.fullHpSpd) {
      Object.assign(entry, {
        onTryMove(this: Battle, source: Pokemon) {
          source.m.zFullHp = source.hp === source.maxhp;
        },
        onAfterMoveSecondarySelf(this: Battle, source: Pokemon) {
          if (source.m.zFullHp) this.boost({ spd: 1 }, source, source);
          source.m.zFullHp = false;
        },
      });
    }
    if (z.burnSelf) {
      Object.assign(entry, {
        onAfterMoveSecondarySelf(this: Battle, source: Pokemon, _target: Pokemon, move: ActiveMove) {
          source.trySetStatus('brn', source, move);
        },
      });
    }
  }
  // Up in the sky, a Pokémon can be hit only by a few moves (Sky Uppercut, Thunder...): Sky Rocket Punch too.
  for (const id of ['fly', 'bounce']) {
    const condition = parent.Moves[id].condition as Entry;
    const original = condition.onInvulnerability as Handler;
    data.Moves[id] = { ...data.Moves[id], inherit: true, condition: { ...condition, onInvulnerability(this: Battle, ...args: unknown[]) {
      return SKY_HITTERS.has((args[2] as ActiveMove).id) ? undefined : original.apply(this, args);
    } } };
  }
  const skyDrop = parent.Moves.skydrop.condition as Entry;
  const skyDropCheck = skyDrop.onAnyInvulnerability as Handler;
  data.Moves.skydrop = { ...data.Moves.skydrop, inherit: true, condition: { ...skyDrop, onAnyInvulnerability(this: Battle, ...args: unknown[]) {
    return SKY_HITTERS.has((args[2] as ActiveMove).id) ? undefined : skyDropCheck.apply(this, args);
  } } };
  // In this app, Close Combat is a punching move when Hitmonchan uses it (Iron Fist boosts it).
  data.Moves.closecombat = { ...data.Moves.closecombat, inherit: true, onModifyMove(this: Battle, move: ActiveMove, pokemon: Pokemon) {
    if (pokemon.baseSpecies.baseSpecies === HITMONCHANIUM_Z.user) move.flags = { ...move.flags, punch: 1 };
  } };
}

/** Chance, in fifths, that a frozen Pokémon thaws out when it tries to move: 1/5 (20%) as in the games, 3/5 (60%) with a Fire-type move (on request). */
const THAW_IN_5 = { usual: 1, fire: 3 };

/**
 * The frozen status's before-move check (as in the simulator, but a Fire-type move raises the chance to thaw by
 * 40 points). Moves that always thaw the user (Flame Wheel, Flare Blitz, Scald...) still do. The move's type is
 * worked out the way the move itself will (Hidden Power, Weather Ball in sun, Revelation Dance, -ate Abilities...)
 * on a copy, so nothing about the real move changes.
 */
function thawCheck(this: Battle, pokemon: Pokemon, target: Pokemon, move: ActiveMove) {
  if (move.flags['defrost'] && !(move.id === 'burnup' && !pokemon.hasType('Fire'))) return;
  const probe = this.dex.getActiveMove(move.id);
  this.singleEvent('ModifyType', probe, null, pokemon, target, probe, probe);
  this.runEvent('ModifyType', pokemon, target, probe, probe);
  if (this.randomChance(probe.type === 'Fire' ? THAW_IN_5.fire : THAW_IN_5.usual, 5)) {
    pokemon.cureStatus();
    return;
  }
  this.add('cant', pokemon, 'frz');
  return false;
}

/**
 * Electromorphosis (Gen 9; HerculesKabuterimon): hit by an attack, the Pokémon becomes charged, and its next
 * Electric move has double power. As in Gen 9, the charge lasts until it uses an Electric move (Gen 7's own
 * Charge move, which lasts one turn, is unchanged): a volatile of the Ability's own, shown as "Charge".
 */
function addElectromorphosis(data: Record<string, Record<string, Entry>>) {
  const removeOnElectric = function (this: Battle, pokemon: Pokemon, _target: Pokemon, move: ActiveMove) {
    if (move.type === 'Electric' && move.id !== 'charge') pokemon.removeVolatile('electromorphosis');
  };
  const announce = function (this: Battle, pokemon: Pokemon) {
    this.add('-start', pokemon, 'Charge', '[from] ability: Electromorphosis');
  };
  Object.assign(data.Abilities.electromorphosis, {
    onDamagingHitOrder: 1,
    onDamagingHit(this: Battle, _damage: number, target: Pokemon) {
      target.addVolatile('electromorphosis');
    },
    condition: {
      onStart: announce,
      onRestart: announce,
      onBasePowerPriority: 9,
      onBasePower(this: Battle, _basePower: number, _attacker: Pokemon, _defender: Pokemon, move: ActiveMove) {
        if (move.type === 'Electric') return this.chainModify(2);
      },
      onMoveAborted: removeOnElectric,
      onAfterMove: removeOnElectric,
      onEnd(this: Battle, pokemon: Pokemon) {
        this.add('-end', pokemon, 'Charge', '[silent]');
      },
    },
  });
}

/**
 * The Digimon's moves and Abilities that need more than data: a move with a second type (Lightning Joust: Steel that
 * also counts as Electric against the target's types, like Flying Press; only its own type gives STAB and immunities),
 * a multi-hit move whose remaining hits go on to the fainted target's partner (Burst Shot, in Doubles), Dauntless
 * Shield (Gallantmon) as in Gen 9: +1 Defense the first time it takes effect in a battle (Matrix Evolving counts), not
 * on every switch-in as in Gen 8, and Elevate (MegaGargomon, the user's own Ability).
 */
function addDigimonLogic(data: Record<string, Record<string, Entry>>) {
  for (const m of DIGIMON_MOVES.filter(m => m.retarget && m.multihit)) {
    const hits = m.multihit!;
    Object.assign(data.Moves[toId(m.name)], {
      onAfterMove(this: Battle, source: Pokemon, target: Pokemon | null, move: ActiveMove) {
        // move.hit: the last hit made. The loop stops early when the target is down to 0 HP.
        const done = move.hit ?? 0;
        if (!target || target.hp > 0 || !source.hp || done < 1 || done >= hits) return;
        const next = source.adjacentFoes().find(p => p !== target && p.hp > 0 && !p.fainted);
        if (!next) return;
        const rest = this.dex.getActiveMove(move.id);
        // (Only the move's own use ends with AfterMove, so these hits don't pass them on again.)
        rest.multihit = hits - done;
        this.add('-anim', source, move.name, next);
        this.actions.trySpreadMoveHit([next], source, rest);
      },
    });
  }
  // Elevate: knocking a Pokémon out with an attack raises the user's highest base stat (not HP; by base stats, not its
  // current stats as Beast Boost does) by 1. Not for indirect damage (poison, weather, hazards...). It's MegaGargomon's
  // Ability, so for Terriermon's line it's always MegaGargomon's base stats (Attack), never Terriermon's (Sp. Atk),
  // even on a Terriermon that got it some other way (Skill Swap...); anyone else uses its own current species'.
  const elevateForms = new Map(WARP_DIGIMON.filter(d => d.warp.abilities[0] === 'Elevate').map(d => [d.base.name, d.warp.name]));
  Object.assign(data.Abilities.elevate, {
    onSourceAfterFaint(this: Battle, length: number, _target: Pokemon, source: Pokemon, effect: { effectType?: string } | null) {
      if (effect?.effectType !== 'Move') return;
      const form = elevateForms.get(source.species.baseSpecies);
      const base = (form ? this.dex.species.get(form) : source.species).baseStats;
      const stats = ['atk', 'def', 'spa', 'spd', 'spe'] as const;
      const best = stats.reduce((a, b) => (base[b] > base[a] ? b : a));
      this.boost({ [best]: length }, source);
    },
  });
  // Amethyst Mandala breaks the target side's screens before it hits, as Brick Break does (and only when the target
  // can be hit by its type: none is immune to Fairy).
  for (const m of DIGIMON_MOVES.filter(m => m.breaksScreens)) {
    const type = m.type;
    Object.assign(data.Moves[toId(m.name)], {
      onTryHit(this: Battle, target: Pokemon) {
        if (!target.runImmunity(type)) return;
        target.side.removeSideCondition('reflect');
        target.side.removeSideCondition('lightscreen');
        target.side.removeSideCondition('auroraveil');
      },
    });
  }
  for (const m of DIGIMON_MOVES.filter(m => m.alsoType)) {
    const also = m.alsoType!;
    Object.assign(data.Moves[toId(m.name)], {
      onEffectiveness(this: Battle, typeMod: number, _target: Pokemon | null, type: string) {
        return typeMod + this.dex.getEffectiveness(also, type);
      },
    });
  }
  Object.assign(data.Abilities.dauntlessshield, {
    onStart(this: Battle, pokemon: Pokemon) {
      // Matrix Evolving: it takes effect after the call ("Gallantmon!"), not in the middle of the change (warpDigivolve).
      if (pokemon.m.warping) {
        pokemon.m.abilityHeld = true;
        return;
      }
      if (pokemon.m.shieldBoost) return;
      pokemon.m.shieldBoost = true;
      this.boost({ def: 1 }, pokemon);
    },
  });
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
  // The anime's call, split around the warp animation: "Agumon warp-digivolve to..." ... "WarGreymon!"
  // (BlackWarGreymon: "Agumon dark warp-digivolve to..."; Gallantmon: "Guilmon matrix-evolve to...").
  battle.add('message', `${who} ${warpNames(form).call} to...`);
  pokemon.m.warping = true;
  pokemon.formeChange(form, battle.dex.conditions.get('warpdigivolution'), true);
  pokemon.m.warping = false;
  // As for Mega Evolution: it counts as an action for Truant, and there's no going back.
  pokemon.moveThisTurnResult = true;
  pokemon.formeRegression = true;
  battle.add('message', `${form}!`);
  // An Ability that acts as it starts (Gallantmon's Dauntless Shield) waited for the call: now it does.
  if (pokemon.m.abilityHeld) {
    pokemon.m.abilityHeld = false;
    battle.singleEvent('Start', pokemon.getAbility(), pokemon.abilityState, pokemon);
  }
}

type Actions = Battle['actions'];
const proto = (self: Actions) => Object.getPrototypeOf(self) as Actions;

/**
 * The custom crystals' Z-Moves: Poliwrathium Z by the base move's type (Fighting / Water / Ice), with the base move's
 * Z power; Hitmonchanium Z by the base move itself, with its own power (Omega Punch: the base move's Z power).
 */
function customZ(item: string, move: Move): { name: string; basePower: number | null; priority?: number } | null {
  if (move.category === 'Status') return null;
  if (item === POLIWRATHIUM_ID) {
    const z = POLIWRATHIUM_Z.moves[move.type];
    return z ? { name: z.name, basePower: null } : null;
  }
  if (item === HITMONCHANIUM_ID) return HITMONCHANIUM_Z.moves[move.name] ?? null;
  return null;
}

/** The custom crystals' Z-Move for this base move, ready to use (category from the base move). */
function customZMove(actions: Actions, move: Move, pokemon: Pokemon): ActiveMove | null {
  const z = pokemon ? customZ(pokemon.getItem().id, move) : null;
  if (!z) return null;
  const zMove = actions.dex.getActiveMove(z.name);
  zMove.basePower = z.basePower ?? move.zMove!.basePower!;
  zMove.category = move.category;
  // Thunderbolt Blitzkrieg has its own priority (the turn order already used it, from the move's data).
  zMove.priority = z.priority ?? (z.basePower === null ? move.priority : 0);
  zMove.isZOrMaxPowered = true;
  return zMove;
}

/**
 * Engine hooks for the custom content. Poliwrathium Z: Poliwrath's damaging
 * Fighting / Water / Ice moves become its own Z-Moves, with the base move's Z
 * power and category (as Fightinium / Waterium / Icium Z would give).
 * Hitmonchanium Z: seven of Hitmonchan's moves become its own Z-Moves.
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
    if (item.id !== POLIWRATHIUM_ID && item.id !== HITMONCHANIUM_ID) return proto(this).getZMove.call(this, move, pokemon, skipChecks);
    if (!skipChecks) {
      if (pokemon.side.zMoveUsed || !item.itemUser?.includes(pokemon.species.name)) return undefined;
      if (!pokemon.getMoveData(move)?.pp) return undefined;
    }
    const z = customZ(item.id, move);
    return z && (z.basePower !== null || move.zMove?.basePower) ? z.name : undefined;
  },
  getActiveZMove(this: Actions, move: Move, pokemon: Pokemon): ActiveMove {
    const zMove = customZMove(this, move, pokemon) ?? proto(this).getActiveZMove.call(this, move, pokemon);
    // A damaging Z-Move is Physical or Special by its base move, which the protocol doesn't say:
    // a silent line tells the battle screen, for the animation (the sim asks twice per use; same answer).
    if (pokemon && zMove.category !== 'Status') this.battle.add('-activate', pokemon, `Z-Move: ${zMove.category}`, '[silent]');
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
