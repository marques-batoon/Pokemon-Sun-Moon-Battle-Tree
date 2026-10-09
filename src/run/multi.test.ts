import { describe, expect, it } from 'vitest';
import type { BattleClient, BattleSnapshot, StartOptions } from '../client/battle-client';
import { BattleClient as RealBattleClient } from '../client/battle-client';
import { TRAINERS } from '../data/battle-tree';
import { TEST_PLAYER_TEAM_TEXT } from '../engine/fixtures-data';
import { createInProcessTransport } from '../engine/in-process-transport';
import { memoryStore, type KeyValueStore } from '../storage/kv';
import { importShowdownText } from '../team/showdown-text';
import { RunController, type RunTeam } from './controller';
import { defaultPartnerBook, partnersForSale, partnerTeam, rollOffer, specialTrainer } from './partners';
import { Rng } from './rng';
import { RunStore } from './run-store';
import { bpForWin, planChosenOpponent, planOpponent, teamSizeFor } from './selection';
import { canField } from './opponent';
import { SETS } from '../data/battle-tree';
import { bpBalance, DEFAULT_SETTINGS, partnerPrice, type RunState } from './types';

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

  it('draws battle 50 between Red & Blue and Marques & Thomas (weight 7 each), Marques always first', () => {
    const pairs = new Map<string, number>();
    const n = 4000;
    for (let i = 0; i < n; i++) {
      const plan = planOpponent(`b50-${i}`, 'multi', 'super', 50, DEFAULT_SETTINGS, SINA);
      const names = `${plan.displayName} & ${plan.second!.displayName}`;
      pairs.set(names, (pairs.get(names) ?? 0) + 1);
      expect([plan.team.length, plan.second!.team.length]).toEqual([2, 2]);
      expect(plan.kind).toBe('legend');
    }
    expect([...pairs.keys()].sort()).toEqual(['Battle Legend Red & Battle Legend Blue', 'Pokémon Trainer Marques & Pokémon Trainer Thomas']);
    // 7 : 7, so about half each.
    expect(Math.abs(pairs.get('Pokémon Trainer Marques & Pokémon Trainer Thomas')! - n / 2)).toBeLessThan(4.5 * Math.sqrt(n / 4));
    // Their teams come from their own sets, with their own moves.
    const plan = [...Array(200).keys()].map(i => planOpponent(`mt-${i}`, 'multi', 'super', 50, DEFAULT_SETTINGS, SINA)).find(p => p.displayName.endsWith('Marques'))!;
    expect(plan.team.every(s => ['Venusaur', 'Poliwrath', 'Alakazam'].includes(s.species))).toBe(true);
    expect(plan.second!.team.every(s => ['Ampharos', 'Infernape', 'Drampa'].includes(s.species))).toBe(true);
    const venusaur = SETS.find(s => s.label === 'Venusaur (Marques 1)')!;
    expect(venusaur.moves).toContain('Hidden Power Fire');
  });

  it('keeps Red alone at battle 50 of Super Singles and Blue in Super Doubles', () => {
    for (let i = 0; i < 50; i++) {
      expect(planOpponent(`s50-${i}`, 'singles', 'super', 50, DEFAULT_SETTINGS).displayName).toBe('Battle Legend Red');
      expect(planOpponent(`d50-${i}`, 'doubles', 'super', 50, DEFAULT_SETTINGS).displayName).toBe('Battle Legend Blue');
    }
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
    expect(book.beaten).toEqual({});
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

  it('prices a partner at 1000 BP after one win, 100 BP less per extra win, never below 100', () => {
    expect([1, 2, 3, 9, 10, 11, 50].map(partnerPrice)).toEqual([1000, 900, 800, 200, 100, 100, 100]);
  });

  it('lets you buy special trainers you beat, cheaper the more you beat them, with six Pokémon to choose two from', () => {
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
    expect(store.getState().profile.partners.beaten).toEqual({ [name]: 1 });
    expect(partnersForSale(store.getState().profile.partners)).toEqual([{ name, timesBeaten: 1, price: 1000 }]);
    expect(() => controller.buyPartner(name)).toThrow(/costs 1000 BP/);

    // Beating them twice more takes 200 BP off.
    store.updateProfile(p => ({ ...p, partners: { ...p.partners, beaten: { [name]: 3 } }, bpTotal: p.bpTotal + 800 }));
    expect(partnersForSale(store.getState().profile.partners)[0].price).toBe(800);
    const before = store.getState().profile;
    controller.buyPartner(name);
    const after = store.getState().profile;
    expect(partnersForSale(after.partners)).toEqual([]);
    expect(() => controller.buyPartner(name)).toThrow(/already your partner/);
    const { offer } = after.partners.owned[name];
    expect(offer.length).toBeGreaterThanOrEqual(2);
    expect(offer.length).toBeLessThanOrEqual(6);
    for (const id of offer) expect(specialTrainer(name).roster).toContain(id);
    expect(bpBalance(after)).toBe(bpBalance(before) - 800);
    // Now they can be a partner, with two Pokémon from their offer.
    controller.debugUnlockSuper('multi');
    const run = controller.startRun({ format: 'multi', course: 'super', team: MULTI_TEAM, settings: DEFAULT_SETTINGS, partner: { name, setIds: [offer[1], offer[0]] } });
    expect(run.partner?.setIds).toEqual([offer[1], offer[0]]);
  });

  it('counts a win over each special trainer in a Multi Battle', () => {
    const { controller, battle, store } = setup();
    controller.debugUnlockSuper('multi');
    controller.startRun({ format: 'multi', course: 'super', team: MULTI_TEAM, settings: DEFAULT_SETTINGS, seedText: 'pairs', partner: picks('Sina') });
    const at10 = winThrough(controller, battle, 'multi-super', 9).next;
    winThrough(controller, battle, 'multi-super', 10);
    const names = [at10, at10.second!].map(t => TRAINERS[t.trainerId].name);
    expect(store.getState().profile.partners.beaten).toEqual(Object.fromEntries(names.map(n => [n, 1])));
  });

  it("practice runs don't make anyone buyable", () => {
    const { controller, battle, store } = setup();
    controller.debugUnlockSuper('singles');
    controller.startRun({ course: 'super', team: SINGLES_TEAM, settings: { ...DEFAULT_SETTINGS, ai: 'random' }, seedText: 'practice' });
    winThrough(controller, battle, 'singles-super', 10);
    expect(store.getState().profile.partners.beaten).toEqual({});
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

  it('migrates partner books from earlier versions (fixed two Pokémon, "scoutable" or "available" trainers)', () => {
    const kv = memoryStore();
    setup(kv);
    new RunStore(kv).updateProfile(p => p);
    const file = JSON.parse(kv.get('tree.v1')!);
    file.profile.partners = { owned: { Sina: { setIds: [1, 2] }, Cynthia: { setIds: [3, 4] } }, scoutable: { Guzma: { setIds: [5, 6] } }, available: ['Wally'] };
    kv.set('tree.v1', JSON.stringify(file));
    const { partners } = new RunStore(kv).getState().profile;
    expect(Object.keys(partners.owned).sort()).toEqual(['Cynthia', 'Dexio', 'Sina']);
    expect(partners.owned.Cynthia.offer.length).toBeGreaterThanOrEqual(2);
    expect(partners.beaten).toEqual({ Wally: 1, Guzma: 1 });
    expect(partnersForSale(partners).map(p => p.price)).toEqual([1000, 1000]);
  });
});

describe('Debug: choosing the next opponents', () => {
  const id = (name: string) => specialTrainer(name).id;

  it('replaces the next opponent with the chosen special trainer and makes the run unranked', () => {
    const { controller, battle } = setup();
    controller.startRun({ course: 'normal', team: SINGLES_TEAM, settings: DEFAULT_SETTINGS, seedText: 'pick' });
    controller.debugChooseOpponent('singles-normal', [id('Cynthia')]);
    const run = controller.run('singles-normal')!;
    expect([run.next.displayName, run.next.battle, run.next.team.length, run.debug]).toEqual(['Pokémon Trainer Cynthia', 1, 3, true]);
    expect(() => controller.debugChooseOpponent('singles-normal', [0])).toThrow(/special trainers or Battle Legends/);
    // Battle Legends too: Blue's Super team in a Single Battle brings 3.
    controller.debugChooseOpponent('singles-normal', [191]);
    expect([controller.run('singles-normal')!.next.displayName, controller.run('singles-normal')!.next.team.length]).toEqual(['Battle Legend Blue', 3]);
    // The battle after is drawn as usual.
    winThrough(controller, battle, 'singles-normal', 1);
    expect(controller.run('singles-normal')!.next.kind).toBe('regular');
  });

  it('takes two opponents in Multi, keeps Tate and Liza together, and never your partner', () => {
    const { controller } = setup();
    controller.debugUnlockSuper('multi');
    controller.startRun({ format: 'multi', course: 'super', team: MULTI_TEAM, settings: DEFAULT_SETTINGS, seedText: 'pick-multi', partner: picks('Sina') });
    controller.debugChooseOpponent('multi-super', [id('Brock'), id('Misty')]);
    let next = controller.run('multi-super')!.next;
    expect([next.displayName, next.second!.displayName]).toEqual(['Gym Leader Brock', 'Gym Leader Misty']);
    expect([next.team.length, next.second!.team.length]).toEqual([2, 2]);
    controller.debugChooseOpponent('multi-super', [id('Liza')]);
    next = controller.run('multi-super')!.next;
    expect([next.displayName, next.second!.displayName]).toEqual(['Gym Leader Liza', 'Gym Leader Tate']);
    expect(() => controller.debugChooseOpponent('multi-super', [id('Brock'), id('Tate')])).toThrow(/only battles alongside Liza/);
    expect(() => controller.debugChooseOpponent('multi-super', [id('Brock')])).toThrow(/two different/);
    expect(() => controller.debugChooseOpponent('multi-super', [id('Sina'), id('Brock')])).toThrow(/partner/);
    // Battle Legends: Red with anyone; Marques and Thomas together, Marques first, whichever is picked.
    controller.debugChooseOpponent('multi-super', [190, id('Cynthia')]);
    next = controller.run('multi-super')!.next;
    expect([next.displayName, next.second!.displayName]).toEqual(['Battle Legend Red', 'Pokémon Trainer Cynthia']);
    const legend = (name: string) => TRAINERS.find(t => t.kind === 'legend' && t.name === name)!.id;
    controller.debugChooseOpponent('multi-super', [legend('Thomas')]);
    next = controller.run('multi-super')!.next;
    expect([next.displayName, next.second!.displayName]).toEqual(['Pokémon Trainer Marques', 'Pokémon Trainer Thomas']);
    expect(() => controller.debugChooseOpponent('multi-super', [190, legend('Marques')])).toThrow(/only battles alongside Thomas/);
  });

  it('only offers trainers who can field a team in that format (Marques has 3 Pokémon: no Doubles)', () => {
    const marques = TRAINERS.find(t => t.kind === 'legend' && t.name === 'Marques')!;
    expect([teamSizeFor(marques, 'singles'), teamSizeFor(marques, 'doubles'), teamSizeFor(marques, 'multi')]).toEqual([3, 4, 2]);
    expect([canField(marques, 3), canField(marques, 4)]).toEqual([true, false]);
    expect(() => planChosenOpponent('x', 'doubles', 1, [marques.id])).toThrow(/can't field 4/);
    // Red's Normal team (3 in Singles) brings 4 in Doubles.
    expect(planChosenOpponent('x', 'doubles', 1, [203]).team).toHaveLength(4);
  });
});

describe('Starting at a later battle (checkpoints)', () => {
  it('unlocks battle 30 after winning battle 50, and battle 50 after winning battle 100, per course', () => {
    const { controller, battle, store } = setup();
    controller.debugUnlockSuper('singles');
    const start = (checkpoint: number) => controller.startRun({ course: 'super', team: SINGLES_TEAM, settings: DEFAULT_SETTINGS, seedText: `cp-${checkpoint}`, checkpoint });
    expect(() => start(30)).toThrow(/won battle 50/);
    const setBest = (best: number) => store.updateProfile(p => ({ ...p, records: { ...p.records, 'singles-super': { best, last: 0 } } }));
    setBest(50);
    expect(() => start(50)).toThrow(/won battle 100/);
    expect(() => start(20)).toThrow(/can't start at battle 20/);
    const run = start(30);
    expect([run.battle, run.wins, run.debug, run.next.battle]).toEqual([30, 29, false, 30]);
    // Battle 30 is a special-trainer battle; it counts: winning it is a 30-win streak.
    expect(run.next.kind).toBe('special');
    winThrough(controller, battle, 'singles-super', 30);
    expect(controller.run('singles-super')!.wins).toBe(30);
    expect(store.getState().profile.records['singles-super'].best).toBe(50);
    setBest(100);
    expect(start(50).next.displayName).toBe('Battle Legend Red');
    // Other courses keep their own records.
    controller.debugUnlockSuper('doubles');
    expect(() => controller.startRun({ format: 'doubles', course: 'super', team: { ...SINGLES_TEAM, bring: [0, 1, 2, 3] }, settings: DEFAULT_SETTINGS, checkpoint: 30 })).toThrow(/won battle 50/);
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
