import { describe, expect, it } from 'vitest';
import type { BattleClient, BattleSnapshot, StartOptions } from '../client/battle-client';
import { BattleClient as RealBattleClient } from '../client/battle-client';
import { TRAINERS } from '../data/battle-tree';
import { TEST_PLAYER_TEAM_TEXT } from '../engine/fixtures-data';
import { createInProcessTransport } from '../engine/in-process-transport';
import { memoryStore, type KeyValueStore } from '../storage/kv';
import { importShowdownText } from '../team/showdown-text';
import { RunController, type RunTeam } from './controller';
import { defaultPartnerBook, partnerTeam, rollOffer, specialTrainer } from './partners';
import { Rng } from './rng';
import { RunStore } from './run-store';
import { bpForWin, planOpponent } from './selection';
import { SETS } from '../data/battle-tree';
import { bpBalance, DEFAULT_SETTINGS, PARTNER_COST, type RunState } from './types';

const PLAYER_SETS = importShowdownText(TEST_PLAYER_TEAM_TEXT).teams[0].sets;
const SINGLES_TEAM: RunTeam = { sourceTeamId: null, name: 'Test team', sets: PLAYER_SETS, bring: [0, 1, 2] };
const MULTI_TEAM: RunTeam = { ...SINGLES_TEAM, bring: [0, 1] };
const SINA = specialTrainer('Sina').id;
/** The first two Pokémon of a partner's offer (what a player might pick). */
const picks = (name: string) => ({ name, setIds: defaultPartnerBook().owned[name].offer.slice(0, 2) });

/** Stand-in for the battle client: battles end when the test says who won. */
class FakeBattle {
  private readonly listeners = new Set<() => void>();
  private snapshot = { battleId: null, phase: 'idle', result: null } as unknown as BattleSnapshot;
  private n = 0;
  started: StartOptions[] = [];
  subscribe = (l: () => void) => { this.listeners.add(l); return () => { this.listeners.delete(l); }; };
  getSnapshot = () => this.snapshot;
  start(opts: StartOptions): string {
    this.started.push(opts);
    const battleId = `fake-${++this.n}`;
    this.snapshot = { ...this.snapshot, battleId, phase: 'starting', result: null };
    return battleId;
  }
  end(winner: 'p1' | 'p2') {
    this.snapshot = { ...this.snapshot, phase: 'ended', result: { winner, turns: 3, inputLog: [] } } as unknown as BattleSnapshot;
    this.listeners.forEach(l => l());
  }
}

function setup(kv: KeyValueStore = memoryStore()) {
  const battle = new FakeBattle();
  const store = new RunStore(kv);
  const controller = new RunController(store, battle as unknown as BattleClient);
  return { battle, store, controller };
}

/** Wins every battle of the run up to and including battle `last`. */
function winThrough(controller: RunController, battle: FakeBattle, key: Parameters<RunController['startBattle']>[0], last: number): RunState {
  while (controller.run(key)!.battle <= last) {
    controller.startBattle(key);
    battle.end('p1');
  }
  return controller.run(key)!;
}

describe('Multi: planning opponents', () => {
  it('pairs two different trainers with 2 Pokémon each, never the player’s partner', () => {
    for (let battle = 1; battle <= 60; battle++) {
      const plan = planOpponent('multi-plan', 'multi', 'super', battle, DEFAULT_SETTINGS, SINA);
      expect(plan.second).toBeDefined();
      expect(plan.second!.trainerId).not.toBe(plan.trainerId);
      expect([plan.trainerId, plan.second!.trainerId]).not.toContain(SINA);
      expect(plan.team).toHaveLength(2);
      expect(plan.second!.team).toHaveLength(2);
      if (battle % 10 === 0 && battle !== 50) expect([plan.kind, plan.second!.kind]).toEqual(['special', 'special']);
    }
    // Same inputs, same pair.
    expect(planOpponent('multi-plan', 'multi', 'super', 7, DEFAULT_SETTINGS, SINA)).toEqual(planOpponent('multi-plan', 'multi', 'super', 7, DEFAULT_SETTINGS, SINA));
  });

  it('puts Battle Legends Red and Blue together at battle 50', () => {
    const plan = planOpponent('m', 'multi', 'super', 50, DEFAULT_SETTINGS, SINA);
    expect([plan.displayName, plan.second!.displayName]).toEqual(['Battle Legend Red', 'Battle Legend Blue']);
    expect([plan.team.length, plan.second!.team.length]).toEqual([2, 2]);
  });

  it('replaces a locked Anabel with an ordinary trainer, per trainer', () => {
    const settings = { ...DEFAULT_SETTINGS, anabelUnlocked: false };
    for (let n = 0; n < 300; n++) {
      const plan = planOpponent(`anabel-${n}`, 'multi', 'super', 20, settings, SINA);
      for (const t of [plan, plan.second!]) {
        expect(TRAINERS[t.trainerId].name).not.toBe('Anabel');
        expect(t.kind).toBe(t.replacedAnabel ? 'regular' : 'special');
      }
    }
  });

  it('always pairs Tate with Liza, leading with Solrock + Lunatone or Gallade + Gardevoir', () => {
    const tate = specialTrainer('Tate').id;
    const liza = specialTrainer('Liza').id;
    const species = (id: number) => SETS[id].species;
    let seen = 0;
    for (let n = 0; n < 600; n++) {
      const plan = planOpponent(`twins-${n}`, 'multi', 'super', 10 * (1 + (n % 4)), DEFAULT_SETTINGS, SINA);
      const ids = [plan.trainerId, plan.second!.trainerId];
      if (!ids.includes(tate) && !ids.includes(liza)) continue;
      seen++;
      expect([...ids].sort()).toEqual([tate, liza].sort());
      const leadOf = (id: number) => species((id === plan.trainerId ? plan : plan.second!).setIds[0]);
      expect([['Solrock', 'Lunatone'], ['Gallade', 'Gardevoir']]).toContainEqual([leadOf(tate), leadOf(liza)]);
    }
    expect(seen).toBeGreaterThan(5);
    // With one twin as your partner, the other never shows up as an opponent.
    for (let n = 0; n < 300; n++) {
      const plan = planOpponent(`twin-partner-${n}`, 'multi', 'super', 20, DEFAULT_SETTINGS, tate);
      expect([plan.trainerId, plan.second!.trainerId]).not.toContain(liza);
    }
  });

  it('lets Tate and Liza appear on their own in Singles', () => {
    const tate = specialTrainer('Tate').id;
    const plans = Array.from({ length: 2000 }, (_, n) => planOpponent(`solo-${n}`, 'singles', 'super', 10, DEFAULT_SETTINGS));
    expect(plans.some(p => p.trainerId === tate)).toBe(true);
    expect(plans.every(p => !p.second)).toBe(true);
  });

  it("doesn't change Singles and Doubles plans", () => {
    expect(planOpponent('x', 'singles', 'super', 12, DEFAULT_SETTINGS).second).toBeUndefined();
    expect(planOpponent('x', 'doubles', 'super', 30, DEFAULT_SETTINGS).team).toHaveLength(4);
  });
});

describe('Multi: partners and the Super Multi course', () => {
  it('starts everyone with Sina and Dexio, each offering six of their own Pokémon', () => {
    const book = defaultPartnerBook();
    expect(Object.keys(book.owned).sort()).toEqual(['Dexio', 'Sina']);
    expect(book.available).toEqual([]);
    for (const [name, { offer }] of Object.entries(book.owned)) {
      expect(offer).toHaveLength(6);
      for (const id of offer) expect(specialTrainer(name).roster).toContain(id);
    }
    expect(defaultPartnerBook()).toEqual(book);
  });

  it('offers up to six Pokémon with different species and items, so any two are legal together', () => {
    for (const name of ['Sina', 'Dexio', 'Wally', 'Cynthia', 'Kiawe', 'Anabel']) {
      for (let n = 0; n < 20; n++) {
        const offer = rollOffer(name, new Rng(`${name}-${n}`)).map(id => SETS[id]);
        expect(offer.length).toBeGreaterThanOrEqual(2);
        expect(offer.length).toBeLessThanOrEqual(6);
        expect(new Set(offer.map(s => s.item)).size).toBe(offer.length);
        expect(new Set(offer.map(s => s.species)).size).toBe(offer.length);
      }
    }
  });

  it('opens Super Multi only once Super Singles and Super Doubles are both unlocked, and needs a scouted partner', () => {
    const { controller } = setup();
    const start = (partner?: { name: string; setIds: number[] }) => controller.startRun({ format: 'multi', course: 'super', team: MULTI_TEAM, settings: DEFAULT_SETTINGS, seedText: 'm', partner });
    expect(() => start(picks('Sina'))).toThrow(/Super Multi unlocks/);
    controller.debugUnlockSuper('singles');
    expect(() => start(picks('Sina'))).toThrow(/Super Multi unlocks/);
    controller.debugUnlockSuper('doubles');
    expect(() => controller.startRun({ format: 'multi', course: 'normal', team: MULTI_TEAM, settings: DEFAULT_SETTINGS })).toThrow(/no normal multi/);
    expect(() => start()).toThrow(/Choose a partner/);
    expect(() => start({ name: 'Cynthia', setIds: specialTrainer('Cynthia').roster.slice(0, 2) })).toThrow(/don't have Cynthia/);
    // Two different Pokémon, both from the offer.
    const offer = defaultPartnerBook().owned.Dexio.offer;
    expect(() => start({ name: 'Dexio', setIds: [offer[0]] })).toThrow(/Choose 2/);
    expect(() => start({ name: 'Dexio', setIds: [offer[0], offer[0]] })).toThrow(/Choose 2/);
    const outside = specialTrainer('Dexio').roster.find(id => !offer.includes(id))!;
    expect(() => start({ name: 'Dexio', setIds: [offer[0], outside] })).toThrow(/Choose 2/);
    expect(() => controller.startRun({ format: 'multi', course: 'super', team: SINGLES_TEAM, settings: DEFAULT_SETTINGS, partner: picks('Sina') })).toThrow(/exactly 2/);
    const run = start({ name: 'Dexio', setIds: [offer[3], offer[1]] });
    expect(run.partner).toEqual({ name: 'Dexio', trainerId: specialTrainer('Dexio').id, setIds: [offer[3], offer[1]] });
    expect(run.next.second).toBeDefined();
  });

  it('battles with the partner and both opponents; history names the pair', () => {
    const { controller, battle } = setup();
    controller.debugUnlockSuper('multi');
    const run = controller.startRun({ format: 'multi', course: 'super', team: MULTI_TEAM, settings: DEFAULT_SETTINGS, seedText: 'pair', partner: picks('Sina') });
    controller.startBattle('multi-super');
    const opts = battle.started[0];
    expect(opts.format).toBe('multi');
    expect(opts.player.team).toEqual([PLAYER_SETS[0], PLAYER_SETS[1]]);
    expect(opts.partner).toEqual({ name: 'Pokémon Trainer Sina', team: partnerTeam(run.partner!) });
    expect(opts.partner!.team.map(s => s.species)).toEqual(picks('Sina').setIds.map(id => SETS[id].species));
    expect(opts.opponent2).toEqual({ kind: 'team', name: run.next.second!.displayName, team: run.next.second!.team });
    battle.end('p1');
    const after = controller.run('multi-super')!;
    expect(after.history[0].opponent).toBe(`${run.next.displayName} & ${run.next.second!.displayName}`);
    expect(after.bp).toBe(bpForWin('super', 1));
  });

  it('lets you buy special trainers you beat for 100 BP, with six Pokémon to choose two from', () => {
    // A seed whose battle 10 is a special trainer you don't start with.
    const seed = Array.from({ length: 50 }, (_, i) => `scout-${i}`).find(s => {
      const p = planOpponent(s, 'singles', 'super', 10, DEFAULT_SETTINGS);
      return p.kind === 'special' && !['Sina', 'Dexio'].includes(TRAINERS[p.trainerId].name);
    })!;
    const { controller, battle, store } = setup();
    controller.debugUnlockSuper('singles');
    controller.startRun({ course: 'super', team: SINGLES_TEAM, settings: DEFAULT_SETTINGS, seedText: seed });
    expect(() => controller.buyPartner('Cynthia')).toThrow(/Beat Cynthia/);
    const name = TRAINERS[winThrough(controller, battle, 'singles-super', 9).next.trainerId].name;
    winThrough(controller, battle, 'singles-super', 10);
    expect(store.getState().profile.partners.available).toEqual([name]);
    expect(() => controller.buyPartner(name)).toThrow(/costs 100 BP/);

    store.updateProfile(p => ({ ...p, bpTotal: p.bpTotal + PARTNER_COST }));
    const before = store.getState().profile;
    controller.buyPartner(name);
    const after = store.getState().profile;
    expect(after.partners.available).toEqual([]);
    const { offer } = after.partners.owned[name];
    expect(offer.length).toBeGreaterThanOrEqual(2);
    expect(offer.length).toBeLessThanOrEqual(6);
    for (const id of offer) expect(specialTrainer(name).roster).toContain(id);
    expect(bpBalance(after)).toBe(bpBalance(before) - PARTNER_COST);
    // Now they can be a partner, with two Pokémon from their offer.
    controller.debugUnlockSuper('multi');
    const run = controller.startRun({ format: 'multi', course: 'super', team: MULTI_TEAM, settings: DEFAULT_SETTINGS, partner: { name, setIds: [offer[1], offer[0]] } });
    expect(run.partner?.setIds).toEqual([offer[1], offer[0]]);
  });

  it("practice runs don't make anyone buyable", () => {
    const { controller, battle, store } = setup();
    controller.debugUnlockSuper('singles');
    controller.startRun({ course: 'super', team: SINGLES_TEAM, settings: { ...DEFAULT_SETTINGS, ai: 'random' }, seedText: 'practice' });
    winThrough(controller, battle, 'singles-super', 10);
    expect(store.getState().profile.partners.available).toEqual([]);
  });

  it('migrates saves from before Multi (no partners, no BP spent)', () => {
    const kv = memoryStore();
    setup(kv).controller.startRun({ course: 'normal', team: SINGLES_TEAM, settings: DEFAULT_SETTINGS, seedText: 'old' });
    const file = JSON.parse(kv.get('tree.v1')!);
    delete file.profile.partners;
    delete file.profile.bpSpent;
    delete file.profile.records['multi-super'];
    file.profile.bpTotal = 42;
    kv.set('tree.v1', JSON.stringify(file));
    const { store } = setup(kv);
    const profile = store.getState().profile;
    expect(profile.partners).toEqual(defaultPartnerBook());
    expect(bpBalance(profile)).toBe(42);
    expect(profile.records['multi-super']).toEqual({ best: 0, last: 0 });
  });

  it('migrates partner books from before offers (fixed two Pokémon, "scoutable" trainers)', () => {
    const kv = memoryStore();
    setup(kv);
    new RunStore(kv).updateProfile(p => p);
    const file = JSON.parse(kv.get('tree.v1')!);
    file.profile.partners = { owned: { Sina: { setIds: [1, 2] }, Cynthia: { setIds: [3, 4] } }, scoutable: { Guzma: { setIds: [5, 6] } } };
    kv.set('tree.v1', JSON.stringify(file));
    const { partners } = new RunStore(kv).getState().profile;
    expect(Object.keys(partners.owned).sort()).toEqual(['Cynthia', 'Dexio', 'Sina']);
    expect(partners.owned.Cynthia.offer.length).toBeGreaterThanOrEqual(2);
    expect(partners.available).toEqual(['Guzma']);
  });
});

describe('Starting at a later battle (checkpoints)', () => {
  it('unlocks battle 20 after winning battle 50, and battle 50 after winning battle 100, per course', () => {
    const { controller, battle, store } = setup();
    controller.debugUnlockSuper('singles');
    const start = (checkpoint: number) => controller.startRun({ course: 'super', team: SINGLES_TEAM, settings: DEFAULT_SETTINGS, seedText: `cp-${checkpoint}`, checkpoint });
    expect(() => start(20)).toThrow(/won battle 50/);
    const setBest = (best: number) => store.updateProfile(p => ({ ...p, records: { ...p.records, 'singles-super': { best, last: 0 } } }));
    setBest(50);
    expect(() => start(50)).toThrow(/won battle 100/);
    expect(() => start(30)).toThrow(/can't start at battle 30/);
    const run = start(20);
    expect([run.battle, run.wins, run.debug, run.next.battle]).toEqual([20, 19, false, 20]);
    // It counts: winning battle 20 is a 20-win streak.
    winThrough(controller, battle, 'singles-super', 20);
    expect(controller.run('singles-super')!.wins).toBe(20);
    expect(store.getState().profile.records['singles-super'].best).toBe(50);
    setBest(100);
    expect(start(50).next.displayName).toBe('Battle Legend Red');
    // Other courses keep their own records.
    controller.debugUnlockSuper('doubles');
    expect(() => controller.startRun({ format: 'doubles', course: 'super', team: { ...SINGLES_TEAM, bring: [0, 1, 2, 3] }, settings: DEFAULT_SETTINGS, checkpoint: 20 })).toThrow(/won battle 50/);
  });
});

describe('Multi: a real battle through the run', () => {
  it('plays battle 1 of Super Multi with the engine and records the result', async () => {
    const battle = new RealBattleClient(createInProcessTransport());
    const controller = new RunController(new RunStore(memoryStore()), battle);
    controller.debugUnlockSuper('multi');
    controller.startRun({ format: 'multi', course: 'super', team: MULTI_TEAM, settings: DEFAULT_SETTINGS, seedText: 'real-multi', partner: picks('Sina') });
    let lastRev = -1;
    const stop = battle.subscribe(() => {
      const s = battle.getSnapshot();
      if (s.phase !== 'active' || !s.request || s.awaiting || s.rev === lastRev) return;
      lastRev = s.rev;
      queueMicrotask(() => battle.choose('default'));
    });
    controller.startBattle('multi-super');
    const run = await new Promise<RunState>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), 20000);
      const unsub = controller.subscribe(() => {
        const r = controller.run('multi-super')!;
        if (r.status !== 'in-battle') { clearTimeout(timer); unsub(); resolve(r); }
      });
    });
    stop();
    expect(controller.getSnapshot().error).toBeNull();
    expect(battle.getSnapshot().battle!.gameType).toBe('multi');
    expect(battle.getSnapshot().opponentName).toContain(' & ');
    expect(run.history).toHaveLength(1);
    expect(['ready', 'lost']).toContain(run.status);
    battle.dispose();
  });
});
