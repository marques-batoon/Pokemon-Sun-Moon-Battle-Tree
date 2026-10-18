// Bridge from live simulator state to @smogon/calc damage estimates.
import { calculate, Field, Generations, Move as CalcMove, Pokemon as CalcPokemon, Side as CalcSide } from '@smogon/calc';
import type { Battle, Pokemon, Side } from '@pkmn/sim';
import { CHAMPIONS_MEGAS, NEW_BASE_SPECIES } from '../../data/champions';
import { CUSTOM_SPECIES, HITMONCHANIUM_Z } from '../../data/custom';
import { DIGIMON_MOVES } from '../../data/custom/digimon';
import { PARADOX_FORMS } from '../../data/custom/paradox';

const gen = Generations.get(7);

const WEATHER: Record<string, string> = {
  sunnyday: 'Sun', raindance: 'Rain', sandstorm: 'Sand', hail: 'Hail', snowscape: 'Snow',
  desolateland: 'Harsh Sunshine', primordialsea: 'Heavy Rain', deltastream: 'Strong Winds',
};
const TERRAIN: Record<string, string> = {
  electricterrain: 'Electric', grassyterrain: 'Grassy', psychicterrain: 'Psychic', mistyterrain: 'Misty',
};

export interface Forme {
  /** Species to evaluate as (e.g. the Mega forme when Mega Evolving this turn). */
  species?: string;
  ability?: string;
}

const toId = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Species name as @smogon/calc knows it. Showdown's default formes sometimes
 * differ ("Aegislash" is "Aegislash-Shield" in the calc), and cosmetic formes
 * (Gastrodon-East, Minior colours, Vivillon patterns) aren't in the calc at all.
 */
export function calcSpeciesName(name: string, baseSpecies: string, baseForme: string): string {
  if (gen.species.get(toId(name) as never)) return name;
  // Not in the calc's Gen 7 data (Pokémon Champions Megas, Gen 8-9 Pokémon): calcPokemon describes them itself.
  if (CHAMPIONS_NAMES.has(name)) return name;
  const withForme = `${name}-${baseForme}`;
  if (baseForme && gen.species.get(toId(withForme) as never)) return withForme;
  return baseSpecies;
}

const CHAMPIONS_NAMES = new Set([...CHAMPIONS_MEGAS.map(m => m.species), ...NEW_BASE_SPECIES, ...CUSTOM_SPECIES, ...PARADOX_FORMS.map(f => f.form)]);

/** The calc's Gen 7 data predates the Champions Megas and Gen 8-9 Pokémon; describe them from the simulator's data. */
function speciesOverrides(species: Pokemon['species'], calcName: string) {
  if (gen.species.get(toId(calcName) as never)) return undefined;
  return {
    name: species.name, types: [...species.types], baseStats: { ...species.baseStats }, weightkg: species.weightkg,
    abilities: { 0: species.abilities[0] }, nfe: false,
  };
}

/** Calc errors seen so far (they're survivable, but a rising count means a mapping bug). */
export const calcErrors: { count: number; last: string | null } = { count: 0, last: null };

export function calcPokemon(p: Pokemon, forme: Forme = {}): CalcPokemon {
  const set = p.set;
  const species = forme.species ? p.battle.dex.species.get(forme.species) : p.species;
  const name = calcSpeciesName(species.name, species.baseSpecies, species.baseForme);
  // Protosynthesis / Quark Drive (this app's always-on version): the stat it boosts, so the calc applies 1.3x.
  const paradox = p.volatiles.paradoxboost as { bestStat?: string } | undefined;
  return new CalcPokemon(gen, name, {
    ...(paradox?.bestStat && !forme.species ? { boostedStat: paradox.bestStat as never } : {}),
    overrides: speciesOverrides(species, name) as never,
    level: p.level,
    ability: forme.ability ?? p.getAbility().name,
    item: p.getItem().name || undefined,
    nature: set.nature || 'Serious',
    evs: set.evs,
    ivs: set.ivs,
    gender: (p.gender || undefined) as 'M' | 'F' | 'N' | undefined,
    boosts: { atk: p.boosts.atk, def: p.boosts.def, spa: p.boosts.spa, spd: p.boosts.spd, spe: p.boosts.spe },
    status: (p.status || '') as '',
    curHP: p.hp,
  });
}

function calcSide(s: Side): CalcSide {
  const c = s.sideConditions;
  return new CalcSide({
    isReflect: !!c.reflect,
    isLightScreen: !!c.lightscreen,
    isAuroraVeil: !!c.auroraveil,
    isTailwind: !!c.tailwind,
    isSR: !!c.stealthrock,
    spikes: (c.spikes?.layers as number | undefined) ?? 0,
  });
}

export function calcField(battle: Battle, attacker: Side, defender: Side): Field {
  return new Field({
    gameType: battle.gameType === 'doubles' ? 'Doubles' : 'Singles',
    weather: WEATHER[battle.field.effectiveWeather()] as never,
    terrain: TERRAIN[battle.field.terrain] as never,
    isGravity: !!battle.field.getPseudoWeather('gravity'),
    attackerSide: calcSide(attacker),
    defenderSide: calcSide(defender),
  });
}

export interface DamageEstimate {
  min: number;
  max: number;
  /** Expected damage as a fraction of the defender's current HP, capped at 1. */
  frac: number;
  /** Every damage roll knocks the defender out. */
  ko: boolean;
}

export const NO_DAMAGE: DamageEstimate = { min: 0, max: 0, frac: 0, ko: false };

function rangeOf(d: number | number[] | number[][]): [number, number] {
  if (typeof d === 'number') return [d, d];
  if (!d.length) return [0, 0];
  if (Array.isArray(d[0])) {
    const hits = d as number[][];
    return [hits.reduce((s, h) => s + h[0], 0), hits.reduce((s, h) => s + h[h.length - 1], 0)];
  }
  const rolls = d as number[];
  return [rolls[0], rolls[rolls.length - 1]];
}

/** Gen 8-9 moves (made available for the Champions Pokémon) and the custom moves aren't in the calc's Gen 7 data. */
function moveOverrides(move: ReturnType<Battle['dex']['moves']['get']>) {
  if (gen.moves.get(move.id as never)) return undefined;
  return {
    name: move.name, basePower: move.basePower, type: move.type, category: move.category, target: move.target,
    priority: move.priority, flags: { ...move.flags }, multihit: move.multihit, drain: move.drain, recoil: move.recoil,
    // Sheer Force (WarGreymon) boosts moves with secondary effects.
    secondaries: move.secondaries ? true : undefined,
  };
}

/**
 * The move as the calc should see it. Hitmonchanium Z: its own Z-Moves' power and punch flag (the calc would make
 * a type Z-Move from the base move); Omega Punch takes the base move's Z power, as the calc does. Close Combat is a
 * punching move for Hitmonchan (Iron Fist).
 */
function calcMoveFor(battle: Battle, attacker: Pokemon, move: ReturnType<Battle['dex']['moves']['get']>, useZ: boolean): CalcMove {
  const z = useZ && attacker.getItem().id === toId(HITMONCHANIUM_Z.item) ? HITMONCHANIUM_Z.moves[move.name] : undefined;
  if (z && z.basePower !== null) {
    const zMove = battle.dex.moves.get(z.name);
    return new CalcMove(gen, move.name, { overrides: { ...moveOverrides(zMove), name: z.name, category: move.category } as never });
  }
  const punching = move.id === 'closecombat' && attacker.baseSpecies.baseSpecies === HITMONCHANIUM_Z.user;
  const overrides = punching ? { flags: { ...move.flags, punch: 1 } } : moveOverrides(move);
  return new CalcMove(gen, move.name, { useZ, overrides: overrides as never });
}

/**
 * Expected damage of `moveId` from attacker to defender in the current battle
 * state. Handles OHKO moves and Endeavor, which the calc reports as 0.
 * Never throws: unknown/unsupported cases count as no damage.
 */
export function estimateDamage(
  battle: Battle, attacker: Pokemon, defender: Pokemon, moveId: string,
  opts: { useZ?: boolean; attackerForme?: Forme; defenderForme?: Forme } = {},
): DamageEstimate {
  const move = battle.dex.moves.get(moveId);
  const hp = defender.hp;
  if (!move.exists || hp <= 0 || move.category === 'Status') return NO_DAMAGE;

  if (move.ohko) {
    const immuneType = move.id === 'sheercold' ? defender.hasType('Ice') : !defender.runImmunity(move.type);
    const grounded = move.id === 'fissure' ? defender.isGrounded() !== false : true;
    if (immuneType || !grounded || defender.hasAbility('sturdy') || defender.level > attacker.level) return NO_DAMAGE;
    return { min: hp, max: hp, frac: 1, ko: true };
  }
  if (move.id === 'endeavor') {
    if (!defender.runImmunity(move.type) || attacker.hp >= hp) return NO_DAMAGE;
    const dmg = hp - attacker.hp;
    return { min: dmg, max: dmg, frac: dmg / hp, ko: false };
  }

  try {
    const custom = opts.useZ ? undefined : DIGIMON_MOVES.find(m => toId(m.name) === move.id);
    const att = calcPokemon(attacker, opts.attackerForme);
    // A Digimon move attacking with another stat (Shield of Just: Sp. Def, as Body Press uses Defense): the calc only
    // knows Body Press by name, so it's given that stat (and its boosts) as Sp. Atk / Attack.
    if (custom?.attackStat) {
      const stat = custom.category === 'Physical' ? 'atk' : 'spa';
      att.rawStats[stat] = att.rawStats[custom.attackStat];
      att.stats[stat] = att.stats[custom.attackStat];
      att.boosts[stat] = att.boosts[custom.attackStat];
    }
    const result = calculate(
      gen,
      att,
      calcPokemon(defender, opts.defenderForme),
      calcMoveFor(battle, attacker, move, !!opts.useZ),
      calcField(battle, attacker.side, defender.side),
    );
    let [min, max] = rangeOf(result.damage);
    // A Digimon move with a second type (Lightning Joust: Electric too, like Flying Press): its effectiveness counts too.
    if (custom?.alsoType) {
      const k = 2 ** battle.dex.getEffectiveness(custom.alsoType, (opts.defenderForme?.species ? battle.dex.species.get(opts.defenderForme.species).types : defender.getTypes()) as string[]);
      [min, max] = [Math.floor(min * k), Math.floor(max * k)];
    }
    return { min, max, frac: Math.min(1, (min + max) / 2 / hp), ko: min >= hp };
  } catch (err) {
    calcErrors.count++;
    calcErrors.last = `${attacker.species.name} ${move.name} vs ${defender.species.name}: ${err instanceof Error ? err.message : String(err)}`;
    return NO_DAMAGE;
  }
}
