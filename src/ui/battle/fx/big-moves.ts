// Every move over 100 power has its own animation (on request, 2026-10-17), tailored to the move: what it is in the
// games, drawn with the stage's shapes (approximations, not the games' animations). Solar Beam and the Digimon's
// moves have theirs in catalog.ts (SIGNATURE_MOVES, which these join). How long each plays: BIG_MOVE_MS in
// client/playback.ts. How the user moves: BIG_MOVE_MOTION (stage-fx); the target reacts with the hit after.
//
// Timings: a user that charges in (motion 'charge', 'leap', 'dive') makes contact at about 43% of the move's length;
// a move sent from where the user stands ('cast') lands at about 55-60%; a rampage hits at about 27%, 47% and 67%.
import type { Anchor, FxSpec, Layer, Motion, Shape } from './catalog';

const pt = (at: Anchor, shape: Shape, motion: Motion, color: string, color2: string | undefined, count: number, size: number, spread: number, delay = 0, dur?: number): Layer =>
  ({ kind: 'particles', at, shape, motion, color, ...(color2 ? { color2 } : {}), count, size, spread, delay, ...(dur ? { dur } : {}) });
const hit = (delay: number, color: string, size: number, star = true): Layer => ({ kind: 'impact', color, size, star, delay });
const ring = (at: Anchor | 'path', delay: number, color: string, count: number, size: number, dur = 550): Layer => ({ kind: 'rings', at, color, count, size, delay, dur });
const flash = (delay: number, color = '#ffffff', dur = 200): Layer => ({ kind: 'screen', color, mode: 'flash', delay, dur });
const tint = (delay: number, color: string, dur: number): Layer => ({ kind: 'screen', color, mode: 'tint', delay, dur });
const dim = (delay: number, dur: number, color = '#000010'): Layer => ({ kind: 'screen', color, mode: 'dim', delay, dur });
const speed = (delay: number, color = '#ffffff', dur = 450): Layer => ({ kind: 'speedlines', at: 'target', color, delay, dur });

export const BIG_MOVES: Record<string, FxSpec> = {
  // ---- 250-180 power ----
  // Explosion: the user swells, glows white-hot and blows up: a blinding flash, a towering blast, shockwaves across the
  // stage, debris and smoke; the blast reaches the target too.
  explosion: { shake: 'strong', layers: [
    { kind: 'aura', at: 'user', color: '#ffb347', size: 260, dur: 600 },
    pt('user', 'spark', 'converge', '#fff6b0', '#ffffff', 20, 12, 140, 0, 550),
    flash(580, '#ffffff', 300),
    { kind: 'impact', at: 'user', color: '#ffffff', size: 640, star: true, delay: 600 },
    { kind: 'impact', at: 'user', color: '#ff8c3a', size: 480, star: true, delay: 660 },
    pt('user', 'flame', 'rise', '#ff8c3a', '#fff6dc', 26, 30, 120, 620, 800),
    ring('user', 620, '#ffb347', 5, 700, 750),
    { kind: 'rays', at: 'user', color: '#ffd27f', size: 640, delay: 640, dur: 800 },
    pt('user', 'rock', 'burst', '#8a6d47', '#c9a35a', 26, 16, 320, 650, 750),
    pt('user', 'flame', 'burst', '#ff5a1a', '#ffd23f', 30, 22, 260, 640, 700),
    hit(760, '#ffb347', 300),
    { kind: 'crack', color: '#5a3a1a', delay: 780 },
    pt('user', 'wisp', 'rise', '#5a4a46', '#8a7a74', 18, 30, 180, 900, 700),
  ] },
  // Self-Destruct: a smaller blast, the user flaring orange and bursting in a ring of fire and sparks.
  selfdestruct: { shake: 'strong', layers: [
    { kind: 'aura', at: 'user', color: '#ff8c3a', size: 220, dur: 550 },
    pt('user', 'spark', 'converge', '#ffd27f', '#ffffff', 16, 10, 120, 0, 500),
    flash(560, '#fff0c0', 240),
    { kind: 'impact', at: 'user', color: '#ffd27f', size: 520, star: true, delay: 580 },
    ring('user', 590, '#ff8c3a', 4, 560, 650),
    pt('user', 'spark', 'burst', '#ffd23f', '#ffffff', 26, 14, 260, 600, 650),
    pt('user', 'flame', 'burst', '#ff7a1a', '#ffd23f', 20, 18, 200, 600, 600),
    hit(700, '#ff8c3a', 240),
    pt('user', 'wisp', 'rise', '#6a5a56', '#9a8a84', 12, 26, 140, 850, 600),
  ] },
  // V-create: a blazing V of fire forms on the user's brow, it charges in wreathed in fire and slashes a fiery V into
  // the target, which erupts in flame.
  vcreate: { shake: 'strong', layers: [
    pt('user', 'flame', 'converge', '#ff3a1a', '#ffd23f', 26, 18, 160, 0, 550),
    { kind: 'aura', at: 'user', color: '#ff3a1a', size: 300, delay: 100, dur: 600 },
    { kind: 'gust', color: '#ff7a2a', count: 14, delay: 450, dur: 260, leaves: false },
    speed(560, '#ffd27f'),
    { kind: 'slash', color: '#ff5a1a', count: 2, angle: 62, width: 16, cross: true, delay: 640 },
    hit(650, '#fff0c0', 380),
    { kind: 'column', color: '#ff3a1a', color2: '#ffd23f', delay: 680 },
    ring('target', 680, '#ff7a1a', 3, 360),
    pt('target', 'flame', 'burst', '#ff3a1a', '#ffd23f', 30, 22, 240, 690, 650),
    { kind: 'rays', at: 'target', color: '#ff8c3a', size: 420, delay: 690, dur: 600 },
  ] },
  // ---- 160-150 power ----
  // Prismatic Laser: light splits into every colour around the user, then a laser of rainbow light blasts the target.
  prismaticlaser: { shake: 'strong', layers: [
    { kind: 'rings', at: 'user', color: '#ffffff', count: 4, size: 260, rainbow: true, dur: 700 },
    pt('user', 'gem', 'converge', '#ff8ac0', '#8ae0ff', 24, 12, 170, 0, 600),
    dim(300, 1100),
    { kind: 'beam', color: '#ff6ab0', color2: '#ffd0e4', width: 70, delay: 520, dur: 820 },
    { kind: 'beam', color: '#ffe066', color2: '#fffbe0', width: 46, delay: 560, dur: 780 },
    { kind: 'beam', color: '#6ad8ff', color2: '#ffffff', width: 22, delay: 600, dur: 740 },
    { kind: 'rings', at: 'path', color: '#ffffff', count: 6, size: 80, rainbow: true, delay: 560, dur: 650 },
    hit(860, '#ffffff', 420),
    { kind: 'rays', at: 'target', color: '#ffd0e4', size: 480, delay: 870, dur: 650 },
    { kind: 'rings', at: 'target', color: '#ffffff', count: 3, size: 380, rainbow: true, delay: 880, dur: 600 },
  ] },
  // Blast Burn: the user's fire gathers into a roaring fireball that hits in a huge explosion, scorching the ground.
  blastburn: { shake: 'strong', layers: [
    pt('user', 'flame', 'converge', '#ff5a1a', '#ffd23f', 28, 18, 170, 0, 600),
    { kind: 'aura', at: 'user', color: '#ff5a1a', size: 300, delay: 100, dur: 600 },
    { kind: 'orb', color: '#ff5a1a', color2: '#ffd23f', size: 110, shape: 'flame', delay: 560, dur: 320 },
    flash(870, '#fff0c0', 220),
    hit(880, '#fff6c0', 520),
    hit(930, '#ff5a1a', 400),
    { kind: 'column', color: '#ff3a1a', color2: '#ffd23f', delay: 890 },
    ring('target', 890, '#ff7a1a', 4, 460, 650),
    pt('target', 'flame', 'burst', '#ff3a1a', '#ffd23f', 36, 24, 280, 900, 700),
    { kind: 'ground', color: '#ff5a1a', delay: 900, dur: 600 },
    { kind: 'crack', color: '#5a2a10', delay: 910 },
  ] },
  // Eruption: the user erupts like a volcano, flinging blazing rocks that rain down on the target.
  eruption: { shake: 'strong', layers: [
    pt('user', 'flame', 'rise', '#ff5a1a', '#ffd23f', 30, 22, 120, 0, 700),
    { kind: 'aura', at: 'user', color: '#ff3a00', size: 280, dur: 700 },
    pt('user', 'rock', 'rise', '#5a2a10', '#ff7a1a', 14, 16, 110, 150, 600),
    { kind: 'meteor', shape: 'rock', color: '#ff5a1a', color2: '#ffd23f', size: 90, delay: 600, dur: 420 },
    { kind: 'meteor', shape: 'rock', color: '#ff7a1a', color2: '#ffd23f', size: 70, delay: 760, dur: 420 },
    { kind: 'meteor', shape: 'rock', color: '#ff3a1a', color2: '#ffd23f', size: 110, delay: 900, dur: 420 },
    hit(1020, '#ff7a1a', 260), hit(1180, '#ff5a1a', 300), hit(1320, '#ffd23f', 380),
    { kind: 'ground', color: '#ff5a1a', delay: 1000, dur: 500 },
    pt('target', 'flame', 'burst', '#ff5a1a', '#ffd23f', 24, 20, 200, 1320, 500),
    { kind: 'crack', color: '#5a2a10', delay: 1330 },
  ] },
  // Focus Punch: the user calms, focus gathering inward in quiet rings, then strikes with everything at once.
  focuspunch: { shake: 'strong', layers: [
    pt('user', 'dot', 'converge', '#ffffff', '#ffd2b0', 22, 10, 160, 0, 650),
    { kind: 'aura', at: 'user', color: '#ffe0c0', size: 220, delay: 100, dur: 550 },
    ring('user', 200, '#ffd2b0', 2, 160, 400),
    speed(520),
    hit(600, '#ffffff', 480),
    hit(650, '#e0503a', 360),
    ring('target', 610, '#e0503a', 4, 420, 600),
    { kind: 'rays', at: 'target', color: '#ffd2b0', size: 460, delay: 620, dur: 600 },
    { kind: 'crack', color: '#7a5a2a', delay: 630 },
    flash(600, '#ffffff', 160),
  ] },
  // Frenzy Plant: giant roots burst from the ground under the target, one after another, throwing up earth and leaves.
  frenzyplant: { shake: 'strong', layers: [
    pt('user', 'leaf', 'converge', '#5fb83a', '#c8f08a', 22, 14, 160, 0, 600),
    { kind: 'ground', color: '#4a8a2a', delay: 450, dur: 700 },
    { kind: 'crack', color: '#3a6a1a', delay: 650 },
    { kind: 'column', color: '#6a4a2a', color2: '#5fb83a', delay: 700 },
    hit(720, '#9ad86a', 300),
    { kind: 'column', color: '#4a8a2a', color2: '#c8f08a', delay: 900 },
    hit(920, '#c8f08a', 380),
    pt('target', 'rock', 'spray', '#6a4a2a', '#a07a4a', 14, 14, 140, 720, 600),
    pt('target', 'leaf', 'burst', '#5fb83a', '#c8f08a', 26, 16, 240, 920, 650),
    ring('target', 930, '#5fb83a', 3, 360),
  ] },
  // Giga Impact: the user's whole body blazes with a dark violet aura and it slams into the target with everything.
  gigaimpact: { shake: 'strong', layers: [
    { kind: 'aura', at: 'user', color: '#5a2aa0', size: 320, dur: 700 },
    pt('user', 'spark', 'converge', '#c9a0ff', '#ffffff', 22, 12, 160, 0, 600),
    { kind: 'gust', color: '#c9a0ff', count: 16, delay: 460, dur: 240, leaves: false },
    speed(540, '#e0c8ff'),
    flash(640),
    hit(645, '#ffffff', 560),
    hit(700, '#8a4ae0', 420),
    ring('target', 650, '#8a4ae0', 4, 480, 650),
    { kind: 'rays', at: 'target', color: '#c9a0ff', size: 520, delay: 660, dur: 650 },
    { kind: 'crack', color: '#3a2a5a', delay: 670 },
    pt('target', 'rock', 'burst', '#6a5a8a', '#c9a0ff', 18, 14, 240, 680, 600),
  ] },
  // Head Smash: the user hardens into rock and rams the target headfirst; rocks burst everywhere, and it takes a jolt
  // itself.
  headsmash: { shake: 'strong', layers: [
    { kind: 'aura', at: 'user', color: '#b8a038', size: 280, dur: 650 },
    pt('user', 'rock', 'converge', '#8a7030', '#e8d898', 18, 14, 150, 0, 550),
    speed(540, '#e8d898'),
    hit(645, '#ffffff', 520),
    hit(700, '#b8a038', 380),
    ring('target', 650, '#b8a038', 3, 420),
    pt('target', 'rock', 'burst', '#8a7030', '#e8d898', 30, 18, 280, 660, 650),
    { kind: 'crack', color: '#5a4a1a', delay: 670 },
    { kind: 'impact', at: 'user', color: '#e8d898', size: 160, delay: 900 },
  ] },
  // Hydro Cannon: a torrent of water gathers into a huge cannonball of water that bursts on the target in a geyser.
  hydrocannon: { shake: 'strong', layers: [
    pt('user', 'drop', 'converge', '#3b7cff', '#cfe8ff', 26, 14, 170, 0, 600),
    { kind: 'vortex', at: 'user', color: '#3b7cff', color2: '#cfe8ff', size: 200, delay: 100, dur: 600 },
    { kind: 'orb', color: '#2a6ae0', color2: '#cfe8ff', size: 120, shape: 'bubble', delay: 560, dur: 320 },
    hit(880, '#ffffff', 480),
    { kind: 'column', color: '#3b7cff', color2: '#cfe8ff', delay: 890 },
    ring('target', 890, '#5aa2ff', 4, 440),
    pt('target', 'drop', 'spray', '#3b7cff', '#ffffff', 36, 18, 240, 900, 700),
    pt('target', 'bubble', 'burst', '#5aa2ff', '#ffffff', 16, 16, 200, 920, 600),
  ] },
  // Hyper Beam: energy gathers at the user and is fired as a massive beam that bursts on the target.
  hyperbeam: { shake: 'strong', layers: [
    pt('user', 'dot', 'converge', '#ffb347', '#fff6b0', 24, 12, 170, 0, 600),
    { kind: 'aura', at: 'user', color: '#ffb347', size: 260, delay: 100, dur: 550 },
    dim(350, 1000),
    { kind: 'beam', color: '#ff8c3a', color2: '#fff0c0', width: 74, wavy: true, delay: 520, dur: 820 },
    { kind: 'beam', color: '#ffe066', color2: '#ffffff', width: 30, delay: 560, dur: 780 },
    hit(860, '#ffffff', 460),
    { kind: 'rays', at: 'target', color: '#ffd27f', size: 480, delay: 870, dur: 650 },
    ring('target', 880, '#ff8c3a', 3, 400),
    flash(860, '#fff0c0'),
  ] },
  // Mind Blown: the user's head explodes in flame, and the blast is hurled at the target and explodes again.
  mindblown: { shake: 'strong', layers: [
    { kind: 'aura', at: 'user', color: '#ffb347', size: 220, dur: 400 },
    { kind: 'impact', at: 'user', color: '#fff6c0', size: 360, star: true, delay: 380 },
    pt('user', 'flame', 'burst', '#ff5a1a', '#ffd23f', 24, 18, 200, 390, 550),
    ring('user', 400, '#ff8c3a', 3, 320),
    { kind: 'orb', color: '#ff5a1a', color2: '#ffd23f', size: 100, shape: 'flame', delay: 560, dur: 320 },
    flash(880, '#fff0c0'),
    hit(880, '#ffffff', 500),
    hit(930, '#ff5a1a', 380),
    pt('target', 'flame', 'burst', '#ff3a1a', '#ffd23f', 30, 22, 260, 890, 650),
    ring('target', 890, '#ff7a1a', 4, 440),
  ] },
  // Roar of Time: a roar that distorts time itself: the stage darkens and ripples in blue, and waves of time crash
  // into the target.
  roaroftime: { shake: 'strong', layers: [
    tint(0, '#2a3a8a', 1300),
    ring('user', 100, '#6ac8ff', 4, 300, 600),
    { kind: 'vortex', at: 'target', color: '#2a4ad0', color2: '#9ae0ff', size: 300, delay: 300, dur: 1000 },
    { kind: 'beam', color: '#3a6ae0', color2: '#c0f0ff', width: 60, wavy: true, delay: 520, dur: 820 },
    ring('path', 540, '#9ae0ff', 7, 90, 650),
    hit(860, '#c0f0ff', 460),
    { kind: 'rays', at: 'target', color: '#9ae0ff', size: 500, delay: 880, dur: 600 },
    ring('target', 880, '#6ac8ff', 4, 440),
    pt('target', 'gem', 'burst', '#6ac8ff', '#ffffff', 22, 14, 240, 890, 600),
  ] },
  // Rock Wrecker: a gigantic boulder is hurled at the target and smashes into pieces.
  rockwrecker: { shake: 'strong', layers: [
    pt('user', 'rock', 'converge', '#8a7030', '#e8d898', 22, 16, 160, 0, 600),
    { kind: 'orb', color: '#9a8040', color2: '#e8d898', size: 140, shape: 'rock', arc: true, delay: 560, dur: 380 },
    hit(940, '#ffffff', 480),
    hit(990, '#b8a038', 380),
    pt('target', 'rock', 'burst', '#8a7030', '#e8d898', 34, 20, 280, 950, 700),
    ring('target', 950, '#b8a038', 3, 420),
    { kind: 'crack', color: '#5a4a1a', delay: 960 },
  ] },
  // Shell Trap: the user's shell explodes in a trap of fire, which bursts up under the target.
  shelltrap: { shake: 'strong', layers: [
    { kind: 'impact', at: 'user', color: '#ffd27f', size: 380, star: true, delay: 100 },
    ring('user', 110, '#ff7a1a', 3, 360),
    pt('user', 'flame', 'burst', '#ff5a1a', '#ffd23f', 26, 20, 220, 120, 550),
    pt('user', 'rock', 'burst', '#7a5a3a', '#c9a35a', 10, 12, 180, 120, 500),
    { kind: 'ground', color: '#ff5a1a', delay: 450, dur: 500 },
    { kind: 'column', color: '#ff3a1a', color2: '#ffd23f', delay: 720 },
    hit(740, '#fff6c0', 420),
    pt('target', 'flame', 'burst', '#ff5a1a', '#ffd23f', 28, 22, 240, 750, 600),
    ring('target', 750, '#ff7a1a', 3, 380),
  ] },
  // Water Spout: water shoots up from the user in a huge spout and comes crashing down on the target.
  waterspout: { shake: 'strong', layers: [
    pt('user', 'drop', 'rise', '#3b7cff', '#cfe8ff', 36, 18, 130, 0, 700),
    { kind: 'pillar', at: 'user', color: '#3b7cff', color2: '#cfe8ff', width: 130, delay: 100, dur: 600 },
    pt('target', 'drop', 'fall', '#3b7cff', '#cfe8ff', 40, 18, 160, 650, 650),
    { kind: 'pillar', at: 'target', color: '#2a6ae0', color2: '#cfe8ff', width: 170, delay: 760, dur: 650 },
    hit(900, '#ffffff', 440),
    ring('target', 910, '#5aa2ff', 4, 440),
    pt('target', 'drop', 'spray', '#3b7cff', '#ffffff', 30, 16, 240, 920, 600),
  ] },
  // ---- 140 power ----
  // Boomburst: a terrible explosion of sound: shockwaves blast out from the user, across the stage and through the target.
  boomburst: { shake: 'strong', layers: [
    ring('user', 0, '#ffffff', 2, 200, 400),
    flash(350, '#ffffff', 160),
    ring('user', 360, '#e8e8e8', 5, 600, 650),
    ring('path', 380, '#ffffff', 8, 110, 600),
    hit(700, '#ffffff', 420),
    ring('target', 710, '#e8e8e8', 4, 480, 600),
    pt('target', 'star', 'burst', '#ffffff', '#e8e8e8', 18, 12, 240, 720, 550),
  ] },
  // Doom Desire: steel light gathers into a sphere that rises away, to strike two turns later (DOOM_DESIRE_HIT).
  doomdesire: { layers: [
    pt('user', 'gem', 'converge', '#e8eef8', '#ffffff', 26, 12, 170, 0, 600),
    { kind: 'rays', at: 'user', color: '#e8eef8', size: 300, delay: 200, dur: 700 },
    { kind: 'aura', at: 'user', color: '#c8d0e8', size: 260, delay: 300, dur: 600 },
    pt('user', 'star', 'rise', '#ffffff', '#c8d0e8', 18, 14, 90, 650, 600),
    { kind: 'pillar', at: 'user', color: '#c8d0e8', color2: '#ffffff', width: 90, delay: 650, dur: 600 },
  ] },
  // Freeze Shock: a charged block of ice, crackling with electricity, is driven into the target.
  freezeshock: { shake: 'strong', layers: [
    { kind: 'aura', at: 'user', color: '#9fe8ff', size: 260, dur: 550 },
    pt('user', 'spark', 'converge', '#ffe14a', '#9fe8ff', 18, 12, 140, 0, 500),
    speed(460, '#e8fbff'),
    hit(560, '#c9f6ff', 440),
    { kind: 'bolt', color: '#9fe8ff', delay: 560 },
    pt('target', 'shard', 'burst', '#9fe8ff', '#ffffff', 26, 18, 240, 570, 600),
    pt('target', 'spark', 'burst', '#ffe14a', '#ffffff', 18, 12, 200, 580, 500),
    ring('target', 580, '#9fe8ff', 3, 380),
    { kind: 'crack', color: '#9fe8ff', delay: 590 },
  ] },
  // Ice Burn: freezing blue fire engulfs the target.
  iceburn: { shake: 'strong', layers: [
    pt('user', 'flame', 'converge', '#9fe8ff', '#ffffff', 22, 16, 150, 0, 550),
    { kind: 'orb', color: '#5ac8ff', color2: '#ffffff', size: 90, shape: 'flame', delay: 480, dur: 320 },
    hit(780, '#e8fbff', 420),
    { kind: 'column', color: '#5ac8ff', color2: '#ffffff', delay: 790 },
    pt('target', 'flame', 'rise', '#5ac8ff', '#e8fbff', 30, 22, 160, 790, 600),
    pt('target', 'shard', 'burst', '#9fe8ff', '#ffffff', 18, 14, 220, 800, 550),
    ring('target', 800, '#9fe8ff', 3, 380),
  ] },
  // Last Resort: the user throws everything it has left: a stream of every move's light, then a huge star burst.
  lastresort: { shake: 'strong', layers: [
    { kind: 'orb', color: '#ff7a7a', size: 40, shape: 'star', count: 1, delay: 150, dur: 380 },
    { kind: 'orb', color: '#7ab0ff', size: 40, shape: 'star', count: 1, delay: 260, dur: 380 },
    { kind: 'orb', color: '#7adf7a', size: 40, shape: 'star', count: 1, delay: 370, dur: 380 },
    { kind: 'orb', color: '#ffe066', size: 40, shape: 'star', count: 1, delay: 480, dur: 380 },
    hit(560, '#ffffff', 460),
    { kind: 'rings', at: 'target', color: '#ffffff', count: 3, size: 400, rainbow: true, delay: 570, dur: 600 },
    pt('target', 'star', 'burst', '#ffffff', '#ffe066', 26, 14, 260, 580, 600),
    { kind: 'rays', at: 'target', color: '#ffffff', size: 440, delay: 580, dur: 550 },
  ] },
  // Light of Ruin: the Eternal Flower's power: a blinding beam of pink light, petals swirling, that tears into the
  // target; the user is hurt by the power it unleashed.
  lightofruin: { shake: 'strong', layers: [
    pt('user', 'heart', 'converge', '#ff8ac0', '#ffffff', 18, 14, 160, 0, 600),
    { kind: 'rays', at: 'user', color: '#ffd0e4', size: 320, delay: 150, dur: 500 },
    dim(300, 1000),
    { kind: 'beam', color: '#ff6ab0', color2: '#ffffff', width: 66, delay: 520, dur: 820 },
    { kind: 'beam', color: '#ffd0e4', color2: '#ffffff', width: 26, delay: 560, dur: 780 },
    pt('target', 'leaf', 'swirl', '#ff8ac0', '#ffd0e4', 20, 14, 140, 600, 700),
    hit(860, '#ffffff', 460),
    { kind: 'rays', at: 'target', color: '#ff8ac0', size: 500, delay: 870, dur: 600 },
    ring('target', 880, '#ff8ac0', 4, 420),
    { kind: 'impact', at: 'user', color: '#ff8ac0', size: 160, delay: 1100 },
  ] },
  // Psycho Boost: a spiral of overwhelming psychic power gathers and is unleashed on the target.
  psychoboost: { shake: 'strong', layers: [
    tint(0, '#ff6ab0', 1200),
    { kind: 'vortex', at: 'user', color: '#f85888', color2: '#ffd0e0', size: 240, dur: 650 },
    pt('user', 'dot', 'converge', '#f85888', '#ffd0e0', 24, 12, 160, 0, 600),
    { kind: 'orb', color: '#f85888', color2: '#ffd0e0', size: 110, delay: 520, dur: 320 },
    hit(840, '#ffffff', 460),
    { kind: 'vortex', at: 'target', color: '#f85888', color2: '#ffd0e0', size: 280, delay: 850, dur: 500 },
    ring('target', 860, '#f85888', 4, 420),
    { kind: 'rays', at: 'target', color: '#ffd0e0', size: 460, delay: 860, dur: 550 },
  ] },
  // Sky Attack: glowing white, the user streaks down from the sky like a comet into the target.
  skyattack: { shake: 'strong', layers: [
    { kind: 'aura', at: 'user', color: '#ffffff', size: 280, dur: 600 },
    pt('user', 'feather', 'rise', '#ffffff', '#cfd8ff', 14, 14, 100, 0, 500),
    { kind: 'gust', color: '#ffffff', count: 16, delay: 440, dur: 260, leaves: false },
    speed(500),
    flash(560, '#ffffff', 160),
    hit(560, '#ffffff', 500),
    hit(610, '#a8c8ff', 380),
    ring('target', 570, '#cfd8ff', 4, 440),
    pt('target', 'feather', 'burst', '#ffffff', '#a8c8ff', 22, 16, 240, 580, 650),
  ] },
  // Steel Beam: the user fires a huge beam of steel from its body (and takes damage from the effort).
  steelbeam: { shake: 'strong', layers: [
    pt('user', 'gem', 'converge', '#c8d0e8', '#ffffff', 22, 12, 160, 0, 550),
    { kind: 'rays', at: 'user', color: '#e8eef8', size: 300, delay: 200, dur: 500 },
    { kind: 'beam', color: '#9aa4c8', color2: '#ffffff', width: 66, delay: 500, dur: 820 },
    { kind: 'beam', color: '#e8eef8', color2: '#ffffff', width: 24, delay: 540, dur: 780 },
    ring('path', 520, '#e8eef8', 6, 80, 600),
    hit(820, '#ffffff', 440),
    pt('target', 'gem', 'burst', '#c8d0e8', '#ffffff', 26, 14, 240, 830, 600),
    ring('target', 840, '#c8d0e8', 3, 400),
    { kind: 'impact', at: 'user', color: '#c8d0e8', size: 160, delay: 1050 },
  ] },
  // ---- 130 power ----
  // Blue Flare: beautiful, intense blue flames surge onto the target.
  blueflare: { shake: 'strong', layers: [
    pt('user', 'flame', 'converge', '#3b8cff', '#cfe8ff', 24, 18, 160, 0, 550),
    { kind: 'orb', color: '#2a6ae0', color2: '#cfe8ff', size: 100, shape: 'flame', delay: 480, dur: 320 },
    hit(780, '#e8f4ff', 440),
    { kind: 'column', color: '#2a6ae0', color2: '#cfe8ff', delay: 790 },
    pt('target', 'flame', 'rise', '#3b8cff', '#cfe8ff', 34, 24, 180, 790, 650),
    ring('target', 800, '#5aa2ff', 3, 400),
    { kind: 'rays', at: 'target', color: '#9ac8ff', size: 440, delay: 800, dur: 550 },
  ] },
  // Bolt Strike: cloaked in a huge amount of electricity, the user charges into the target.
  boltstrike: { shake: 'strong', layers: [
    { kind: 'aura', at: 'user', color: '#ffd23f', size: 280, dur: 600 },
    pt('user', 'spark', 'burst', '#ffe14a', '#ffffff', 16, 12, 120, 0, 500),
    { kind: 'gust', color: '#ffe14a', count: 14, delay: 420, dur: 240, leaves: false },
    speed(480, '#fff6b0'),
    { kind: 'bolt', color: '#ffe14a', delay: 540 },
    hit(560, '#ffffff', 460),
    hit(610, '#ffd23f', 360),
    pt('target', 'spark', 'burst', '#ffe14a', '#ffffff', 28, 14, 240, 570, 600),
    ring('target', 580, '#ffd23f', 3, 400),
  ] },
  // Burn Up: the user burns itself out: every flame it has bursts out at the target, leaving it smoking.
  burnup: { shake: 'strong', layers: [
    pt('user', 'flame', 'burst', '#ff5a1a', '#ffd23f', 30, 22, 200, 0, 600),
    { kind: 'aura', at: 'user', color: '#ff3a00', size: 320, dur: 600 },
    { kind: 'orb', color: '#ff5a1a', color2: '#ffd23f', size: 110, shape: 'flame', delay: 460, dur: 300 },
    hit(760, '#fff6c0', 460),
    { kind: 'column', color: '#ff3a1a', color2: '#ffd23f', delay: 770 },
    pt('target', 'flame', 'burst', '#ff3a1a', '#ffd23f', 30, 22, 240, 780, 600),
    pt('user', 'wisp', 'rise', '#5a4a46', '#8a7a74', 12, 24, 100, 900, 500),
  ] },
  // Draco Meteor: comets called down from the sky rain onto the target one after another.
  dracometeor: { shake: 'strong', layers: [
    { kind: 'orb', color: '#6a3cf0', color2: '#c6b0ff', size: 60, delay: 0, dur: 300 },
    pt('user', 'dot', 'rise', '#6a3cf0', '#c6b0ff', 14, 12, 80, 0, 400),
    dim(200, 1100, '#100830'),
    { kind: 'meteor', shape: 'rock', color: '#ff7a3a', color2: '#ffd27f', size: 80, delay: 400, dur: 420 },
    { kind: 'meteor', shape: 'rock', color: '#8a5af0', color2: '#ffd27f', size: 100, delay: 560, dur: 420 },
    { kind: 'meteor', shape: 'rock', color: '#ff5a3a', color2: '#ffd27f', size: 120, delay: 720, dur: 420 },
    hit(820, '#ffd27f', 280), hit(980, '#c6b0ff', 340), hit(1140, '#ffffff', 420),
    ring('target', 1140, '#8a5af0', 4, 440),
    pt('target', 'rock', 'burst', '#6a3cf0', '#ffd27f', 24, 16, 240, 1150, 550),
    { kind: 'crack', color: '#3a2a6a', delay: 1150 },
  ] },
  // Fleur Cannon: a strong beam of flower power, petals bursting where it hits.
  fleurcannon: { shake: 'strong', layers: [
    pt('user', 'heart', 'converge', '#ff8ac0', '#ffd0e4', 18, 12, 150, 0, 550),
    { kind: 'beam', color: '#ff8ac0', color2: '#ffffff', width: 60, delay: 480, dur: 780 },
    pt('target', 'leaf', 'swirl', '#ff8ac0', '#ffd0e4', 16, 14, 120, 520, 650),
    ring('path', 500, '#ffd0e4', 6, 80, 600),
    hit(780, '#ffffff', 440),
    pt('target', 'leaf', 'burst', '#ff8ac0', '#ffd0e4', 30, 16, 260, 790, 650),
    pt('target', 'heart', 'burst', '#ff8ac0', '#ffffff', 12, 14, 200, 800, 600),
    ring('target', 800, '#ff8ac0', 3, 400),
  ] },
  // High Jump Kick: the user leaps high and comes down knee-first on the target.
  highjumpkick: { shake: 'strong', layers: [
    pt('user', 'dot', 'spray', '#e8d8a8', '#ffffff', 10, 10, 80, 150, 400),
    speed(460),
    hit(560, '#ffffff', 480),
    hit(610, '#e0503a', 360),
    ring('target', 570, '#e0503a', 3, 400),
    { kind: 'crack', color: '#7a5a2a', delay: 580 },
    pt('target', 'rock', 'spray', '#8a6d47', '#c9a35a', 14, 12, 160, 580, 500),
  ] },
  // Leaf Storm: a storm of sharp leaves whirls onto the target.
  leafstorm: { shake: 'light', layers: [
    pt('user', 'leaf', 'swirl', '#5fb83a', '#c8f08a', 18, 14, 110, 0, 550),
    { kind: 'gust', color: '#c8f08a', count: 14, delay: 380, dur: 500 },
    { kind: 'vortex', at: 'target', color: '#4a8a2a', color2: '#c8f08a', size: 280, delay: 520, dur: 700 },
    pt('target', 'leaf', 'swirl', '#5fb83a', '#c8f08a', 34, 16, 160, 540, 700),
    hit(800, '#c8f08a', 360),
    pt('target', 'leaf', 'burst', '#5fb83a', '#c8f08a', 24, 14, 240, 820, 500),
  ] },
  // Overheat: at full power, the user's heat bursts out as a searing wave onto the target.
  overheat: { shake: 'strong', layers: [
    tint(0, '#ff8c3a', 1200),
    { kind: 'aura', at: 'user', color: '#fff0c0', size: 300, dur: 600 },
    pt('user', 'flame', 'rise', '#ff5a1a', '#fff0c0', 26, 20, 140, 0, 600),
    { kind: 'beam', color: '#ff5a1a', color2: '#fff0c0', width: 64, wavy: true, delay: 480, dur: 780 },
    hit(780, '#fff6c0', 460),
    { kind: 'column', color: '#ff5a1a', color2: '#fff0c0', delay: 790 },
    { kind: 'rays', at: 'target', color: '#ffb347', size: 460, delay: 800, dur: 550 },
    pt('target', 'flame', 'burst', '#ff5a1a', '#ffd23f', 26, 20, 240, 800, 550),
  ] },
  // Skull Bash: head lowered, the user rams the target with tremendous force.
  skullbash: { shake: 'strong', layers: [
    { kind: 'aura', at: 'user', color: '#e8e8e8', size: 240, dur: 550 },
    speed(460),
    hit(560, '#ffffff', 480),
    ring('target', 570, '#e8e8e8', 4, 420),
    pt('target', 'star', 'burst', '#ffffff', '#e8e8e8', 22, 14, 220, 580, 550),
    { kind: 'crack', color: '#6a6a6a', delay: 580 },
  ] },
  // Steel Roller: the user rolls over the target at full speed, tearing up the ground (and any terrain).
  steelroller: { shake: 'strong', layers: [
    { kind: 'gust', color: '#c8d0e8', count: 14, delay: 300, dur: 300, leaves: false },
    { kind: 'ground', color: '#8a8aa0', delay: 350, dur: 600 },
    hit(560, '#ffffff', 460),
    hit(610, '#c8d0e8', 360),
    pt('target', 'rock', 'spray', '#8a8aa0', '#c8d0e8', 20, 14, 200, 570, 550),
    pt('target', 'spark', 'burst', '#ffffff', '#c8d0e8', 18, 12, 200, 580, 500),
    { kind: 'crack', color: '#4a4a5a', delay: 590 },
  ] },
  // ---- 125-120 power ----
  // Solar Blade: the gathered sunlight becomes a blade of light that cuts through the target.
  solarblade: { shake: 'strong', layers: [
    { kind: 'aura', at: 'user', color: '#ffd84a', size: 260, dur: 550 },
    pt('user', 'dot', 'converge', '#ffe066', '#fffbe0', 18, 10, 140, 0, 500),
    speed(460, '#fff6c0'),
    { kind: 'slash', color: '#fff3a0', count: 1, angle: -35, width: 22, delay: 540 },
    { kind: 'slash', color: '#ffffff', count: 1, angle: -35, width: 8, delay: 560 },
    hit(570, '#fffbe0', 420),
    { kind: 'rays', at: 'target', color: '#fff3a0', size: 440, delay: 580, dur: 550 },
    pt('target', 'leaf', 'burst', '#7ac74c', '#c8f08a', 16, 14, 200, 590, 550),
  ] },
  // Belch: a great cloud of foul gas belched at the target.
  belch: { layers: [
    pt('user', 'wisp', 'converge', '#a040a0', '#9ad86a', 14, 18, 120, 0, 450),
    { kind: 'orb', color: '#8a3a8a', color2: '#b8e06a', size: 100, shape: 'wisp', delay: 420, dur: 360 },
    hit(760, '#c080c0', 360, false),
    pt('target', 'wisp', 'burst', '#a040a0', '#9ad86a', 26, 26, 220, 770, 650),
    pt('target', 'bubble', 'rise', '#a040a0', '#e0a0e0', 14, 14, 140, 790, 600),
  ] },
  // Brave Bird: wings tucked, the user dives into the target wreathed in blue fire, and is hurt by the impact too.
  bravebird: { shake: 'strong', layers: [
    { kind: 'aura', at: 'user', color: '#5aa2ff', size: 260, dur: 520 },
    pt('user', 'feather', 'rise', '#9ac8ff', '#ffffff', 12, 14, 100, 0, 450),
    { kind: 'gust', color: '#9ac8ff', count: 14, delay: 400, dur: 220, leaves: false },
    speed(450, '#cfe8ff'),
    hit(520, '#ffffff', 440),
    hit(570, '#5aa2ff', 340),
    pt('target', 'feather', 'burst', '#9ac8ff', '#ffffff', 22, 16, 230, 530, 600),
    ring('target', 540, '#5aa2ff', 3, 380),
    { kind: 'impact', at: 'user', color: '#9ac8ff', size: 140, delay: 800 },
  ] },
  // Close Combat: the user lets loose a flurry of close-range blows, then one big one.
  closecombat: { shake: 'strong', layers: [
    speed(380),
    ...[480, 540, 600, 660, 720].map((delay, n): Layer => ({ kind: 'impact', color: n % 2 ? '#ffffff' : '#ffb08a', size: 150 + n * 25, star: true, delay })),
    hit(800, '#ffffff', 440),
    ring('target', 810, '#e0503a', 3, 400),
    pt('target', 'star', 'burst', '#ffd2b0', '#ffffff', 22, 12, 220, 820, 500),
  ] },
  // Double-Edge: a reckless, life-risking tackle; the user is hurt by the impact too.
  doubleedge: { shake: 'strong', layers: [
    { kind: 'aura', at: 'user', color: '#ffffff', size: 240, dur: 500 },
    speed(440),
    hit(520, '#ffffff', 460),
    ring('target', 530, '#e8e8e8', 3, 400),
    pt('target', 'star', 'burst', '#ffffff', '#e8e8e8', 18, 12, 200, 540, 500),
    { kind: 'impact', at: 'user', color: '#e8e8e8', size: 160, delay: 760 },
  ] },
  // Dragon Ascent: the user soars into the sky and plummets back down in a streak of green light.
  dragonascent: { shake: 'strong', layers: [
    pt('user', 'scale', 'rise', '#5fd88a', '#c8ffd8', 16, 14, 110, 0, 500),
    { kind: 'pillar', at: 'user', color: '#5fd88a', color2: '#e8fff0', width: 110, dur: 450 },
    { kind: 'meteor', shape: 'scale', color: '#3fbf6a', color2: '#e8fff0', size: 110, delay: 280, dur: 280 },
    hit(560, '#e8fff0', 460),
    ring('target', 570, '#5fd88a', 4, 420),
    { kind: 'rays', at: 'target', color: '#9af0b8', size: 440, delay: 580, dur: 500 },
    pt('target', 'scale', 'burst', '#5fd88a', '#ffffff', 20, 14, 220, 580, 500),
  ] },
  // Flare Blitz: cloaked in fire, the user charges into the target, which bursts into flame; the user is hurt too.
  flareblitz: { shake: 'strong', layers: [
    { kind: 'aura', at: 'user', color: '#ff5a1a', size: 280, dur: 520 },
    pt('user', 'flame', 'rise', '#ff5a1a', '#ffd23f', 22, 18, 120, 0, 500),
    { kind: 'gust', color: '#ff7a2a', count: 14, delay: 400, dur: 220, leaves: false },
    speed(450, '#ffd27f'),
    hit(520, '#fff6c0', 440),
    { kind: 'column', color: '#ff3a1a', color2: '#ffd23f', delay: 530 },
    pt('target', 'flame', 'burst', '#ff5a1a', '#ffd23f', 26, 20, 230, 540, 550),
    { kind: 'impact', at: 'user', color: '#ff8c3a', size: 150, delay: 800 },
  ] },
  // Focus Blast: the user gathers its focus into a ball of energy and hurls it.
  focusblast: { shake: 'strong', layers: [
    pt('user', 'dot', 'converge', '#ffb08a', '#ffffff', 22, 12, 150, 0, 500),
    { kind: 'orb', color: '#e0503a', color2: '#ffe0c0', size: 100, delay: 420, dur: 340 },
    hit(760, '#ffffff', 440),
    hit(800, '#e0503a', 340),
    ring('target', 770, '#ffb08a', 3, 400),
    { kind: 'rays', at: 'target', color: '#ffd2b0', size: 420, delay: 780, dur: 500 },
  ] },
  // Future Sight: the user's psychic power rises away into the future, to strike two turns later (FUTURE_SIGHT_HIT).
  futuresight: { layers: [
    pt('user', 'dot', 'converge', '#f85888', '#ffd0e0', 22, 10, 160, 0, 500),
    { kind: 'aura', at: 'user', color: '#f85888', size: 240, delay: 150, dur: 500 },
    ring('user', 300, '#ffd0e0', 3, 260),
    pt('user', 'gem', 'rise', '#f85888', '#ffffff', 18, 12, 90, 550, 600),
    { kind: 'pillar', at: 'user', color: '#f85888', color2: '#ffd0e0', width: 80, delay: 550, dur: 550 },
  ] },
  // Glaive Rush: the user rushes in recklessly, its body a glaive of dragon energy.
  glaiverush: { shake: 'strong', layers: [
    { kind: 'aura', at: 'user', color: '#6a3cf0', size: 260, dur: 500 },
    { kind: 'gust', color: '#c6b0ff', count: 14, delay: 380, dur: 240, leaves: false },
    speed(440, '#c6b0ff'),
    { kind: 'slash', color: '#8a5af0', count: 1, angle: 20, width: 20, delay: 510 },
    hit(520, '#ffffff', 440),
    ring('target', 530, '#8a5af0', 3, 400),
    pt('target', 'scale', 'burst', '#6a3cf0', '#c6b0ff', 18, 14, 220, 540, 500),
  ] },
  // Gunk Shot: a heap of filthy garbage is flung at the target and splatters everywhere.
  gunkshot: { layers: [
    { kind: 'orb', color: '#6a3a5a', color2: '#a040a0', size: 90, shape: 'blob', arc: true, delay: 300, dur: 420 },
    hit(720, '#a040a0', 380, false),
    pt('target', 'drop', 'burst', '#a040a0', '#6a3a5a', 30, 16, 230, 730, 600),
    pt('target', 'blob', 'spray', '#6a3a5a', '#a040a0', 12, 16, 180, 740, 550),
    pt('target', 'wisp', 'rise', '#a040a0', '#9ad86a', 10, 22, 120, 800, 500),
  ] },
  // Head Charge: the user charges headfirst with its huge head of hair, slamming the target.
  headcharge: { shake: 'strong', layers: [
    pt('user', 'dot', 'spray', '#c9a35a', '#e8d8a8', 12, 10, 100, 100, 400),
    speed(440),
    hit(520, '#ffffff', 460),
    ring('target', 530, '#e8e8e8', 3, 400),
    { kind: 'crack', color: '#6a5a3a', delay: 540 },
    pt('target', 'star', 'burst', '#ffffff', '#e8d8a8', 18, 12, 210, 540, 500),
    { kind: 'impact', at: 'user', color: '#e8e8e8', size: 140, delay: 780 },
  ] },
  // Headlong Rush: the user smashes into the target in a full-body tackle, tearing across the ground.
  headlongrush: { shake: 'strong', layers: [
    { kind: 'ground', color: '#c9a35a', delay: 200, dur: 500 },
    { kind: 'gust', color: '#e8d8a8', count: 12, delay: 380, dur: 240, leaves: false },
    speed(440, '#e8d8a8'),
    hit(520, '#ffffff', 460),
    pt('target', 'rock', 'spray', '#8a6d47', '#c9a35a', 22, 14, 220, 530, 550),
    { kind: 'crack', color: '#6a4a2a', delay: 540 },
    ring('target', 540, '#c9a35a', 3, 400),
  ] },
  // Mega Kick: an extremely powerful kick: a huge star of impact.
  megakick: { shake: 'strong', layers: [
    speed(440),
    hit(520, '#ffffff', 500),
    hit(570, '#ffd27f', 380),
    ring('target', 530, '#e8e8e8', 4, 440),
    pt('target', 'star', 'burst', '#ffffff', '#ffd27f', 20, 14, 230, 540, 500),
  ] },
  // Megahorn: the user rams the target with its tough horn, a green spearhead of energy.
  megahorn: { shake: 'strong', layers: [
    { kind: 'aura', at: 'user', color: '#a8b820', size: 240, dur: 500 },
    speed(440, '#e0f080'),
    { kind: 'slash', color: '#a8b820', count: 1, angle: -20, width: 18, delay: 510 },
    hit(520, '#ffffff', 440),
    ring('target', 530, '#a8b820', 3, 380),
    pt('target', 'shard', 'burst', '#a8b820', '#e0f080', 18, 14, 210, 540, 500),
  ] },
  // Meteor Beam: the cosmic power it gathered fires as a beam full of stars.
  meteorbeam: { shake: 'strong', layers: [
    pt('user', 'star', 'converge', '#ffe9b0', '#ffffff', 20, 12, 150, 0, 500),
    { kind: 'beam', color: '#b88a3a', color2: '#ffe9b0', width: 60, delay: 460, dur: 760 },
    pt('user', 'star', 'spray', '#ffe9b0', '#ffffff', 16, 12, 160, 500, 600),
    ring('path', 480, '#ffe9b0', 6, 80, 600),
    hit(760, '#ffffff', 440),
    pt('target', 'star', 'burst', '#ffe9b0', '#ffffff', 24, 14, 240, 770, 550),
    pt('target', 'rock', 'burst', '#b8a038', '#e8d898', 14, 14, 200, 780, 500),
  ] },
  // Outrage: in a rampage, the user lashes out at the target again and again in a red dragon fury.
  outrage: { shake: 'strong', layers: [
    tint(0, '#a01a3a', 1100),
    { kind: 'aura', at: 'user', color: '#d0203a', size: 280, dur: 900 },
    hit(320, '#ff6a6a', 300), hit(560, '#8a5af0', 340), hit(800, '#ff3a3a', 420),
    ring('target', 810, '#d0203a', 3, 400),
    pt('target', 'scale', 'burst', '#8a5af0', '#ff6a6a', 22, 14, 220, 820, 500),
  ] },
  // Petal Dance: the user dances, petals whirling around it and then onto the target.
  petaldance: { layers: [
    pt('user', 'leaf', 'swirl', '#ff8ac0', '#ffd0e4', 26, 14, 120, 0, 700),
    { kind: 'orb', color: '#ff8ac0', size: 26, shape: 'leaf', count: 6, gap: 70, delay: 300, dur: 380 },
    pt('target', 'leaf', 'swirl', '#ff8ac0', '#ffd0e4', 26, 14, 150, 560, 650),
    hit(800, '#ffd0e4', 340),
    pt('target', 'leaf', 'burst', '#ff8ac0', '#ffffff', 20, 12, 220, 820, 500),
  ] },
  // Power Whip: the user's vines whip the target with tremendous force.
  powerwhip: { shake: 'strong', layers: [
    { kind: 'slash', color: '#4a8a2a', count: 2, angle: 30, width: 14, cross: true, delay: 420 },
    { kind: 'slash', color: '#7ac74c', count: 1, angle: -10, width: 18, delay: 560 },
    hit(440, '#c8f08a', 260), hit(580, '#ffffff', 400),
    pt('target', 'leaf', 'burst', '#5fb83a', '#c8f08a', 20, 14, 220, 590, 500),
    ring('target', 590, '#5fb83a', 3, 380),
  ] },
  // Precipice Blades: the power of the ground becomes blades of glowing red rock bursting up under the target.
  precipiceblades: { shake: 'strong', layers: [
    { kind: 'ground', color: '#d0402a', delay: 200, dur: 800 },
    { kind: 'crack', color: '#ff5a2a', delay: 450 },
    { kind: 'column', color: '#8a2a1a', color2: '#ff7a3a', delay: 600 },
    hit(620, '#ff7a3a', 300),
    { kind: 'column', color: '#d0402a', color2: '#ffd27f', delay: 820 },
    hit(840, '#ffffff', 420),
    pt('target', 'rock', 'spray', '#8a2a1a', '#ff7a3a', 26, 16, 240, 640, 650),
    ring('target', 850, '#d0402a', 3, 420),
  ] },
  // Raging Fury: the user rampages, spewing fire at the target again and again.
  ragingfury: { shake: 'strong', layers: [
    tint(0, '#ff5a1a', 1100),
    { kind: 'aura', at: 'user', color: '#ff3a00', size: 280, dur: 900 },
    hit(320, '#ffb347', 300), hit(560, '#ff5a1a', 360), hit(800, '#fff6c0', 420),
    pt('target', 'flame', 'burst', '#ff5a1a', '#ffd23f', 24, 20, 220, 560, 500),
    { kind: 'column', color: '#ff3a1a', color2: '#ffd23f', delay: 810 },
  ] },
  // Seed Flare: a shock wave of light bursts from the user's body, across the ground and onto the target.
  seedflare: { shake: 'strong', layers: [
    pt('user', 'dot', 'converge', '#c8f08a', '#ffffff', 22, 10, 150, 0, 500),
    { kind: 'rays', at: 'user', color: '#e8ffd8', size: 360, delay: 400, dur: 500 },
    ring('user', 420, '#9ad86a', 4, 520, 650),
    { kind: 'ground', color: '#9ad86a', delay: 450, dur: 600 },
    hit(760, '#ffffff', 460),
    { kind: 'column', color: '#5fb83a', color2: '#e8ffd8', delay: 770 },
    pt('target', 'dot', 'burst', '#c8f08a', '#ffffff', 28, 10, 250, 780, 550),
  ] },
  // Shadow Force: the user reappears from the shadows behind the target and strikes in a burst of darkness.
  shadowforce: { shake: 'strong', layers: [
    dim(0, 1100),
    { kind: 'vortex', at: 'target', color: '#2a1838', color2: '#8a5ac8', size: 280, delay: 100, dur: 700 },
    pt('target', 'wisp', 'converge', '#4a2a6a', '#8a5ac8', 18, 22, 150, 150, 450),
    hit(560, '#c9b6ff', 460),
    hit(610, '#6a4ab8', 360),
    pt('target', 'wisp', 'burst', '#4a2a6a', '#c9b6ff', 24, 22, 230, 580, 550),
    ring('target', 590, '#6a4ab8', 3, 400),
  ] },
  // Superpower: power surges through the user's whole body and it hits with all of it (feeling the strain after).
  superpower: { shake: 'strong', layers: [
    { kind: 'aura', at: 'user', color: '#e0503a', size: 320, dur: 550 },
    pt('user', 'dot', 'rise', '#ffb08a', '#ffffff', 18, 10, 110, 0, 500),
    speed(440),
    hit(520, '#ffffff', 500),
    hit(570, '#e0503a', 380),
    ring('target', 530, '#e0503a', 4, 440),
    { kind: 'crack', color: '#7a5a2a', delay: 550 },
    pt('target', 'rock', 'burst', '#8a6d47', '#c9a35a', 16, 14, 220, 550, 500),
  ] },
  // Synchronoise: an odd shock wave that hits anything that shares the user's type: rippling rings.
  synchronoise: { layers: [
    tint(0, '#c080ff', 1000),
    ring('user', 0, '#f85888', 3, 260, 500),
    ring('path', 300, '#c080ff', 7, 100, 600),
    ring('target', 650, '#f85888', 4, 420, 550),
    hit(700, '#ffd0e0', 340, false),
    pt('target', 'dot', 'burst', '#c080ff', '#ffd0e0', 18, 10, 200, 710, 500),
  ] },
  // Techno Blast: the user's drive fires a beam of light from its cannon.
  technoblast: { shake: 'strong', layers: [
    pt('user', 'gem', 'converge', '#9ac8ff', '#ffffff', 18, 12, 140, 0, 500),
    { kind: 'wireframe', at: 'user', color: '#9ac8ff', size: 160, delay: 100, dur: 500 },
    { kind: 'beam', color: '#5a8ae0', color2: '#e8f4ff', width: 54, delay: 460, dur: 760 },
    hit(760, '#ffffff', 440),
    ring('target', 770, '#9ac8ff', 3, 400),
    pt('target', 'spark', 'burst', '#9ac8ff', '#ffffff', 20, 12, 220, 780, 500),
  ] },
  // Thrash: the user rampages, slamming into the target again and again.
  thrash: { shake: 'strong', layers: [
    hit(320, '#ffffff', 300), hit(560, '#e8e8e8', 340), hit(800, '#ffffff', 420),
    ring('target', 810, '#e8e8e8', 3, 380),
    pt('target', 'star', 'burst', '#ffffff', '#e8e8e8', 18, 12, 200, 820, 450),
  ] },
  // Volt Tackle: crackling with electricity, the user charges into the target in a lightning-bright tackle (hurting itself).
  volttackle: { shake: 'strong', layers: [
    { kind: 'aura', at: 'user', color: '#ffd23f', size: 260, dur: 520 },
    pt('user', 'spark', 'burst', '#ffe14a', '#ffffff', 16, 12, 110, 0, 450),
    { kind: 'gust', color: '#ffe14a', count: 14, delay: 400, dur: 220, leaves: false },
    speed(450, '#fff6b0'),
    { kind: 'bolt', color: '#ffe14a', delay: 500 },
    hit(520, '#ffffff', 440),
    pt('target', 'spark', 'burst', '#ffe14a', '#ffffff', 24, 14, 230, 530, 550),
    { kind: 'impact', at: 'user', color: '#ffe14a', size: 150, delay: 800 },
  ] },
  // Wood Hammer: the user slams its rugged body down on the target like a hammer of wood.
  woodhammer: { shake: 'strong', layers: [
    { kind: 'aura', at: 'user', color: '#7a5a2a', size: 240, dur: 500 },
    { kind: 'meteor', shape: 'rock', color: '#7a5a2a', color2: '#c8f08a', size: 110, delay: 260, dur: 260 },
    hit(520, '#ffffff', 460),
    { kind: 'crack', color: '#5a3a1a', delay: 530 },
    pt('target', 'leaf', 'burst', '#5fb83a', '#c8f08a', 16, 14, 210, 540, 500),
    pt('target', 'rock', 'burst', '#7a5a2a', '#a07a4a', 14, 12, 200, 540, 500),
    { kind: 'impact', at: 'user', color: '#a07a4a', size: 140, delay: 780 },
  ] },
  // Zap Cannon: a slow, heavy ball of electricity fired like a cannon, bursting into lightning on the target.
  zapcannon: { shake: 'strong', layers: [
    pt('user', 'spark', 'converge', '#ffe14a', '#ffffff', 22, 12, 150, 0, 500),
    { kind: 'orb', color: '#ffd23f', color2: '#ffffff', size: 110, delay: 420, dur: 420 },
    { kind: 'bolt', color: '#ffe14a', delay: 820 },
    hit(840, '#ffffff', 440),
    pt('target', 'spark', 'burst', '#ffe14a', '#ffffff', 28, 14, 240, 850, 550),
    ring('target', 860, '#ffd23f', 3, 400),
  ] },
  // ---- 110 power ----
  // Blizzard: a howling blizzard sweeps across the stage, snow driving sideways, and buries the target in snow and ice.
  blizzard: { layers: [
    tint(0, '#e8f4ff', 1200),
    { kind: 'gust', color: '#ffffff', count: 24, delay: 150, dur: 650, leaves: false },
    pt('target', 'dot', 'spray', '#ffffff', '#cdf6ff', 34, 9, 200, 250, 750),
    pt('target', 'dot', 'fall', '#ffffff', '#cdf6ff', 30, 8, 180, 200, 800),
    { kind: 'ground', color: '#ffffff', delay: 450, dur: 650 },
    pt('target', 'shard', 'burst', '#cdf6ff', '#ffffff', 22, 16, 200, 700, 550),
    hit(760, '#e8fbff', 380),
    ring('target', 770, '#cdf6ff', 3, 360),
  ] },
  // Clanging Scales: the user rubs its scales together in a huge clanging noise: rings of sound and flying scales.
  clangingscales: { shake: 'strong', layers: [
    pt('user', 'scale', 'burst', '#c6b0ff', '#ffd27f', 18, 14, 150, 0, 500),
    ring('user', 100, '#c6b0ff', 4, 320, 600),
    ring('path', 400, '#ffd27f', 7, 100, 600),
    hit(760, '#ffffff', 420),
    ring('target', 770, '#c6b0ff', 4, 420),
    pt('target', 'scale', 'burst', '#8a5af0', '#ffd27f', 18, 14, 220, 780, 500),
  ] },
  // Fire Blast: an all-consuming blast of fire that bursts on the target in a five-pointed star of flame.
  fireblast: { shake: 'strong', layers: [
    { kind: 'orb', color: '#ff5a1a', color2: '#ffd23f', size: 80, shape: 'flame', delay: 280, dur: 380 },
    hit(660, '#ff7a1a', 480),
    hit(700, '#ffd23f', 340),
    pt('target', 'flame', 'burst', '#ff5a1a', '#ffd23f', 30, 20, 260, 670, 600),
    ring('target', 680, '#ff7a1a', 3, 400),
    { kind: 'column', color: '#ff3a1a', color2: '#ffd23f', delay: 700 },
  ] },
  // Hurricane: a fierce wind whirls the target up in a towering storm.
  hurricane: { layers: [
    tint(0, '#cfe8ff', 1100),
    { kind: 'gust', color: '#e6f6ff', count: 16, delay: 150, dur: 500, leaves: false },
    { kind: 'column', color: '#cfe8ff', color2: '#ffffff', delay: 500 },
    { kind: 'vortex', at: 'target', color: '#9ac8ff', color2: '#ffffff', size: 320, delay: 300, dur: 800 },
    pt('target', 'wisp', 'swirl', '#e6f6ff', '#ffffff', 22, 18, 150, 350, 750),
    pt('target', 'feather', 'swirl', '#ffffff', '#cfd8ff', 12, 14, 140, 400, 700),
    hit(800, '#ffffff', 360),
  ] },
  // Hydro Pump: a huge volume of water blasted at the target under great pressure.
  hydropump: { shake: 'light', layers: [
    pt('user', 'drop', 'converge', '#3b7cff', '#cfe8ff', 18, 12, 140, 0, 450),
    { kind: 'beam', color: '#3b7cff', color2: '#cfe8ff', width: 50, wavy: true, delay: 380, dur: 700 },
    { kind: 'beam', color: '#9ac8ff', color2: '#ffffff', width: 18, wavy: true, delay: 420, dur: 660 },
    hit(700, '#ffffff', 400),
    pt('target', 'drop', 'spray', '#3b7cff', '#ffffff', 30, 16, 230, 710, 550),
    ring('target', 720, '#5aa2ff', 3, 380),
  ] },
  // Origin Pulse: countless beams of glowing blue light, Kyogre's power of the sea, converge on the target.
  originpulse: { shake: 'strong', layers: [
    tint(0, '#1a4a9a', 1200),
    ring('user', 0, '#6ac8ff', 3, 280, 500),
    { kind: 'beam', color: '#2a6ae0', color2: '#9ae0ff', width: 40, wavy: true, delay: 380, dur: 760 },
    { kind: 'beam', color: '#5aa2ff', color2: '#ffffff', width: 16, delay: 420, dur: 720 },
    ring('path', 400, '#9ae0ff', 7, 90, 650),
    { kind: 'vortex', at: 'target', color: '#2a6ae0', color2: '#9ae0ff', size: 280, delay: 650, dur: 600 },
    hit(760, '#e8f8ff', 440),
    { kind: 'rays', at: 'target', color: '#9ae0ff', size: 460, delay: 770, dur: 550 },
  ] },
  // Poltergeist: the target's own things fly at it, hurled by an invisible force.
  poltergeist: { layers: [
    dim(0, 1000),
    pt('target', 'wisp', 'swirl', '#6a4ab8', '#c9b6ff', 14, 18, 130, 100, 700),
    pt('target', 'rock', 'converge', '#9a8aa8', '#c9b6ff', 4, 30, 200, 300, 400),
    pt('target', 'gem', 'converge', '#c9b6ff', '#ffffff', 4, 28, 220, 420, 400),
    pt('target', 'star', 'converge', '#8a7aa8', '#c9b6ff', 4, 30, 210, 540, 400),
    hit(700, '#c9b6ff', 300), hit(820, '#6a4ab8', 340), hit(940, '#ffffff', 380),
    pt('target', 'wisp', 'burst', '#6a4ab8', '#c9b6ff', 18, 20, 210, 950, 450),
  ] },
  // Steam Eruption: a geyser of scalding steam bursts up under the target.
  steameruption: { shake: 'strong', layers: [
    pt('user', 'drop', 'converge', '#9ac8ff', '#ffffff', 16, 12, 130, 0, 450),
    { kind: 'ground', color: '#9ac8ff', delay: 300, dur: 500 },
    { kind: 'column', color: '#8ab8e0', color2: '#ffffff', delay: 600 },
    hit(620, '#ffffff', 420),
    pt('target', 'wisp', 'rise', '#ffffff', '#cfe8ff', 26, 26, 170, 620, 650),
    pt('target', 'drop', 'spray', '#9ac8ff', '#ffffff', 22, 14, 220, 640, 550),
  ] },
  // Thunder: lightning crashes down on the target from the sky, twice, lighting up the stage.
  thunder: { shake: 'strong', layers: [
    dim(0, 1100, '#101030'),
    { kind: 'bolt', color: '#ffe14a', delay: 300 },
    flash(300, '#fff6b0', 160),
    { kind: 'bolt', color: '#ffffff', delay: 620 },
    flash(620, '#ffffff', 180),
    hit(640, '#fff6b0', 440),
    pt('target', 'spark', 'burst', '#ffe14a', '#ffffff', 28, 14, 240, 650, 550),
    { kind: 'ground', color: '#ffe14a', delay: 640, dur: 450 },
  ] },
};

/**
 * How the user moves for each of them (stage-fx turns these into sprite classes, timed by the move's length):
 * charge into the target, cast it from where it stands (swelling with power, then rocking back), explode (Explosion,
 * Self-Destruct), leap up and come down on it (High Jump Kick), soar up and dive into it, or rampage.
 */
export const BIG_MOVE_MOTION: Record<string, 'charge' | 'cast' | 'explode' | 'leap' | 'dive' | 'rampage'> = {
  explosion: 'explode', selfdestruct: 'explode',
  vcreate: 'charge', gigaimpact: 'charge', headsmash: 'charge', focuspunch: 'charge', boltstrike: 'charge', skullbash: 'charge',
  steelroller: 'charge', solarblade: 'charge', closecombat: 'charge', doubleedge: 'charge', flareblitz: 'charge', glaiverush: 'charge',
  headcharge: 'charge', headlongrush: 'charge', megakick: 'charge', megahorn: 'charge', superpower: 'charge', volttackle: 'charge',
  woodhammer: 'charge', freezeshock: 'charge', lastresort: 'charge', powerwhip: 'charge',
  highjumpkick: 'leap',
  skyattack: 'dive', bravebird: 'dive', dragonascent: 'dive',
  outrage: 'rampage', thrash: 'rampage', petaldance: 'rampage', ragingfury: 'rampage',
  prismaticlaser: 'cast', blastburn: 'cast', eruption: 'cast', frenzyplant: 'cast', hydrocannon: 'cast', hyperbeam: 'cast', mindblown: 'cast',
  roaroftime: 'cast', rockwrecker: 'cast', shelltrap: 'cast', waterspout: 'cast', boomburst: 'cast', doomdesire: 'cast', iceburn: 'cast',
  lightofruin: 'cast', psychoboost: 'cast', steelbeam: 'cast', blueflare: 'cast', burnup: 'cast', dracometeor: 'cast', fleurcannon: 'cast',
  leafstorm: 'cast', overheat: 'cast', belch: 'cast', focusblast: 'cast', futuresight: 'cast', gunkshot: 'cast', meteorbeam: 'cast',
  precipiceblades: 'cast', seedflare: 'cast', shadowforce: 'charge', synchronoise: 'cast', technoblast: 'cast', zapcannon: 'cast',
  blizzard: 'cast', clangingscales: 'cast', fireblast: 'cast', hurricane: 'cast', hydropump: 'cast', originpulse: 'cast', poltergeist: 'cast',
  steameruption: 'cast', thunder: 'cast',
};

/** Future Sight and Doom Desire landing two turns later: the attack falls from above onto the target. */
export const FUTURE_HIT: Record<string, FxSpec> = {
  futuresight: { shake: 'strong', layers: [
    tint(0, '#ff6ab0', 900),
    { kind: 'pillar', at: 'user', color: '#f85888', color2: '#ffd0e0', width: 140, dur: 700 },
    pt('user', 'gem', 'fall', '#f85888', '#ffffff', 18, 12, 110, 0, 450),
    { kind: 'impact', at: 'user', color: '#ffffff', size: 420, star: true, delay: 420 },
    ring('user', 430, '#f85888', 4, 400),
    { kind: 'rays', at: 'user', color: '#ffd0e0', size: 440, delay: 440, dur: 450 },
  ] },
  doomdesire: { shake: 'strong', layers: [
    tint(0, '#e8eef8', 900),
    { kind: 'pillar', at: 'user', color: '#c8d0e8', color2: '#ffffff', width: 160, dur: 700 },
    pt('user', 'star', 'fall', '#ffffff', '#c8d0e8', 20, 14, 120, 0, 450),
    { kind: 'impact', at: 'user', color: '#ffffff', size: 460, star: true, delay: 420 },
    ring('user', 430, '#c8d0e8', 4, 420),
    { kind: 'rays', at: 'user', color: '#e8eef8', size: 480, delay: 440, dur: 450 },
  ] },
};
