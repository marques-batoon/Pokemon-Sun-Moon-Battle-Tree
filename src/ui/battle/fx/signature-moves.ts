// Signature moves have their own animation (on request, 2026-10-21): every move that was one Pokémon's (or one
// evolution line's) own when it came out, still is or not (Bonemerang, Shadow Bone, Sacred Fire, Spore...), that the
// battles can use and that had no animation of its own yet (the moves over 100 power have theirs in big-moves.ts), the
// Galarian legendary birds' (2026-10-22) and the Generation 8 and 9 starters' (2026-10-23; Pyro Ball is over 100 power).
// Each is tailored to the move: what it is in the games, drawn with the stage's shapes (approximations, not the
// games' animations). How long each plays: SIGNATURE_MOVE_MS in client/playback.ts. How the user of an attack moves:
// SIGNATURE_MOTION (as BIG_MOVE_MOTION: a user that charges in makes contact at about 43% of the move's length; a move
// sent from where the user stands lands at about 55-60%).
import type { Anchor, FxSpec, Layer, Motion, Shape } from './catalog';

const pt = (at: Anchor, shape: Shape, motion: Motion, color: string, color2: string | undefined, count: number, size: number, spread: number, delay = 0, dur?: number): Layer =>
  ({ kind: 'particles', at, shape, motion, color, ...(color2 ? { color2 } : {}), count, size, spread, delay, ...(dur ? { dur } : {}) });
const hit = (delay: number, color: string, size: number, star = true, at: Anchor = 'target'): Layer => ({ kind: 'impact', color, size, star, delay, at });
const ring = (at: Anchor | 'path', delay: number, color: string, count: number, size: number, dur = 550): Layer => ({ kind: 'rings', at, color, count, size, delay, dur });
const aura = (at: Anchor, delay: number, color: string, size: number, dur = 500): Layer => ({ kind: 'aura', at, color, size, delay, dur });
const orb = (delay: number, color: string, size: number, shape: Shape, dur: number, extra: Partial<Extract<Layer, { kind: 'orb' }>> = {}): Layer =>
  ({ kind: 'orb', color, size, shape, delay, dur, ...extra });
const slash = (delay: number, color: string, count: number, angle: number, width = 10, cross = false): Layer => ({ kind: 'slash', color, count, angle, width, cross, delay });
const flash = (delay: number, color = '#ffffff', dur = 200): Layer => ({ kind: 'screen', color, mode: 'flash', delay, dur });
const tint = (delay: number, color: string, dur: number): Layer => ({ kind: 'screen', color, mode: 'tint', delay, dur });
const dim = (delay: number, dur: number, color = '#000010'): Layer => ({ kind: 'screen', color, mode: 'dim', delay, dur });
const speed = (delay: number, color = '#ffffff', dur = 380): Layer => ({ kind: 'speedlines', at: 'target', color, delay, dur });
const up = (at: Anchor, delay: number, color = '#ff5a3a'): Layer => ({ kind: 'arrows', at, dir: 'up', color, delay });
const down = (at: Anchor, delay: number, color = '#5aa0ff'): Layer => ({ kind: 'arrows', at, dir: 'down', color, delay });
const heal = (delay: number, color: string): Layer[] => [aura('user', delay, color, 190, 520), pt('user', 'star', 'rise', '#ffffff', color, 8, 11, 60, delay + 80, 600)];

export const SIGNATURE_ATTACKS: Record<string, FxSpec> = {
  // ---- Generation 1 ----
  // Bonemerang (Cubone, Marowak): the bone is hurled spinning straight at the target and flies on past it, striking as it
  // goes through (the first hit). The second hit is its way back (BONEMERANG_RETURN, then BONEMERANG_CATCH).
  bonemerang: { shake: 'light', layers: [
    orb(150, '#efe6d2', 48, 'bone', 620, { through: true, spin: true, color2: '#c9b48a' }),
    hit(520, '#efe6d2', 150),
    pt('target', 'rock', 'burst', '#c9a35a', '#efe6d2', 8, 9, 60, 520, 450),
    ring('target', 520, '#efe6d2', 2, 150, 400),
  ] },
  // Bone Club: the user clubs the target with its bone, overhead, and the ground cracks under the blow.
  boneclub: { shake: 'light', layers: [
    orb(250, '#efe6d2', 50, 'bone', 200, { spin: true, color2: '#c9b48a' }),
    slash(420, '#efe6d2', 1, 75, 14),
    hit(430, '#fff4dc', 150),
    { kind: 'crack', color: '#7a5a3a', delay: 450 },
    pt('target', 'rock', 'burst', '#a8875a', '#d9c79a', 10, 10, 70, 450, 450),
  ] },
  // Crabhammer: a huge claw, dripping water, hammers the target in a crash of spray.
  crabhammer: { shake: 'strong', layers: [
    aura('user', 0, '#e8604a', 170, 350),
    pt('user', 'drop', 'converge', '#7cc4ff', '#ffffff', 10, 10, 90, 0, 350),
    { kind: 'jaws', color: '#e8604a', delay: 360 },
    hit(430, '#cfe9ff', 190),
    pt('target', 'drop', 'spray', '#4d90d5', '#cfe9ff', 16, 14, 90, 440, 550),
    ring('target', 440, '#7cc4ff', 2, 180, 450),
  ] },
  // Clamp: the user's shell snaps shut on the target and holds on, bubbles streaming out.
  clamp: { layers: [
    { kind: 'jaws', color: '#7a8fb8', delay: 300 },
    hit(430, '#cfe0ff', 110, false),
    pt('target', 'bubble', 'rise', '#7cc4ff', '#ffffff', 10, 12, 50, 450, 650),
    ring('target', 520, '#7a8fb8', 2, 120, 450),
  ] },
  // Hyper Fang: two huge front teeth bite down hard.
  hyperfang: { shake: 'light', layers: [
    speed(250, '#ffffff', 220),
    { kind: 'jaws', color: '#ffffff', delay: 340 },
    hit(430, '#fff6dc', 150),
    slash(430, '#f4f0e6', 2, 85, 12),
    pt('target', 'star', 'burst', '#ffffff', '#ffe08a', 8, 11, 70, 440, 400),
  ] },
  // ---- Generation 2 ----
  // Aeroblast (Lugia): a spiralling blast of air, silver and blue, roars across the stage and bursts on the target.
  aeroblast: { shake: 'light', layers: [
    pt('user', 'wisp', 'converge', '#cfe0ff', '#ffffff', 14, 22, 120, 0, 380),
    { kind: 'beam', color: '#8fa9de', color2: '#ffffff', width: 46, wavy: true, delay: 350, dur: 620 },
    ring('path', 370, '#e6eeff', 5, 80, 600),
    { kind: 'gust', color: '#cfe0ff', count: 10, delay: 360, dur: 500, leaves: false },
    hit(720, '#ffffff', 260),
    { kind: 'vortex', at: 'target', color: '#8fa9de', color2: '#ffffff', size: 180, delay: 700, dur: 450 },
  ] },
  // Sacred Fire (Ho-Oh): a pillar of sacred, rainbow-edged flame engulfs the target, with golden light.
  sacredfire: { shake: 'strong', layers: [
    aura('user', 0, '#ffb347', 220, 500),
    pt('user', 'feather', 'rise', '#ff7a1a', '#ffd23f', 10, 18, 90, 50, 500),
    { kind: 'column', color: '#ff5a1a', color2: '#ffd23f', delay: 520 },
    { kind: 'rings', at: 'target', color: '#ffd23f', count: 3, size: 240, rainbow: true, delay: 560, dur: 600 },
    pt('target', 'flame', 'rise', '#ff5a1a', '#fff0a0', 22, 24, 90, 560, 650),
    { kind: 'rays', at: 'target', color: '#ffe08a', size: 360, delay: 600, dur: 600 },
    hit(650, '#fff0c0', 260),
  ] },
  // Octazooka: a blob of ink fired from the snout, splattering the target in black.
  octazooka: { layers: [
    orb(200, '#2e2440', 34, 'blob', 400, { color2: '#5a4a6a' }),
    hit(600, '#3a2e50', 170, false),
    pt('target', 'blob', 'burst', '#2e2440', '#5a4a6a', 12, 14, 80, 600, 500),
    pt('target', 'drop', 'fall', '#2e2440', undefined, 8, 10, 60, 650, 500),
    { kind: 'screen', color: '#1a1424', mode: 'tint', delay: 620, dur: 380 },
  ] },
  // Triple Kick: three kicks in a row, each harder than the last.
  triplekick: { layers: [
    speed(300, '#ffffff', 260),
    hit(400, '#ffe08a', 90),
    hit(520, '#ffd23f', 120),
    hit(640, '#ffb347', 160),
    pt('target', 'star', 'burst', '#fff6c0', '#ffb347', 10, 12, 70, 650, 400),
  ] },
  // Present (Delibird): a wrapped gift tossed at the target, which bursts open in a pop of confetti.
  present: { layers: [
    orb(150, '#e8484a', 34, 'present', 500, { arc: true, spin: true, color2: '#ffd23f' }),
    hit(650, '#fff0c0', 190),
    pt('target', 'star', 'burst', '#ffd23f', '#e8484a', 14, 12, 100, 650, 550),
    pt('target', 'dot', 'burst', '#7cc95a', '#4ac0ff', 10, 9, 90, 660, 550),
  ] },
  // ---- Generation 3 ----
  // Arm Thrust (Makuhita, Hariyama): a flurry of open-palm strikes.
  armthrust: { layers: [
    hit(380, '#ffe0c0', 80), hit(450, '#ffe0c0', 90), hit(520, '#ffd8b0', 95), hit(590, '#ffd0a0', 110),
    pt('target', 'star', 'burst', '#ffffff', '#ce416b', 10, 10, 60, 600, 400),
  ] },
  // Blaze Kick (Blaziken): a flaming kick that leaves a streak of fire.
  blazekick: { shake: 'light', layers: [
    pt('user', 'flame', 'converge', '#ff7a1a', '#ffd23f', 10, 14, 80, 0, 350),
    slash(410, '#ff5a1a', 1, 28, 16),
    hit(430, '#ffd27f', 170),
    pt('target', 'flame', 'burst', '#ff5a1a', '#ffd23f', 16, 18, 90, 440, 500),
  ] },
  // Leaf Blade (Sceptile): the leaves on its arms flash into a blade: one bright green cut, leaves scattering.
  leafblade: { shake: 'light', layers: [
    aura('user', 0, '#63bc5a', 150, 350),
    slash(420, '#7cd05a', 1, 48, 18),
    slash(450, '#e8ffd8', 1, 48, 6),
    hit(440, '#e8ffd8', 150),
    pt('target', 'leaf', 'burst', '#63bc5a', '#9ae07a', 14, 16, 90, 450, 550),
  ] },
  // Luster Purge (Latios): a gathering of blue-white light released in a burst at the target.
  lusterpurge: { layers: [
    pt('user', 'dot', 'converge', '#cfe0ff', '#4a7ad8', 16, 10, 110, 0, 400),
    { kind: 'sphere', at: 'user', color: '#7ab0ff', color2: '#ffffff', size: 120, delay: 150, dur: 350 },
    { kind: 'beam', color: '#4a7ad8', color2: '#ffffff', width: 40, delay: 450, dur: 450 },
    { kind: 'rays', at: 'target', color: '#cfe0ff', size: 320, delay: 620, dur: 500 },
    hit(650, '#ffffff', 240),
    down('target', 750),
  ] },
  // Mist Ball (Latias): a ball of downy pink mist drifts to the target and puffs open.
  mistball: { layers: [
    pt('user', 'wisp', 'converge', '#ffc0d8', '#ffffff', 12, 20, 100, 0, 380),
    orb(330, '#ff9ac0', 52, 'dot', 430, { color2: '#ffffff' }),
    hit(760, '#ffe0ec', 210, false),
    pt('target', 'wisp', 'burst', '#ffc0d8', '#ffffff', 14, 24, 100, 760, 550),
    down('target', 820),
  ] },
  // Muddy Water: a churning wave of muddy water rolls over the field.
  muddywater: { shake: 'light', layers: [
    { kind: 'ground', color: '#8a6d47', delay: 200, dur: 600 },
    { kind: 'gust', color: '#a8875a', count: 12, delay: 250, dur: 520, leaves: false },
    pt('target', 'drop', 'spray', '#8a6d47', '#c9a35a', 18, 14, 100, 550, 550),
    hit(600, '#c9a35a', 220, false),
    tint(560, '#5a3a1a', 400),
  ] },
  // Needle Arm (Cacnea, Cacturne): a thorny arm swung into the target, needles flying.
  needlearm: { layers: [
    slash(410, '#63bc5a', 3, 35, 6),
    hit(430, '#d8f0c0', 140),
    pt('target', 'shard', 'burst', '#4f9a3a', '#d8f0c0', 14, 12, 90, 440, 450),
  ] },
  // Poison Tail (Seviper): a swipe of the poisoned tail, dripping venom.
  poisontail: { layers: [
    slash(410, '#aa6bc8', 1, -30, 14),
    hit(430, '#e0c0f0', 140),
    pt('target', 'bubble', 'rise', '#aa6bc8', '#e0c0f0', 12, 12, 60, 450, 600),
  ] },
  // Weather Ball: a ball of the sky's weather (clouds and light) launched at the target.
  weatherball: { layers: [
    pt('user', 'wisp', 'converge', '#e6eeff', '#cfe0ff', 12, 18, 100, 0, 350),
    orb(300, '#cfe0ff', 44, 'dot', 450, { arc: true, color2: '#ffffff' }),
    hit(750, '#ffffff', 220),
    pt('target', 'wisp', 'burst', '#e6eeff', '#8fa9de', 12, 22, 90, 750, 500),
    ring('target', 760, '#cfe0ff', 2, 200, 450),
  ] },
  // Meteor Mash (Metagross): a fist as hard as a meteor, trailing stars, crashes into the target.
  meteormash: { shake: 'strong', layers: [
    speed(300, '#cfe0ff', 300),
    pt('user', 'star', 'converge', '#ffffff', '#9fb8d0', 10, 12, 90, 0, 350),
    hit(430, '#ffffff', 220),
    pt('target', 'star', 'burst', '#ffffff', '#9fb8d0', 16, 14, 110, 440, 500),
    ring('target', 440, '#9fb8d0', 3, 220, 500),
    up('user', 650),
  ] },
};

export const SIGNATURE_STATUS: Record<string, FxSpec> = {
  // ---- Generation 1 ----
  // Lovely Kiss (Jynx): a big heart blown at the target, which drifts off to sleep among little hearts.
  lovelykiss: { layers: [
    orb(150, '#ff6aa8', 42, 'heart', 500, { arc: true, color2: '#ffc0d8' }),
    pt('target', 'heart', 'swirl', '#ff9ac0', '#ff6aa8', 10, 14, 60, 640, 500),
    pt('target', 'dot', 'rise', '#d8b0ff', '#ffffff', 8, 10, 50, 700, 450),
  ] },
  // Soft-Boiled (Chansey): an egg appears, cracks, and its goodness heals the user.
  softboiled: { layers: [
    pt('user', 'blob', 'converge', '#fffaf0', '#ffe0a0', 8, 18, 70, 0, 400),
    { kind: 'sphere', at: 'user', color: '#fff6dc', color2: '#ffe0a0', size: 90, delay: 150, dur: 400 },
    ...heal(500, '#ffb0c8'),
  ] },
  // Transform (Ditto, Mew): the user dissolves into rippling light and takes on the target's shape.
  transform: { layers: [
    ring('path', 0, '#d8b0ff', 3, 70, 450),
    { kind: 'scan', at: 'user', color: '#c87aff', delay: 300, dur: 450 },
    pt('user', 'dot', 'swirl', '#d8b0ff', '#ffffff', 14, 9, 70, 300, 500),
    aura('user', 450, '#c87aff', 180, 300),
  ] },
  // Splash (Magikarp): flop, flop, splash. Nothing happens.
  splash: { layers: [
    pt('user', 'drop', 'spray', '#7cc4ff', '#ffffff', 10, 12, 60, 0, 500),
    pt('user', 'bubble', 'rise', '#7cc4ff', '#ffffff', 5, 10, 40, 250, 400),
  ] },
  // Kinesis (Kadabra): a bent spoon's pull warps the air around the target.
  kinesis: { layers: [
    ring('path', 0, '#fa7179', 2, 60, 450),
    { kind: 'vortex', at: 'target', color: '#fa7179', color2: '#ffd0e0', size: 150, delay: 300, dur: 450 },
    pt('target', 'star', 'swirl', '#ffd0e0', '#fa7179', 8, 10, 60, 350, 400),
    down('target', 500),
  ] },
  // Spore (Paras, Parasect, Breloom...): a cloud of mushroom spores drifts onto the target, which falls asleep.
  spore: { layers: [
    pt('user', 'dot', 'rise', '#d8c870', '#a8c060', 12, 9, 60, 0, 400),
    orb(150, '#d8c870', 16, 'dot', 500, { arc: true, count: 6, gap: 50, color2: '#a8c060' }),
    pt('target', 'dot', 'fall', '#d8c870', '#a8c060', 16, 9, 80, 500, 600),
    pt('target', 'dot', 'rise', '#e8e0a0', '#ffffff', 6, 8, 40, 750, 350),
  ] },
  // ---- Generation 2 ----
  // Milk Drink (Miltank): a stream of fresh milk, and the user glows healthy again.
  milkdrink: { layers: [
    pt('user', 'drop', 'fall', '#ffffff', '#fff6dc', 14, 12, 50, 0, 500),
    ...heal(400, '#fff0c0'),
  ] },
  // Sketch (Smeargle): a tail-brush flourish in every color, copying the last move seen.
  sketch: { layers: [
    pt('user', 'dot', 'swirl', '#ff5a7a', '#4ac0ff', 10, 10, 70, 0, 500),
    pt('user', 'dot', 'swirl', '#7ad85a', '#ffd23f', 10, 10, 70, 150, 500),
    { kind: 'rings', at: 'user', color: '#ffffff', count: 2, size: 160, rainbow: true, delay: 450, dur: 400 },
  ] },
  // Spider Web (Ariados): a sticky web spun over the target: it can't get away.
  spiderweb: { layers: [
    orb(100, '#f0f0f0', 10, 'dot', 400, { count: 3, gap: 60, color2: '#ffffff' }),
    { kind: 'web', at: 'target', color: '#f4f4f4', size: 190, delay: 450, dur: 700 },
  ] },
  // ---- Generation 3 ----
  // Camouflage (Kecleon): the user shimmers and its colors shift to blend into the surroundings.
  camouflage: { layers: [
    { kind: 'scan', at: 'user', color: '#9ae07a', delay: 0, dur: 500 },
    pt('user', 'leaf', 'swirl', '#63bc5a', '#c9a35a', 10, 12, 60, 150, 500),
    aura('user', 350, '#9ae07a', 170, 350),
  ] },
  // Slack Off (Slakoth, Slaking): the user lazes about and its strength comes back.
  slackoff: { layers: [
    pt('user', 'wisp', 'rise', '#fff0d0', '#e8d8b0', 8, 18, 50, 0, 600),
    ...heal(350, '#ffe8b0'),
  ] },
  // Tail Glow (Volbeat): its tail glows brighter and brighter, sharply raising its Special Attack.
  tailglow: { layers: [
    pt('user', 'spark', 'converge', '#fff6b0', '#ffe066', 14, 10, 90, 0, 400),
    { kind: 'rays', at: 'user', color: '#fff3a0', size: 220, delay: 250, dur: 450 },
    aura('user', 300, '#ffe066', 200, 450),
    up('user', 450, '#ffb020'),
  ] },
};

const GEN_4_5: Record<string, FxSpec> = {
  // ---- Generation 4 ----
  // Attack Order (Vespiquen): a swarm of her underlings streams out and stings the target.
  attackorder: { layers: [
    orb(150, '#f2c23c', 12, 'dot', 420, { count: 10, gap: 35, color2: '#3a2a10' }),
    hit(600, '#ffe08a', 120), hit(720, '#ffd23f', 140),
    pt('target', 'spark', 'burst', '#f2c23c', '#3a2a10', 12, 10, 70, 620, 400),
  ] },
  // Defend Order: the swarm forms a living shield around her.
  defendorder: { layers: [
    pt('user', 'dot', 'swirl', '#f2c23c', '#3a2a10', 16, 9, 80, 0, 600),
    { kind: 'wall', color: '#f2c23c', delay: 350 },
    up('user', 450, '#d0a020'),
  ] },
  // Heal Order: the swarm brings honey, and she's healed.
  healorder: { layers: [
    pt('user', 'dot', 'converge', '#f2c23c', '#ffe08a', 16, 9, 100, 0, 450),
    ...heal(400, '#ffd86a'),
  ] },
  // Chatter (Chatot): a burst of chattering notes that leaves the target confused.
  chatter: { layers: [
    orb(100, '#4a68c8', 30, 'note', 450, { arc: true, count: 5, gap: 60, color2: '#ffffff' }),
    ring('path', 120, '#8fa9de', 3, 60, 500),
    pt('target', 'note', 'swirl', '#4a68c8', '#e0a010', 8, 20, 60, 600, 400),
  ] },
  // Crush Grip (Regigigas): a colossal hand closes on the target and squeezes.
  crushgrip: { shake: 'strong', layers: [
    { kind: 'jaws', color: '#d8d8c8', delay: 330 },
    hit(430, '#ffffff', 200),
    { kind: 'jaws', color: '#b8b8a8', delay: 520 },
    hit(600, '#f0f0e0', 240),
    ring('target', 600, '#d8d8c8', 3, 220, 450),
  ] },
  // Dark Void (Darkrai): a void of darkness swallows the target, which falls into nightmares (no dimming: it inflicts
  // a status condition, and those keep the Pokémon in plain view).
  darkvoid: { layers: [
    ring('path', 0, '#3a2a4a', 3, 70, 400),
    pt('target', 'wisp', 'converge', '#3a2a4a', '#7a5a9a', 16, 26, 120, 100, 500),
    { kind: 'vortex', at: 'target', color: '#2a1a3a', color2: '#7a5a9a', size: 220, delay: 300, dur: 650 },
    ring('target', 500, '#7a5a9a', 3, 220, 450),
  ] },
  // Heart Swap (Manaphy): hearts trade places between the two, swapping their stat changes.
  heartswap: { layers: [
    orb(100, '#ff6aa8', 26, 'heart', 420, { color2: '#ffc0d8' }),
    orb(250, '#ff9ac0', 26, 'heart', 420, { reverse: true, color2: '#ffc0d8' }),
    ring('target', 520, '#ff9ac0', 2, 160, 400),
    ring('user', 670, '#ff9ac0', 2, 160, 400),
  ] },
  // Judgment (Arceus): pillars of light rain down from the heavens on the target, shards of every color flying.
  judgment: { shake: 'strong', layers: [
    { kind: 'rays', at: 'user', color: '#fff6c0', size: 280, delay: 0, dur: 500 },
    tint(250, '#fffbe0', 900),
    { kind: 'pillar', at: 'target', color: '#fff6c0', color2: '#ffffff', width: 90, delay: 450, dur: 650 },
    pt('target', 'gem', 'fall', '#ffd23f', '#7ab0ff', 18, 14, 120, 450, 600),
    pt('target', 'gem', 'fall', '#ff7aa0', '#7ad85a', 14, 12, 120, 550, 550),
    hit(700, '#ffffff', 300),
    ring('target', 720, '#ffffff', 3, 280, 500),
  ] },
  // Lunar Dance (Cresselia): crescent moons whirl around her as she gives everything to restore an ally.
  lunardance: { layers: [
    pt('user', 'crescent', 'swirl', '#d8c0ff', '#fff6c0', 10, 18, 80, 0, 700),
    { kind: 'rays', at: 'user', color: '#e6d8ff', size: 240, delay: 250, dur: 550 },
    aura('user', 400, '#c8b0ff', 220, 500),
    pt('user', 'star', 'rise', '#ffffff', '#d8c0ff', 10, 10, 70, 500, 600),
  ] },
  // Magma Storm (Heatran): a swirling storm of magma traps the target in a burning vortex.
  magmastorm: { shake: 'strong', layers: [
    orb(150, '#ff5a1a', 30, 'flame', 380, { count: 3, gap: 70, color2: '#ffd23f' }),
    { kind: 'vortex', at: 'target', color: '#ff5a1a', color2: '#ffd23f', size: 230, delay: 500, dur: 700 },
    { kind: 'column', color: '#c83a10', color2: '#ffb347', delay: 560 },
    pt('target', 'flame', 'swirl', '#ff7a1a', '#ffd23f', 18, 18, 80, 520, 650),
    hit(620, '#ffd27f', 220),
  ] },
  // Spacial Rend (Palkia): space itself is torn open across the target in streaks of pink and pearl light.
  spacialrend: { shake: 'strong', layers: [
    dim(0, 900, '#0a0014'),
    { kind: 'rays', at: 'user', color: '#f0c0e8', size: 260, delay: 0, dur: 450 },
    slash(450, '#ff9ad8', 2, 30, 20, true),
    slash(500, '#ffffff', 2, 30, 6, true),
    hit(560, '#ffe0f4', 280),
    pt('target', 'shard', 'burst', '#ff9ad8', '#ffffff', 18, 16, 130, 570, 550),
    ring('target', 580, '#f0c0e8', 3, 260, 450),
  ] },
  // ---- Generation 5 ----
  // Fiery Dance (Volcarona): it dances in a whirl of flame, flames wrapping the target; its Special Attack may rise.
  fierydance: { layers: [
    pt('user', 'flame', 'swirl', '#ff7a1a', '#ffd23f', 16, 18, 90, 0, 600),
    pt('user', 'feather', 'swirl', '#ffb347', '#ff7a1a', 8, 16, 100, 100, 500),
    orb(350, '#ff7a1a', 26, 'flame', 380, { count: 3, gap: 50, arc: true, color2: '#ffd23f' }),
    hit(760, '#ffd27f', 180),
    pt('target', 'flame', 'swirl', '#ff5a1a', '#ffd23f', 12, 16, 70, 760, 450),
  ] },
  // Gear Grind (Klinklang): two spinning steel gears thrown at the target, each hitting.
  geargrind: { layers: [
    orb(200, '#b8c0c8', 34, 'star', 380, { spin: true, count: 2, gap: 120, color2: '#ffffff' }),
    hit(580, '#e8eef4', 120), hit(700, '#d8e0e8', 140),
    pt('target', 'spark', 'burst', '#ffe08a', '#ffffff', 10, 10, 60, 600, 400),
  ] },
  // Heat Crash (Tepig line): the user leaps and slams down on the target with its burning weight.
  heatcrash: { shake: 'strong', layers: [
    aura('user', 0, '#ff7a1a', 170, 400),
    hit(470, '#ffd27f', 260),
    { kind: 'crack', color: '#5a2a10', delay: 480 },
    pt('target', 'flame', 'burst', '#ff5a1a', '#ffd23f', 18, 20, 110, 480, 550),
    ring('target', 490, '#ff7a1a', 3, 240, 450),
  ] },
  // Horn Leech (Deerling line): the branching horns drain the target, the life flowing back to the user.
  hornleech: { layers: [
    slash(410, '#63bc5a', 2, 70, 10),
    hit(430, '#d8f0c0', 140),
    orb(520, '#7cd05a', 14, 'dot', 420, { reverse: true, count: 5, gap: 50, color2: '#e8ffd8' }),
    ...heal(850, '#9ae07a'),
  ] },
  // Night Daze (Zoroark): a pitch-black shock wave of crimson-edged darkness.
  nightdaze: { layers: [
    dim(0, 900, '#100008'),
    ring('user', 200, '#8a1a3a', 3, 200, 500),
    ring('path', 300, '#5a1030', 4, 80, 500),
    hit(700, '#a02040', 230),
    pt('target', 'wisp', 'burst', '#3a1020', '#a02040', 12, 22, 90, 700, 450),
  ] },
  // Psystrike (Mewtwo): a pulse of psychic energy materializes around the target and crushes it.
  psystrike: { shake: 'strong', layers: [
    aura('user', 0, '#fa7179', 200, 450),
    tint(300, '#ffd0e8', 800),
    ring('target', 400, '#fa7179', 4, 260, 600),
    pt('target', 'shard', 'converge', '#ffb0d0', '#ffffff', 16, 14, 140, 400, 400),
    hit(700, '#ffe0f0', 280),
    pt('target', 'shard', 'burst', '#fa7179', '#ffffff', 14, 14, 110, 710, 450),
  ] },
  // Relic Song (Meloetta): an ancient song: notes and rainbow rings fill the stage around the target.
  relicsong: { layers: [
    pt('user', 'note', 'rise', '#f4f4f4', '#7ad85a', 8, 20, 70, 0, 550),
    { kind: 'rings', at: 'path', color: '#ffffff', count: 4, size: 80, rainbow: true, delay: 250, dur: 550 },
    orb(300, '#ffd23f', 24, 'note', 450, { arc: true, count: 4, gap: 60, color2: '#ffffff' }),
    pt('target', 'note', 'swirl', '#ff9ad8', '#7ab0ff', 10, 18, 70, 700, 450),
    hit(720, '#ffffff', 180, false),
  ] },
  // Searing Shot (Victini): fireballs burst out from the user in every direction, scorching everything around.
  searingshot: { shake: 'light', layers: [
    aura('user', 0, '#ff7a1a', 200, 400),
    pt('user', 'flame', 'burst', '#ff5a1a', '#ffd23f', 24, 22, 200, 300, 600),
    orb(320, '#ff5a1a', 30, 'flame', 380, { count: 3, gap: 60, color2: '#ffd23f' }),
    hit(700, '#ffd27f', 220),
    pt('target', 'flame', 'burst', '#ff5a1a', '#ffd23f', 14, 18, 90, 710, 450),
  ] },
  // Secret Sword (Keldeo): its horn becomes a long blade of light and slashes the target clean.
  secretsword: { shake: 'light', layers: [
    { kind: 'rays', at: 'user', color: '#cfe8ff', size: 220, delay: 0, dur: 400 },
    slash(410, '#7ab0ff', 1, 40, 22),
    slash(430, '#ffffff', 1, 40, 8),
    hit(440, '#ffffff', 200),
    pt('target', 'shard', 'burst', '#cfe8ff', '#ffffff', 14, 14, 100, 450, 500),
  ] },
  // Sacred Sword (the Swords of Justice): a golden sword slash, in a cross, that cuts through defenses.
  sacredsword: { shake: 'light', layers: [
    { kind: 'rays', at: 'user', color: '#fff3a0', size: 200, delay: 0, dur: 400 },
    slash(410, '#ffd23f', 2, 55, 16, true),
    hit(440, '#fffbe0', 200),
    { kind: 'rays', at: 'target', color: '#ffe08a', size: 260, delay: 450, dur: 450 },
  ] },
  // Glaciate (Kyurem): freezing air sweeps over the foes, glazing the ground in ice.
  glaciate: { layers: [
    { kind: 'gust', color: '#cfeeff', count: 14, delay: 150, dur: 550, leaves: false },
    { kind: 'ground', color: '#bfe8ff', delay: 300, dur: 600 },
    pt('target', 'shard', 'fall', '#bfe8ff', '#ffffff', 16, 14, 110, 450, 550),
    hit(650, '#e8f8ff', 220, false),
    tint(450, '#d8f4ff', 500),
    down('target', 800),
  ] },
  // Fusion Flare (Reshiram): a gigantic white-hot fireball engulfs the target.
  fusionflare: { shake: 'strong', layers: [
    pt('user', 'flame', 'converge', '#ffd8b0', '#ffffff', 18, 18, 140, 0, 400),
    { kind: 'sphere', at: 'user', color: '#ffb070', color2: '#ffffff', size: 140, delay: 150, dur: 350 },
    orb(450, '#ff8c3a', 70, 'dot', 420, { arc: true, color2: '#fffbe0' }),
    hit(870, '#fffbe0', 320),
    { kind: 'rays', at: 'target', color: '#ffd8b0', size: 380, delay: 880, dur: 500 },
    pt('target', 'flame', 'burst', '#ff7a1a', '#fff0c0', 20, 22, 130, 880, 450),
  ] },
  // Fusion Bolt (Zekrom): the user becomes a giant ball of lightning and crashes into the target.
  fusionbolt: { shake: 'strong', layers: [
    aura('user', 0, '#5a7aff', 220, 400),
    pt('user', 'spark', 'converge', '#cfe0ff', '#5a7aff', 16, 14, 120, 0, 400),
    speed(380, '#cfe0ff', 300),
    { kind: 'bolt', color: '#5a7aff', delay: 450 },
    hit(470, '#e8f0ff', 300),
    pt('target', 'spark', 'burst', '#cfe0ff', '#5a7aff', 18, 16, 130, 480, 500),
  ] },
};

const GEN_6: Record<string, FxSpec> = {
  // Aromatic Mist (Spritzee, Aromatisse): a sweet pink mist drifts over an ally, raising its Special Defense.
  aromaticmist: { layers: [
    pt('user', 'wisp', 'rise', '#ffc0e0', '#ffffff', 14, 24, 90, 0, 650),
    pt('user', 'dot', 'swirl', '#ff9ad8', '#ffffff', 8, 9, 70, 150, 500),
    up('user', 450, '#ff6aa8'),
  ] },
  // Crafty Shield (Klefki): a shimmering, key-shaped glint of a barrier that blocks status moves.
  craftyshield: { layers: [
    { kind: 'wall', color: '#ec8fe6', delay: 100 },
    pt('user', 'star', 'burst', '#fff0fa', '#ec8fe6', 10, 12, 90, 250, 450),
  ] },
  // Diamond Storm (Diancie): diamonds swirl up around her and then rain on the foes; her Defense may rise.
  diamondstorm: { shake: 'light', layers: [
    pt('user', 'gem', 'swirl', '#ffd8f0', '#bfe8ff', 18, 14, 100, 0, 550),
    { kind: 'rays', at: 'user', color: '#ffe0f8', size: 220, delay: 200, dur: 400 },
    orb(400, '#ffd8f0', 22, 'gem', 380, { count: 8, gap: 35, color2: '#ffffff' }),
    hit(800, '#ffffff', 240),
    pt('target', 'shard', 'burst', '#ffd8f0', '#bfe8ff', 18, 14, 120, 800, 450),
    up('user', 850, '#ff9ad8'),
  ] },
  // Electrify (Helioptile line): a jolt makes the target's next move Electric-type.
  electrify: { layers: [
    { kind: 'bolt', color: '#f4d23c', delay: 250 },
    aura('target', 320, '#f4d23c', 160, 450),
    pt('target', 'spark', 'swirl', '#fff6b0', '#f4d23c', 12, 12, 60, 330, 450),
  ] },
  // Fairy Lock (Klefki): a glittering lock seals the field: nobody can flee next turn.
  fairylock: { layers: [
    ring('user', 0, '#ec8fe6', 3, 260, 600),
    pt('target', 'star', 'swirl', '#fff0fa', '#ec8fe6', 12, 12, 70, 250, 500),
    { kind: 'rays', at: 'target', color: '#ffd8f8', size: 200, delay: 400, dur: 400 },
  ] },
  // Forest's Curse (Trevenant): a ghostly swirl of dark leaves curses the target with the Grass type.
  forestscurse: { layers: [
    pt('target', 'leaf', 'swirl', '#2e6a2a', '#63bc5a', 16, 16, 80, 100, 650),
    { kind: 'vortex', at: 'target', color: '#2e6a2a', color2: '#7a5aa0', size: 170, delay: 250, dur: 550 },
    pt('target', 'wisp', 'rise', '#5a4a7a', '#7a5aa0', 8, 22, 60, 300, 550),
  ] },
  // Geomancy (Xerneas): it soaks up the planet's energy in rainbow light, sharply raising three stats.
  geomancy: { layers: [
    pt('user', 'dot', 'converge', '#ffd23f', '#7ab0ff', 18, 10, 160, 0, 500),
    pt('user', 'dot', 'converge', '#ff7aa0', '#7ad85a', 18, 10, 160, 100, 500),
    { kind: 'rings', at: 'user', color: '#ffffff', count: 3, size: 260, rainbow: true, delay: 400, dur: 600 },
    { kind: 'rays', at: 'user', color: '#e6f0ff', size: 300, delay: 500, dur: 550 },
    up('user', 650, '#ff5a3a'),
  ] },
  // Hyperspace Fury (Hoopa Unbound): portals open all around the target and its many arms pummel it from each.
  hyperspacefury: { shake: 'strong', layers: [
    dim(0, 1100, '#100018'),
    ring('target', 150, '#a060d0', 4, 200, 500),
    hit(400, '#d0a0ff', 120), hit(470, '#c090f0', 130), hit(540, '#b080e0', 140), hit(610, '#d0a0ff', 180),
    slash(420, '#7a3ab0', 4, 30, 10, true),
    pt('target', 'wisp', 'burst', '#5a2a8a', '#d0a0ff', 14, 22, 110, 620, 450),
    down('user', 720),
  ] },
  // Hyperspace Hole (Hoopa): a ring portal opens by the target and the attack comes through it, out of nowhere.
  hyperspacehole: { layers: [
    { kind: 'vortex', at: 'user', color: '#a060d0', color2: '#ffd23f', size: 140, delay: 0, dur: 450 },
    { kind: 'vortex', at: 'target', color: '#a060d0', color2: '#ffd23f', size: 180, delay: 400, dur: 500 },
    hit(650, '#e8d0ff', 240),
    pt('target', 'star', 'burst', '#ffd23f', '#d0a0ff', 12, 12, 100, 660, 400),
  ] },
  // Land's Wrath (Zygarde): the land's power erupts under the foes in green-lit earth.
  landswrath: { shake: 'strong', layers: [
    { kind: 'ground', color: '#4f9a3a', delay: 100, dur: 600 },
    { kind: 'crack', color: '#2e4a1a', delay: 400 },
    { kind: 'column', color: '#4f9a3a', color2: '#c9a35a', delay: 450 },
    pt('target', 'rock', 'burst', '#8a6d47', '#4f9a3a', 18, 14, 120, 480, 500),
    hit(560, '#d8f0c0', 230),
  ] },
  // Thousand Arrows (Zygarde): countless green arrows rise from the ground and rain down, grounding even fliers.
  thousandarrows: { shake: 'light', layers: [
    pt('user', 'shard', 'rise', '#4f9a3a', '#c9e8a0', 16, 14, 120, 0, 500),
    pt('target', 'shard', 'fall', '#4f9a3a', '#c9e8a0', 22, 14, 130, 400, 500),
    hit(650, '#d8f0c0', 220),
    { kind: 'crack', color: '#2e4a1a', delay: 660 },
    down('target', 750, '#4f9a3a'),
  ] },
  // Thousand Waves (Zygarde): waves roll through the ground, trapping the foes.
  thousandwaves: { shake: 'light', layers: [
    { kind: 'ground', color: '#4f9a3a', delay: 100, dur: 700 },
    ring('target', 350, '#4f9a3a', 4, 260, 650),
    pt('target', 'rock', 'rise', '#8a6d47', '#4f9a3a', 14, 12, 110, 400, 500),
    hit(600, '#d8f0c0', 200, false),
  ] },
  // King's Shield (Aegislash): its shield goes up, gleaming gold; anything that hits it has its Attack cut.
  kingsshield: { layers: [
    { kind: 'shield', color: '#d8c890' },
    { kind: 'rays', at: 'user', color: '#fff3a0', size: 220, delay: 150, dur: 450 },
    pt('user', 'star', 'burst', '#ffffff', '#ffd23f', 8, 12, 80, 300, 400),
  ] },
  // Mat Block (Greninja line): a mat flipped up as a wall, shielding the side from attacks.
  matblock: { layers: [
    { kind: 'wall', color: '#c9a35a', delay: 0 },
    pt('user', 'rock', 'burst', '#c9a35a', '#7a5a3a', 8, 10, 80, 200, 400),
    hit(220, '#fff0c0', 120, true, 'user'),
  ] },
  // Noble Roar (Litleo, Pyroar): a regal roar that cows the target, lowering Attack and Special Attack.
  nobleroar: { layers: [
    ring('path', 0, '#ffd23f', 4, 90, 550),
    ring('user', 0, '#ffe08a', 2, 200, 450),
    down('target', 500),
  ] },
  // Oblivion Wing (Yveltal): a crimson-black beam drains the target's life into Yveltal.
  oblivionwing: { shake: 'light', layers: [
    dim(0, 1100, '#14000a'),
    pt('user', 'feather', 'converge', '#c8203a', '#3a0a14', 12, 18, 120, 0, 400),
    { kind: 'beam', color: '#c8203a', color2: '#1a0008', width: 40, delay: 350, dur: 450 },
    hit(600, '#ff4a6a', 230),
    orb(700, '#ff4a6a', 14, 'dot', 400, { reverse: true, count: 5, gap: 40, color2: '#ffc0c8' }),
    ...heal(950, '#ff6a8a'),
  ] },
  // Parting Shot (Pancham line): a parting jeer that lowers the target's stats, and the user slips away.
  partingshot: { layers: [
    orb(100, '#5a5465', 18, 'dot', 350, { count: 2, gap: 80, color2: '#ffffff' }),
    down('target', 450),
    pt('user', 'wisp', 'rise', '#9a9aa8', '#ffffff', 8, 18, 60, 500, 350),
  ] },
  // Powder (Vivillon line): a cloud of fine powder settles on the target: it'll explode if it uses a Fire move.
  powder: { layers: [
    orb(100, '#ffb070', 12, 'dot', 450, { arc: true, count: 5, gap: 40, color2: '#ffe0c0' }),
    pt('target', 'dot', 'fall', '#ffb070', '#ffe0c0', 18, 8, 80, 450, 450),
  ] },
  // Topsy-Turvy (Malamar): a bizarre twist that turns the target's stat changes upside down.
  topsyturvy: { layers: [
    ring('path', 0, '#7a5a9a', 3, 70, 450),
    { kind: 'vortex', at: 'target', color: '#5a5465', color2: '#c87aff', size: 160, delay: 300, dur: 500 },
    up('target', 450, '#c87aff'), down('target', 550, '#c87aff'),
  ] },
  // Trick-or-Treat (Pumpkaboo, Gourgeist): orange ghost-lights swirl around the target, giving it the Ghost type.
  trickortreat: { layers: [
    pt('target', 'wisp', 'swirl', '#ff9a3a', '#7a5aa0', 14, 22, 80, 100, 650),
    aura('target', 300, '#7a5aa0', 170, 450),
    pt('target', 'star', 'burst', '#ffb347', '#ffffff', 8, 10, 70, 450, 400),
  ] },
  // Spiky Shield (Chesnaught): a shield bristling with spikes; whoever hits it is hurt.
  spikyshield: { layers: [
    { kind: 'shield', color: '#6cbf4b', spiky: true },
    pt('user', 'shard', 'burst', '#4f9a3a', '#d8f0c0', 12, 12, 90, 200, 400),
  ] },
  // Water Shuriken (Greninja line): spinning stars of water flung at the target, two to five of them.
  watershuriken: { layers: [
    orb(100, '#4d90d5', 26, 'star', 300, { spin: true, count: 4, gap: 70, color2: '#cfe9ff' }),
    hit(420, '#cfe9ff', 90), hit(490, '#cfe9ff', 100), hit(560, '#cfe9ff', 110), hit(630, '#cfe9ff', 120),
    pt('target', 'drop', 'burst', '#4d90d5', '#cfe9ff', 10, 10, 70, 640, 350),
  ] },
  // Flying Press (Hawlucha): it dives from the sky and slams the target with a press, Fighting and Flying at once.
  flyingpress: { shake: 'strong', layers: [
    pt('user', 'feather', 'rise', '#8fa9de', '#ce416b', 8, 16, 70, 0, 400),
    hit(470, '#ffe0e8', 260),
    ring('target', 480, '#ce416b', 2, 220, 450),
    ring('target', 520, '#8fa9de', 2, 260, 450),
    pt('target', 'star', 'burst', '#ffffff', '#ce416b', 14, 14, 110, 490, 450),
  ] },
};

const GEN_7: Record<string, FxSpec> = {
  // Accelerock (Rockruff line): a blur of speed and a rock-hard tackle.
  accelerock: { shake: 'light', layers: [
    speed(250, '#e8dcc0', 260),
    hit(390, '#efe6d2', 170),
    pt('target', 'rock', 'burst', '#c5b78c', '#8a6d47', 14, 12, 90, 400, 400),
  ] },
  // Anchor Shot (Dhelmise): the anchor is hurled on its chain, strikes, and the chain holds the target fast.
  anchorshot: { shake: 'light', layers: [
    orb(150, '#7a8a94', 12, 'dot', 420, { count: 4, gap: 40, color2: '#c0c8d0' }),
    orb(190, '#5a6a74', 40, 'gem', 420, { spin: true, color2: '#c0c8d0' }),
    hit(620, '#e0e8f0', 220),
    ring('target', 650, '#5a6a74', 3, 180, 500),
  ] },
  // Baneful Bunker (Toxapex): a spiked, poisonous bunker; whoever hits it is poisoned.
  banefulbunker: { layers: [
    { kind: 'shield', color: '#a33ea1', spiky: true },
    pt('user', 'bubble', 'burst', '#aa6bc8', '#e0c0f0', 12, 12, 90, 200, 450),
  ] },
  // Beak Blast (Toucannon): its beak heats red-hot, then the strike lands in an explosion of flame.
  beakblast: { shake: 'strong', layers: [
    aura('user', 0, '#ff5a1a', 180, 400),
    pt('user', 'flame', 'converge', '#ff7a1a', '#ffd23f', 14, 14, 90, 0, 400),
    hit(470, '#ffd27f', 230),
    pt('target', 'flame', 'burst', '#ff5a1a', '#ffd23f', 18, 18, 110, 480, 450),
    ring('target', 480, '#ff7a1a', 2, 200, 400),
  ] },
  // Core Enforcer (Zygarde): a Z-shaped beam of green light sears the foes, suppressing their Abilities.
  coreenforcer: { shake: 'light', layers: [
    pt('user', 'dot', 'converge', '#7cd05a', '#e8ffd8', 16, 10, 120, 0, 400),
    { kind: 'beam', color: '#4f9a3a', color2: '#e8ffd8', width: 34, delay: 350, dur: 450 },
    slash(620, '#7cd05a', 1, 0, 14), slash(680, '#7cd05a', 1, -45, 14), slash(740, '#7cd05a', 1, 0, 14),
    hit(700, '#e8ffd8', 240),
    ring('target', 720, '#4f9a3a', 3, 220, 450),
  ] },
  // Darkest Lariat (Incineroar): it spins with both arms out and clotheslines the target, ignoring its defenses.
  darkestlariat: { shake: 'strong', layers: [
    { kind: 'vortex', at: 'user', color: '#3a2a3a', color2: '#ff5a3a', size: 170, delay: 0, dur: 450 },
    slash(410, '#5a2a3a', 2, 10, 18),
    hit(430, '#ff8a6a', 230),
    pt('target', 'flame', 'burst', '#c83a1a', '#3a2a3a', 14, 16, 100, 440, 450),
  ] },
  // Fire Lash (Salazzle): a whip of fire lashes the target, lowering its Defense.
  firelash: { layers: [
    slash(400, '#ff5a1a', 1, -20, 12),
    slash(440, '#ffd23f', 1, -20, 5),
    hit(440, '#ffd27f', 160),
    pt('target', 'flame', 'rise', '#ff5a1a', '#ffd23f', 12, 14, 70, 450, 450),
    down('target', 600),
  ] },
  // Ice Hammer (Crabominable): a huge icy fist hammers down on the target.
  icehammer: { shake: 'strong', layers: [
    { kind: 'gauntlets', color: '#bfe8ff', color2: '#ffffff', size: 110, style: 'one-two', material: 'ice', delay: 150, dur: 600 },
    hit(560, '#e8f8ff', 250),
    pt('target', 'shard', 'burst', '#bfe8ff', '#ffffff', 16, 14, 110, 570, 450),
    { kind: 'crack', color: '#5a8aa8', delay: 580 },
  ] },
  // Multi-Attack (Silvally): its memory disc glows and it tears into the target with a type-shifting strike.
  multiattack: { shake: 'strong', layers: [
    { kind: 'rings', at: 'user', color: '#ffffff', count: 2, size: 200, rainbow: true, delay: 0, dur: 450 },
    aura('user', 100, '#e0e0ff', 200, 400),
    slash(500, '#ffffff', 2, 50, 18, true),
    hit(520, '#ffffff', 280),
    { kind: 'rings', at: 'target', color: '#ffffff', count: 3, size: 260, rainbow: true, delay: 530, dur: 500 },
  ] },
  // Photon Geyser (Necrozma): a geyser of light erupts from the ground and pillars into the sky over the target.
  photongeyser: { shake: 'strong', layers: [
    pt('user', 'dot', 'converge', '#fff6c0', '#ffffff', 18, 10, 140, 0, 450),
    aura('user', 150, '#ffe08a', 220, 400),
    flash(550, '#fffbe0', 220),
    { kind: 'pillar', at: 'target', color: '#ffe08a', color2: '#ffffff', width: 110, delay: 550, dur: 650 },
    { kind: 'rays', at: 'target', color: '#fff6c0', size: 380, delay: 600, dur: 600 },
    hit(700, '#ffffff', 300),
  ] },
  // Plasma Fists (Zeraora): a barrage of electrified punches.
  plasmafists: { shake: 'strong', layers: [
    { kind: 'gauntlets', color: '#ffe066', color2: '#5ab0ff', size: 70, style: 'barrage', material: 'electric', count: 4, gap: 90, delay: 150, dur: 300 },
    { kind: 'bolt', color: '#f4d23c', delay: 560 },
    hit(600, '#fff6b0', 220),
    pt('target', 'spark', 'burst', '#fff6b0', '#5ab0ff', 16, 14, 110, 610, 400),
  ] },
  // Pollen Puff (Cutiefly, Ribombee): a fluffy ball of pollen that bursts on a foe (or heals an ally).
  pollenpuff: { layers: [
    orb(150, '#ffe066', 40, 'blob', 480, { arc: true, color2: '#fff6c0' }),
    hit(630, '#fff6c0', 190, false),
    pt('target', 'dot', 'burst', '#ffe066', '#fff6c0', 18, 10, 100, 640, 450),
  ] },
  // Revelation Dance (Oricorio): it dances in a flurry of feathers and a wave of its style's energy hits.
  revelationdance: { layers: [
    pt('user', 'feather', 'swirl', '#ff7aa0', '#ffd23f', 14, 16, 90, 0, 600),
    pt('user', 'dot', 'swirl', '#7ab0ff', '#c87aff', 10, 9, 80, 100, 500),
    { kind: 'beam', color: '#ff9ad8', color2: '#fff6c0', width: 30, wavy: true, delay: 450, dur: 400 },
    hit(700, '#fff0fa', 220),
    pt('target', 'feather', 'burst', '#ff7aa0', '#ffd23f', 12, 14, 100, 710, 400),
  ] },
  // Shadow Bone (Marowak, Alolan form): it swings its bone, wreathed in ghostly fire, into the target.
  shadowbone: { shake: 'strong', layers: [
    aura('user', 0, '#7a4ac8', 170, 400),
    pt('user', 'wisp', 'rise', '#7a4ac8', '#c8a0ff', 10, 20, 60, 0, 450),
    orb(230, '#e8dcff', 54, 'bone', 210, { spin: true, color2: '#7a4ac8' }),
    slash(410, '#a070ff', 1, 65, 16),
    hit(430, '#d8c0ff', 210),
    pt('target', 'wisp', 'burst', '#5a2a9a', '#c8a0ff', 16, 22, 100, 440, 500),
    pt('target', 'flame', 'rise', '#7a4ac8', '#c8a0ff', 10, 16, 60, 460, 450),
  ] },
  // Sparkling Aria (Primarina): it sings, and its song sends out a stream of sparkling bubbles.
  sparklingaria: { shake: 'light', layers: [
    pt('user', 'note', 'rise', '#7ab0ff', '#ffffff', 8, 20, 70, 0, 550),
    orb(250, '#7cc4ff', 26, 'bubble', 500, { arc: true, count: 7, gap: 45, color2: '#ffffff' }),
    orb(300, '#cfe9ff', 22, 'note', 450, { arc: true, count: 3, gap: 80, color2: '#ffffff' }),
    hit(760, '#e8f6ff', 220, false),
    pt('target', 'bubble', 'burst', '#7cc4ff', '#ffffff', 16, 14, 110, 770, 450),
  ] },
  // Spectral Thief (Marshadow): it slips into the target's shadow, steals its stat boosts and strikes.
  spectralthief: { shake: 'light', layers: [
    dim(0, 1000, '#08000a'),
    speed(250, '#5a4a6a', 300),
    slash(410, '#3a2a4a', 2, 40, 14, true),
    hit(430, '#9a7ac8', 210),
    pt('target', 'wisp', 'converge', '#5a4a6a', '#9a7ac8', 12, 20, 90, 450, 350),
    up('user', 700, '#9a7ac8'),
  ] },
  // Spirit Shackle (Decidueye): an arrow-quill pins the target's shadow so it can't escape.
  spiritshackle: { shake: 'light', layers: [
    pt('user', 'feather', 'converge', '#7a6a4a', '#d8c8a0', 8, 16, 80, 0, 350),
    orb(250, '#5a4a3a', 34, 'feather', 300, { color2: '#d8c8a0' }),
    hit(550, '#d8c8a0', 190),
    ring('target', 580, '#2a1a3a', 3, 170, 500),
    pt('target', 'wisp', 'rise', '#3a2a4a', '#7a5aa0', 10, 20, 70, 600, 450),
  ] },
  // Trop Kick (Bounsweet line): a tropical, fruity kick that saps the target's Attack.
  tropkick: { layers: [
    slash(410, '#ff7a9a', 1, 25, 14),
    hit(430, '#ffe0e8', 170),
    pt('target', 'leaf', 'burst', '#63bc5a', '#ff7a9a', 12, 14, 90, 440, 450),
    pt('target', 'heart', 'burst', '#ff9ac0', '#ffe066', 6, 10, 70, 450, 400),
    down('target', 600),
  ] },
  // Zing Zap (Togedemaru): it spins its spines and jabs the target in an electric burst.
  zingzap: { shake: 'light', layers: [
    pt('user', 'spark', 'swirl', '#fff6b0', '#f4d23c', 14, 12, 70, 0, 450),
    aura('user', 100, '#f4d23c', 160, 350),
    hit(430, '#fff6b0', 200),
    pt('target', 'spark', 'burst', '#fff6b0', '#f4d23c', 14, 14, 100, 440, 400),
  ] },
  // Sunsteel Strike (Solgaleo): it blazes like a meteor of sunlight and slams the target.
  sunsteelstrike: { shake: 'strong', layers: [
    { kind: 'rays', at: 'user', color: '#ffd23f', size: 300, delay: 0, dur: 500 },
    aura('user', 0, '#ffb020', 240, 500),
    speed(450, '#ffe08a', 300),
    hit(560, '#fffbe0', 320),
    { kind: 'column', color: '#ffb020', color2: '#fffbe0', delay: 580 },
    ring('target', 590, '#ffd23f', 3, 280, 500),
  ] },
  // Moongeist Beam (Lunala): the stage dims and a beam of eerie moonlight is fired at the target.
  moongeistbeam: { shake: 'light', layers: [
    dim(0, 1300, '#06000f'),
    pt('user', 'crescent', 'converge', '#c8b0ff', '#ffffff', 10, 18, 120, 0, 450),
    { kind: 'beam', color: '#6a3ac8', color2: '#e0d0ff', width: 44, delay: 450, dur: 550 },
    ring('path', 470, '#c8b0ff', 4, 80, 550),
    hit(750, '#e0d0ff', 270),
    pt('target', 'star', 'burst', '#ffffff', '#c8b0ff', 14, 12, 110, 760, 450),
  ] },
  // First Impression (Golisopod): a lightning-fast first strike, only on its first turn out.
  firstimpression: { shake: 'light', layers: [
    speed(200, '#d8f0a0', 300),
    hit(390, '#e8ffc0', 230),
    slash(390, '#91c12f', 3, 20, 10),
    pt('target', 'star', 'burst', '#ffffff', '#91c12f', 12, 12, 100, 400, 400),
  ] },
  // Nature's Madness (the Tapus): nature's own power converges on the target and halves its HP.
  naturesmadness: { layers: [
    pt('target', 'leaf', 'converge', '#7cd05a', '#ff9ad8', 16, 14, 150, 100, 500),
    pt('target', 'dot', 'converge', '#ffe066', '#7ab0ff', 14, 9, 150, 200, 450),
    { kind: 'vortex', at: 'target', color: '#ec8fe6', color2: '#7cd05a', size: 200, delay: 450, dur: 500 },
    hit(700, '#fff0fa', 250),
  ] },
  // ---- Generations 8 and 9 (the Champions Pokémon and the Paradox forms) ----
  // Mortal Spin (Glimmora): it spins in a whirl of poison crystal, clearing hazards and poisoning the foes.
  mortalspin: { shake: 'light', layers: [
    { kind: 'vortex', at: 'user', color: '#aa6bc8', color2: '#ffd8f0', size: 190, delay: 0, dur: 600 },
    pt('user', 'shard', 'burst', '#aa6bc8', '#ffd8f0', 18, 14, 160, 300, 550),
    hit(600, '#e0c0f0', 200),
    pt('target', 'bubble', 'rise', '#aa6bc8', '#e0c0f0', 10, 12, 60, 620, 400),
  ] },
  // Psyblade (Iron Leaves): a blade of psychic light, brighter on Electric Terrain.
  psyblade: { shake: 'light', layers: [
    aura('user', 0, '#fa7179', 160, 350),
    slash(410, '#ff6ab0', 1, 45, 20),
    slash(440, '#ffffff', 1, 45, 7),
    hit(440, '#ffe0f0', 200),
    ring('target', 450, '#fa7179', 2, 200, 400),
  ] },
  // Mighty Cleave (Iron Boulder): a cleaving blade of rock that cuts through protection.
  mightycleave: { shake: 'strong', layers: [
    slash(410, '#c5b78c', 1, 70, 22),
    slash(440, '#ffffff', 1, 70, 7),
    hit(440, '#efe6d2', 240),
    pt('target', 'rock', 'burst', '#c5b78c', '#8a6d47', 16, 14, 110, 450, 450),
    { kind: 'crack', color: '#5a4a2a', delay: 460 },
  ] },
  // Tachyon Cutter (Iron Crown): two blades of particle light, launched at blinding speed, each hitting.
  tachyoncutter: { layers: [
    orb(150, '#9fb8d0', 34, 'shard', 260, { spin: true, count: 2, gap: 130, color2: '#ffffff' }),
    hit(420, '#e8f4ff', 140), hit(550, '#e8f4ff', 160),
    slash(420, '#cfe0ff', 2, 30, 8, true),
  ] },
  // Thunderclap (Raging Bolt): a bolt of lightning that strikes first.
  thunderclap: { shake: 'light', layers: [
    flash(200, '#fffbe0', 150),
    { kind: 'bolt', color: '#f4d23c', delay: 250 },
    hit(320, '#fff6b0', 220),
    pt('target', 'spark', 'burst', '#fff6b0', '#f4d23c', 14, 14, 110, 330, 400),
  ] },
  // Hydro Steam (Walking Wake): a blast of scalding steam, stronger in the sun.
  hydrosteam: { shake: 'light', layers: [
    pt('user', 'wisp', 'converge', '#e8f4ff', '#cfe9ff', 12, 22, 110, 0, 400),
    { kind: 'beam', color: '#7cc4ff', color2: '#ffffff', width: 44, wavy: true, delay: 350, dur: 500 },
    hit(650, '#ffffff', 240),
    pt('target', 'wisp', 'rise', '#ffffff', '#cfe9ff', 16, 26, 100, 660, 500),
    pt('target', 'drop', 'burst', '#4d90d5', '#cfe9ff', 10, 12, 90, 660, 400),
  ] },
  // Freezing Glare (Galarian Articuno): its eyes flash and it shoots a psychic glare that can freeze the target.
  freezingglare: { shake: 'light', layers: [
    aura('user', 0, '#f366b9', 150, 400),
    { kind: 'beam', color: '#f366b9', color2: '#e8f8ff', width: 30, delay: 380, dur: 450 },
    ring('path', 400, '#bfe8ff', 3, 70, 450),
    hit(650, '#e8f8ff', 230),
    pt('target', 'shard', 'burst', '#bfe8ff', '#f366b9', 14, 13, 100, 660, 450),
  ] },
  // Thunderous Kick (Galarian Zapdos): a lightning-fast rush, then a kick that crackles like thunder.
  thunderouskick: { shake: 'strong', layers: [
    speed(200, '#ffd870', 280),
    pt('user', 'spark', 'burst', '#ffe066', '#ffffff', 8, 12, 70, 100, 300),
    slash(410, '#ff9a3a', 1, 30, 18),
    hit(430, '#ffe9b0', 240),
    { kind: 'bolt', color: '#f4d23c', delay: 440 },
    pt('target', 'spark', 'burst', '#ffe066', '#ff9a3a', 14, 12, 110, 450, 400),
  ] },
  // Fiery Wrath (Galarian Moltres): its wrath becomes a fire-like aura of dark flames that engulfs the foes.
  fierywrath: { shake: 'light', layers: [
    dim(0, 1100, '#0a0010'),
    aura('user', 0, '#6a2a8a', 210, 500),
    pt('user', 'flame', 'rise', '#7a3aa8', '#c060ff', 12, 18, 90, 100, 450),
    { kind: 'column', color: '#5a1a7a', color2: '#d080ff', delay: 600 },
    hit(650, '#e0b0ff', 250),
    pt('target', 'flame', 'rise', '#5a2a7a', '#c060ff', 14, 18, 110, 660, 450),
  ] },
  // Drum Beating (Rillaboom): it pounds its drum, and the beat sends the drum's roots bursting up under the target,
  // which slows down.
  drumbeating: { shake: 'light', layers: [
    ring('user', 0, '#8a6d47', 2, 160, 300), ring('user', 220, '#7cd05a', 2, 180, 300),
    pt('user', 'leaf', 'burst', '#3f9a2a', '#7cd05a', 10, 12, 90, 100, 400),
    { kind: 'ground', color: '#6b4a2b', delay: 350, dur: 450 },
    { kind: 'column', color: '#5a3a1a', color2: '#7cd05a', delay: 620 },
    hit(650, '#c8f0a0', 220),
    down('target', 750),
  ] },
  // Snipe Shot (Inteleon): it takes aim (a red reticle closes in on the target) and fires a single bullet of water from
  // its fingertip.
  snipeshot: { layers: [
    ring('target', 0, '#ff4a4a', 2, 140, 380),
    pt('user', 'drop', 'converge', '#5aa2ff', '#ffffff', 8, 8, 60, 100, 300),
    { kind: 'beam', color: '#3b7cff', color2: '#ffffff', width: 8, delay: 470, dur: 160 },
    orb(470, '#5aa2ff', 14, 'drop', 140, { color2: '#ffffff' }),
    hit(610, '#ffffff', 200),
    pt('target', 'drop', 'burst', '#3b7cff', '#cfe8ff', 12, 12, 90, 620, 350),
  ] },
  // Flower Trick (Meowscarada): it tosses a rigged bouquet at the target, and the flowers burst open in a blast of petals
  // (it always lands a critical hit).
  flowertrick: { shake: 'light', layers: [
    pt('user', 'leaf', 'swirl', '#ff6ab0', '#7cd05a', 10, 12, 70, 0, 400),
    orb(400, '#ff6ab0', 28, 'leaf', 280, { arc: true, spin: true, color2: '#7cd05a' }),
    hit(680, '#ffd0e8', 260),
    { kind: 'impact', color: '#ff6ab0', size: 160, star: true, delay: 700 },
    pt('target', 'leaf', 'burst', '#ff6ab0', '#ffd0e8', 22, 14, 150, 690, 500),
    pt('target', 'leaf', 'burst', '#7cd05a', '#3f9a2a', 10, 12, 110, 720, 450),
  ] },
  // Torch Song (Skeledirge): it sings, and its song comes out as a blast of flame carrying burning notes; its Sp. Atk rises.
  torchsong: { shake: 'light', layers: [
    pt('user', 'note', 'rise', '#ff7a1a', '#ffd23f', 8, 14, 70, 0, 450),
    ring('user', 100, '#ff9a3a', 2, 170, 350),
    { kind: 'beam', color: '#ff5a1a', color2: '#ffd23f', width: 34, wavy: true, delay: 420, dur: 450 },
    orb(430, '#ffb347', 18, 'note', 380, { count: 3, gap: 70, color2: '#fff0a0' }),
    hit(720, '#fff0c0', 240),
    pt('target', 'flame', 'burst', '#ff5a1a', '#ffd23f', 16, 16, 120, 730, 400),
    up('user', 850, '#ff7a1a'),
  ] },
  // Aqua Step (Quaquaval): light, fluid dance steps on a trail of water, then a kick; its Speed rises.
  aquastep: { shake: 'light', layers: [
    pt('user', 'drop', 'swirl', '#5aa2ff', '#cfe8ff', 12, 10, 80, 0, 400),
    speed(220, '#9ac8ff', 260),
    slash(450, '#5aa2ff', 2, 20, 12),
    hit(470, '#e8f4ff', 220),
    pt('target', 'drop', 'spray', '#3b7cff', '#ffffff', 14, 12, 110, 480, 400),
    up('user', 700, '#5aa2ff'),
  ] },
};

const GEN_6_TO_9_STATUS: Record<string, FxSpec> = {
  // Floral Healing (Comfey): flowers bloom around the target and heal it.
  floralhealing: { layers: [
    pt('target', 'leaf', 'burst', '#ff9ad8', '#7cd05a', 16, 14, 90, 100, 550),
    pt('target', 'heart', 'rise', '#ff9ad8', '#ffffff', 8, 12, 60, 250, 550),
    aura('target', 300, '#ffc0e0', 190, 450),
  ] },
  // Instruct (Oranguru): it gestures, and the target uses its move again.
  instruct: { layers: [
    ring('path', 0, '#fa7179', 3, 60, 400),
    pt('target', 'star', 'burst', '#ffffff', '#fa7179', 8, 12, 70, 400, 350),
  ] },
  // Purify (Pyukumuku): it cures the target's status and heals itself.
  purify: { layers: [
    orb(100, '#ffd8f0', 14, 'dot', 350, { count: 3, gap: 60, color2: '#ffffff' }),
    pt('target', 'star', 'rise', '#ffffff', '#ffd8f0', 10, 11, 70, 450, 400),
    ...heal(500, '#ffc0e0'),
  ] },
  // Shore Up (Sandygast line): sand rushes in and rebuilds the user (more in a sandstorm).
  shoreup: { layers: [
    pt('user', 'rock', 'converge', '#d9c79a', '#c9a35a', 20, 10, 140, 0, 550),
    { kind: 'vortex', at: 'user', color: '#c9a35a', color2: '#efe6d2', size: 170, delay: 150, dur: 500 },
    ...heal(550, '#e8d8b0'),
  ] },
  // Toxic Thread (Spinarak line): a web of poison thread that poisons the target and slows it down.
  toxicthread: { layers: [
    orb(100, '#aa6bc8', 10, 'dot', 400, { count: 3, gap: 60, color2: '#e0c0f0' }),
    { kind: 'web', at: 'target', color: '#c890e8', size: 180, delay: 450, dur: 650 },
    pt('target', 'bubble', 'rise', '#aa6bc8', '#e0c0f0', 8, 10, 50, 600, 450),
    down('target', 700),
  ] },
  // Spicy Extract (Scovillain): a fiery chili extract: the target's Attack sharply rises, its Defense sharply falls.
  spicyextract: { layers: [
    orb(100, '#e8303a', 22, 'flame', 380, { color2: '#ffd23f' }),
    pt('target', 'flame', 'rise', '#e8303a', '#ffd23f', 12, 14, 60, 480, 450),
    up('target', 550), down('target', 650),
  ] },
  // No Retreat (Falinks): it vows not to run, every stat rising, and can no longer switch out.
  noretreat: { layers: [
    ring('user', 0, '#ffb347', 3, 220, 500),
    pt('user', 'spark', 'converge', '#ffe08a', '#ffffff', 14, 12, 110, 0, 400),
    aura('user', 300, '#ff9a3a', 210, 450),
    up('user', 450),
  ] },
  // Burning Bulwark (Gouging Fire): a shield of fire; whoever hits it is burned.
  burningbulwark: { layers: [
    { kind: 'shield', color: '#ff7a1a', spiky: true },
    pt('user', 'flame', 'burst', '#ff5a1a', '#ffd23f', 14, 14, 90, 200, 450),
  ] },
};

/** Every signature move with its own animation here (attacks and status moves), by move id. */
export const SIGNATURE_MOVE_FX: Record<string, FxSpec> = {
  ...SIGNATURE_ATTACKS, ...GEN_4_5, ...GEN_6, ...GEN_7, ...SIGNATURE_STATUS, ...GEN_6_TO_9_STATUS,
};

/**
 * How the user of each signature attack moves (as BIG_MOVE_MOTION): charging in to strike, leaping onto the target, or
 * sending the move off from where it stands. Status moves keep their usual motion.
 */
export const SIGNATURE_MOTION: Record<string, 'charge' | 'cast' | 'leap' | 'dive'> = {
  boneclub: 'charge', crabhammer: 'charge', clamp: 'charge', hyperfang: 'charge', triplekick: 'charge', armthrust: 'charge', blazekick: 'charge',
  leafblade: 'charge', needlearm: 'charge', poisontail: 'charge', meteormash: 'charge', crushgrip: 'charge', geargrind: 'cast', hornleech: 'charge',
  secretsword: 'cast', sacredsword: 'charge', fusionbolt: 'charge', hyperspacefury: 'charge', accelerock: 'charge', beakblast: 'charge',
  darkestlariat: 'charge', firelash: 'charge', icehammer: 'charge', multiattack: 'charge', plasmafists: 'charge', shadowbone: 'charge',
  spectralthief: 'charge', tropkick: 'charge', zingzap: 'charge', sunsteelstrike: 'charge', firstimpression: 'charge', psyblade: 'charge',
  mightycleave: 'charge',
  heatcrash: 'leap', flyingpress: 'dive',
  bonemerang: 'cast', aeroblast: 'cast', sacredfire: 'cast', octazooka: 'cast', present: 'cast', lusterpurge: 'cast', mistball: 'cast',
  muddywater: 'cast', weatherball: 'cast', attackorder: 'cast', chatter: 'cast', judgment: 'cast', magmastorm: 'cast', spacialrend: 'cast',
  fierydance: 'cast', nightdaze: 'cast', psystrike: 'cast', relicsong: 'cast', searingshot: 'cast', glaciate: 'cast', fusionflare: 'cast',
  diamondstorm: 'cast', hyperspacehole: 'cast', landswrath: 'cast', thousandarrows: 'cast', thousandwaves: 'cast', oblivionwing: 'cast',
  watershuriken: 'cast', anchorshot: 'cast', coreenforcer: 'cast', photongeyser: 'cast', pollenpuff: 'cast', revelationdance: 'cast',
  sparklingaria: 'cast', spiritshackle: 'cast', moongeistbeam: 'cast', naturesmadness: 'cast', mortalspin: 'cast', tachyoncutter: 'cast',
  thunderclap: 'cast', hydrosteam: 'cast', freezingglare: 'cast', fierywrath: 'cast', drumbeating: 'cast', snipeshot: 'cast', flowertrick: 'cast',
  torchsong: 'cast',
  thunderouskick: 'charge', aquastep: 'charge',
};

/**
 * Bonemerang's second hit, in two parts (playback 'move-return', then the hit). First the bone, spinning, comes back
 * from beyond the target (where the throw went) to the target...
 */
export const BONEMERANG_RETURN: FxSpec = { layers: [
  orb(0, '#efe6d2', 48, 'bone', 380, { fromBeyond: true, spin: true, color2: '#c9b48a' }),
] };
/**
 * ...then strikes it on the way and flies on back into the thrower's hand. On the hit itself, whose anchors are the
 * Pokémon hit ('user') and the thrower ('target').
 */
export const BONEMERANG_CATCH: FxSpec = { layers: [
  hit(0, '#efe6d2', 160, true, 'user'),
  pt('user', 'rock', 'burst', '#c9a35a', '#efe6d2', 8, 9, 60, 0, 400),
  orb(0, '#efe6d2', 48, 'bone', 430, { spin: true, color2: '#c9b48a' }),
  ring('target', 420, '#efe6d2', 2, 110, 300),
] };
