// Turns protocol lines into timed animation events. The BattleClient plays
// them one at a time: apply the line (state + log), show its animation, wait
// its duration, then move to the next line.
import type { Battle as ClientBattle } from '@pkmn/client';
import { isWarpForm } from '../data/custom/digimon';
import { paradoxKindOfForm } from '../data/custom/paradox';
import { classifyMove, type MoveFx } from './move-class';
import { CARRIED } from './semi-invulnerable';
import { gen7 } from '../team/dex';

export type AnimationKind =
  | 'move' | 'zpower' | 'hit' | 'residual' | 'heal' | 'switch-out' | 'switch-in' | 'faint'
  | 'mega-start' | 'mega' | 'forme' | 'status' | 'boost' | 'unboost' | 'miss' | 'text'
  /** Paradox Evolution: the charge-up, then the change; `condition` is "ancient" or "future". */
  | 'paradox-start' | 'paradox'
  /** Warp Digivolution: the digital charge-up, then the new form bursts out; `condition` is the form's name. */
  | 'warp-start' | 'warp'
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
  | 'cure'
  /**
   * An Ability makes a move fail: Water Absorb, Volt Absorb, Motor Drive, Lightning Rod, Storm Drain, Sap Sipper,
   * Flash Fire, Dry Skin (each its own animation), Levitate, or any other (Soundproof, Wonder Guard...). `side`/`slot`:
   * the Pokémon with the Ability; `target`/`targetSlot`: the move's user, when known; `condition`: the Ability's id.
   */
  | 'ability'
  /** The Pokémon becomes charged (Charge, or Electromorphosis: `label`): its next Electric move has double power. */
  | 'charged'
  /**
   * A Berry is eaten (`label`: its name). `side`/`slot`: who eats it; `target`/`targetSlot`: whose Berry it was
   * when it was stolen and eaten by Bug Bite or Pluck (else null).
   */
  | 'berry'
  /** The Pokémon's Air Balloon pops (hit by an attack). */
  | 'balloon-pop'
  /** The Pokémon floats on an Air Balloon (it came in holding one, or got one). */
  | 'balloon-in'
  /** A Focus Sash (or Focus Band: `condition`) lets the Pokémon hang on with 1 HP. */
  | 'sash'
  /** Sturdy: at full HP, a hit that would have knocked the Pokémon out leaves it with 1 HP ("X endured the hit!"). */
  | 'sturdy'
  /**
   * Protosynthesis or Quark Drive (`label`: its name) heightens the Pokémon's highest stat (`condition`: atk, def, spa,
   * spd or spe), in that stat's colour.
   */
  | 'paradox-boost'
  /**
   * Another held item is used up (`label`: its name; `condition`: its id): White Herb, Mental Herb, Power Herb, Weakness
   * Policy, Eject Button, Absorb Bulb, a Seed... For Red Card, `target`/`targetSlot`: the attacker it sends back.
   */
  | 'item'
  /**
   * A move has no effect because of the type chart (Psychic on Dark, Normal on Ghost...). `side`/`slot`: the immune
   * Pokémon; `target`/`targetSlot`: the move's user, when known; `condition`: the pair, e.g. "psychic-dark".
   */
  | 'immune'
  /** Sky Drop's first turn: its user (`side`/`slot`) takes the target (`target`/`targetSlot`) up into the sky. */
  | 'sky-drop'
  /** Sky Drop's attack: the Pokémon it carried (`side`/`slot`) is dropped from the sky and slams into the ground. */
  | 'sky-dropped'
  /** Solar Beam's (or Solar Blade's) charging turn: the user absorbs sunlight. */
  | 'solar-charge'
  /** Future Sight or Doom Desire (`condition`) lands on the Pokémon (`side`/`slot`) two turns after it was used. */
  | 'future-hit'
  /**
   * A thrown move comes back for its second hit (`condition`: the move, Bonemerang): `side`/`slot` threw it, at
   * `target`/`targetSlot`. The hit that follows has the same `condition` and the thrower as its `target`: the bone strikes
   * on its way back to the thrower's hand.
   */
  | 'move-return'
  /**
   * Frisk reveals a held item: it pops up beside the Pokémon holding it (`side`/`slot`), `label` its name. `target`/
   * `targetSlot`: the Pokémon with Frisk.
   */
  | 'frisk';

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
  /** For 'ability': the Ability's name, as shown. */
  label?: string;
  /** For 'hit' and 'sub-hit': it was a critical hit ("CRIT" shows over the Pokémon). */
  crit?: boolean;
  /** Duration at normal speed, in ms. */
  durationMs: number;
}

/**
 * Protocol lines in the order they're shown. The engine announces a Focus Sash ("-enditem") and Sturdy ("-ability")
 * just before the damage they let the Pokémon survive; as in the games, the hit shows first, then "X hung on using its
 * Focus Sash!" or "X endured the hit!".
 */
export function displayOrder(lines: readonly string[]): string[] {
  const out = [...lines];
  for (let i = 0; i + 1 < out.length; i++) {
    const held = /^\|-enditem\|([^|]+)\|Focus Sash(\||$)/.exec(out[i]) ?? /^\|-ability\|([^|]+)\|Sturdy$/.exec(out[i]);
    if (held && out[i + 1].startsWith(`|-damage|${held[1]}|`)) [out[i], out[i + 1]] = [out[i + 1], out[i]];
  }
  return out;
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
export const MEGA_START_MS = 1700;
/** The Mega forme bursts out of its cocoon. */
export const MEGA_MS = 1000;
export const PARADOX_START_MS = 1100;
export const WARP_START_MS = 2600;
/** Damaging Z-Moves (catalog Z_MOVE_MS). */
const Z_MOVE_MS = 2200;
/** Every move over 100 power has its own animation (catalog BIG_MOVES): how long each plays. */
export const BIG_MOVE_MS: Record<string, number> = {
  explosion: 1700, selfdestruct: 1500, vcreate: 1300, prismaticlaser: 1600, blastburn: 1800, eruption: 1800, focuspunch: 1400,
  frenzyplant: 1600, gigaimpact: 1500, headsmash: 1400, hydrocannon: 1700, hyperbeam: 1500, mindblown: 1700, roaroftime: 1600,
  rockwrecker: 1600, shelltrap: 1400, waterspout: 1700, boomburst: 1500, doomdesire: 1100, freezeshock: 1200, iceburn: 1400,
  lastresort: 1200, lightofruin: 1600, psychoboost: 1600, skyattack: 1300, steelbeam: 1500, blueflare: 1400, boltstrike: 1200,
  burnup: 1300, dracometeor: 1800, fleurcannon: 1400, highjumpkick: 1200, leafstorm: 1300, overheat: 1300, skullbash: 1300,
  steelroller: 1100, solarblade: 1100, belch: 1300, bravebird: 1300, closecombat: 1400, doubleedge: 1300, dragonascent: 1300,
  flareblitz: 1300, focusblast: 1400, futuresight: 1100, glaiverush: 1200, gunkshot: 1200, headcharge: 1300, headlongrush: 1200,
  megakick: 1300, megahorn: 1200, meteorbeam: 1300, outrage: 1400, petaldance: 1300, powerwhip: 1200, precipiceblades: 1500,
  ragingfury: 1300, seedflare: 1300, shadowforce: 1200, superpower: 1300, synchronoise: 1400, technoblast: 1400, thrash: 1400,
  volttackle: 1300, woodhammer: 1300, zapcannon: 1500, blizzard: 1300, clangingscales: 1500, fireblast: 1300, hurricane: 1300,
  hydropump: 1300, originpulse: 1300, poltergeist: 1400, steameruption: 1100, thunder: 1100, pyroball: 1400, wavecrash: 1300,
};
/**
 * Signature moves (one Pokémon's own when they came out: Bonemerang, Shadow Bone, Sacred Fire, Spore...) with their own
 * animation (catalog signature-moves.ts): how long each plays.
 */
export const SIGNATURE_MOVE_MS: Record<string, number> = {
  bonemerang: 1100, boneclub: 1050, crabhammer: 1100, clamp: 1200, hyperfang: 1050, aeroblast: 1250, sacredfire: 1350, octazooka: 1250, triplekick: 1150,
  present: 1350, armthrust: 1100, blazekick: 1050, leafblade: 1100, lusterpurge: 1350, mistball: 1450, muddywater: 1200, needlearm: 1050, poisontail: 1150,
  weatherball: 1350, meteormash: 1250, attackorder: 1200, defendorder: 1050, healorder: 1200, chatter: 1100, crushgrip: 1150, darkvoid: 1100, heartswap: 1200,
  judgment: 1350, lunardance: 1200, magmastorm: 1300, spacialrend: 1250, fierydance: 1350, geargrind: 1150, heatcrash: 1150, hornleech: 1600, nightdaze: 1250,
  psystrike: 1300, relicsong: 1250, searingshot: 1300, secretsword: 1050, sacredsword: 1050, glaciate: 1400, fusionflare: 1500, fusionbolt: 1100, aromaticmist: 1050,
  craftyshield: 900, diamondstorm: 1450, electrify: 900, fairylock: 900, forestscurse: 950, geomancy: 1250, hyperspacefury: 1350, hyperspacehole: 1200, landswrath: 1100,
  thousandarrows: 1350, thousandwaves: 1100, kingsshield: 900, matblock: 900, nobleroar: 1100, oblivionwing: 1600, partingshot: 1050, powder: 1000, topsyturvy: 1150,
  trickortreat: 950, spikyshield: 900, watershuriken: 1100, flyingpress: 1100, accelerock: 900, anchorshot: 1250, banefulbunker: 900, beakblast: 1050, coreenforcer: 1350,
  darkestlariat: 1050, firelash: 1200, icehammer: 1200, multiattack: 1150, photongeyser: 1300, plasmafists: 1200, pollenpuff: 1200, revelationdance: 1250, shadowbone: 1050,
  sparklingaria: 1350, spectralthief: 1300, spiritshackle: 1200, tropkick: 1200, zingzap: 950, sunsteelstrike: 1200, moongeistbeam: 1400, firstimpression: 1000, naturesmadness: 1150,
  mortalspin: 1150, psyblade: 1050, mightycleave: 1100, tachyoncutter: 1050, thunderclap: 900, hydrosteam: 1300, lovelykiss: 1250, softboiled: 1300, transform: 900,
  freezingglare: 1100, thunderouskick: 1000, fierywrath: 1200, drumbeating: 1150, snipeshot: 1050, flowertrick: 1150, torchsong: 1250, aquastep: 1100,
  dragondarts: 950, overdrive: 1100, spiritbreak: 1050,
  splash: 900, kinesis: 1100, spore: 1200, milkdrink: 1200, sketch: 950, spiderweb: 1250, camouflage: 900, slackoff: 1150, tailglow: 1050,
  floralhealing: 900, instruct: 900, purify: 1300, shoreup: 1350, toxicthread: 1300, spicyextract: 1250, noretreat: 1050, burningbulwark: 900,
};
/** Signature moves with their own, longer animation (catalog SIGNATURE_MOVES). */
/** Moves with a bigger animation while their user is charged (CHARGED_MOVES): Giga Blaster. */
export const CHARGED_MOVE_MS: Record<string, number> = { gigablaster: 2800 };

export const SIGNATURE_MS: Record<string, number> = {
  ...BIG_MOVE_MS, ...SIGNATURE_MOVE_MS, solarbeam: 1500, gaiaforce: 2400, cocytuspulse: 1300, darkgaiaforce: 2400, dramondestroyer: 1000, dramonbreaker: 1000, gigablaster: 2400,
  pyrofang: 1000, lightningjoust: 1100, shieldofjust: 1300, petittwister: 1200, burstshot: 1400, giantmissile: 1500,
  diamondshuriken: 1000, amethystmandala: 1500,
};
/** A damaging Z-Move's category (Physical or Special, from its base move), from the engine's silent hint line, until its move line. */
const zCategories = new WeakMap<ClientBattle, 'Physical' | 'Special'>();
export const WARP_MS = 1300;
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
export const ABILITY_MS = 1100;
/** Elevate: MegaGargomon lifts off on its rocket jets, hovers over the attack and sets down (1.5 s until 2026-10-23). */
export const ELEVATE_MS = 1100;
/** How long an Ability's animation takes (by its id). */
export const abilityDuration = (id: string) => (id === 'elevate' ? ELEVATE_MS : ABILITY_MS);
export const CHARGED_MS = 750;
export const BERRY_MS = 1000;
export const BALLOON_POP_MS = 850;
export const BALLOON_IN_MS = 1100;
export const SASH_MS = 900;
/** Sturdy holding a Pokémon on with 1 HP. */
export const STURDY_MS = 1000;
/** Protosynthesis or Quark Drive heightening a stat. */
export const PARADOX_BOOST_MS = 1300;
export const ITEM_MS = 1000;
export const IMMUNE_MS = 1100;
export const SKY_DROP_MS = 900;
export const SKY_DROPPED_MS = 900;
export const SOLAR_CHARGE_MS = 1000;
export const FUTURE_HIT_MS = 900;
/** Bonemerang's bone flying back to the target for its second hit. */
export const MOVE_RETURN_MS = 380;
export const FRISK_MS = 950;

/**
 * Abilities that absorb a move of some type: it fails, and the Pokémon heals, gets a stat boost or powers up
 * (each has its own animation). Other Abilities that make a move fail (Levitate, Soundproof, Wonder Guard...)
 * get the general one, or Levitate's own.
 */
export const ABSORB_ABILITIES = ['waterabsorb', 'voltabsorb', 'dryskin', 'motordrive', 'lightningrod', 'stormdrain', 'sapsipper', 'flashfire'] as const;
const isAbsorb = (id: string) => (ABSORB_ABILITIES as readonly string[]).includes(id);
/** The effect of Protosynthesis or Quark Drive starting: the Ability's id and the stat it heightens. */
const PARADOX_BOOST = /^(protosynthesis|quarkdrive)(atk|def|spa|spd|spe)$/;
/** "ability: Water Absorb" (a [from] tag or a -start effect) -> "Water Absorb". */
const abilityName = (tag: unknown) => (typeof tag === 'string' ? /^ability: (.+)$/i.exec(tag)?.[1] ?? null : null);
/** Who used the last move (and its type), so an Ability's animation can show the attack being taken in. */
const lastMoveUser = new WeakMap<ClientBattle, { side: 'p1' | 'p2' | null; slot: number; type?: string; id?: string }>();
/** Hits (damage not from an effect) since the last move, by battle: a multi-hit move's second one is its return (Bonemerang). */
const hitsSinceMove = new WeakMap<ClientBattle, number>();
/** Moves whose second hit is the throw coming back (its own animation). */
const RETURNING_MOVES = new Set(['bonemerang']);
/** Pokémon a critical hit was just announced for ("-crit" comes before the damage), by side and slot. */
const pendingCrits = new WeakMap<ClientBattle, Set<string>>();
const critKey = (ident: string | undefined) => { const { side, slot } = at(ident); return `${side}${slot}`; };
/** Takes (and clears) a critical hit announced for this Pokémon. */
function takeCrit(battle: ClientBattle, ident: string | undefined): boolean {
  return pendingCrits.get(battle)?.delete(critKey(ident)) ?? false;
}

/**
 * The type-chart immunity a move of this type runs into on this Pokémon ("psychic-dark", "normal-ghost"...), from its
 * current types, or null (no such immunity: the move failed for another reason, like Will-O-Wisp on a Fire type).
 */
export function typeImmunity(battle: ClientBattle, ident: string | undefined, moveType: string | undefined): string | null {
  const { side, slot } = at(ident);
  const mon = side ? battle[side].active[slot] : null;
  const type = moveType ? gen7.types.get(moveType) : undefined;
  if (!mon || !type) return null;
  const immune = mon.types.find(t => type.effectiveness[t] === 0);
  return immune ? `${toId(type.name)}-${toId(immune)}` : null;
}

/**
 * A move a Pokémon's type makes it immune to outside the type chart ("leechseed-grass", "par-electric"...), or null:
 * Leech Seed and powder moves on a Grass type, a status condition its type can't get (paralysis on Electric, a burn
 * on Fire, poison on Poison; on Steel it's the type chart's), Sheer Cold on an Ice type, a Prankster status move on a Dark type. The
 * protocol only says "-immune", so the move (and the Pokémon's current types) tell which.
 */
export function statusImmunity(battle: ClientBattle, ident: string | undefined, moveId: string | undefined): string | null {
  const { side, slot } = at(ident);
  const mon = side ? battle[side].active[slot] : null;
  const move = moveId ? gen7.moves.get(moveId) : undefined;
  if (!mon || !move?.exists) return null;
  const has = (type: string) => mon.types.includes(type as never);
  if (move.id === 'leechseed' && has('Grass')) return 'leechseed-grass';
  if (move.flags.powder && has('Grass')) return 'powder-grass';
  if (move.id === 'sheercold' && has('Ice')) return 'sheercold-ice';
  const status = move.status === 'tox' ? 'psn' : move.status;
  if (status === 'par' && has('Electric')) return 'par-electric';
  if (status === 'brn' && has('Fire')) return 'brn-fire';
  if (status === 'psn' && has('Poison')) return 'psn-poison';
  if (move.category === 'Status' && has('Dark')) return 'prankster-dark';
  return null;
}

/**
 * Air Balloon: a Ground-type move doesn't affect its holder. The protocol only says "-immune" (no "[from]"), so
 * the battle state tells: the Pokémon holds an Air Balloon (announced when it came in) and the move is Ground-type.
 */
function balloonImmune(battle: ClientBattle, ident: string | undefined, moveType: string | undefined): boolean {
  const { side, slot } = at(ident);
  return moveType === 'Ground' && !!side && battle[side].active[slot]?.item === 'airballoon';
}

/**
 * Whether a move is taken in by an Ability before it can do anything (Water Absorb...), judging from the lines
 * that follow it in the same action: then the move itself doesn't animate (as in the games), and the Ability's
 * animation plays instead. Only single-target moves (a spread move can still hit the others).
 */
export function absorbedByAbility(moveArgs: readonly string[], kwArgs: Record<string, unknown>, upcoming: readonly string[], battle?: ClientBattle): boolean {
  const target = moveArgs[3];
  if (!target || 'spread' in kwArgs) return false;
  const pos = target.slice(0, 3);
  for (const line of upcoming) {
    if (line === '|' || /^\|(move|turn|upkeep|switch|drag|cant|faint)\|/.test(line)) return false;
    const m = /^\|(-heal|-immune|-boost|-start|-ability)\|(p[1-4][ab]?)[^|]*\|?([^|]*)/.exec(line);
    if (!m || !m[2].startsWith(pos)) continue;
    // A Ground move into an Air Balloon: the balloon's animation instead (like Levitate's). A type-chart immunity
    // (Psychic on Dark...): its own animation, with the attack in it.
    if (m[1] === '-immune' && !/\[from\]/.test(line) && battle) {
      const type = classifyMove(moveArgs[2]).type;
      if (balloonImmune(battle, target, type) || typeImmunity(battle, target, type) || statusImmunity(battle, target, toId(moveArgs[2]))) return true;
    }
    // "-ability|p2a: Raichu|Lightning Rod|boost" names it plainly; the others say "ability: Water Absorb".
    const name = m[1] === '-ability' ? m[3] : /ability: ([^|]+)/.exec(line)?.[1];
    if (!name) continue;
    const id = toId(name);
    if (m[1] === '-immune' || isAbsorb(id)) return true;
  }
  return false;
}

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

/** An Ability's animation on the Pokémon `ident`, with the attack coming from the last move's user. */
function abilityStep(step: (a: Omit<BattleAnimation, 'id'> | null) => PlannedStep, battle: ClientBattle, ident: string, name: string, hpDelta?: number): PlannedStep {
  const holder = at(ident);
  const user = lastMoveUser.get(battle);
  const from = user && user.side && !(user.side === holder.side && user.slot === holder.slot) ? user : null;
  return step({
    kind: 'ability', ...holder, target: from?.side ?? null, targetSlot: from?.slot, condition: toId(name), label: name, hpDelta, durationMs: abilityDuration(toId(name)),
  });
}

/** Move animation length (normal speed) by what the move does. */
export function moveDuration(fx: MoveFx): number {
  if (fx.kind === 'z') return Z_MOVE_MS;
  if (fx.charged && CHARGED_MOVE_MS[fx.moveId]) return CHARGED_MOVE_MS[fx.moveId];
  if (SIGNATURE_MS[fx.moveId]) return SIGNATURE_MS[fx.moveId];
  if (fx.kind === 'attack') return fx.category === 'Special' ? 1000 : 900;
  return 800;
}

/** The player's or the opponent's half of the field (Multi: the partner p3 is with p1, p4 with p2). */
export const sideOf = (ident: string | undefined): 'p1' | 'p2' | null =>
  /^p[13]/.test(ident ?? '') ? 'p1' : /^p[24]/.test(ident ?? '') ? 'p2' : null;
/** Active slot from an ident like "p1b: Garchomp" (0 when there's no letter). */
const slotOf = (ident: string | undefined): number => (/^p[1-4]b/.test(ident ?? '') ? 1 : 0);
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
  /** Text shown when this step plays, on top of the line's own (Mega Evolution's messages, split around its animation). */
  text?: string;
}

/**
 * Plans the steps for one protocol line given the battle state *before* it is
 * applied. Most lines are one step; a switch-in replacing a healthy Pokémon
 * first plays a switch-out, and Mega Evolution (Paradox Evolution, Warp
 * Digivolution) plays a charge-up before the sprite changes.
 */
export function planLine(args: readonly string[], kwArgs: Record<string, unknown>, battle: ClientBattle, hasText: boolean, opts: { absorbed?: boolean } = {}): PlannedStep[] {
  const cmd = args[0];
  const base = DURATION[cmd] ?? (hasText ? TEXT_DURATION : 0);
  const step = (animation: Omit<BattleAnimation, 'id'> | null): PlannedStep => ({ animation, applyLine: true });

  switch (cmd) {
    // "-anim": a move's animation without the move line, when a two-turn move fires on the turn it charges (Solar
    // Beam in sun, a Power Herb): animated as the move itself.
    case 'move':
    case '-anim': {
      const side = sideOf(args[1]);
      const slot = slotOf(args[1]);
      const target = sideOf(args[3]) ?? side;
      const targetSlot = args[3] ? slotOf(args[3]) : slot;
      // "[spread] p2a,p2b": every Pokémon a spread move hit.
      const spread = typeof kwArgs.spread === 'string' && kwArgs.spread
        ? kwArgs.spread.split(',').map(id => at(id.trim())).filter((t): t is { side: 'p1' | 'p2'; slot: number } => !!t.side)
        : undefined;
      let fx = classifyMove(args[2]);
      const zCategory = zCategories.get(battle);
      if (fx.kind === 'z' && zCategory) fx = { ...fx, category: zCategory };
      zCategories.delete(battle);
      // Giga Blaster from a charged Pokémon (Charge, Electromorphosis: double power): its bigger animation. The charge
      // ends after the move, so it's still there now.
      if (CHARGED_MOVE_MS[fx.moveId] && 'charge' in (battle.getPokemon(args[1] as never)?.volatiles ?? {})) fx = { ...fx, charged: true };
      lastMoveUser.set(battle, { side, slot, type: fx.type, id: toId(args[2]) });
      hitsSinceMove.set(battle, 0);
      pendingCrits.delete(battle);
      // [still]: the move didn't animate in the game either (e.g. charging turn, or it missed). Taken in by an
      // Ability (Water Absorb...): the Ability's own animation shows it instead.
      const still = 'still' in kwArgs || 'miss' in kwArgs || !!opts.absorbed;
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
      const absorbing = cmd === '-heal' ? abilityName(kwArgs.from) : null;
      if (absorbing && isAbsorb(toId(absorbing))) return [abilityStep(step, battle, args[1], absorbing, hpDelta)];
      const kind = cmd === '-heal' ? 'heal' : 'from' in kwArgs ? 'residual' : 'hit';
      // Residual damage remembers its cause (burn, poison, confusion, weather...) for its animation.
      const crit = kind === 'hit' && takeCrit(battle, args[1]);
      const hit = step({ kind, side, slot, target: null, hpDelta, condition: from || undefined, ...(crit ? { crit } : {}), durationMs: base });
      // Bonemerang's second hit: the bone flies back to the target, then strikes it on its way to the thrower.
      const thrower = lastMoveUser.get(battle);
      if (kind === 'hit') hitsSinceMove.set(battle, (hitsSinceMove.get(battle) ?? 0) + 1);
      if (kind === 'hit' && thrower?.side && thrower.id && RETURNING_MOVES.has(thrower.id) && hitsSinceMove.get(battle) === 2) {
        return [
          { animation: { kind: 'move-return', side: thrower.side, slot: thrower.slot, target: side, targetSlot: slot, condition: thrower.id, durationMs: MOVE_RETURN_MS }, applyLine: false },
          step({ ...hit.animation!, condition: thrower.id, target: thrower.side, targetSlot: thrower.slot }),
        ];
      }
      // Sky Drop's attack lands on the Pokémon it carried: first it's dropped from the sky and slams into the ground.
      if (kind === 'hit' && lastMoveUser.get(battle)?.id === 'skydrop' && mon && CARRIED in mon.volatiles) {
        return [{ animation: { kind: 'sky-dropped', side, slot, target: null, durationMs: SKY_DROPPED_MS }, applyLine: false }, hit];
      }
      return [hit];
    }
    case '-crit': {
      // Shown with the damage that follows (or the Substitute taking it): "CRIT" over the Pokémon.
      const set = pendingCrits.get(battle) ?? new Set<string>();
      set.add(critKey(args[1]));
      pendingCrits.set(battle, set);
      return [step(null)];
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
      const form = (args[2] ?? '').split(',')[0];
      if (isWarpForm(form)) {
        return [
          { animation: { kind: 'warp-start', ...who, target: null, condition: form, durationMs: WARP_START_MS }, applyLine: false },
          step({ kind: 'warp', ...who, target: null, condition: form, durationMs: WARP_MS }),
        ];
      }
      const paradox = paradoxKindOfForm(form);
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
        step({ kind: 'mega', ...who, target: null, durationMs: MEGA_MS }),
      ];
    }
    case '-formechange':
      return [step({ kind: 'forme', ...at(args[1]), target: null, durationMs: base })];
    case '-start':
    case '-end':
    case '-activate': {
      const effect = toId(args[2]);
      const who = at(args[1]);
      // Charged up (Charge, or an Ability: Electromorphosis): its next Electric move is doubled.
      if (cmd === '-start' && effect === 'charge') {
        return [step({ kind: 'charged', ...who, target: null, label: abilityName(kwArgs.from) ?? undefined, durationMs: CHARGED_MS })];
      }
      // Protosynthesis / Quark Drive heightens the highest stat ("-start|X|protosynthesisatk", "quarkdrivespe").
      const paradox = cmd === '-start' ? PARADOX_BOOST.exec(effect) : null;
      if (paradox) {
        return [step({ kind: 'paradox-boost', ...who, target: null, condition: paradox[2], label: paradox[1] === 'quarkdrive' ? 'Quark Drive' : 'Protosynthesis', durationMs: PARADOX_BOOST_MS })];
      }
      // Flash Fire takes in a Fire move and powers up.
      if (cmd === '-start' && abilityName(args[2]) && isAbsorb(toId(abilityName(args[2])!))) return [abilityStep(step, battle, args[1], abilityName(args[2])!)];
      // The engine's hint "Z-Move: Physical" / "Z-Move: Special" for the Z-Move about to be used.
      if (cmd === '-activate' && (effect === 'zmovephysical' || effect === 'zmovespecial')) {
        zCategories.set(battle, effect === 'zmovespecial' ? 'Special' : 'Physical');
        return [step(null)];
      }
      if (effect === 'substitute') {
        if (cmd === '-start') return [step({ kind: 'sub-start', ...who, target: null, durationMs: SUB_START_MS })];
        if (cmd === '-end') return [step({ kind: 'sub-end', ...who, target: null, durationMs: SUB_END_MS })];
        if ('damage' in kwArgs) return [step({ kind: 'sub-hit', ...who, target: null, crit: takeCrit(battle, args[1]) || undefined, durationMs: SUB_HIT_MS })];
      }
      if (effect === 'leechseed' && cmd === '-start') return [step({ kind: 'seeded', ...who, target: null, durationMs: SEEDED_MS })];
      if (effect === 'confusion' && cmd !== '-end') return [step({ kind: 'confused', ...who, target: null, durationMs: CONFUSED_MS })];
      if (effect === 'attract' && cmd !== '-end') return [step({ kind: 'infatuated', ...who, target: null, durationMs: CONFUSED_MS })];
      // A Focus Band lets its holder hang on ("-activate|X|item: Focus Band").
      if (cmd === '-activate' && effect === 'itemfocusband') return [step({ kind: 'sash', ...who, target: null, condition: 'focusband', durationMs: SASH_MS })];
      // Future Sight / Doom Desire lands ("-end|X|move: Future Sight"); its damage follows.
      if (cmd === '-end' && (effect === 'futuresight' || effect === 'doomdesire')) {
        return [step({ kind: 'future-hit', ...who, target: null, condition: effect, durationMs: FUTURE_HIT_MS })];
      }
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
    case '-ability':
      // Motor Drive, Lightning Rod, Storm Drain, Sap Sipper take in a move ("-ability|p2a: Raichu|Lightning Rod|boost");
      // the stat rise follows on its own line.
      if (isAbsorb(toId(args[2]))) return [abilityStep(step, battle, args[1], args[2])];
      // Sturdy: the Pokémon braces and hangs on with 1 HP (an OHKO move it blocks is "-immune ... [from] ability: Sturdy").
      if (toId(args[2]) === 'sturdy') return [step({ kind: 'sturdy', ...at(args[1]), target: null, durationMs: STURDY_MS })];
      return [step(base > 0 ? { kind: 'text', side: null, target: null, durationMs: base } : null)];
    case '-boost':
    case '-unboost': {
      // Motor Drive, Lightning Rod, Storm Drain, Sap Sipper: the move is taken in for a stat boost.
      const absorbing = cmd === '-boost' ? abilityName(kwArgs.from) : null;
      if (absorbing && isAbsorb(toId(absorbing))) return [abilityStep(step, battle, args[1], absorbing)];
      return [step({ kind: cmd === '-boost' ? 'boost' : 'unboost', ...at(args[1]), target: null, durationMs: base })];
    }
    case '-prepare': {
      // Solar Beam / Solar Blade: the user absorbs light ("X absorbed light!").
      if (toId(args[2]) === 'solarbeam' || toId(args[2]) === 'solarblade') {
        return [step({ kind: 'solar-charge', ...at(args[1]), target: null, condition: toId(args[2]), durationMs: SOLAR_CHARGE_MS })];
      }
      // Sky Drop: the user grabs its target and both go up into the sky (StageSpot shows where they went).
      if (toId(args[2]) === 'skydrop' && args[3]) {
        const carried = at(args[3]);
        return [step({ kind: 'sky-drop', ...at(args[1]), target: carried.side, targetSlot: carried.slot, durationMs: SKY_DROP_MS })];
      }
      return [step(base > 0 ? { kind: 'text', side: null, target: null, durationMs: base } : null)];
    }
    case '-enditem': {
      // A Berry eaten by its holder ("[eat]"), or stolen and eaten by Bug Bite / Pluck ("[from] stealeat", "[of]" the eater).
      const stolen = toId(kwArgs.from as string | undefined) === 'stealeat' && typeof kwArgs.of === 'string';
      if ('eat' in kwArgs || stolen) {
        const holder = at(args[1]);
        const eater = stolen ? at(kwArgs.of as string) : holder;
        return [step({ kind: 'berry', ...eater, target: stolen ? holder.side : null, targetSlot: stolen ? holder.slot : undefined, label: args[2], durationMs: BERRY_MS })];
      }
      // An Air Balloon pops when an attack hits its holder.
      if (toId(args[2]) === 'airballoon') return [step({ kind: 'balloon-pop', ...at(args[1]), target: null, durationMs: BALLOON_POP_MS })];
      // A Focus Sash is used up as its holder hangs on.
      if (toId(args[2]) === 'focussash') return [step({ kind: 'sash', ...at(args[1]), target: null, condition: 'focussash', durationMs: SASH_MS })];
      // Any other item its holder uses up (a herb, Weakness Policy, Red Card, Eject Button, a Seed, a Gem: "[from] gem"),
      // not one a move destroys or takes ("[from] move: Knock Off", Incinerate...), nor a Berry eaten earlier (a
      // resist Berry weakening the hit, "[weaken]"; Micle Berry's boost used up).
      const from = toId(kwArgs.from as string | undefined);
      if ((!from || from === 'gem') && !('silent' in kwArgs) && !('weaken' in kwArgs) && !gen7.items.get(args[2])?.isBerry) {
        // Red Card names the attacker it sends back ("[of]").
        const of = toId(args[2]) === 'redcard' && typeof kwArgs.of === 'string' ? at(kwArgs.of) : null;
        return [step({ kind: 'item', ...at(args[1]), target: of?.side ?? null, targetSlot: of?.slot, label: args[2], condition: toId(args[2]), durationMs: ITEM_MS })];
      }
      return [step(base > 0 ? { kind: 'text', side: null, target: null, durationMs: base } : null)];
    }
    case '-item': {
      // Floating on an Air Balloon: it came in holding one ("X floats in the air with its Air Balloon!"), or got
      // one (Trick...). Not when an Ability only reveals it (Frisk).
      if (toId(args[2]) === 'airballoon' && !abilityName(kwArgs.from)) return [step({ kind: 'balloon-in', ...at(args[1]), target: null, durationMs: BALLOON_IN_MS })];
      // Frisk: the item it finds pops up beside the Pokémon holding it ("X frisked its target and found its Y!").
      if (toId(abilityName(kwArgs.from) ?? '') === 'frisk') {
        const frisker = typeof kwArgs.of === 'string' ? at(kwArgs.of) : null;
        return [step({ kind: 'frisk', ...at(args[1]), target: frisker?.side ?? null, targetSlot: frisker?.slot, label: args[2], durationMs: FRISK_MS })];
      }
      return [step(base > 0 ? { kind: 'text', side: null, target: null, durationMs: base } : null)];
    }
    case '-miss':
    case '-immune':
    case '-fail': {
      // An Ability made the move fail (Water Absorb at full HP, Levitate, Soundproof...): its animation, not a miss.
      const blocking = cmd === '-immune' ? abilityName(kwArgs.from) : null;
      if (blocking) return [abilityStep(step, battle, args[1], blocking)];
      // A Ground move doesn't affect a Pokémon floating on its Air Balloon: shown like Levitate.
      if (cmd === '-immune' && !('from' in kwArgs) && balloonImmune(battle, args[1], lastMoveUser.get(battle)?.type)) return [abilityStep(step, battle, args[1], 'Air Balloon')];
      // The type chart: each pair has its own animation (a Psychic attack breaking on Dark, a Normal one passing through a Ghost...).
      // Then a type's other immunities (Leech Seed on Grass, Thunder Wave on Electric...), with their own.
      const last = lastMoveUser.get(battle);
      const pair = cmd === '-immune' && !('from' in kwArgs) ? typeImmunity(battle, args[1], last?.type) ?? statusImmunity(battle, args[1], last?.id) : null;
      if (pair) {
        const holder = at(args[1]);
        const user = lastMoveUser.get(battle);
        const from = user && user.side && !(user.side === holder.side && user.slot === holder.slot) ? user : null;
        return [step({ kind: 'immune', ...holder, target: from?.side ?? null, targetSlot: from?.slot, condition: pair, durationMs: IMMUNE_MS })];
      }
      const id = cmd === '-miss' && args[2] ? args[2] : args[1];
      return [step({ kind: 'miss', ...at(id), target: null, durationMs: base })];
    }
    default:
      return [step(base > 0 ? { kind: 'text', side: null, target: null, durationMs: base } : null)];
  }
}
