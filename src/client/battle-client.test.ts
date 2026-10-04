import { describe, expect, it } from 'vitest';
import { PRNG } from '@pkmn/sim';
import { RandomAI } from '../ai/random-ai';
import { TEST_PLAYER_TEAM_TEXT } from '../engine/fixtures-data';
import { createInProcessTransport } from '../engine/in-process-transport';
import { seedFromString } from '../engine/seed';
import { BattleClient, type BattleSnapshot, type StartOptions } from './battle-client';

const start = (seedText: string, team = TEST_PLAYER_TEAM_TEXT): StartOptions => ({
  format: 'singles',
  seedText,
  player: { name: 'Player', team },
  opponent: { kind: 'test-fixture' },
  ai: 'random',
});

function waitFor(client: BattleClient, pred: (s: BattleSnapshot) => boolean, timeoutMs = 10000): Promise<BattleSnapshot> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { unsub(); reject(new Error(`timeout; phase=${client.getSnapshot().phase}`)); }, timeoutMs);
    const check = () => {
      const s = client.getSnapshot();
      if (pred(s)) { clearTimeout(timer); unsub(); resolve(s); }
    };
    const unsub = client.subscribe(check);
    check();
  });
}

/** Plays the player's side with random legal choices until the battle ends. */
function autoplay(client: BattleClient, seedText: string) {
  const ai = new RandomAI();
  const prng = new PRNG(seedFromString(`${seedText}|player`));
  let lastRev = -1;
  return client.subscribe(() => {
    const s = client.getSnapshot();
    if (s.phase !== 'active' || !s.request || s.awaiting || s.rev === lastRev) return;
    lastRev = s.rev;
    const choice = ai.choose({ request: s.request, prng, side: 'p1', battle: null as never });
    queueMicrotask(() => client.choose(choice));
  });
}

describe('BattleClient (in-process engine)', () => {
  it('runs a full battle and tracks the player view', async () => {
    const client = new BattleClient(createInProcessTransport());
    const stop = autoplay(client, 'client-1');
    client.start(start('client-1'));
    const end = await waitFor(client, s => s.phase === 'ended');
    stop();

    expect(end.result?.winner === 'p1' || end.result?.winner === 'p2' || end.result?.winner === null).toBe(true);
    expect(end.log.some(e => e.kind === 'turn')).toBe(true);
    expect(end.battle!.p1.name).toBe('Player');
    expect(end.battle!.p2.name).toBe('Battle Legend Red');
    // Team Preview revealed the opponent's 3 Pokémon; the player brought 3 of 6.
    expect(end.battle!.p2.team.map(p => p.baseSpeciesForme).sort()).toEqual(['Charizard', 'Lapras', 'Snorlax']);
    expect(end.battle!.p1.team.filter(p => p.hp >= 0)).toHaveLength(3);
    client.dispose();
  });

  it('starts with a Team Preview request for 3 of 6', async () => {
    const client = new BattleClient(createInProcessTransport());
    client.start(start('client-2'));
    const s = await waitFor(client, x => !!x.request);
    expect(s.request && 'teamPreview' in s.request && s.request.maxChosenTeamSize).toBe(3);
    expect(s.request!.side.pokemon).toHaveLength(6);
    client.dispose();
  });

  it('rejects an illegal team before the battle starts', async () => {
    const client = new BattleClient(createInProcessTransport());
    client.start(start('client-3', `
Mewtwo @ Life Orb
Ability: Pressure
- Psystrike

Chansey @ Life Orb
Ability: Natural Cure
- Seismic Toss

Blissey @ Leftovers
Ability: Natural Cure
- Seismic Toss`));
    const s = await waitFor(client, x => x.phase === 'invalid-team');
    expect(s.problems.join('\n')).toMatch(/Mewtwo is banned/);
    expect(s.problems.join('\n')).toMatch(/Item Clause/);
    client.dispose();
  });

  it('reports an invalid choice and keeps the request open', async () => {
    const client = new BattleClient(createInProcessTransport());
    client.start(start('client-4'));
    await waitFor(client, x => !!x.request);
    client.choose('team 9');
    const s = await waitFor(client, x => x.log.some(e => e.kind === 'error'));
    expect(s.awaiting).toBe(false);
    expect(s.request).not.toBeNull();
    client.dispose();
  });
});

describe('BattleClient playback (animations on)', () => {
  it('plays events one at a time, in order, revealing the log as it goes', async () => {
    // speed 0.02: a 700 ms move animation waits 14 ms.
    const client = new BattleClient(createInProcessTransport(), { speed: 0.02 });
    const seen: { log: number; anim: string | null; playing: boolean; newRequest: boolean }[] = [];
    const nowPlaying: { move: string | null; caption: string | null; lastLog: string | undefined; anim: string | null }[] = [];
    let lastRequest: unknown = null;
    client.subscribe(() => {
      const s = client.getSnapshot();
      const newRequest = !!s.request && s.request !== lastRequest;
      lastRequest = s.request;
      seen.push({ log: s.log.length, anim: s.animation ? `${s.animation.kind}:${s.animation.side}` : null, playing: s.playing, newRequest });
      if (s.playing) nowPlaying.push({ move: s.currentMove?.name ?? null, caption: s.caption, lastLog: s.log.at(-1)?.text, anim: s.animation?.kind ?? null });
    });
    const stop = autoplay(client, 'anim-1');
    client.start({ ...start('anim-1'), teamPreview: false });
    const end = await waitFor(client, s => s.phase === 'ended', 30000);
    stop();

    // The log only ever grows, a little at a time (not one batch per turn).
    for (let i = 1; i < seen.length; i++) expect(seen[i].log).toBeGreaterThanOrEqual(seen[i - 1].log);
    const growthSteps = seen.filter((s, i) => i > 0 && s.log > seen[i - 1].log).length;
    expect(growthSteps).toBeGreaterThan(end.battle!.turn);

    const kinds = seen.map(s => s.anim).filter(Boolean) as string[];
    expect(kinds.some(k => k.startsWith('move:'))).toBe(true);
    expect(kinds.some(k => k.startsWith('hit:'))).toBe(true);
    expect(kinds.some(k => k.startsWith('switch-in:'))).toBe(true);
    // Every hit is preceded (at some point earlier) by a move.
    const firstHit = kinds.findIndex(k => k.startsWith('hit:'));
    expect(kinds.slice(0, firstHit).some(k => k.startsWith('move:'))).toBe(true);
    // A new request (the next set of controls) only arrives once playback has finished.
    expect(seen.filter(s => s.newRequest).length).toBeGreaterThan(1);
    expect(seen.filter(s => s.newRequest).every(s => !s.playing)).toBe(true);
    // The battle only ends after playback finished.
    expect(end.playing).toBe(false);
    expect(end.animation).toBeNull();
    // While playing, the current move and the text of the event on screen are available for display.
    const moving = nowPlaying.filter(n => n.anim === 'move');
    expect(moving.length).toBeGreaterThan(0);
    for (const n of moving) {
      expect(n.move).toBeTruthy();
      expect(n.caption).toContain(n.move!);
      expect(n.caption).toBe(n.lastLog);
    }
    expect(end.currentMove).toBeNull();
    expect(end.caption).toBeNull();
    client.dispose();
  }, 40000);

  it('skipAnimations applies everything queued immediately', async () => {
    const client = new BattleClient(createInProcessTransport(), { speed: 100 });
    client.start({ ...start('skip-1'), teamPreview: false });
    // With a huge speed multiplier the first animation would take minutes.
    await waitFor(client, s => s.playing);
    client.skipAnimations();
    const s = client.getSnapshot();
    expect(s.playing).toBe(false);
    expect(s.request).not.toBeNull();
    client.dispose();
  });
});
