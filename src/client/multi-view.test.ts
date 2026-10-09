import { describe, expect, it } from 'vitest';
import { TRAINERS } from '../data/battle-tree';
import { testPlayerTeam } from '../engine/fixtures';
import { createInProcessTransport } from '../engine/in-process-transport';
import { pickTeamSets, treeSetToPokemonSet } from '../run/opponent';
import { Rng } from '../run/rng';
import { BattleClient, type BattleSnapshot } from './battle-client';
import { sideOf } from './playback';

function trainerTeam(trainerId: number, seed: string) {
  const trainer = TRAINERS[trainerId];
  const rng = new Rng(seed);
  return { name: `${trainer.class} ${trainer.name}`, team: pickTeamSets(trainer, 2, rng).map(s => treeSetToPokemonSet(s, trainer.iv, rng)) };
}

describe('Multi Battle view (player + partner vs two trainers)', () => {
  it('maps the partner (p3) to the player side and the second opponent (p4) to the foe side', () => {
    expect(['p1a: X', 'p3b: Y', 'p2a: Z', 'p4b: W', undefined].map(sideOf)).toEqual(['p1', 'p1', 'p2', 'p2', null]);
  });

  it('keeps both of each pair on the field and never calls the partner "opposing"', async () => {
    const client = new BattleClient(createInProcessTransport());
    const partner = trainerTeam(201, 'mv-sina');
    let sawPartnerBesidePlayer = false;
    let lastRev = -1;
    const done = new Promise<BattleSnapshot>(resolve => {
      client.subscribe(() => {
        const s = client.getSnapshot();
        const b = s.battle;
        if (b?.p3 && b.p1.active[1]?.side === b.p3) sawPartnerBesidePlayer = true;
        if (s.phase === 'ended') resolve(s);
        if (s.phase !== 'active' || !s.request || s.awaiting || s.rev === lastRev) return;
        lastRev = s.rev;
        queueMicrotask(() => client.choose('default'));
      });
    });
    client.start({
      format: 'multi',
      teamPreview: false,
      seedText: 'multi-view',
      player: { name: 'Player', team: testPlayerTeam().slice(0, 2) },
      partner,
      opponent: { kind: 'team', ...trainerTeam(190, 'mv-red') },
      opponent2: { kind: 'team', ...trainerTeam(191, 'mv-blue') },
      ai: 'heuristic',
    });
    const end = await done;
    const b = end.battle!;
    const text = end.log.map(e => e.text).join('\n');

    expect(b.gameType).toBe('multi');
    expect(sawPartnerBesidePlayer).toBe(true);
    // One field array per pair of allies, side conditions shared like the simulator's.
    expect(b.p1.active).toBe(b.p3!.active);
    expect(b.p2.active).toBe(b.p4!.active);
    expect(b.p1.sideConditions).toBe(b.p3!.sideConditions);
    expect(text).toMatch(/Battle started between Player & Pokémon Trainer Sina and Battle Legend Red & Battle Legend Blue!/);
    expect(text).toMatch(/Pokémon Trainer Sina sent out/);
    expect(text).toMatch(/Battle Legend Blue sent out/);
    for (const set of partner.team) expect(text).not.toMatch(new RegExp(`opposing ${set.species}\\b`));
    expect(end.result?.winner === 'p1' || end.result?.winner === 'p2').toBe(true);
    client.dispose();
  });
});
