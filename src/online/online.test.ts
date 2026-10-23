import { describe, expect, it } from 'vitest';
import { BattleClient } from '../client/battle-client';
import { QUOTE_PICKS, TRAINERS, trainerQuotes } from '../data/battle-tree';
import { TEST_PLAYER_TEAM_TEXT } from '../engine/fixtures-data';
import { createInProcessTransport } from '../engine/in-process-transport';
import { importShowdownText } from '../team/showdown-text';
import type { PokemonSet } from '../team/types';
import { cleanSet, parseToGuest, parseToHost } from './link-protocol';
import { OnlineRoom, type OnlineReward } from './link-room';
import { RunController } from '../run/controller';
import { RunStore } from '../run/run-store';
import { memoryStore } from '../storage/kv';
import type { EngineTransport } from '../client/transport';
import type { FromEngine } from '../engine/protocol';
import type { ConnectRelay, RelayHandlers } from './relay-client';
import { newRoomCode, ROOM_CODE, type Member } from './relay-protocol';
import { battleName, checkTrainerName } from './trainer-name';

const SETS = importShowdownText(TEST_PLAYER_TEAM_TEXT).teams[0].sets;

describe('trainer names', () => {
  it('accepts ordinary names, cleaned up', () => {
    expect(checkTrainerName('  Ash   Ketchum ')).toEqual({ ok: true, name: 'Ash Ketchum' });
    expect(checkTrainerName('Lillie_2')).toEqual({ ok: true, name: 'Lillie_2' });
    expect(checkTrainerName('Ñandú')).toEqual({ ok: true, name: 'Ñandú' });
    // Line breaks and tabs count as spaces.
    expect(checkTrainerName('line\nbreak\t2')).toEqual({ ok: true, name: 'line break 2' });
  });

  it('rejects empty, long, odd-character, reserved and offensive names', () => {
    for (const bad of ['', '   ', 'x'.repeat(17), 'Red|win|p2', 'nul\u0000l', '<script>', '😀Smile', '-dash', 'Player', 'admin', 'sh1t head']) {
      expect(checkTrainerName(bad).ok).toBe(false);
    }
    expect(checkTrainerName(42).ok).toBe(false);
  });

  it('battles as "Player" until a valid name is saved', () => {
    expect(battleName('')).toBe('Player');
    expect(battleName('Red|x')).toBe('Player');
    expect(battleName('Hau')).toBe('Hau');
  });
});

describe('online messages', () => {
  it('makes unguessable room codes in the agreed format', () => {
    const codes = new Set(Array.from({ length: 200 }, newRoomCode));
    expect(codes.size).toBe(200);
    for (const c of codes) expect(c).toMatch(ROOM_CODE);
  });

  it('rebuilds Pokémon from the other player without nicknames or extra fields', () => {
    const set = cleanSet({ ...SETS[0], name: 'Some nickname', evil: '<img onerror>', level: 50 })!;
    expect(set.name).toBe('Salamence');
    expect('evil' in set).toBe(false);
    expect(cleanSet({ ...SETS[0], moves: ['a', 'b', 'c', 'd', 'e'] })).toBeNull();
    expect(cleanSet({ ...SETS[0], evs: { hp: 9999 } })).toBeNull();
    expect(cleanSet({ ...SETS[0], species: 'x'.repeat(100) })).toBeNull();
    expect(cleanSet('Salamence')).toBeNull();
  });

  it('drops anything that is not a known message', () => {
    expect(parseToHost({ k: 'team', sets: [SETS[0], SETS[1]] })?.k).toBe('team');
    expect(parseToHost({ k: 'team', sets: [SETS[0], SETS[1], SETS[2]] })).toBeNull();
    expect(parseToHost({ k: 'choose', battleId: 'b', choice: 'move 1 1' })).toEqual({ k: 'choose', battleId: 'b', choice: 'move 1 1' });
    expect(parseToHost({ k: 'choose', battleId: 'b', choice: 'x'.repeat(500) })).toBeNull();
    expect(parseToHost({ k: 'takeover' })).toBeNull();
    expect(parseToHost(null)).toBeNull();
    expect(parseToGuest({ k: 'engine', msg: { type: 'start', battleId: 'b' } })).toBeNull();
    expect(parseToGuest({ k: 'lobby', lobby: { streak: -1, battle: 1, next: [] } })).toBeNull();
    expect(parseToGuest({ k: 'lobby', lobby: { streak: 0, battle: 1, next: [190, 191], notice: 'hi' } })?.k).toBe('lobby');
    // The quote pick is a small number; anything else is ignored (no greetings shown).
    const lobby = (quotePick: unknown) => parseToGuest({ k: 'lobby', lobby: { streak: 0, battle: 1, next: [190, 191], quotePick } });
    expect(lobby(7)).toMatchObject({ lobby: { quotePick: 7 } });
    expect(lobby(QUOTE_PICKS)).toMatchObject({ lobby: { quotePick: null } });
    expect(lobby('a greeting')).toMatchObject({ lobby: { quotePick: null } });
    // The mode: All Star or Super (anything else, or an older host sending none, is Super).
    const mode = (course: unknown) => parseToGuest({ k: 'lobby', lobby: { streak: 0, battle: 1, next: [190, 191], course } });
    expect([mode('allstar'), mode(undefined), mode('normal')].map(m => m && m.k === 'lobby' && m.lobby.course)).toEqual(['allstar', 'super', 'super']);
  });
});

/** The relay, in memory: two seats, names, members updates and message passing (asynchronous, cloned). */
function memoryRelay() {
  const seats = new Map<number, { name: string; handlers: RelayHandlers }>();
  const later = (f: () => void) => setTimeout(f, 0);
  const members = (): Member[] => [...seats].map(([seat, m]) => ({ seat, name: m.name }));
  const broadcast = () => { const list = members(); seats.forEach(m => later(() => m.handlers.onMessage({ t: 'members', members: list }))); };
  const connect = (seat: number, name: string): ConnectRelay => handlers => {
    seats.set(seat, { name, handlers });
    later(() => handlers.onMessage({ t: 'welcome', seat }));
    broadcast();
    return {
      send: data => {
        const copy = structuredClone(data);
        seats.forEach((m, s) => { if (s !== seat) later(() => m.handlers.onMessage({ t: 'msg', from: seat, data: copy })); });
      },
      close: () => { seats.delete(seat); broadcast(); },
    };
  };
  return { connect, seats };
}

function waitFor<T>(get: () => T | null | undefined | false, timeoutMs = 20000): Promise<T> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      const v = get();
      if (v) return resolve(v);
      if (Date.now() - start > timeoutMs) return reject(new Error('timeout'));
      setTimeout(tick, 5);
    };
    tick();
  });
}

/** Answers every request of a battle client with the simulator's default choice. */
function autoplay(client: BattleClient, enabled: () => boolean = () => true) {
  let lastRev = -1;
  return client.subscribe(() => {
    const s = client.getSnapshot();
    if (!enabled() || s.phase !== 'active' || !s.request || s.awaiting || s.rev === lastRev) return;
    lastRev = s.rev;
    queueMicrotask(() => client.choose('default'));
  });
}

function rooms() {
  const relay = memoryRelay();
  const engine = createInProcessTransport();
  const makeClient = (t: Parameters<ConstructorParameters<typeof OnlineRoom>[0]['makeClient']>[0], perspective: 'p1' | 'p3') => new BattleClient(t, { perspective });
  const host = new OnlineRoom({ role: 'host', code: 'ABCDEFGH', name: 'Hau', connect: relay.connect(0, 'Hau'), engine, makeClient, seedText: 'online-test' });
  const guest = new OnlineRoom({ role: 'guest', code: 'ABCDEFGH', name: 'Lillie', connect: relay.connect(1, 'Lillie'), makeClient });
  return { relay, host, guest };
}

const pair = (a: number, b: number): PokemonSet[] => [SETS[a], SETS[b]];

describe('online Multi Battle (host engine, guest partner)', () => {
  it('plays a battle together: each player sees their own side, and the streak is shared', async () => {
    const { host, guest } = rooms();
    await waitFor(() => host.getSnapshot().partnerName === 'Lillie' && guest.getSnapshot().partnerName === 'Hau');
    host.setTeam(pair(0, 1));
    guest.setTeam([{ ...SETS[3], name: 'My Nickname' }, SETS[5]]);
    await waitFor(() => host.getSnapshot().lobby.guestReady && guest.getSnapshot().lobby.hostReady);
    expect(guest.getSnapshot().lobby.next).toHaveLength(2);
    // Both see the same greetings for the next battle, without the guest learning the seed.
    const guestLobby = guest.getSnapshot().lobby;
    expect(guestLobby.quotePick).not.toBeNull();
    expect(guestLobby.quotePick).toBe(host.getSnapshot().lobby.quotePick);
    expect(JSON.stringify(guestLobby)).not.toMatch(/online-test/);
    const foes = guestLobby.next.map(id => TRAINERS[id]);
    expect(foes.every(t => trainerQuotes(t, guestLobby.quotePick!, foes)?.greeting)).toBe(true);

    // On the guest's first request: both of the guest's side on the field, each in its own slot.
    let field: string[] | null = null;
    const watch = guest.client.subscribe(() => {
      const { battle, request } = guest.client.getSnapshot();
      if (field || !battle || !request) return;
      field = [battle.p1.active[0]?.ident ?? '-', battle.p3!.active[1]?.ident ?? '-', String(battle.p1.active === battle.p3!.active)];
    });
    const stops = [autoplay(host.client), autoplay(guest.client), watch];
    host.startBattle();
    const hostEnd = await waitFor(() => host.client.getSnapshot().phase === 'ended' && host.client.getSnapshot());
    const guestEnd = await waitFor(() => guest.client.getSnapshot().phase === 'ended' && guest.client.getSnapshot());
    stops.forEach(s => s());

    expect(field).toEqual(['p1a: Salamence', 'p3b: Tapu Lele', 'true']);
    const hb = hostEnd.battle!;
    const gb = guestEnd.battle!;
    expect(gb.gameType).toBe('multi');
    expect(guestEnd.perspective).toBe('p3');
    // Each side's names, and nicknames gone.
    expect(hb.p1.name).toBe('Hau');
    expect(hb.p3!.name).toBe('Lillie');
    expect(gb.p3!.team.map(p => p.name)).toEqual(expect.arrayContaining(['Tapu Lele']));
    const guestText = guestEnd.log.map(e => e.text).join('\n');
    expect(guestText).toMatch(/Battle started between Hau & Lillie and /);
    expect(guestText).not.toMatch(/My Nickname/);
    // The guest's own Pokémon aren't "opposing"; the host's aren't either.
    expect(guestText).not.toMatch(/opposing (Tapu Lele|Garchomp|Salamence|Aegislash)\b/);
    // The guest only ever had requests for their own side.
    expect(gb.request?.side?.id ?? 'p3').toBe('p3');
    // Same result for both, and the lobby moved on.
    expect(guestEnd.result!.winner).toBe(hostEnd.result!.winner);
    expect(guestEnd.result!.inputLog).toEqual([]);
    // The closing remarks go with the greetings shown before the battle, for both players.
    expect(guest.getSnapshot().battleQuotePick).toBe(guestLobby.quotePick);
    expect(host.getSnapshot().battleQuotePick).toBe(guestLobby.quotePick);
    await waitFor(() => !guest.getSnapshot().lobby.inBattle);
    const won = hostEnd.result!.winner === 'p1';
    expect(host.getSnapshot().lobby.streak).toBe(won ? 1 : 0);
    expect(guest.getSnapshot().lobby.battle).toBe(won ? 2 : 1);
    host.dispose();
    guest.dispose();
  }, 60000);

  it("rejects an illegal guest team and lets the guest's choices only steer the guest's Pokémon", async () => {
    const { host, guest } = rooms();
    await waitFor(() => host.getSnapshot().partnerName);
    host.setTeam(pair(0, 1));
    // Salamence twice: Species Clause.
    guest.setTeam([SETS[0], { ...SETS[0], item: 'Leftovers' }]);
    await waitFor(() => host.getSnapshot().lobby.guestReady);
    host.startBattle();
    await waitFor(() => guest.getSnapshot().lobby.notice && !guest.getSnapshot().lobby.inBattle);
    expect(guest.getSnapshot().lobby.notice).toMatch(/Lillie's team:/);
    expect(guest.getSnapshot().lobby.guestReady).toBe(false);
    host.dispose();
    guest.dispose();
  }, 30000);

  it('lets the AI take over when the guest leaves mid-battle', async () => {
    const { host, guest } = rooms();
    await waitFor(() => host.getSnapshot().partnerName);
    host.setTeam(pair(0, 1));
    guest.setTeam(pair(3, 5));
    await waitFor(() => host.getSnapshot().lobby.guestReady);
    const stop = autoplay(host.client);
    host.startBattle();
    // The guest never answers, then leaves.
    await waitFor(() => guest.client.getSnapshot().request);
    guest.leave();
    const end = await waitFor(() => host.client.getSnapshot().phase === 'ended' && host.client.getSnapshot());
    stop();
    expect(host.getSnapshot().aiPartner).toBe(true);
    expect(end.result!.winner === 'p1' || end.result!.winner === 'p2').toBe(true);
    host.dispose();
  }, 60000);

  it('lets only the host choose the next opponents (debug); the guest just sees who they are', async () => {
    const { host, guest } = rooms();
    await waitFor(() => guest.getSnapshot().partnerName && guest.getSnapshot().lobby.next.length);
    const brock = TRAINERS.find(t => t.kind === 'special' && t.name === 'Brock')!.id;
    const misty = TRAINERS.find(t => t.kind === 'special' && t.name === 'Misty')!.id;
    host.debugChooseOpponents([brock, misty]);
    await waitFor(() => guest.getSnapshot().lobby.next.join() === `${brock},${misty}`);
    expect(() => guest.debugChooseOpponents([brock, misty])).toThrow(/Only the host/);
    host.dispose();
    guest.dispose();
  });

  it('lets the host start a streak from battle 20, before its first battle only', async () => {
    const { host, guest } = rooms();
    await waitFor(() => guest.getSnapshot().partnerName && guest.getSnapshot().lobby.next.length);
    expect(() => guest.setStartBattle(20)).toThrow(/Only the host/);
    expect(() => host.setStartBattle(7)).toThrow(/battle 1 or 20/);
    host.setStartBattle(20);
    await waitFor(() => guest.getSnapshot().lobby.battle === 20);
    expect(guest.getSnapshot().lobby.streak).toBe(19);
    expect(host.getSnapshot().startFrom).toBe(20);
    // Battle 20 is a special-trainer battle in Super Multi.
    expect(guest.getSnapshot().lobby.next.every(id => TRAINERS[id].kind !== 'regular')).toBe(true);
    host.setStartBattle(1);
    await waitFor(() => guest.getSnapshot().lobby.battle === 1);
    expect(guest.getSnapshot().lobby.streak).toBe(0);
    // No retry offer until a loss after battle 10.
    expect(host.startOptions()).toEqual([1, 20]);
    expect(() => host.setStartBattle(30)).toThrow(/battle 1 or 20/);
    host.dispose();
    guest.dispose();
  });

  it('after a loss after battle 10, lets the host start again from the last multiple of 10 won', async () => {
    // A stand-in engine: the test decides each battle's result.
    const handlers = new Set<(msg: FromEngine) => void>();
    const engine: EngineTransport = { send: () => {}, listen: h => { handlers.add(h); return () => { handlers.delete(h); }; }, dispose: () => {} };
    const relay = memoryRelay();
    const makeClient = (t: EngineTransport, perspective: 'p1' | 'p3') => new BattleClient(t, { perspective });
    const host = new OnlineRoom({ role: 'host', code: 'ABCDEFGH', name: 'Hau', connect: relay.connect(0, 'Hau'), engine, makeClient, seedText: 'retry' });
    const guest = new OnlineRoom({ role: 'guest', code: 'ABCDEFGH', name: 'Lillie', connect: relay.connect(1, 'Lillie'), makeClient });
    await waitFor(() => host.getSnapshot().partnerName === 'Lillie');
    host.setTeam(pair(0, 1));
    guest.setTeam(pair(3, 5));
    await waitFor(() => host.getSnapshot().lobby.guestReady);
    const play = (winner: 'p1' | 'p2') => {
      host.startBattle();
      const battleId = host.getSnapshot().battleId!;
      handlers.forEach(h => h({ type: 'end', battleId, result: { winner, turns: 3, seed: [0, 0, 0, 0] as never, inputLog: [] } }));
      host.leaveBattleScreen();
    };

    host.setStartBattle(20);
    for (let i = 0; i < 13; i++) play('p1');
    expect(host.getSnapshot().lobby.battle).toBe(33);
    expect(host.getSnapshot().fresh).toBe(false);
    expect(() => host.setStartBattle(1)).toThrow(/before its first battle/);
    play('p2');
    // Lost battle 33: next streak from 20 (the host's choice) or 30 (the last multiple of 10).
    const snap = host.getSnapshot();
    expect([snap.lobby.battle, snap.lobby.streak, snap.retryFrom, snap.fresh]).toEqual([20, 19, 30, true]);
    expect(host.startOptions()).toEqual([1, 20, 30]);
    expect(snap.lobby.notice).toMatch(/ended at 32\. Start again from battle 20, or from battle 30/);
    host.setStartBattle(30);
    await waitFor(() => guest.getSnapshot().lobby.battle === 30);
    expect(guest.getSnapshot().lobby.streak).toBe(29);
    // The streak's default stays 20; the offer is gone once the battle starts.
    expect(host.getSnapshot().startFrom).toBe(20);
    play('p1');
    expect(host.getSnapshot().retryFrom).toBeNull();
    expect(host.getSnapshot().lobby.battle).toBe(31);
    host.dispose();
    guest.dispose();
  });

  it('lets the host switch the room to All Star Mode before a streak starts: specials every battle, Battle Legends every 10th', async () => {
    const handlers = new Set<(msg: FromEngine) => void>();
    const engine: EngineTransport = { send: () => {}, listen: h => { handlers.add(h); return () => { handlers.delete(h); }; }, dispose: () => {} };
    const relay = memoryRelay();
    const makeClient = (t: EngineTransport, perspective: 'p1' | 'p3') => new BattleClient(t, { perspective });
    const host = new OnlineRoom({ role: 'host', code: 'ABCDEFGH', name: 'Hau', connect: relay.connect(0, 'Hau'), engine, makeClient, seedText: 'all-star' });
    const guest = new OnlineRoom({ role: 'guest', code: 'ABCDEFGH', name: 'Lillie', connect: relay.connect(1, 'Lillie'), makeClient });
    await waitFor(() => host.getSnapshot().partnerName === 'Lillie');
    host.setTeam(pair(0, 1));
    guest.setTeam(pair(3, 5));
    await waitFor(() => host.getSnapshot().lobby.guestReady);
    expect(guest.getSnapshot().lobby.course).toBe('super');
    expect(() => guest.setCourse('allstar')).toThrow(/Only the host/);
    host.setCourse('allstar');
    await waitFor(() => guest.getSnapshot().lobby.course === 'allstar');
    const kinds: string[] = [];
    for (let i = 0; i < 10; i++) {
      kinds.push(host.getSnapshot().lobby.next.map(id => TRAINERS[id].kind).join('+'));
      host.startBattle();
      const battleId = host.getSnapshot().battleId!;
      handlers.forEach(h => h({ type: 'end', battleId, result: { winner: 'p1', turns: 3, seed: [0, 0, 0, 0] as never, inputLog: [] } }));
      host.leaveBattleScreen();
    }
    // Special trainers (Izzy and Kaito bring Battle Legend Tai: legend+special), then the Battle Legends at 10.
    expect(kinds.slice(0, 9).every(k => k === 'special+special' || k === 'legend+special')).toBe(true);
    expect(kinds[9]).toBe('legend+legend');
    // Mid-streak, the mode stays.
    expect(() => host.setCourse('super')).toThrow(/before a streak/);
    host.dispose();
    guest.dispose();
  });

  it('closes the guest room when the host leaves', async () => {
    const { host, guest } = rooms();
    await waitFor(() => guest.getSnapshot().partnerName);
    host.leave();
    await waitFor(() => guest.getSnapshot().status === 'closed');
    expect(guest.getSnapshot().error).toMatch(/host left/);
    guest.dispose();
  });
});

describe('online All Star Multi: BP and partner progress for each player', () => {
  /** Host and guest rooms on a stand-in engine (the test decides each battle's result), recording each player's rewards. */
  async function setup(seedText = 'rewards') {
    const handlers = new Set<(msg: FromEngine) => void>();
    const engine: EngineTransport = { send: () => {}, listen: h => { handlers.add(h); return () => { handlers.delete(h); }; }, dispose: () => {} };
    const relay = memoryRelay();
    const makeClient = (t: EngineTransport, perspective: 'p1' | 'p3') => new BattleClient(t, { perspective });
    const rewards: { host: OnlineReward[]; guest: OnlineReward[] } = { host: [], guest: [] };
    const host = new OnlineRoom({ role: 'host', code: 'ABCDEFGH', name: 'Hau', connect: relay.connect(0, 'Hau'), engine, makeClient, seedText, onReward: r => rewards.host.push(r) });
    const guest = new OnlineRoom({ role: 'guest', code: 'ABCDEFGH', name: 'Lillie', connect: relay.connect(1, 'Lillie'), makeClient, onReward: r => rewards.guest.push(r) });
    await waitFor(() => host.getSnapshot().partnerName === 'Lillie');
    host.setTeam(pair(0, 1));
    guest.setTeam(pair(3, 5));
    await waitFor(() => host.getSnapshot().lobby.guestReady);
    /** Plays the next battle to this result; the guest follows it (it opens with "started"). */
    const play = async (winner: 'p1' | 'p2') => {
      const before = guest.getSnapshot().lobby;
      host.startBattle();
      const battleId = host.getSnapshot().battleId!;
      handlers.forEach(h => h({ type: 'started', battleId, seed: 's', opponentName: 'Foes', playerTeam: [] }));
      handlers.forEach(h => h({ type: 'end', battleId, result: { winner, turns: 3, seed: [0, 0, 0, 0] as never, inputLog: [] } }));
      await waitFor(() => guest.getSnapshot().battleId === battleId && guest.getSnapshot().lobby.battle !== before.battle || guest.getSnapshot().lobby.notice);
      host.leaveBattleScreen();
      guest.leaveBattleScreen();
    };
    return { host, guest, rewards, play, close: () => { host.dispose(); guest.dispose(); } };
  }

  it('gives both players the battle\'s BP and its trainers when they win in All Star Mode', async () => {
    const { host, guest, rewards, play, close } = await setup();
    host.setCourse('allstar');
    await waitFor(() => guest.getSnapshot().lobby.course === 'allstar' && guest.getSnapshot().lobby.rewards);
    const foes = [...host.getSnapshot().lobby.next];
    await play('p1');
    expect(rewards.host).toEqual([{ course: 'allstar', battle: 1, bp: 2, trainerIds: foes }]);
    await waitFor(() => rewards.guest.length);
    expect(rewards.guest).toEqual(rewards.host);
    expect(guest.getSnapshot().lastReward).toEqual(rewards.host[0]);
    // A loss gives nothing; a new streak from battle 1 counts again.
    await play('p2');
    expect(rewards.host).toHaveLength(1);
    expect(guest.getSnapshot().lobby.rewards).toBe(true);
    close();
  });

  it('gives nothing in Super Multi, for opponents chosen with debug tools, or in a streak started at battle 20', async () => {
    const { host, rewards, play, close } = await setup('no-rewards');
    expect(host.getSnapshot().lobby.rewards).toBe(false);
    await play('p1');
    expect(rewards.host).toEqual([]);
    close();

    const b = await setup('no-rewards-2');
    b.host.setCourse('allstar');
    const brock = TRAINERS.find(t => t.kind === 'special' && t.name === 'Brock')!.id;
    const misty = TRAINERS.find(t => t.kind === 'special' && t.name === 'Misty')!.id;
    b.host.debugChooseOpponents([brock, misty]);
    await waitFor(() => b.guest.getSnapshot().lobby.next.join() === `${brock},${misty}` && !b.guest.getSnapshot().lobby.rewards);
    await b.play('p1');
    expect(b.rewards.host).toEqual([]);
    // The next battle is drawn as usual again, and counts.
    expect(b.host.getSnapshot().lobby.rewards).toBe(true);
    b.close();

    const c = await setup('no-rewards-3');
    c.host.setCourse('allstar');
    c.host.setStartBattle(20);
    expect(c.host.getSnapshot().lobby.rewards).toBe(false);
    await c.play('p1');
    expect(c.rewards.host).toEqual([]);
    c.close();
  });

  it('counts a streak started again from the last multiple of 10 after a loss, as a local challenge does', async () => {
    const { host, rewards, play, close } = await setup('retry-rewards');
    host.setCourse('allstar');
    for (let i = 0; i < 12; i++) await play('p1');
    expect(rewards.host.map(r => r.battle)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
    // Battle 10 is the Battle Legends' draw: 50 BP.
    expect(rewards.host[9].bp).toBe(50);
    await play('p2');
    expect(host.getSnapshot().retryFrom).toBe(10);
    host.setStartBattle(10);
    expect(host.getSnapshot().lobby.rewards).toBe(true);
    await play('p1');
    expect(rewards.host.at(-1)).toMatchObject({ battle: 10, bp: 50 });
    close();
  });

  it('records the reward in each player\'s own app: BP, and the trainers beaten in the Partners shop at All Star prices', () => {
    const store = new RunStore(memoryStore());
    const controller = new RunController(store, new BattleClient(createInProcessTransport()));
    const red = TRAINERS.find(t => t.kind === 'legend' && t.name === 'Red')!.id;
    const [brock, misty] = ['Brock', 'Misty'].map(name => TRAINERS.find(t => t.kind === 'special' && t.name === name)!.id);
    expect(controller.recordOnlineWin({ battle: 10, trainerIds: [red, brock] })).toBe(50);
    controller.recordOnlineWin({ battle: 11, trainerIds: [brock, misty] });
    const { profile } = store.getState();
    expect(profile.bpTotal).toBe(53);
    expect(profile.partners.prices).toMatchObject({ Red: 10000, Brock: 9990, Misty: 10000 });
    expect(profile.records['multi-allstar']).toEqual({ best: 0, last: 0 });
  });
});
