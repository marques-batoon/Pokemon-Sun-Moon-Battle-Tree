import type { Battle, Pokemon, PRNG, SideID } from '@pkmn/sim';
import type { AIContext, BattleAI } from '../types';
import { doublesTargets, hitsPartner, isSpread } from '../../engine/choices';
import { isFainted, isForceSwitch, isMoveRequest, isTeamPreview, type SimRequest } from '../../engine/sim-types';
import { estimateDamage, type Forme } from './calc';
import { DEFAULT_CONFIG, type HeuristicConfig } from './config';
import { bestThreat, evaluateBench, scoreDamaging, scoreStatus, type Situation } from './evaluate';

export interface DecisionOption {
  choice: string;
  score: number;
  ko: boolean;
  first: boolean;
  reason: string;
  /** Doubles: also deals heavy damage to the AI's own partner. */
  harmsPartner?: boolean;
}

/** What the AI considered and why it picked what it did (for tests and tuning). */
export interface Decision {
  turn: number;
  options: DecisionOption[];
  choice: string;
  why: string;
}

type HeuristicOverrides = Partial<Omit<HeuristicConfig, 'scores'>> & { scores?: Partial<HeuristicConfig['scores']> };

/**
 * Approximation of the Sun/Moon Battle Tree AI (see AI_NOTES.md): damage-aware
 * move choice via @smogon/calc, sensible status/setup/field moves, occasional
 * defensive switching, and a weighted random roll so it isn't predictable.
 */
export class HeuristicAI implements BattleAI {
  readonly name = 'heuristic';
  readonly config: HeuristicConfig;
  lastDecision: Decision | null = null;

  constructor(overrides: HeuristicOverrides = {}) {
    this.config = { ...DEFAULT_CONFIG, ...overrides, scores: { ...DEFAULT_CONFIG.scores, ...overrides.scores } };
  }

  choose(ctx: AIContext): string {
    const { request } = ctx;
    if (isTeamPreview(request)) {
      // The generated team order is the battle order (first pick leads).
      const n = request.maxChosenTeamSize ?? request.side.pokemon.length;
      return `team ${Array.from({ length: n }, (_, i) => i + 1).join('')}`;
    }
    const doubles = ctx.battle.gameType === 'doubles';
    if (isForceSwitch(request)) return doubles ? this.chooseDoublesReplacements(ctx, request) : this.chooseReplacement(ctx);
    if (isMoveRequest(request)) return doubles ? this.chooseDoublesActions(ctx, request) : this.chooseAction(ctx, request);
    return 'default';
  }

  /**
   * Doubles: each active Pokémon picks its own action. Single-target moves are
   * scored against each foe (the choice names the target), spread moves against
   * both foes minus any damage to the partner. One Mega Evolution and one Z-Move
   * per turn. No voluntary switching (see AI_NOTES.md).
   */
  private chooseDoublesActions(ctx: AIContext, request: Extract<SimRequest, { active: unknown }>): string {
    const { battle, side, prng } = ctx;
    const cfg = this.config;
    const mySide = battle.getSide(side);
    const foes = mySide.foe.active.filter((f): f is Pokemon => !!f && !f.fainted && f.hp > 0);
    let megaUsed = false;
    let zUsed = false;
    const notes: string[] = [];
    const choices = request.active.map((active, slot) => {
      const me = mySide.active[slot];
      const reqMon = request.side.pokemon[slot];
      if (!me || me.fainted || !reqMon || isFainted(reqMon)) return 'pass';
      const partner = mySide.active[1 - slot];
      const partnerUp = !!partner && !partner.fainted && partner.hp > 0;
      const usable = active.moves
        .map((m, i) => ({ m, moveSlot: i + 1, dex: battle.dex.moves.get(m.id) }))
        .filter(({ m }) => !m.disabled && (m.pp === undefined || m.pp > 0));
      const firstFoeLoc = foes.length ? foes[0].position + 1 : 1;
      const withTarget = (moveSlot: number, target: string | undefined, loc: number, extra = '') => {
        const needs = doublesTargets(target, slot);
        return `move ${moveSlot}${needs ? ` ${needs.includes(loc) ? loc : needs[0]}` : ''}${extra}`;
      };
      const forced = usable.length <= 1 && (usable[0]?.m.id === 'recharge' || usable[0]?.m.id === 'struggle');
      if (!foes.length || forced || !usable.length) {
        return usable.length ? withTarget(usable[0].moveSlot, usable[0].m.target, firstFoeLoc) : 'move 1';
      }

      const mega = !megaUsed && active.canMegaEvo ? ' mega' : '';
      const myForme = mega ? megaForme(battle, me) : undefined;
      const situation = (foe: Pokemon): Situation => ({
        battle, me, foe, myForme, config: cfg,
        trickRoom: !!battle.field.getPseudoWeather('trickroom'),
        threat: bestThreat(battle, foe, me, myForme),
      });
      const partnerHit = (moveId: string) => {
        if (!partnerUp) return { penalty: 0, heavy: false };
        const est = estimateDamage(battle, me, partner, moveId, { attackerForme: myForme });
        return { penalty: est.frac * cfg.partnerDamagePenalty + (est.ko ? cfg.partnerDamagePenalty : 0), heavy: est.ko || est.frac >= HEAVY_PARTNER_DAMAGE };
      };

      const options: DecisionOption[] = [];
      for (const { m, moveSlot, dex } of usable) {
        if (dex.category === 'Status') continue;
        if (isSpread(dex.target) || !doublesTargets(dex.target, slot)) {
          // Spread (or self-targeting, like Outrage): one choice, judged against every foe it can hit.
          const hits = isSpread(dex.target) ? foes : foes.slice(0, 1);
          const scored = hits.map(f => scoreDamaging(situation(f), m.id, false));
          const friendly = hitsPartner(dex.target) ? partnerHit(m.id) : { penalty: 0, heavy: false };
          const score = scored.reduce((a, r) => a + r.score, 0) - friendly.penalty;
          options.push({
            choice: withTarget(moveSlot, dex.target, firstFoeLoc, mega), score, ko: scored.some(r => r.ko), first: scored.some(r => r.first),
            harmsPartner: friendly.heavy, reason: `${m.move}: ${scored.map(r => r.reason).join(' / ')}${friendly.penalty ? ` (partner -${friendly.penalty.toFixed(2)})` : ''}`,
          });
          continue;
        }
        for (const foe of foes) {
          const r = scoreDamaging(situation(foe), m.id, false);
          options.push({ choice: withTarget(moveSlot, dex.target, foe.position + 1, mega), score: r.score, ko: r.ko, first: r.first, reason: `${m.move} -> ${foe.name}: ${r.reason}` });
        }
      }
      const koAvailable = options.some(o => o.ko);
      for (const { m, moveSlot, dex } of usable) {
        if (dex.category !== 'Status') continue;
        const targets = doublesTargets(dex.target, slot);
        if (targets && targets.every(t => t < 0)) {
          // Partner support (Helping Hand, Follow Me's partner moves...).
          if (partnerUp) options.push({ choice: withTarget(moveSlot, dex.target, targets[targets.length - 1], mega), score: cfg.partnerSupportScore, ko: false, first: false, reason: `${m.move}: support partner` });
          continue;
        }
        const foe = foes[0];
        const r = scoreStatus(situation(foe), m.id, koAvailable);
        options.push({ choice: withTarget(moveSlot, dex.target, foe.position + 1, mega), score: r.score, ko: false, first: r.first, reason: `${m.move}: ${r.reason}` });
      }
      if (!zUsed && active.canZMove && prng.random() < cfg.zMoveChance) {
        active.canZMove.forEach((z, i) => {
          const base = active.moves[i];
          if (!z || !base || base.disabled || battle.dex.moves.get(base.id).category === 'Status') return;
          const best = foes
            .map(f => ({ f, r: scoreDamaging(situation(f), base.id, true) }))
            .reduce((a, b) => (b.r.score > a.r.score ? b : a));
          options.push({ choice: withTarget(i + 1, z.target, best.f.position + 1, ' zmove'), score: best.r.score, ko: best.r.ko, first: best.r.first, reason: `${z.move} -> ${best.f.name}: ${best.r.reason}` });
        });
      }

      // Take a KO most of the time, but not one that also badly hurts the partner (that goes to the weighted roll).
      const kos = options.filter(o => o.ko && !o.harmsPartner);
      const choice = kos.length && prng.random() < cfg.koBias
        ? [...kos].sort((a, b) => Number(b.first) - Number(a.first) || Number(a.choice.includes('zmove')) - Number(b.choice.includes('zmove')) || b.score - a.score)[0].choice
        : weightedPick(options, cfg.temperature, prng);
      if (choice.endsWith(' mega')) megaUsed = true;
      if (choice.endsWith(' zmove')) zUsed = true;
      notes.push(`${me.name}: ${choice}`);
      return choice;
    });
    const choice = choices.join(', ');
    this.lastDecision = { turn: battle.turn, options: [], choice, why: notes.join('; ') };
    return choice;
  }

  /** Doubles replacements: for each empty slot, the strongest remaining Pokémon against the foes still standing. */
  private chooseDoublesReplacements({ battle, side }: AIContext, request: Extract<SimRequest, { forceSwitch: boolean[] }>): string {
    const mySide = battle.getSide(side);
    const foe = mySide.foe.active.find(f => f && !f.fainted && f.hp > 0);
    const taken = new Set<number>();
    return request.forceSwitch.map(needed => {
      if (!needed) return 'pass';
      const bench = foe
        ? evaluateBench(battle, mySide, foe).filter(b => !taken.has(b.slot))
        : mySide.pokemon.flatMap((p, i) => (!p.isActive && p.hp > 0 && !taken.has(i + 1) ? [{ slot: i + 1, offense: 0, incoming: 0 }] : []));
      if (!bench.length) return 'pass';
      const best = bench.reduce((a, b) => (scoreIncoming(b) > scoreIncoming(a) ? b : a));
      taken.add(best.slot);
      return `switch ${best.slot}`;
    }).join(', ');
  }

  /** After a faint: send in the Pokémon with the highest damage potential against the foe (Smogon guide). */
  private chooseReplacement({ battle, side }: AIContext): string {
    const mySide = battle.getSide(side);
    const foe = mySide.foe.active[0];
    if (!foe || foe.hp <= 0) {
      const slot = mySide.pokemon.findIndex(p => !p.isActive && p.hp > 0);
      return slot >= 0 ? `switch ${slot + 1}` : 'pass';
    }
    const bench = evaluateBench(battle, mySide, foe);
    if (!bench.length) return 'pass';
    const best = bench.reduce((a, b) => (scoreIncoming(b) > scoreIncoming(a) ? b : a));
    return this.record(battle, bench.map(b => ({ choice: `switch ${b.slot}`, score: scoreIncoming(b), ko: false, first: false, reason: `offense ${pct(b.offense)}, takes ${pct(b.incoming)}` })), `switch ${best.slot}`, 'highest damage potential');
  }

  private chooseAction(ctx: AIContext, request: Extract<SimRequest, { active: unknown }>): string {
    const { battle, side, prng } = ctx;
    const cfg = this.config;
    const active = request.active[0];
    const me = battle.getSide(side).active[0];
    const foe = battle.getSide(side).foe.active[0];

    const usable = active.moves
      .map((m, i) => ({ m, slot: i + 1 }))
      .filter(({ m }) => !m.disabled && (m.pp === undefined || m.pp > 0));
    const forced = usable.length <= 1 && (usable[0]?.m.id === 'recharge' || usable[0]?.m.id === 'struggle');
    if (!me || !foe || foe.hp <= 0 || forced) {
      return usable.length ? `move ${usable[0].slot}` : 'move 1';
    }

    const mega = active.canMegaEvo ? ' mega' : '';
    const myForme = active.canMegaEvo ? megaForme(battle, me) : undefined;
    const situation: Situation = {
      battle, me, foe, myForme, config: cfg,
      trickRoom: !!battle.field.getPseudoWeather('trickroom'),
      threat: bestThreat(battle, foe, me, myForme),
    };

    // Damaging moves first, so status moves know whether a KO is on the table.
    const options: DecisionOption[] = [];
    for (const { m, slot } of usable) {
      if (battle.dex.moves.get(m.id).category === 'Status') continue;
      const r = scoreDamaging(situation, m.id, false);
      options.push({ choice: `move ${slot}${mega}`, score: r.score, ko: r.ko, first: r.first, reason: `${m.move}: ${r.reason}` });
    }
    const koAvailable = options.some(o => o.ko);
    for (const { m, slot } of usable) {
      if (battle.dex.moves.get(m.id).category !== 'Status') continue;
      const r = scoreStatus(situation, m.id, koAvailable);
      options.push({ choice: `move ${slot}${mega}`, score: r.score, ko: false, first: r.first, reason: `${m.move}: ${r.reason}` });
    }
    // Z-Moves: offered on damaging slots that can become one; decided once per turn.
    if (active.canZMove && prng.random() < cfg.zMoveChance) {
      active.canZMove.forEach((z, i) => {
        const base = active.moves[i];
        if (!z || !base || battle.dex.moves.get(base.id).category === 'Status' || base.disabled) return;
        const r = scoreDamaging(situation, base.id, true);
        options.push({ choice: `move ${i + 1} zmove`, score: r.score, ko: r.ko, first: r.first, reason: `${z.move}: ${r.reason}` });
      });
    }

    const switchChoice = this.considerSwitch(battle, side, foe, situation, options, !!(active.trapped || active.maybeTrapped), prng);
    if (switchChoice) return switchChoice;

    // A guaranteed KO is taken most of the time; prefer one that lands first, and a plain move over spending the Z.
    const kos = options.filter(o => o.ko);
    if (kos.length && prng.random() < cfg.koBias) {
      const best = [...kos].sort((a, b) => Number(b.first) - Number(a.first) || Number(a.choice.includes('zmove')) - Number(b.choice.includes('zmove')) || b.score - a.score)[0];
      return this.record(battle, options, best.choice, 'take the KO');
    }
    return this.record(battle, options, weightedPick(options, cfg.temperature, prng), 'weighted roll');
  }

  /**
   * Switch out when (a) the foe KOs us first and we can't KO it first, or (b) we're
   * locked into moves that do nothing; and a bench Pokémon resists (takes little
   * damage) and threatens the foe back (Smogon guide).
   */
  private considerSwitch(battle: Battle, side: SideID, foe: Pokemon, s: Situation, options: DecisionOption[], trapped: boolean, prng: PRNG): string | null {
    if (trapped) return null;
    const cfg = this.config;
    const weKOFirst = options.some(o => o.ko && o.first);
    const threatened = s.threat.koFirst && !weKOFirst;
    const useless = options.every(o => o.score <= POINTLESS);
    if (!threatened && !useless) return null;

    const candidates = evaluateBench(battle, battle.getSide(side), foe)
      .filter(c => c.incoming <= cfg.switchInMaxDamage && (c.superEffective || c.offense >= 0.5));
    if (!candidates.length) return null;
    if (prng.random() >= (useless ? cfg.lockedSwitchChance : cfg.switchChance)) return null;
    const best = candidates.reduce((a, b) => (b.offense - b.incoming > a.offense - a.incoming ? b : a));
    const reason = useless ? 'locked into useless move' : `threatened (${pct(s.threat.frac)} from ${s.threat.moveId})`;
    return this.record(battle, [...options, { choice: `switch ${best.slot}`, score: 0, ko: false, first: false, reason: `${best.pokemon.name}: takes ${pct(best.incoming)}, deals ${pct(best.offense)}` }], `switch ${best.slot}`, reason);
  }

  private record(battle: Battle, options: DecisionOption[], choice: string, why: string): string {
    this.lastDecision = { turn: battle.turn, options, choice, why };
    return choice;
  }
}

/** Doubles: damage to the partner (fraction of its HP) that makes a move count as hurting it badly. */
const HEAVY_PARTNER_DAMAGE = 0.3;

/** Options at or below this score do nothing useful (failing moves, weather already up). */
const POINTLESS = 0.04;

/**
 * Softmax roll over scores normalized by the best option, so the roll compares
 * relative strength: with temperature 0.12 an option at 90% of the best is
 * picked ~0.43x as often, one at 70% ~0.08x. Pointless options are dropped
 * unless nothing else is available (then the pick is uniform).
 */
export function weightedPick(options: DecisionOption[], temperature: number, prng: PRNG): string {
  if (!options.length) return 'default';
  const useful = options.filter(o => o.score > POINTLESS);
  if (!useful.length) return options[prng.random(options.length)].choice;
  const max = Math.max(...useful.map(o => o.score));
  const weights = useful.map(o => Math.exp((o.score / max - 1) / temperature));
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = prng.random() * total;
  for (let i = 0; i < useful.length; i++) {
    roll -= weights[i];
    if (roll < 0) return useful[i].choice;
  }
  return useful[useful.length - 1].choice;
}

function megaForme(battle: Battle, me: Pokemon): Forme | undefined {
  const name = typeof me.canMegaEvo === 'string' ? me.canMegaEvo : null;
  if (!name) return undefined;
  const species = battle.dex.species.get(name);
  return { species: species.name, ability: species.abilities[0] };
}

const scoreIncoming = (c: { offense: number; incoming: number }) => c.offense - c.incoming * 0.25;
const pct = (f: number) => `${Math.round(f * 100)}%`;
