import { describe, expect, it } from 'vitest';
import type { BattleClient, BattleSnapshot, StartOptions } from '../client/battle-client';
import { multiPartners, pairedTrainer, pairGreeting, samePerson, trainerKey, TRAINERS } from '../data/battle-tree';
import { TEST_PLAYER_TEAM_TEXT } from '../engine/fixtures-data';
import { replayBattle, simulateMatches } from '../engine/host';
import { splitTurns } from '../client/replay-player';
import type { SimMatch } from '../engine/protocol';
import { memoryStore } from '../storage/kv';
import { importShowdownText } from '../team/showdown-text';
import type { RunTeam } from './controller';
import { partnerTrainer } from './partners';
import { RunStore } from './run-store';
import {
  champion, drawBracket, drawDuos, matchCount, matchEntrants, nextOpponent, playerIndex, playerMatch, roundName, roundPhrase, tournamentBp, TOURNAMENT_ROUNDS,
  type TournamentState,
} from './tournament';
import { TournamentController, type Simulate } from './tournament-controller';
import { DEFAULT_SETTINGS, PARTNER_PRICE } from './types';

const TEAM: RunTeam = { sourceTeamId: null, name: 'Test team', sets: importShowdownText(TEST_PLAYER_TEAM_TEXT).teams[0].sets, bring: [0, 1] };
const SINA = partnerTrainer('Sina');

describe('the draw', () => {
  it('brings 31 duos of special trainers who have lines together, each trainer once, never your partner', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
      const duos = drawDuos(seed, SINA.id);
      expect(duos).toHaveLength(31);
      const ids = duos.flat().map(p => p.trainerId);
      expect(new Set(ids).size).toBe(62);
      for (const id of ids) {
        expect(TRAINERS[id].kind).toBe('special');
        expect(samePerson(TRAINERS[id], SINA)).toBe(false);
      }
      for (const [a, b] of duos) {
        const [ta, tb] = [TRAINERS[a.trainerId], TRAINERS[b.trainerId]];
        // Pair greetings, twins (Tate and Liza), or a fixed partner with team-up lines (Izzy and Colress or Cheren).
        const together = pairGreeting(ta, tb) !== null || pairedTrainer(ta.id)?.partnerId === tb.id || multiPartners(tb.id).includes(ta.id);
        expect(together, `${trainerKey(ta)} & ${trainerKey(tb)}`).toBe(true);
        expect(samePerson(ta, tb)).toBe(false);
        expect(a.team).toHaveLength(2);
        expect(b.team).toHaveLength(2);
      }
      // Two versions of one character never both enter (the Archies, the Maxies).
      for (const x of ids) for (const y of ids) if (x !== y) expect(samePerson(TRAINERS[x], TRAINERS[y])).toBe(false);
    }
  });

  it('is the same for the same seed, and leaves out trainers whose only partners are Battle Legends (Rika, Kaito)', () => {
    expect(drawDuos('same', SINA.id)).toEqual(drawDuos('same', SINA.id));
    expect(drawDuos('one')).not.toEqual(drawDuos('two'));
    const seen = new Set(Array.from({ length: 30 }, (_, i) => drawDuos(`many-${i}`)).flat(2).map(p => trainerKey(TRAINERS[p.trainerId])));
    expect(seen.has('Rika')).toBe(false);
    expect(seen.has('Kaito')).toBe(false);
  });

  it('draws trainers by their special trainer weight, as in Super Multi (Anabel, weight 1, is rarer than weight-7 trainers)', () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 60; i++) for (const p of drawDuos(`weights-${i}`).flat()) counts.set(trainerKey(TRAINERS[p.trainerId]), (counts.get(trainerKey(TRAINERS[p.trainerId])) ?? 0) + 1);
    expect(counts.get('Anabel') ?? 0).toBeLessThan(counts.get('Brock') ?? 0);
    expect(counts.get('Anabel') ?? 0).toBeLessThan(counts.get('Cynthia') ?? 0);
  });

  it('puts you and the 31 duos in a 32-pair bracket', () => {
    const bracket = drawBracket('bracket', SINA.id);
    expect(bracket).toHaveLength(32);
    expect(bracket.filter(e => e.kind === 'player')).toHaveLength(1);
    const places = new Set(Array.from({ length: 30 }, (_, i) => playerIndex({ entrants: drawBracket(`place-${i}`) })));
    expect(places.size).toBeGreaterThan(10);
  });
});

describe('bracket helpers and BP', () => {
  it('pairs winners into the next round, names the rounds and pays the Super Multi rate, the final like a Battle Legend', () => {
    expect(TOURNAMENT_ROUNDS).toBe(5);
    expect([0, 1, 2, 3, 4].map(r => matchCount(r))).toEqual([16, 8, 4, 2, 1]);
    expect([0, 1, 2, 3, 4].map(r => roundName(r))).toEqual(['Round 1', 'Round 2', 'Quarterfinals', 'Semifinals', 'Final']);
    expect([0, 1, 2, 3, 4].map(r => roundPhrase(r))).toEqual(['Round 1', 'Round 2', 'the quarterfinals', 'the semifinals', 'the final']);
    expect([0, 1, 2, 3, 4].map(r => tournamentBp(r))).toEqual([2, 2, 2, 2, 50]);
    // A tournament saved with 16 pairs (4 rounds) keeps working.
    expect([0, 1, 2, 3].map(r => roundName(r, 4))).toEqual(['Round 1', 'Quarterfinals', 'Semifinals', 'Final']);
    expect([0, 1, 2, 3].map(r => tournamentBp(r, 4))).toEqual([2, 2, 2, 50]);
    const results = [[0, 3, 4, 7, 8, 11, 12, 15], [0, null, 8, 12], [null, null], [null]];
    expect(matchEntrants({ results }, 0, 2)).toEqual([4, 5]);
    expect(matchEntrants({ results }, 1, 1)).toEqual([4, 7]);
    expect(matchEntrants({ results }, 2, 0)).toBeNull();
    expect(matchEntrants({ results }, 2, 1)).toEqual([8, 12]);
    expect(playerMatch({ entrants: Array.from({ length: 16 }, (_, i) => (i === 13 ? { kind: 'player' as const } : { kind: 'duo' as const, trainers: [] as never })) }, 2)).toBe(1);
  });
});

/** A battle client stand-in: starts record what was asked; finish() ends the current battle. */
function fakeBattle() {
  const listeners = new Set<() => void>();
  let snapshot = { battleId: null, phase: 'idle' } as unknown as BattleSnapshot;
  const started: StartOptions[] = [];
  const client = {
    subscribe: (l: () => void) => { listeners.add(l); return () => listeners.delete(l); },
    getSnapshot: () => snapshot,
    start: (opts: StartOptions) => {
      started.push(opts);
      snapshot = { ...snapshot, battleId: `battle-${started.length}`, phase: 'active', result: null } as BattleSnapshot;
      listeners.forEach(l => l());
      return snapshot.battleId!;
    },
  };
  const finish = (winner: 'p1' | 'p2') => {
    snapshot = { ...snapshot, phase: 'ended', result: { winner, turns: 7, inputLog: [`>start ${snapshot.battleId}`] } } as BattleSnapshot;
    listeners.forEach(l => l());
  };
  return { client: client as unknown as BattleClient, started, finish };
}

function setup(simulate: Simulate = async matches => matches.map((_, i) => ({ winner: (i % 2) as 0 | 1, inputLog: [`>start log-${i}`] }))) {
  const store = new RunStore(memoryStore());
  store.updateProfile(p => ({ ...p, superUnlocked: { singles: true, doubles: true } }));
  const battle = fakeBattle();
  const sims: SimMatch[][] = [];
  const controller = new TournamentController(store, battle.client, (m, ai) => { sims.push(m); return simulate(m, ai); }, { now: () => 1_000_000 });
  return { store, battle, controller, sims };
}

const start = (controller: TournamentController, settings = DEFAULT_SETTINGS) =>
  controller.start({ team: TEAM, partner: { name: 'Sina', setIds: controller.getSnapshot().profile.partners.owned.Sina.offer.slice(0, 2) }, settings, seedText: 'cup' });

/** Waits for pending simulations (they resolve on the microtask queue). */
const settle = () => new Promise(r => setTimeout(r, 0));

describe('TournamentController', () => {
  it('opens with Super Multi', () => {
    const store = new RunStore(memoryStore());
    const controller = new TournamentController(store, fakeBattle().client, async () => []);
    expect(() => start(controller)).toThrow(/Super Multi/);
  });

  it('plays your matches, has the rest fought, keeps every match for replays, pays 2 BP a round and 50 for the final, and counts the win', async () => {
    const { controller, battle, sims, store } = setup();
    start(controller);
    expect(store.getState().profile.tournaments).toEqual({ entered: 1, won: 0 });
    for (let round = 0; round < TOURNAMENT_ROUNDS; round++) {
      const t = controller.tournament!;
      expect(t.round).toBe(round);
      const foes = nextOpponent(t)!;
      controller.startBattle();
      const opts = battle.started.at(-1)!;
      // You and your partner against the duo, left trainer first.
      expect(opts.format).toBe('multi');
      expect(opts.opponent).toMatchObject({ kind: 'team', name: foes.trainers[0].displayName });
      expect(opts.opponent2).toMatchObject({ kind: 'team', name: foes.trainers[1].displayName });
      expect(opts.player.team).toHaveLength(2);
      battle.finish('p1');
      await settle();
      controller.markShown(round + 1);
    }
    const t = controller.tournament!;
    expect(t.status).toBe('won');
    expect(champion(t)).toBe(playerIndex(t));
    expect(t.bp).toBe(2 + 2 + 2 + 2 + 50);
    expect(t.history.map(h => h.result)).toEqual(['win', 'win', 'win', 'win', 'win']);
    // The other matches of rounds 1-4 were simulated: 15, 7, 3 and 1.
    expect(sims.map(s => s.length)).toEqual([15, 7, 3, 1]);
    // Every match fought has its input log: yours from the battle, the others' from the simulation.
    for (let r = 0; r < TOURNAMENT_ROUNDS; r++) expect(t.logs![r].every(l => l !== null && l.length > 0), `round ${r + 1}`).toBe(true);
    expect(t.logs![0][playerMatch(t, 0)]).toEqual(['>start battle-1']);
    const { profile } = store.getState();
    expect(profile.bpTotal).toBe(58);
    expect(profile.tournaments).toEqual({ entered: 1, won: 1 });
    // Beaten duos come into the shop at All Star prices.
    const beaten = t.history.length * 2;
    expect(Object.keys(profile.partners.beaten)).toHaveLength(beaten);
    expect(Object.values(profile.partners.prices ?? {})).toEqual(Array(beaten).fill(PARTNER_PRICE.allStarFirst));
  });

  it('knocked out, the rest of the bracket plays out round by round until a champion is crowned', async () => {
    const { controller, battle } = setup();
    start(controller);
    controller.startBattle();
    battle.finish('p2');
    await settle();
    let t: TournamentState = controller.tournament!;
    expect(t.status).toBe('lost');
    expect(t.bp).toBe(0);
    expect(t.results[0].every(r => r !== null)).toBe(true);
    expect(t.results[0]).not.toContain(playerIndex(t));
    for (let r = 1; r < TOURNAMENT_ROUNDS; r++) await controller.resolveRound(r);
    t = controller.tournament!;
    expect(champion(t)).not.toBeNull();
    expect(t.entrants[champion(t)!].kind).toBe('duo');
    // Each winner came from the match before.
    for (let r = 1; r < TOURNAMENT_ROUNDS; r++) t.results[r].forEach((w, m) => expect(matchEntrants(t, r, m)).toContain(w));
  });

  it('retiring sends the duo you were to face through; an interrupted match can be replayed or counted as a loss', async () => {
    const a = setup();
    start(a.controller);
    const foes = nextOpponent(a.controller.tournament!)!;
    a.controller.retire();
    await settle();
    const t = a.controller.tournament!;
    expect(t.status).toBe('retired');
    expect(t.entrants[t.results[0][playerMatch(t, 0)]!]).toBe(foes);

    const b = setup();
    start(b.controller);
    b.controller.startBattle();
    // As after a reload: a new controller on the same store sees the match interrupted.
    const reloaded = new TournamentController(b.store, fakeBattle().client, async m => m.map(() => ({ winner: 0 as const, inputLog: [] })));
    expect(reloaded.isInterrupted()).toBe(true);
    reloaded.restartInterrupted();
    expect(reloaded.tournament!.status).toBe('ready');
  });

  it('practice (random AI) earns no BP or partner progress', async () => {
    const { controller, battle, store } = setup();
    start(controller, { ...DEFAULT_SETTINGS, ai: 'random' });
    controller.startBattle();
    battle.finish('p1');
    await settle();
    expect(controller.tournament!.bp).toBe(0);
    expect(store.getState().profile.bpTotal).toBe(0);
    expect(store.getState().profile.tournaments.entered).toBe(0);
  });

  it('keeps the tournament through a reload', () => {
    const kv = memoryStore();
    const store = new RunStore(kv);
    store.updateProfile(p => ({ ...p, superUnlocked: { singles: true, doubles: true } }));
    const controller = new TournamentController(store, fakeBattle().client, async () => []);
    const t = start(controller);
    expect(new RunStore(kv).getState().tournament?.entrants).toEqual(t.entrants);
  });
});

describe('simulated matches', () => {
  it('fights real Multi Battles with AIs on all four sides, the same way every time', async () => {
    const duos = drawDuos('sim');
    const matches: SimMatch[] = [0, 2].map(i => ({
      seedText: `sim|${i}`,
      sides: [duos[i], duos[i + 1]].map(d => ({ trainers: d.map(p => ({ name: p.displayName, team: p.team })) })) as SimMatch['sides'],
    }));
    const first = await simulateMatches(matches, 'heuristic');
    expect(first).toHaveLength(2);
    for (const { winner } of first) expect([0, 1]).toContain(winner);
    expect((await simulateMatches(matches, 'heuristic')).map(o => o.winner)).toEqual(first.map(o => o.winner));
  }, 30000);

  it('replays a match from its input log, turn for turn, with the same winner', async () => {
    const duos = drawDuos('replay');
    const match: SimMatch = { seedText: 'replay|1', sides: [duos[0], duos[1]].map(d => ({ trainers: d.map(p => ({ name: p.displayName, team: p.team })) })) as SimMatch['sides'] };
    const [{ winner, inputLog }] = await simulateMatches([match], 'heuristic');
    const { chunks, team } = await replayBattle(inputLog);
    expect(team.map(s => s.species)).toEqual(duos[0][0].team.map(s => s.species));
    const lines = chunks.join('\n').split('\n');
    // The first duo is p1 (with p3): the replay ends with their side's win, or the other one's.
    const win = lines.find(l => l.startsWith('|win|'))!;
    expect(win).toContain(winner === 0 ? duos[0][0].displayName : duos[1][0].displayName);
    // Split into turns: the leads coming out, then one segment per turn, each but the last ending at the next turn.
    const segments = splitTurns(chunks);
    const turns = lines.filter(l => l.startsWith('|turn|')).length;
    expect(segments).toHaveLength(turns + 1);
    segments.slice(0, -1).forEach((seg, i) => expect(seg.at(-1)).toBe(`|turn|${i + 1}`));
    expect(segments.flat().some(l => l.startsWith('|request|'))).toBe(false);
  }, 30000);
});
