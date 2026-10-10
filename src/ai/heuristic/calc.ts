// Bridge from live simulator state to @smogon/calc damage estimates.
import { calculate, Field, Generations, Move as CalcMove, Pokemon as CalcPokemon, Side as CalcSide } from '@smogon/calc';
import type { Battle, Pokemon, Side } from '@pkmn/sim';
import { CHAMPIONS_MEGAS, NEW_BASE_SPECIES } from '../../data/champions';
import { CUSTOM_SPECIES } from '../../data/custom';
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
    const result = calculate(
      gen,
      calcPokemon(attacker, opts.attackerForme),
      calcPokemon(defender, opts.defenderForme),
      new CalcMove(gen, move.name, { useZ: !!opts.useZ, overrides: moveOverrides(move) as never }),
      calcField(battle, attacker.side, defender.side),
    );
    const [min, max] = rangeOf(result.damage);
    return { min, max, frac: Math.min(1, (min + max) / 2 / hp), ko: min >= hp };
  } catch (err) {
    calcErrors.count++;
    calcErrors.last = `${attacker.species.name} ${move.name} vs ${defender.species.name}: ${err instanceof Error ? err.message : String(err)}`;
    return NO_DAMAGE;
  }
}
