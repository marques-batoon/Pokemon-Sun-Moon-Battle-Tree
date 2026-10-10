// Option scoring for the heuristic AI. Every rule below is listed, with its
// source, in AI_NOTES.md.
import type { Battle, Pokemon, Side } from '@pkmn/sim';
import { estimateDamage, NO_DAMAGE, type DamageEstimate, type Forme } from './calc';
import type { HeuristicConfig } from './config';

type DexMove = ReturnType<Battle['dex']['moves']['get']>;

export interface Situation {
  battle: Battle;
  me: Pokemon;
  foe: Pokemon;
  /** Forme we'll be in when attacking (Mega Evolution happens before moves). */
  myForme?: Forme;
  config: HeuristicConfig;
  trickRoom: boolean;
  /** The foe's strongest move against our active Pokémon. */
  threat: Threat;
}

export interface Threat {
  frac: number;
  ko: boolean;
  /** The foe's KO move lands before we can act. */
  koFirst: boolean;
  moveId: string | null;
}

export interface ScoredMove {
  score: number;
  ko: boolean;
  /** We act before the foe with this move. */
  first: boolean;
  reason: string;
}

const RECOVERY = new Set(['recover', 'roost', 'softboiled', 'slackoff', 'synthesis', 'moonlight', 'morningsun', 'milkdrink', 'healorder', 'shoreup', 'strengthsap', 'wish', 'swallow']);
const CHOICE_LIKE = new Set(['choicescarf', 'choiceband', 'choicespecs', 'flameorb', 'toxicorb', 'ironball', 'laggingtail', 'stickybarb', 'ringtarget']);
const STATUS_ABILITY_BLOCK: Record<string, string[]> = {
  par: ['limber'], brn: ['waterveil', 'waterbubble'], psn: ['immunity'], tox: ['immunity'], slp: ['insomnia', 'vitalspirit', 'sweetveil'],
};
const HAZARD_MAX: Record<string, number> = { stealthrock: 1, spikes: 3, toxicspikes: 2, stickyweb: 1 };

export function movePriority(user: Pokemon, move: DexMove): number {
  let p = move.priority;
  if (move.category === 'Status' && user.hasAbility('prankster')) p += 1;
  if (move.type === 'Flying' && user.hasAbility('galewings') && user.hp === user.maxhp) p += 1;
  if (move.flags.heal && user.hasAbility('triage')) p += 3;
  return p;
}

/** Strictly acts before the defender (speed ties count as not first). */
export function actsFirst(battle: Battle, a: Pokemon, aPriority: number, d: Pokemon, dPriority: number): boolean {
  if (aPriority !== dPriority) return aPriority > dPriority;
  const sa = a.getActionSpeed();
  const sd = d.getActionSpeed();
  return battle.field.getPseudoWeather('trickroom') ? sa < sd : sa > sd;
}

/** The attacker's best damaging move against the defender (full knowledge, as the in-game AI). */
export function bestThreat(battle: Battle, attacker: Pokemon, defender: Pokemon, defenderForme?: Forme): Threat {
  let best: Threat = { frac: 0, ko: false, koFirst: false, moveId: null };
  for (const slot of attacker.moveSlots) {
    if (slot.disabled || slot.pp <= 0) continue;
    const est = estimateDamage(battle, attacker, defender, slot.id, { defenderForme });
    if (est.frac <= best.frac && !(est.ko && !best.ko)) continue;
    const move = battle.dex.moves.get(slot.id);
    const first = actsFirst(battle, attacker, movePriority(attacker, move), defender, 0);
    best = { frac: est.frac, ko: est.ko, koFirst: est.ko && first, moveId: slot.id };
  }
  return best;
}

/** Whether a status move could inflict `status` on the foe right now. */
function canInflict(s: Situation, move: DexMove, status: string): boolean {
  const { battle, foe } = s;
  if (foe.status) return false;
  if (foe.volatiles.substitute && !move.flags.bypasssub && !move.flags.sound) return false;
  if (foe.side.sideConditions.safeguard) return false;
  if (move.flags.powder && (foe.hasType('Grass') || foe.hasAbility('overcoat') || foe.hasItem('safetygoggles'))) return false;
  if (!foe.runImmunity(move.type)) return false;
  if (!foe.runStatusImmunity(status)) return false;
  if (foe.hasAbility([...(STATUS_ABILITY_BLOCK[status] ?? []), 'comatose', 'magicbounce'])) return false;
  if (foe.isGrounded() && battle.field.isTerrain('mistyterrain')) return false;
  if (status === 'slp' && foe.isGrounded() && battle.field.isTerrain('electricterrain')) return false;
  return true;
}

/** Score of a move the AI must not pick (below 0, the score of a move that just fails). */
export const RULED_OUT = -1;

/** Targets that are only the user's partner. */
export const ALLY_ONLY_TARGETS = new Set(['adjacentAlly']);

/** Our side (or our Multi ally) set up the current Trick Room on the previous turn. */
function ownTrickRoomSetLastTurn({ battle, me }: Situation): boolean {
  const room = battle.field.pseudoWeather.trickroom as { duration?: number; source?: Pokemon } | undefined;
  if (!room?.source || (room.duration ?? 0) < 4) return false;
  return room.source.side === me.side || room.source.side === me.side.allySide;
}

const positiveBoosts = (p: Pokemon) => Object.values(p.boosts).reduce((s, v) => s + Math.max(0, v), 0);
const isPhysical = (p: Pokemon) => p.getStat('atk', false, true) >= p.getStat('spa', false, true);
const aliveBench = (side: Side) => side.pokemon.filter(p => !p.isActive && p.hp > 0).length;

/** Moves that hit two turns later (a slot condition on the target's spot until then). */
const FUTURE_MOVES = new Set(['futuresight', 'doomdesire']);

/** Scores a damaging move (optionally as a Z-Move). */
export function scoreDamaging(s: Situation, moveId: string, useZ: boolean): ScoredMove & { est: DamageEstimate } {
  const { battle, me, foe, config } = s;
  const move = battle.dex.moves.get(moveId);
  // App rule: no Future Sight (or Doom Desire) at a spot one is already headed for, until it hits
  // (the game makes it fail then anyway). Below 0, like the other ruled-out moves.
  if (FUTURE_MOVES.has(move.id) && !useZ && foe.side.slotConditions[foe.position]?.futuremove) {
    return { score: RULED_OUT, ko: false, first: false, reason: 'future attack already coming', est: NO_DAMAGE };
  }
  const est = estimateDamage(battle, me, foe, moveId, { useZ, attackerForme: s.myForme });
  const first = actsFirst(battle, me, movePriority(me, move), foe, s.threat.moveId ? battle.dex.moves.get(s.threat.moveId).priority : 0);
  let score = est.frac;
  if (config.considerAccuracy && typeof move.accuracy === 'number') score *= move.accuracy / 100;
  let reason = `${Math.round(est.frac * 100)}% dmg`;

  if (est.ko) {
    score = config.koScore + (first ? 0.2 : 0);
    reason = first ? 'KO, moves first' : 'KO';
  } else {
    if (move.selfdestruct && me.hp / me.maxhp > 0.25) { score *= 0.3; reason += ', self-KO'; }
    if (move.flags.recharge) score *= 0.8;
    const dropsSpeed = [move.secondary, ...(move.secondaries ?? [])].some(sec => (sec?.boosts?.spe ?? 0) < 0 && (sec?.chance ?? 100) >= 100);
    if (dropsSpeed && !actsFirst(battle, me, 0, foe, 0)) { score += config.scores.speedControlBonus; reason += ', speed control'; }
  }

  // First-turn-only moves fail later; Fake Out is used on the first turn out (Smogon guide).
  if (move.id === 'fakeout' || move.id === 'firstimpression') {
    const firstTurn = me.activeMoveActions === 0;
    const blocked = (move.id === 'fakeout' && foe.hasType('Ghost')) || (foe.isGrounded() && battle.field.isTerrain('psychicterrain'));
    if (!firstTurn || blocked) return { score: 0, ko: false, first, reason: 'fails now', est };
    if (move.id === 'fakeout') { score = Math.max(score, config.scores.fakeOut); reason = 'Fake Out on first turn'; }
  }
  if (move.forceSwitch && positiveBoosts(foe) > 0 && aliveBench(foe.side) > 0) {
    score = Math.max(score, config.scores.phaze * 0.9);
    reason = 'phaze boosted foe';
  }
  return { score, ko: est.ko, first, reason, est };
}

/** Scores a non-damaging move by its effect. `koAvailable`: some damaging move already KOs. */
export function scoreStatus(s: Situation, moveId: string, koAvailable: boolean): ScoredMove {
  const { battle, me, foe, config, threat } = s;
  const sc = config.scores;
  const move = battle.dex.moves.get(moveId);
  const first = actsFirst(battle, me, movePriority(me, move), foe, 0);
  const out = (score: number, reason: string): ScoredMove => ({ score, ko: false, first, reason });
  const hpFrac = me.hp / me.maxhp;
  const safe = threat.frac < config.setupSafeThreat && !threat.koFirst;

  // Ruled out (app rules), scored below a move that merely fails so they lose even an all-zero tie:
  // partner-only moves (Helping Hand) in a Single Battle, and Wish / Trick Room twice in a row
  // (a second Trick Room undoes ours; a second Wish fails while one is pending).
  if (battle.gameType === 'singles' && ALLY_ONLY_TARGETS.has(move.target)) return out(RULED_OUT, 'no partner in Singles');
  if (move.id === 'wish' && (me.lastMove?.id === 'wish' || me.side.slotConditions[me.position]?.wish)) return out(RULED_OUT, 'wish just used');
  if (move.id === 'trickroom' && (me.lastMove?.id === 'trickroom' || ownTrickRoomSetLastTurn(s))) return out(RULED_OUT, 'trick room just set');

  if (move.status) {
    if (!canInflict(s, move, move.status)) return out(0, `can't ${move.status}`);
    switch (move.status) {
      case 'slp': return out(sc.sleep, 'sleep');
      case 'par': return out(sc.paralysis, 'paralysis');
      case 'brn': return isPhysical(foe) ? out(sc.burnPhysical, 'burn physical foe') : out(sc.burnSpecial, 'burn');
      case 'tox': return out(sc.toxic, 'toxic');
      case 'psn': return out(sc.poison, 'poison');
    }
  }
  if (move.volatileStatus === 'confusion') {
    if (foe.volatiles.confusion || foe.volatiles.substitute || foe.hasAbility('owntempo')) return out(0, 'already confused');
    return out(move.boosts ? sc.confusion * 0.6 : sc.confusion, 'confuse');
  }
  if (move.id === 'yawn') {
    return !foe.volatiles.yawn && canInflict(s, move, 'slp') ? out(sc.yawn, 'yawn') : out(0, 'yawn fails');
  }
  if (move.id === 'leechseed') {
    return foe.hasType('Grass') || foe.volatiles.leechseed || foe.volatiles.substitute ? out(0, 'seed fails') : out(sc.leechSeed, 'leech seed');
  }
  if (move.weather) {
    if (battle.field.effectiveWeather() === toId(move.weather)) return out(0, 'weather already up');
    return koAvailable ? out(0.02, 'KO available') : out(sc.weather, 'set weather');
  }
  if (move.terrain) {
    if (battle.field.terrain === toId(move.terrain)) return out(0, 'terrain already up');
    return koAvailable ? out(0.02, 'KO available') : out(sc.terrain, 'set terrain');
  }
  if (move.pseudoWeather === 'trickroom') {
    const foeFaster = foe.getActionSpeed() > me.getActionSpeed();
    if (!s.trickRoom) return foeFaster ? out(sc.trickRoom, 'Trick Room vs faster foe') : out(0.03, 'already faster');
    return foeFaster ? out(0.02, 'TR helps us') : out(sc.trickRoom * 0.3, 'revert Trick Room');
  }
  if (move.sideCondition) {
    const cond = move.sideCondition;
    if (cond === 'tailwind') return me.side.sideConditions.tailwind ? out(0, 'tailwind up') : s.trickRoom ? out(0.02, 'Trick Room up') : out(sc.tailwind, 'tailwind');
    if (cond === 'reflect' || cond === 'lightscreen') {
      if (me.side.sideConditions[cond]) return out(0, 'screen up');
      const fits = cond === 'reflect' ? isPhysical(foe) : !isPhysical(foe);
      return out(fits ? sc.screen : sc.screen * 0.4, cond);
    }
    if (cond === 'auroraveil') {
      return battle.field.effectiveWeather() === 'hail' && !me.side.sideConditions.auroraveil ? out(sc.auroraVeil, 'aurora veil') : out(0, 'veil fails');
    }
    if (cond in HAZARD_MAX) {
      const layers = (foe.side.sideConditions[cond]?.layers as number | undefined) ?? (foe.side.sideConditions[cond] ? 1 : 0);
      if (layers >= HAZARD_MAX[cond]) return out(0, 'hazard maxed');
      return aliveBench(foe.side) === 0 ? out(0.02, 'no bench to hurt') : out(sc.hazard, cond);
    }
    return out(sc.other, cond);
  }
  if (move.forceSwitch) {
    if (aliveBench(foe.side) === 0) return out(0, 'nothing to phaze into');
    return positiveBoosts(foe) > 0 ? out(sc.phaze, 'phaze boosted foe') : out(sc.other * 0.5, 'phaze');
  }
  if (move.id === 'haze') return positiveBoosts(foe) > 0 ? out(sc.haze, 'haze boosts') : out(0.02, 'nothing to haze');

  if (move.id === 'bellydrum') {
    if (me.boosts.atk >= 6 || hpFrac <= 0.5) return out(0, 'belly drum fails');
    return hpFrac > 0.55 && safe ? out(sc.setup, 'belly drum') : out(0.02, 'belly drum unsafe');
  }
  if (move.id === 'stockpile') {
    const layers = (me.volatiles.stockpile?.layers as number | undefined) ?? 0;
    if (layers >= 3) return out(0, 'stockpile full');
    return layers < 2 && safe ? out(sc.setup * 0.8, 'stockpile') : out(0.03, 'stockpiled');
  }
  if (move.boosts && (move.target === 'self' || move.target === 'adjacentAllyOrSelf')) {
    return scoreSetup(s, move, safe, out);
  }
  if (move.boosts) {
    // Stat drops on the foe (Growl, Screech, Feather Dance, Cotton Spore...).
    const matters = Object.entries(move.boosts).some(([stat, v]) => (v ?? 0) < 0 && foe.boosts[stat as keyof typeof foe.boosts] > -2
      && (stat !== 'atk' || isPhysical(foe)) && (stat !== 'spa' || !isPhysical(foe)));
    return foe.volatiles.substitute ? out(0, 'behind substitute') : out(matters ? sc.statDrop : 0.03, 'stat drop');
  }

  if (move.id === 'rest') {
    const blocked = me.hasAbility(['insomnia', 'vitalspirit']) || (me.isGrounded() && battle.field.isTerrain(['mistyterrain', 'electricterrain']));
    if (blocked || hpFrac > 0.7) return out(0, 'rest not needed');
    return out(sc.recovery * (1 - hpFrac) + (me.status ? 0.2 : 0), 'rest');
  }
  if (RECOVERY.has(move.id) || (move.heal && move.target === 'self')) {
    if (move.id === 'swallow' && !me.volatiles.stockpile) return out(0, 'nothing swallowed');
    if (me.hp >= me.maxhp) return out(0, 'HP full');
    if (hpFrac > 0.85) return out(0.02, 'healthy');
    // Healing helps only if we survive the hit we're about to take.
    const helps = !threat.koFirst || hpFrac > threat.frac;
    return out(sc.recovery * (1 - hpFrac) * (helps ? 1.2 : 0.5), 'recover');
  }
  if (move.stallingMove) {
    if (me.lastMove && battle.dex.moves.get(me.lastMove.id).stallingMove) return out(0.02, 'protect just used');
    if (move.id === 'endure') return out(threat.koFirst ? 0.3 : 0.02, 'endure');
    const foeTicking = foe.status === 'tox' || foe.status === 'psn' || foe.status === 'brn' || !!foe.volatiles.leechseed || !!foe.volatiles.perishsong;
    return out(foeTicking ? sc.protectStall : sc.protect, foeTicking ? 'stall' : 'protect');
  }
  if (move.id === 'substitute') {
    return !me.volatiles.substitute && me.hp > me.maxhp / 4 + 1 && threat.frac < 0.35 ? out(sc.substitute, 'substitute') : out(0, 'sub unsafe');
  }
  if (move.id === 'counter' || move.id === 'mirrorcoat' || move.id === 'metalburst') {
    // Sturdy / Focus Sash + Metal Burst style sets (Smogon guide).
    const sturdy = me.hp === me.maxhp && (me.hasAbility('sturdy') || me.hasItem('focussash'));
    const fits = move.id === 'metalburst' || (move.id === 'counter' ? isPhysical(foe) : !isPhysical(foe));
    if (!fits) return out(0.03, 'wrong category');
    return out(sturdy ? sc.counter * 1.5 : threat.frac < 0.9 ? sc.counter * 0.5 : 0.05, 'counter');
  }
  if (move.id === 'destinybond') {
    // Gen 7: it fails if used twice in a row.
    if (me.lastMove?.id === 'destinybond') return out(0, 'destiny bond fails');
    return out(threat.koFirst ? sc.destinyBond : 0.02, 'destiny bond');
  }
  if (move.id === 'painsplit') return out(hpFrac + 0.25 < foe.hp / foe.maxhp ? sc.painSplit : 0.03, 'pain split');
  if (move.id === 'taunt') {
    if (foe.volatiles.taunt) return out(0, 'already taunted');
    const foeHasStatus = foe.moveSlots.some(m => battle.dex.moves.get(m.id).category === 'Status');
    return out(foeHasStatus ? sc.taunt : 0.03, 'taunt');
  }
  if (move.id === 'encore') {
    const last = foe.lastMove ? battle.dex.moves.get(foe.lastMove.id) : null;
    if (!last || foe.volatiles.encore) return out(0, 'encore fails');
    return out(last.category === 'Status' ? sc.taunt + 0.2 : 0.03, 'encore');
  }
  if (move.id === 'trick' || move.id === 'switcheroo') {
    return out(CHOICE_LIKE.has(me.getItem().id) && me.getItem().id !== foe.getItem().id ? 0.45 : 0.03, 'trick');
  }
  if (move.id === 'healbell' || move.id === 'aromatherapy') {
    return out(me.side.pokemon.some(p => p.hp > 0 && p.status) ? 0.4 : 0.02, 'cure team');
  }
  if (move.id === 'batonpass') return out(positiveBoosts(me) > 0 && aliveBench(me.side) > 0 ? 0.4 : 0.02, 'baton pass');
  return out(sc.other, 'other');
}

function scoreSetup(s: Situation, move: DexMove, safe: boolean, out: (score: number, reason: string) => ScoredMove): ScoredMove {
  const { battle, me, foe, config } = s;
  const raised = Object.entries(move.boosts ?? {}).filter(([, v]) => (v ?? 0) > 0).map(([k]) => k as keyof typeof me.boosts);
  if (raised.every(stat => me.boosts[stat] >= 6)) return out(0, 'stats maxed');
  const room = raised.filter(stat => me.boosts[stat] < config.maxSetupStage);
  if (!room.length) return out(0.03, 'setup maxed');
  // Breakpoints (Smogon guide): boost until we outspeed or can KO.
  const slower = !actsFirst(battle, me, 0, foe, 0);
  const cantKO = !me.moveSlots.some(m => estimateDamage(battle, me, foe, m.id, { attackerForme: s.myForme }).ko);
  const valuable = room.some(stat =>
    (stat === 'spe' && slower) || ((stat === 'atk' || stat === 'spa') && cantKO)
    || ((stat === 'def' || stat === 'spd') && s.threat.frac > 0.15) || stat === 'evasion');
  if (!valuable) return out(0.05, 'breakpoint reached');
  const evasionOnly = raised.every(stat => stat === 'evasion');
  return out(config.scores.setup * (safe ? 1 : 0.25) * (evasionOnly ? 0.6 : 1), safe ? 'safe setup' : 'risky setup');
}

export interface SwitchCandidate {
  slot: number;
  pokemon: Pokemon;
  /** Our best expected damage fraction against the foe. */
  offense: number;
  /** Has a super-effective attack against the foe. */
  superEffective: boolean;
  /** The foe's best expected damage fraction against this Pokémon. */
  incoming: number;
}

/** Evaluates bench Pokémon (request slot numbers, 1-based) against the foe's active Pokémon. */
export function evaluateBench(battle: Battle, side: Side, foe: Pokemon): SwitchCandidate[] {
  return side.pokemon.flatMap((p, i) => {
    if (p.isActive || p.hp <= 0) return [];
    let offense = 0;
    let superEffective = false;
    for (const slot of p.moveSlots) {
      const move = battle.dex.moves.get(slot.id);
      if (move.category === 'Status') continue;
      offense = Math.max(offense, estimateDamage(battle, p, foe, slot.id).frac);
      if (battle.dex.getImmunity(move.type, foe) && battle.dex.getEffectiveness(move.type, foe) > 0) superEffective = true;
    }
    return [{ slot: i + 1, pokemon: p, offense, superEffective, incoming: bestThreat(battle, foe, p).frac }];
  });
}

const toId = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
