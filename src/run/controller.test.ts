import { describe, expect, it } from 'vitest';
import { RandomAI } from '../ai/random-ai';
import { BattleClient } from '../client/battle-client';
import { TEST_PLAYER_TEAM_TEXT } from '../engine/fixtures-data';
import { createInProcessTransport } from '../engine/in-process-transport';
import { Rng } from './rng';
import { memoryStore, type KeyValueStore } from '../storage/kv';
import { importShowdownText } from '../team/showdown-text';
import { RunController, type RunTeam } from './controller';
import { RunStore } from './run-store';
import { bpForWin, planOpponent } from './selection';
import { DEFAULT_SETTINGS, type RunKey, type RunState } from './types';

const TEAM: RunTeam = {
  sourceTeamId: null,
  name: 'Test team',
  sets: importShowdownText(TEST_PLAYER_TEAM_TEXT).teams[0].sets,
  bring: [0, 1, 2],
};

function setup(kv: KeyValueStore = memoryStore()) {
  const battle = new BattleClient(createInProcessTransport());
  const store = new RunStore(kv);
  const controller = new RunController(store, battle);
  return { battle, store, controller, kv };
}

/** Answers every player request with a random legal choice (seeded). */
function autoplayPlayer(battle: BattleClient, seed: string) {
  const ai = new RandomAI(0, 0);
  const rng = new Rng(seed);
  const prng = { random: (n?: number) => (n === undefined ? rng.next() : rng.int(n)), sample: <T,>(a: T[]) => rng.pick(a), shuffle: () => {} };
  let lastRev = -1;
  return battle.subscribe(() => {
    const s = battle.getSnapshot();
    if (s.phase !== 'active' || !s.request || s.awaiting || s.rev === lastRev) return;
    lastRev = s.rev;
    const choice = ai.choose({ request: s.request, prng: prng as never, side: 'p1', battle: null as never });
    queueMicrotask(() => battle.choose(choice));
  });
}

function waitForRun(controller: RunController, course: RunKey, pred: (r: RunState) => boolean, timeoutMs = 20000): Promise<RunState> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { unsub(); reject(new Error(`timeout: ${JSON.stringify(controller.run(course)?.status)}`)); }, timeoutMs);
    const check = () => {
      const r = controller.run(course);
      if (r && pred(r)) { clearTimeout(timer); unsub(); resolve(r); }
    };
    const unsub = controller.subscribe(check);
    check();
  });
}

/** Plays battles until the run is no longer 'ready'/'in-battle'. */
async function playOut(controller: RunController, course: RunKey, maxBattles = 60) {
  for (let i = 0; i < maxBattles; i++) {
    const run = controller.run(course)!;
    if (run.status !== 'ready') return run;
    const battleNo = run.battle;
    controller.startBattle(course);
    await waitForRun(controller, course, r => r.status !== 'in-battle' && (r.battle !== battleNo || r.status !== 'ready'));
  }
  return controller.run(course)!;
}

describe('RunController', () => {
  it('plays a Normal run: streak, BP, history and the planned opponents line up', async () => {
    const { battle, controller, store } = setup();
    const stop = autoplayPlayer(battle, 'normal-run');
    controller.startRun({ course: 'normal', team: TEAM, settings: DEFAULT_SETTINGS, seedText: 'normal-run' });
    const run = await playOut(controller, 'singles-normal');
    stop();

    expect(['lost', 'cleared']).toContain(run.status);
    const wins = run.history.filter(h => h.result === 'win');
    expect(run.wins).toBe(wins.length);
    expect(run.bp).toBe(wins.reduce((s, h) => s + bpForWin('normal', h.battle), 0));
    run.history.forEach((h, i) => {
      expect(h.battle).toBe(i + 1);
      expect(h.opponent).toBe(planOpponent('normal-run', 'singles', 'normal', i + 1, DEFAULT_SETTINGS).displayName);
    });
    const profile = store.getState().profile;
    expect(profile.records['singles-normal']).toEqual({ best: run.wins, last: run.wins });
    expect(profile.bpTotal).toBe(run.bp);
    expect(profile.superUnlocked).toEqual({ singles: run.status === 'cleared', doubles: false });
  }, 60000);

  it('clears Normal at battle 20 and unlocks Super only for a real (non-debug) clear', async () => {
    // A debug run starting at 20 still faces Red but doesn't unlock Super or set records.
    const { battle, controller, store } = setup();
    const stop = autoplayPlayer(battle, 'boss');
    const run = controller.startRun({ course: 'normal', team: TEAM, settings: DEFAULT_SETTINGS, seedText: 'boss', startBattle: 20 });
    expect(run.next.displayName).toBe('Battle Legend Red');
    expect(run.debug).toBe(true);
    const done = await playOut(controller, 'singles-normal');
    stop();
    expect(['lost', 'cleared']).toContain(done.status);
    expect(store.getState().profile.superUnlocked.singles).toBe(false);
    expect(store.getState().profile.records['singles-normal'].best).toBe(0);
  }, 30000);

  it('refuses Super until unlocked', () => {
    const { controller } = setup();
    expect(() => controller.startRun({ course: 'super', team: TEAM, settings: DEFAULT_SETTINGS })).toThrow(/unlocks/);
    controller.debugUnlockSuper();
    expect(controller.startRun({ course: 'super', team: TEAM, settings: DEFAULT_SETTINGS, seedText: 's' }).next.battle).toBe(1);
  });

  it('saves between battles and resumes after a reload with the same planned opponent', () => {
    const kv = memoryStore();
    const first = setup(kv);
    const run = first.controller.startRun({ course: 'normal', team: TEAM, settings: DEFAULT_SETTINGS, seedText: 'resume' });
    const again = setup(kv);
    expect(again.controller.run('singles-normal')).toEqual(run);
  });

  it('treats a battle cut off by a reload as interrupted: forfeit = loss, or restart the same battle', async () => {
    const kv = memoryStore();
    const first = setup(kv);
    first.controller.startRun({ course: 'normal', team: TEAM, settings: DEFAULT_SETTINGS, seedText: 'interrupt' });
    first.controller.startBattle('singles-normal');
    expect(first.controller.isInterrupted('singles-normal')).toBe(false);

    const reloaded = setup(kv);
    expect(reloaded.controller.isInterrupted('singles-normal')).toBe(true);
    reloaded.controller.restartInterrupted('singles-normal');
    expect(reloaded.controller.run('singles-normal')!.status).toBe('ready');
    expect(reloaded.controller.run('singles-normal')!.next).toEqual(first.controller.run('singles-normal')!.next);

    reloaded.controller.startBattle('singles-normal');
    const third = setup(kv);
    third.controller.forfeitInterrupted('singles-normal');
    expect(third.controller.run('singles-normal')!.status).toBe('lost');
    expect(third.controller.run('singles-normal')!.history.at(-1)!.result).toBe('loss');
  });

  it('right after a loss at battle 10+, offers (this session only) a new run from the last multiple of 10', () => {
    const key = 'singles-normal';
    /** A run lost at `battle` (its battle cut off by a reload, then counted as a loss), in a new session. */
    const lostAt = (battle: number, opts: { startBattle?: number } = {}) => {
      const kv = memoryStore();
      const first = setup(kv);
      const run = first.controller.startRun({ course: 'normal', team: TEAM, settings: DEFAULT_SETTINGS, seedText: `retry-${battle}`, ...opts });
      first.store.setRun(key, { ...run, battle, wins: battle - 1 });
      first.controller.startBattle(key);
      const session = setup(kv);
      session.controller.forfeitInterrupted(key);
      return { kv, session };
    };

    const { kv, session } = lostAt(17);
    expect(session.controller.getSnapshot().retries[key]).toEqual({ battle: 10, lostAt: 17, debug: false });
    expect(() => session.controller.startRun({ course: 'normal', team: TEAM, settings: DEFAULT_SETTINGS, retry: 20 })).toThrow(/battle 10/);
    const retried = session.controller.retryFromOffer(key);
    expect([retried.battle, retried.wins, retried.bp, retried.status, retried.debug]).toEqual([10, 9, 0, 'ready', false]);
    expect(retried.next.battle).toBe(10);
    expect(retried.team).toEqual(TEAM);
    // Used up; and a later session (reload) never had it.
    expect(session.controller.getSnapshot().retries[key]).toBeUndefined();
    expect(() => session.controller.retryFromOffer(key)).toThrow();
    expect(setup(kv).controller.getSnapshot().retries).toEqual({});

    // Losing before battle 10: nothing to offer. Losing a debug run: the retry is unranked too.
    expect(lostAt(7).session.controller.getSnapshot().retries[key]).toBeUndefined();
    const debug = lostAt(20, { startBattle: 15 }).session.controller;
    expect(debug.getSnapshot().retries[key]).toEqual({ battle: 20, lostAt: 20, debug: true });
    expect(debug.retryFromOffer(key).debug).toBe(true);
  });

  it('game rule: battles start with the brought 3, lead first, no Team Preview', async () => {
    const { battle, controller } = setup();
    controller.startRun({ course: 'normal', team: { ...TEAM, bring: [3, 0, 1] }, settings: DEFAULT_SETTINGS, seedText: 'bring' });
    controller.startBattle('singles-normal');
    const s = await new Promise<ReturnType<BattleClient['getSnapshot']>>(resolve => {
      const unsub = battle.subscribe(() => { const x = battle.getSnapshot(); if (x.request) { unsub(); resolve(x); } });
    });
    expect('teamPreview' in s.request!).toBe(false);
    expect(s.request!.side.pokemon.map(p => p.details.split(',')[0])).toEqual(['Tapu Lele', 'Salamence', 'Aegislash']);
    expect(s.battle!.p2.team).toHaveLength(1); // only the opponent's lead is known
  });

  it('Team Preview toggle: battles open with a bring-3 preview of both teams', async () => {
    const { battle, controller } = setup();
    controller.startRun({ course: 'normal', team: TEAM, settings: { ...DEFAULT_SETTINGS, teamPreviewEachBattle: true }, seedText: 'preview' });
    controller.startBattle('singles-normal');
    const s = await new Promise<ReturnType<BattleClient['getSnapshot']>>(resolve => {
      const unsub = battle.subscribe(() => { const x = battle.getSnapshot(); if (x.request) { unsub(); resolve(x); } });
    });
    expect('teamPreview' in s.request!).toBe(true);
    expect(s.request!.side.pokemon).toHaveLength(6);
  });

  it('retiring ends the streak and records it', () => {
    const { controller, store } = setup();
    controller.startRun({ course: 'normal', team: TEAM, settings: DEFAULT_SETTINGS, seedText: 'retire' });
    controller.retire('singles-normal');
    expect(controller.run('singles-normal')!.status).toBe('retired');
    expect(store.getState().profile.records['singles-normal'].last).toBe(0);
    controller.dismiss('singles-normal');
    expect(controller.run('singles-normal')).toBeUndefined();
  });

  it('rejects a bring list that is not 3 distinct Pokémon', () => {
    const { controller } = setup();
    expect(() => controller.startRun({ course: 'normal', team: { ...TEAM, bring: [0, 0, 1] }, settings: DEFAULT_SETTINGS })).toThrow(/exactly 3/);
  });
});

describe('RunController practice and reset', () => {
  it('runs against the random AI are unranked', () => {
    const { controller } = setup();
    const run = controller.startRun({ course: 'normal', team: TEAM, settings: { ...DEFAULT_SETTINGS, ai: 'random' }, seedText: 'practice' });
    expect(run.debug).toBe(true);
    expect(controller.startRun({ course: 'normal', team: TEAM, settings: DEFAULT_SETTINGS, seedText: 'ranked' }).debug).toBe(false);
  });

  it('resetProgress clears records, unlocks and saved runs', () => {
    const { controller, store } = setup();
    controller.debugUnlockSuper();
    controller.startRun({ course: 'normal', team: TEAM, settings: DEFAULT_SETTINGS, seedText: 'x' });
    controller.resetProgress();
    expect(store.getState().runs).toEqual({});
    expect(store.getState().profile.superUnlocked).toEqual({ singles: false, doubles: false });
  });
});

describe('RunController: Doubles', () => {
  const DOUBLES_TEAM: RunTeam = { ...TEAM, bring: [0, 1, 2, 3] };

  it('plans Doubles opponents with 4 Pokémon and Battle Legend Blue at battle 20 / 50', () => {
    expect(planOpponent('d', 'doubles', 'normal', 5, DEFAULT_SETTINGS).team).toHaveLength(4);
    const blue = planOpponent('d', 'doubles', 'normal', 20, DEFAULT_SETTINGS);
    expect(blue.displayName).toBe('Battle Legend Blue');
    expect(blue.team).toHaveLength(4);
    expect(planOpponent('d', 'doubles', 'super', 50, DEFAULT_SETTINGS).displayName).toBe('Battle Legend Blue');
    expect(planOpponent('d', 'doubles', 'super', 30, DEFAULT_SETTINGS).kind).toBe('special');
  });

  it('requires bringing exactly 4 and keeps Singles and Doubles runs apart', () => {
    const { controller } = setup();
    expect(() => controller.startRun({ format: 'doubles', course: 'normal', team: TEAM, settings: DEFAULT_SETTINGS })).toThrow(/exactly 4/);
    controller.startRun({ course: 'normal', team: TEAM, settings: DEFAULT_SETTINGS, seedText: 's' });
    controller.startRun({ format: 'doubles', course: 'normal', team: DOUBLES_TEAM, settings: DEFAULT_SETTINGS, seedText: 'd' });
    expect(controller.run('singles-normal')!.format).toBe('singles');
    expect(controller.run('doubles-normal')!.format).toBe('doubles');
    expect(() => controller.startRun({ format: 'doubles', course: 'super', team: DOUBLES_TEAM, settings: DEFAULT_SETTINGS })).toThrow(/Super Doubles unlocks/);
    controller.debugUnlockSuper('doubles');
    expect(controller.startRun({ format: 'doubles', course: 'super', team: DOUBLES_TEAM, settings: DEFAULT_SETTINGS, seedText: 'ds' }).next.battle).toBe(1);
  });

  it('starts Double Battles with the first two brought Pokémon leading', async () => {
    const { battle, controller } = setup();
    controller.startRun({ format: 'doubles', course: 'normal', team: { ...DOUBLES_TEAM, bring: [3, 0, 1, 2] }, settings: DEFAULT_SETTINGS, seedText: 'd-bring' });
    controller.startBattle('doubles-normal');
    const s = await new Promise<ReturnType<BattleClient['getSnapshot']>>(resolve => {
      const unsub = battle.subscribe(() => { const x = battle.getSnapshot(); if (x.request) { unsub(); resolve(x); } });
    });
    expect('active' in s.request! && s.request.active).toHaveLength(2);
    expect(s.request!.side.pokemon.map(p => p.details.split(',')[0])).toEqual(['Tapu Lele', 'Salamence', 'Aegislash', 'Chansey']);
  });

  it('plays a Normal Doubles run to its end; a clear unlocks only Super Doubles', async () => {
    const { battle, controller, store } = setup();
    const stop = autoplayPlayer(battle, 'doubles-run');
    controller.startRun({ format: 'doubles', course: 'normal', team: DOUBLES_TEAM, settings: DEFAULT_SETTINGS, seedText: 'doubles-run' });
    const run = await playOut(controller, 'doubles-normal');
    stop();
    expect(['lost', 'cleared']).toContain(run.status);
    run.history.forEach((h, i) => expect(h.opponent).toBe(planOpponent('doubles-run', 'doubles', 'normal', i + 1, DEFAULT_SETTINGS).displayName));
    const profile = store.getState().profile;
    expect(profile.records['doubles-normal'].last).toBe(run.wins);
    expect(profile.records['singles-normal']).toEqual({ best: 0, last: 0 });
    expect(profile.superUnlocked).toEqual({ singles: false, doubles: run.status === 'cleared' });
  }, 60000);

  it('migrates saves from before Doubles (one Super flag, runs without a format)', () => {
    const kv = memoryStore();
    const first = setup(kv);
    first.controller.startRun({ course: 'normal', team: TEAM, settings: DEFAULT_SETTINGS, seedText: 'old' });
    const file = JSON.parse(kv.get('tree.v1')!);
    file.profile.superUnlocked = true;
    delete file.runs['singles-normal'].format;
    delete file.profile.records['doubles-normal'];
    kv.set('tree.v1', JSON.stringify(file));
    const { store, controller } = setup(kv);
    expect(store.getState().profile.superUnlocked).toEqual({ singles: true, doubles: false });
    expect(store.getState().profile.records['doubles-normal']).toEqual({ best: 0, last: 0 });
    expect(controller.run('singles-normal')!.format).toBe('singles');
  });
});
