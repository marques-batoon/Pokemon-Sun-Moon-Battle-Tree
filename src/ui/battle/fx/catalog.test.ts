import { describe, expect, it } from 'vitest';
import { classifyMove } from '../../../client/move-class';
import { MEGA_MS, MEGA_START_MS, SHIELD_CONDITIONS, WARP_MS, WARP_START_MS } from '../../../client/playback';
import {
  ATTACKS, cantSpec, CONFUSED, CURE, drainSpec, INFATUATED, residualSpec, statusSpec, MEGA_BURST, MEGA_START, moveSpec, SEEDED, SHIELD_COLORS, SUB_END, SUB_HIT, SUB_START, SUBSTITUTE_MOVE, TYPES,
  SIGNATURE_MOVES, SIGNATURE_Z_MOVES, signatureZMoveSpec, WARP_START, warpBurst, Z_MOVE_MS, Z_POWER, zMoveSpec,
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
    expect(moveSpec(classifyMove('Flare Blitz'))).toBe(ATTACKS.Fire.physical);
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
    expect(seen.size).toBe(SIGNATURE_Z_MOVES.length);
    // The battle screen picks them by the move used, whatever the base move's category.
    for (const name of ['Catastropika', 'Oceanic Operetta', 'Genesis Supernova', "Let's Snuggle Forever", 'Omega Wrath', 'Glacial Guardian Gauntlet']) {
      const fx = classifyMove(name);
      expect(fx.kind, name).toBe('z');
      expect(moveSpec(fx)).toEqual(signatureZMoveSpec(fx.moveId));
      expect(moveSpec({ ...fx, category: 'Special' })).toEqual(signatureZMoveSpec(fx.moveId));
    }
    expect(signatureZMoveSpec('infernooverdrive')).toBeNull();
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
