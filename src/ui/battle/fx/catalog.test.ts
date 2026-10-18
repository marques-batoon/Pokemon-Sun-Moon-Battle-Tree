import { describe, expect, it } from 'vitest';
import { classifyMove } from '../../../client/move-class';
import { BIG_MOVE_MS, MEGA_MS, MEGA_START_MS, SHIELD_CONDITIONS, SIGNATURE_MS, WARP_MS, WARP_START_MS } from '../../../client/playback';
import { gen7 } from '../../../team/dex';
import { BIG_MOVE_MOTION, BIG_MOVES, FUTURE_HIT } from './big-moves';
import {
  abilitySpec, ATTACKS, BALLOON_IN, BALLOON_POP, berrySpec, IMMUNE_FX, immuneSpec, sashSpec, SOLAR_CHARGE, cantSpec, chargedSpec, CRIT, CONFUSED, CURE, drainSpec, INFATUATED, residualSpec, statusSpec, MEGA_BURST, MEGA_START, moveSpec, SEEDED, SHIELD_COLORS, SUB_END, SUB_HIT, SUB_START, SUBSTITUTE_MOVE, TYPES,
  futureHitSpec, SIGNATURE_MOVES, SIGNATURE_Z_MOVES, signatureZMoveSpec, WARP_START, warpBurst, warpStart, Z_MOVE_MS, Z_POWER, zMoveSpec,
} from './catalog';

const key = (spec: unknown) => JSON.stringify(spec);

describe('animation catalog', () => {
  it('has a physical and a special animation for every type, all different', () => {
    const seen = new Set<string>();
    for (const type of TYPES) {
      const { physical, special } = ATTACKS[type];
      expect(physical.layers.length, `${type} physical`).toBeGreaterThan(0);
      expect(special.layers.length, `${type} special`).toBeGreaterThan(0);
      seen.add(key(physical));
      seen.add(key(special));
    }
    expect(seen.size).toBe(TYPES.length * 2);
  });

  it('picks the animation by type and category for attacks', () => {
    expect(moveSpec(classifyMove('Earthquake'))).toBe(ATTACKS.Ground.physical);
    expect(moveSpec(classifyMove('Earth Power'))).toBe(ATTACKS.Ground.special);
    expect(moveSpec(classifyMove('Fire Punch'))).toBe(ATTACKS.Fire.physical);
    expect(moveSpec(classifyMove('Flamethrower'))).toBe(ATTACKS.Fire.special);
  });

  it('gives status families their own looks', () => {
    const looks = ['Swords Dance', 'Growl', 'Thunder Wave', 'Protect', 'Recover', 'Stealth Rock', 'Reflect', 'Roar']
      .map(m => key(moveSpec(classifyMove(m))));
    expect(new Set(looks).size).toBe(looks.length);
    const layerKinds = (m: string) => moveSpec(classifyMove(m)).layers.map(l => l.kind);
    expect(layerKinds('Swords Dance')).toContain('arrows');
    expect(layerKinds('Growl')).toContain('arrows');
    expect(layerKinds("King's Shield")).toContain('shield');
    expect(layerKinds('Substitute')).toContain('aura');
  });

  it('colours the lasting screens as asked: Reflect white, Light Screen yellow, Aurora Veil light blue', () => {
    expect(SHIELD_COLORS.reflect).toBe('#ffffff');
    expect(SHIELD_COLORS.lightscreen).toBe('#ffe14d');
    expect(SHIELD_COLORS.auroraveil).toBe('#a8e6ff');
    for (const id of SHIELD_CONDITIONS) expect(SHIELD_COLORS[id], id).toBeDefined();
    const glow = (m: string) => moveSpec(classifyMove(m)).layers.find(l => l.kind === 'aura');
    expect(glow('Reflect')).toMatchObject({ color: SHIELD_COLORS.reflect });
    expect(glow('Aurora Veil')).toMatchObject({ color: SHIELD_COLORS.auroraveil });
  });

  it('has its own animations for Substitute, Leech Seed and HP drain', () => {
    expect(moveSpec(classifyMove('Substitute'))).toBe(SUBSTITUTE_MOVE);
    const specs = [SUBSTITUTE_MOVE, SUB_START, SUB_HIT, SUB_END, SEEDED, drainSpec('leech'), drainSpec('absorb')].map(key);
    expect(new Set(specs).size).toBe(specs.length);
    // Drained HP travels as a stream of orbs from the drained Pokémon to the healer.
    expect(drainSpec('absorb').layers.some(l => l.kind === 'orb' && (l.count ?? 1) > 1)).toBe(true);
  });

  it('makes Z-Moves bigger than the regular attack of their type', () => {
    const z = moveSpec(classifyMove('Tectonic Rage'));
    expect(z).toEqual(zMoveSpec('Ground'));
    expect(z.shake).toBe('strong');
    expect(z.layers.length).toBeGreaterThan(ATTACKS.Ground.special.layers.length);
  });

  it('has its own Z-Move animation for every type, different for physical and special, all different', () => {
    const specs = TYPES.flatMap(t => [zMoveSpec(t, 'Physical'), zMoveSpec(t, 'Special')]);
    expect(new Set(specs.map(key)).size).toBe(TYPES.length * 2);
    for (const spec of specs) {
      expect(spec.shake).toBe('strong');
      expect(spec.layers.length).toBeGreaterThanOrEqual(6);
      // Each opens dim and ends in a flash of the type's colour.
      expect(spec.layers[0]).toMatchObject({ kind: 'screen', mode: 'dim' });
      expect(spec.layers.at(-1)).toMatchObject({ kind: 'screen', mode: 'flash' });
    }
    // The category comes from the base move (playback), not the Z-Move's data.
    expect(moveSpec({ ...classifyMove('Inferno Overdrive'), category: 'Special' })).toEqual(zMoveSpec('Fire', 'Special'));
    expect(moveSpec(classifyMove('Inferno Overdrive'))).toEqual(zMoveSpec('Fire', 'Physical'));
  });

  it('builds each type\'s Z-Moves around the name, over a longer timeline', () => {
    const has = (spec: { layers: { kind: string }[] }, kind: string) => spec.layers.some(l => l.kind === kind);
    // Hydro Vortex and Black Hole Eclipse open a vortex; Continental Crush and Subzero Slammer drop a giant from the sky.
    for (const c of ['Physical', 'Special'] as const) {
      expect(has(zMoveSpec('Water', c), 'vortex')).toBe(true);
      expect(has(zMoveSpec('Dark', c), 'vortex')).toBe(true);
    }
    expect(has(zMoveSpec('Rock', 'Physical'), 'meteor')).toBe(true);
    expect(has(zMoveSpec('Ice', 'Physical'), 'meteor')).toBe(true);
    // Gigavolt Havoc strikes with lightning; All-Out Pummeling is a barrage of hits.
    expect(zMoveSpec('Electric', 'Physical').layers.filter(l => l.kind === 'bolt').length).toBeGreaterThanOrEqual(3);
    expect(zMoveSpec('Fighting', 'Physical').layers.filter(l => l.kind === 'impact').length).toBeGreaterThanOrEqual(4);
    for (const t of TYPES) for (const c of ['Physical', 'Special'] as const) {
      const spec = zMoveSpec(t, c);
      expect(spec.layers[0]).toMatchObject({ kind: 'screen', mode: 'dim', dur: Z_MOVE_MS });
      // Everything has started by the climax and is over by the end.
      for (const l of spec.layers) expect((l.delay ?? 0) + ('dur' in l && l.dur ? l.dur : 0), `${t} ${c} ${l.kind}`).toBeLessThanOrEqual(Z_MOVE_MS);
    }
  });

  it('gives signature Z-Moves their own animations', () => {
    expect(SIGNATURE_Z_MOVES).toEqual(expect.arrayContaining([
      'catastropika', '10000000voltthunderbolt', 'stokedsparksurfer', 'pulverizingpancake', 'sinisterarrowraid', 'maliciousmoonsault', 'oceanicoperetta',
      'guardianofalola', 'soulstealing7starstrike', 'clangoroussoulblaze', 'splinteredstormshards', 'letssnuggleforever', 'searingsunrazesmash',
      'menacingmoonrazemaelstrom', 'lightthatburnsthesky', 'genesissupernova', 'omegawrath', 'riptiderocketrush', 'glacialguardiangauntlet',
      'superdrainpunch', 'skyrocketpunch', 'punchingbarrage', 'omegapunch', 'glacialguardbreaker', 'infernalfuryfist', 'thunderboltblitzkrieg',
    ]));
    const typeZs = new Set(TYPES.flatMap(t => [zMoveSpec(t, 'Physical'), zMoveSpec(t, 'Special')]).map(key));
    const seen = new Set<string>();
    for (const id of SIGNATURE_Z_MOVES) {
      const spec = signatureZMoveSpec(id)!;
      expect(spec.shake).toBe('strong');
      expect(spec.layers.length, id).toBeGreaterThanOrEqual(6);
      expect(spec.layers[0]).toMatchObject({ kind: 'screen', mode: 'dim' });
      expect(spec.layers.at(-1)).toMatchObject({ kind: 'screen', mode: 'flash' });
      expect(typeZs.has(key(spec))).toBe(false);
      seen.add(key(spec));
    }
    // All different, except Omega Punch, which is Omega Wrath's (on request).
    expect(seen.size).toBe(SIGNATURE_Z_MOVES.length - 1);
    expect(signatureZMoveSpec('omegapunch')).toEqual(signatureZMoveSpec('omegawrath'));
    // The battle screen picks them by the move used, whatever the base move's category.
    for (const name of ['Catastropika', 'Oceanic Operetta', 'Genesis Supernova', "Let's Snuggle Forever", 'Omega Wrath', 'Glacial Guardian Gauntlet']) {
      const fx = classifyMove(name);
      expect(fx.kind, name).toBe('z');
      expect(moveSpec(fx)).toEqual(signatureZMoveSpec(fx.moveId));
      expect(moveSpec({ ...fx, category: 'Special' })).toEqual(signatureZMoveSpec(fx.moveId));
    }
    expect(signatureZMoveSpec('infernooverdrive')).toBeNull();
    // Omega Wrath is one big punch (a single fist and a single star impact), not a barrage.
    const omega = signatureZMoveSpec('omegawrath')!.layers;
    expect(omega.filter(l => l.kind === 'orb').map(l => (l.kind === 'orb' ? l.count ?? 1 : 0))).toEqual([1]);
    expect(omega.filter(l => l.kind === 'impact')).toHaveLength(1);
  });

  it('gives Gaia Force (Terra Force) and Cocytus Pulse (Cocytus Breath) their own animations', () => {
    const gaia = moveSpec(classifyMove('Gaia Force'));
    const cocytus = moveSpec(classifyMove('Cocytus Pulse'));
    expect(gaia).toBe(SIGNATURE_MOVES.gaiaforce);
    expect(cocytus).toBe(SIGNATURE_MOVES.cocytuspulse);
    expect(key(gaia)).not.toBe(key(ATTACKS.Fire.special));
    expect(key(cocytus)).not.toBe(key(ATTACKS.Ice.special));
    // Terra Force: a giant sun hurled at the target; Cocytus Breath: a freezing blast of breath.
    expect(gaia.layers.some(l => l.kind === 'orb' && l.size >= 150)).toBe(true);
    expect(cocytus.layers.filter(l => l.kind === 'beam').length).toBe(2);
    // Other moves of those types keep the usual look.
    expect(moveSpec(classifyMove('Flamethrower'))).toBe(ATTACKS.Fire.special);
  });

  it('has special Mega Evolution and Z-Power sequences', () => {
    for (const spec of [MEGA_START, MEGA_BURST, Z_POWER]) expect(spec.layers.length).toBeGreaterThan(2);
    expect(MEGA_START.layers.some(l => l.kind === 'rings' && l.rainbow)).toBe(true);
    expect(MEGA_BURST.layers.some(l => l.kind === 'screen' && l.mode === 'flash')).toBe(true);
    // As in the games: a rainbow cocoon wraps the Pokémon, then bursts, and the Mega Evolution symbol flashes.
    expect(MEGA_START.layers.some(l => l.kind === 'cocoon')).toBe(true);
    expect(MEGA_BURST.layers.some(l => l.kind === 'megasymbol')).toBe(true);
    // Bigger than before, but short of a Warp Digivolution: no banner, no digital space, a lighter shake.
    expect(MEGA_START_MS + MEGA_MS).toBeLessThan(WARP_START_MS + WARP_MS);
    expect([...MEGA_START.layers, ...MEGA_BURST.layers].some(l => l.kind === 'banner' || l.kind === 'datagrid')).toBe(false);
    expect(MEGA_BURST.shake).toBe('light');
    expect(warpBurst('WarGreymon').shake).toBe('strong');
  });

  it('has its own Warp Digivolution sequence: digital space, code, a wireframe, armour, and the new form\'s name', () => {
    const kinds = WARP_START.layers.map(l => l.kind);
    for (const k of ['datagrid', 'code', 'wireframe', 'banner'] as const) expect(kinds).toContain(k);
    expect(WARP_START.layers.some(l => l.kind === 'particles' && l.motion === 'converge')).toBe(true);
    expect(key(WARP_START)).not.toBe(key(MEGA_START));
    const burst = warpBurst('WarGreymon');
    expect(burst.shake).toBe('strong');
    expect(burst.layers.some(l => l.kind === 'banner' && l.text === 'WarGreymon!')).toBe(true);
    // Each form bursts out in its own element: fire for WarGreymon, ice for MetalGarurumon.
    const shapes = (form: string) => warpBurst(form).layers.flatMap(l => (l.kind === 'particles' ? [l.shape] : []));
    expect(shapes('WarGreymon')).toContain('flame');
    expect(shapes('MetalGarurumon')).toContain('shard');
    expect(shapes('MetalGarurumon')).not.toContain('flame');
  });

  it('animates status conditions with particles only: no filled glow, flash or dim over the Pokémon', () => {
    const conditions = ['par', 'brn', 'psn', 'tox', 'slp', 'frz'];
    const specs = [
      ...conditions.map(statusSpec),
      ...[...conditions, 'flinch', 'attract', 'recharge'].map(cantSpec),
      ...['brn', 'psn', 'tox', 'confusion'].map(c => residualSpec(c)!),
      ...['Thunder Wave', 'Will-O-Wisp', 'Toxic', 'Spore', 'Confuse Ray', 'Attract'].map(m => moveSpec(classifyMove(m))),
      CONFUSED, INFATUATED, CURE,
    ];
    for (const spec of specs) {
      for (const layer of spec.layers) {
        expect(layer.kind).not.toBe('aura');
        expect(layer.kind).not.toBe('screen');
        if (layer.kind === 'impact') expect(layer.star).toBeFalsy();
      }
    }
  });
});

describe('BlackWarGreymon\'s animations', () => {
  it('has its own Dark Warp Digivolution: the same sequence, named so, bursting out in dark energy', () => {
    const start = warpStart('BlackWarGreymon');
    expect(start.layers.find(l => l.kind === 'banner')).toMatchObject({ text: 'Dark Warp Digivolve!' });
    expect(start.layers.filter(l => l.kind !== 'banner')).toEqual(WARP_START.layers.filter(l => l.kind !== 'banner'));
    expect(warpStart('WarGreymon')).toBe(WARP_START);
    const burst = warpBurst('BlackWarGreymon');
    expect(burst.layers.some(l => l.kind === 'particles' && l.shape === 'wisp')).toBe(true);
    expect(burst.layers.find(l => l.kind === 'banner')).toMatchObject({ text: 'BlackWarGreymon!' });
    expect(key(burst)).not.toBe(key(warpBurst('WarGreymon')));
  });

  it('has signature animations: Dark Gaia Force is Gaia Force in dark energy; Dramon Breaker parallels Dramon Destroyer', () => {
    const gaia = SIGNATURE_MOVES.gaiaforce, dark = SIGNATURE_MOVES.darkgaiaforce;
    expect(dark.layers.map(l => [l.kind, l.delay ?? 0])).toEqual(gaia.layers.map(l => [l.kind, l.delay ?? 0]));
    expect(key(dark)).not.toBe(key(gaia));
    const destroyer = SIGNATURE_MOVES.dramondestroyer, breaker = SIGNATURE_MOVES.dramonbreaker;
    expect(destroyer.layers.filter(l => l.kind === 'slash')).toHaveLength(2);
    expect(breaker.layers.filter(l => l.kind === 'slash')).toHaveLength(2);
    expect(key(destroyer)).not.toBe(key(breaker));
    expect(moveSpec(classifyMove('Dark Gaia Force'))).toBe(dark);
    expect(moveSpec(classifyMove('Dramon Destroyer'))).toBe(destroyer);
    expect(moveSpec(classifyMove('Dramon Breaker'))).toBe(breaker);
  });
});

describe('Abilities that take in a move', () => {
  it('has its own animation for each absorbing Ability, Levitate, and a general one, with the Ability\'s name', () => {
    const ids = ['waterabsorb', 'voltabsorb', 'dryskin', 'motordrive', 'lightningrod', 'stormdrain', 'sapsipper', 'flashfire', 'levitate'];
    const specs = ids.map(id => abilitySpec(id));
    expect(new Set(specs.map(key)).size).toBe(ids.length);
    expect(specs).not.toContain(abilitySpec('soundproof'));
    expect(abilitySpec('waterabsorb', 'Water Absorb').layers.find(l => l.kind === 'label')).toMatchObject({ text: 'Water Absorb', at: 'target' });
    expect(abilitySpec('lightningrod').layers.some(l => l.kind === 'bolt')).toBe(true);
    expect(abilitySpec('stormdrain').layers.some(l => l.kind === 'vortex')).toBe(true);
  });
});

describe('HerculesKabuterimon\'s animations', () => {
  it('bursts out of its Warp Digivolution in yellow electricity, and Giga Blaster has its own', () => {
    const burst = warpBurst('HerculesKabuterimon');
    expect(burst.layers.some(l => l.kind === 'particles' && l.shape === 'spark')).toBe(true);
    expect(burst.layers.find(l => l.kind === 'rings')).toMatchObject({ color: '#ffd43b' });
    expect(key(burst)).not.toBe(key(warpBurst('WarGreymon')));
    expect(moveSpec(classifyMove('Giga Blaster'))).toBe(SIGNATURE_MOVES.gigablaster);
  });
});

describe('Charge', () => {
  it('gathers sparks into the Pokémon, naming the Ability when one charged it', () => {
    expect(chargedSpec().layers.some(l => l.kind === 'particles' && l.motion === 'converge')).toBe(true);
    expect(chargedSpec().layers.some(l => l.kind === 'label')).toBe(false);
    expect(chargedSpec('Electromorphosis').layers.find(l => l.kind === 'label')).toMatchObject({ text: 'Electromorphosis', at: 'user' });
  });
});

describe('Berries', () => {
  it('shows the Berry being eaten, flying over from its holder when stolen', () => {
    const eaten = berrySpec('Sitrus Berry').layers.find(l => l.kind === 'berry');
    expect(eaten).toMatchObject({ item: 'Sitrus Berry', at: 'user' });
    expect(eaten).not.toHaveProperty('from');
    expect(berrySpec('Lum Berry', true).layers.find(l => l.kind === 'berry')).toMatchObject({ from: 'target' });
    expect(key(berrySpec('Sitrus Berry'))).not.toBe(key(berrySpec('Oran Berry')));
  });
});

describe('Air Balloon and critical hits', () => {
  it('floats the Pokémon on its balloon (like Levitate), pops it, and labels critical hits', () => {
    const balloon = abilitySpec('airballoon', 'Air Balloon');
    expect(balloon.layers.find(l => l.kind === 'balloon')).toMatchObject({ at: 'target' });
    expect(balloon.layers.find(l => l.kind === 'label')).toMatchObject({ text: 'Air Balloon' });
    expect(key(abilitySpec('airballoon'))).not.toBe(key(abilitySpec('levitate')));
    expect(BALLOON_POP.layers.find(l => l.kind === 'balloon')).toMatchObject({ pop: true, at: 'user' });
    expect(CRIT.layers).toEqual([expect.objectContaining({ kind: 'label', text: 'CRIT', color: '#3ee8ff', variant: 'crit', at: 'user' })]);
  });
});

describe('Focus Sash, Air Balloon coming in, Tailwind', () => {
  it('has their animations', () => {
    expect(sashSpec('focussash').layers.find(l => l.kind === 'sash')).toMatchObject({ at: 'user' });
    expect(sashSpec('focussash').layers.find(l => l.kind === 'label')).toMatchObject({ text: 'Focus Sash' });
    expect(sashSpec('focusband').layers.find(l => l.kind === 'label')).toMatchObject({ text: 'Focus Band' });
    expect(BALLOON_IN.layers.find(l => l.kind === 'balloon')).toMatchObject({ at: 'user' });
    expect(BALLOON_IN.layers.find(l => l.kind === 'balloon')).not.toHaveProperty('pop');
    expect(moveSpec(classifyMove('Tailwind')).layers.some(l => l.kind === 'gust')).toBe(true);
  });
});

describe('type-chart immunities', () => {
  it('has a different animation for each pair, with the attack in it', () => {
    const pairs = ['normal-ghost', 'fighting-ghost', 'ghost-normal', 'electric-ground', 'ground-flying', 'psychic-dark', 'poison-steel', 'dragon-fairy'];
    expect(Object.keys(IMMUNE_FX).sort()).toEqual([...pairs].sort());
    expect(new Set(pairs.map(p => key(immuneSpec(p)))).size).toBe(pairs.length);
    // Normal and Fighting attacks go straight through a Ghost.
    expect(immuneSpec('normal-ghost').layers.find(l => l.kind === 'orb')).toMatchObject({ through: true });
    expect(immuneSpec('fighting-ghost').layers.find(l => l.kind === 'orb')).toMatchObject({ through: true, count: 3 });
    expect(immuneSpec('unknown-pair').layers.length).toBeGreaterThan(0);
  });
});

describe('Solar Beam', () => {
  it('has its own beam of sunlight, and a charging turn with a shaft of light', () => {
    expect(moveSpec(classifyMove('Solar Beam')).layers.filter(l => l.kind === 'beam')).toHaveLength(2);
    expect(moveSpec(classifyMove('Solar Beam'))).not.toBe(moveSpec(classifyMove('Energy Ball')));
    expect(SOLAR_CHARGE.layers.find(l => l.kind === 'pillar')).toMatchObject({ at: 'user' });
  });
});

describe('moves over 100 power', () => {
  const big = [...gen7.moves].filter(m => m.basePower > 100 && m.category !== 'Status' && !m.isZ);

  it('gives every one its own animation, with a length and a motion for its user', () => {
    expect(big.length).toBeGreaterThan(70);
    for (const m of big) {
      expect(SIGNATURE_MOVES[m.id], m.name).toBeDefined();
      expect(moveSpec(classifyMove(m.name)), m.name).toBe(SIGNATURE_MOVES[m.id]);
      expect(SIGNATURE_MS[m.id], m.name).toBeGreaterThan(1000);
    }
    expect(Object.keys(BIG_MOVE_MS).sort()).toEqual(Object.keys(BIG_MOVES).sort());
    expect(Object.keys(BIG_MOVE_MOTION).sort()).toEqual(Object.keys(BIG_MOVES).sort());
    // Each is tailored: no two the same, and none the plain attack of its type.
    const looks = big.map(m => key(SIGNATURE_MOVES[m.id]));
    expect(new Set(looks).size).toBe(big.length);
    for (const m of big) expect(SIGNATURE_MOVES[m.id], m.name).not.toBe(ATTACKS[m.type as keyof typeof ATTACKS].physical);
  });

  it('times every layer to start before the animation ends, the hits well within it', () => {
    for (const [id, spec] of Object.entries(BIG_MOVES)) {
      for (const l of spec.layers) expect((l.delay ?? 0), `${id} ${l.kind}`).toBeLessThan(BIG_MOVE_MS[id] - 300);
      for (const l of spec.layers.filter(l => l.kind === 'impact')) expect((l.delay ?? 0), id).toBeLessThanOrEqual(BIG_MOVE_MS[id] - 400);
    }
  });

  it('fits a few of them to the move', () => {
    const kinds = (id: string) => BIG_MOVES[id].layers.map(l => l.kind);
    // Explosion blows up at the user; Draco Meteor and Eruption rain down; Thunder strikes twice from the sky.
    expect(BIG_MOVES.explosion.layers.some(l => l.kind === 'impact' && l.at === 'user' && l.size >= 600)).toBe(true);
    expect(kinds('dracometeor').filter(k => k === 'meteor')).toHaveLength(3);
    expect(kinds('eruption').filter(k => k === 'meteor')).toHaveLength(3);
    expect(kinds('thunder').filter(k => k === 'bolt')).toHaveLength(2);
    expect(kinds('hyperbeam')).toContain('beam');
    expect(BIG_MOVES.prismaticlaser.layers.some(l => l.kind === 'rings' && l.rainbow)).toBe(true);
    expect(BIG_MOVES.blueflare.layers.find(l => l.kind === 'column')).toMatchObject({ color: '#2a6ae0' });
    expect(BIG_MOVE_MOTION).toMatchObject({ explosion: 'explode', highjumpkick: 'leap', bravebird: 'dive', outrage: 'rampage', closecombat: 'charge', hydropump: 'cast' });
  });

  it('has Future Sight and Doom Desire land from above two turns later', () => {
    expect(futureHitSpec('futuresight')).toBe(FUTURE_HIT.futuresight);
    expect(futureHitSpec('doomdesire')).toBe(FUTURE_HIT.doomdesire);
    expect(futureHitSpec('doomdesire')).not.toEqual(futureHitSpec('futuresight'));
    expect(FUTURE_HIT.futuresight.layers.find(l => l.kind === 'pillar')).toMatchObject({ at: 'user' });
  });
});
