import type { BattleClient, BattleSnapshot } from '../client/battle-client';
import type { AIKind } from '../engine/protocol';
import { pairedTrainer, TRAINERS } from '../data/battle-tree';
import type { PokemonSet } from '../team/types';
import { partnerTeam, rollOffer, runPartner } from './partners';
import { Rng } from './rng';
import type { RunStore, TreeState } from './run-store';
import { bpForWin, courseSchedule, displayName, planChosenOpponent, planOpponent } from './selection';
import {
  bpBalance, BRING, CHECKPOINTS, checkpointsFor, COURSES, DEFAULT_SETTINGS, isSuperUnlocked, MIN_REGISTERED, opponentLabel, partnerPrice, runKey,
  type Course, type Format, type PlannedOpponent, type RunKey, type RunSettings, type RunState, type TreeProfile, type UnlockFormat,
} from './types';

export interface RunTeam {
  sourceTeamId: string | null;
  name: string;
  sets: PokemonSet[];
  /** Indices into sets, battle order (lead first). Exactly 3 in Singles, 4 in Doubles. */
  bring: number[];
}

export interface StartRunOptions {
  /** Default 'singles'. */
  format?: Format;
  course: Course;
  team: RunTeam;
  settings: RunSettings;
  /** Fixed base seed for reproducible runs; random if omitted. */
  seedText?: string;
  /** Debug: begin at this battle number. Marks the run as debug (never counts toward records). */
  startBattle?: number;
  /** Multi (required): a partner you own and the two of their Pokémon (set ids from their offer) they bring, lead first. */
  partner?: { name: string; setIds: number[] };
  /**
   * Start at a later battle you've unlocked (checkpointsFor): 30 after winning battle 50, 50 after
   * winning battle 100. The streak counts from there (battle 30 = 29 wins); the run still counts.
   */
  checkpoint?: number;
}

export interface ControllerSnapshot extends TreeState {
  /** Battle currently being played in this session. */
  active: { key: RunKey; battleId: string } | null;
  /** Last problem starting a battle (e.g. the engine rejected the team). */
  error: string | null;
}

/**
 * Runs the Battle Tree loop: plans opponents, starts battles through the
 * BattleClient, applies results (streak, BP, records, Super unlock) and
 * persists everything through the RunStore.
 */
export class RunController {
  private readonly store: RunStore;
  private readonly battle: BattleClient;
  private readonly ai: AIKind;
  private readonly now: () => number;
  /** The player's trainer name (Settings), read when each battle starts. */
  private readonly playerName: () => string;
  private active: ControllerSnapshot['active'] = null;
  private error: string | null = null;
  private snapshot: ControllerSnapshot;
  private readonly listeners = new Set<() => void>();

  constructor(store: RunStore, battle: BattleClient, opts: { ai?: AIKind; now?: () => number; playerName?: () => string } = {}) {
    this.store = store;
    this.battle = battle;
    this.ai = opts.ai ?? 'heuristic';
    this.now = opts.now ?? Date.now;
    this.playerName = opts.playerName ?? (() => 'Player');
    this.snapshot = this.build();
    store.subscribe(() => this.refresh());
    battle.subscribe(() => this.onBattle(battle.getSnapshot()));
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  getSnapshot = (): ControllerSnapshot => this.snapshot;

  /** The client playing this controller's battles (for the battle screen). */
  get battleClient(): BattleClient {
    return this.battle;
  }

  run(key: RunKey): RunState | undefined {
    return this.store.getState().runs[key];
  }

  /** The run's battle was started but the app reloaded before it finished. */
  isInterrupted(key: RunKey): boolean {
    return this.run(key)?.status === 'in-battle' && this.active?.key !== key;
  }

  startRun(opts: StartRunOptions): RunState {
    const { course, team, settings } = opts;
    const format = opts.format ?? 'singles';
    if (!COURSES[format].includes(course)) throw new Error(`There's no ${course} ${format} course.`);
    const key = runKey(format, course);
    const { profile } = this.store.getState();
    if (course === 'super' && !isSuperUnlocked(profile, format) && !opts.startBattle) throw new Error(LOCKED[format]);
    checkBring(team, format);
    if (format === 'multi' && !opts.partner) throw new Error('Choose a partner for the Multi Battle.');
    const partner = format === 'multi' ? runPartner(opts.partner!.name, opts.partner!.setIds, profile.partners) : undefined;
    const existing = this.run(key);
    if (existing && !isFinished(existing)) this.endRun(existing, 'retired');

    if (opts.checkpoint && !checkpointsFor(profile.records[key]).includes(opts.checkpoint)) {
      const by = CHECKPOINTS.find(c => c.start === opts.checkpoint)?.unlockedBy;
      throw new Error(by ? `Starting at battle ${opts.checkpoint} unlocks once you've won battle ${by} of this course.` : `You can't start at battle ${opts.checkpoint}.`);
    }
    const debugStart = Math.max(1, opts.startBattle ?? 1);
    const battle = debugStart > 1 ? debugStart : opts.checkpoint ?? 1;
    const length = courseSchedule(format, course).length;
    if (length !== null && battle > length) throw new Error(`The ${course} course has ${length} battles.`);
    const seedText = opts.seedText ?? `${this.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const t = this.now();
    const fullSettings: RunSettings = { ...DEFAULT_SETTINGS, ...settings };
    const run: RunState = {
      id: `${key}-${t.toString(36)}`,
      format,
      course,
      settings: fullSettings,
      seedText,
      team: structuredClone(team),
      battle,
      wins: battle - 1,
      bp: 0,
      status: 'ready',
      next: planOpponent(seedText, format, course, battle, settings, partner?.trainerId),
      ...(partner && { partner }),
      history: [],
      // Checkpoint starts count; debug starts ("start at battle N") and practice runs don't.
      debug: debugStart > 1 || fullSettings.ai !== 'heuristic',
      startedAt: t,
      updatedAt: t,
    };
    this.store.updateProfile(p => ({ ...p, settings: fullSettings }));
    this.save(run);
    return this.requireRun(key);
  }

  /**
   * Swap the registered team or the 3 brought between battles. The game allows
   * this after taking a break (Smogon Battle Tree guide); the streak continues.
   */
  changeTeam(key: RunKey, team: RunTeam): void {
    const run = this.requireRun(key);
    if (run.status !== 'ready') throw new Error('The team can only be changed between battles.');
    checkBring(team, run.format);
    this.save({ ...run, team: structuredClone(team) });
  }

  updateSettings(key: RunKey, patch: Partial<Pick<RunSettings, 'teamPreviewEachBattle'>>): void {
    const run = this.requireRun(key);
    this.save({ ...run, settings: { ...run.settings, ...patch } });
  }

  /** Starts the planned battle. Returns the battle id. */
  startBattle(key: RunKey): string {
    const run = this.requireRun(key);
    if (run.status !== 'ready' && !this.isInterrupted(key)) throw new Error(`Can't start a battle while the run is ${run.status}.`);
    const preview = run.settings.teamPreviewEachBattle;
    const sets = preview ? run.team.sets : run.team.bring.map(i => run.team.sets[i]);
    this.error = null;
    const { next, partner } = run;
    const battleId = this.battle.start({
      format: run.format,
      teamPreview: preview,
      seedText: next.seedText,
      player: { name: this.playerName(), team: sets },
      opponent: { kind: 'team', name: next.displayName, team: next.team },
      ...(partner && next.second && {
        partner: { name: displayName(TRAINERS[partner.trainerId]), team: partnerTeam(partner) },
        opponent2: { kind: 'team' as const, name: next.second.displayName, team: next.second.team },
      }),
      ai: run.settings.ai ?? this.ai,
    });
    this.active = { key, battleId };
    this.save({ ...run, status: 'in-battle' });
    return battleId;
  }

  /** Interrupted battle: count it as a loss, as the game does. */
  forfeitInterrupted(key: RunKey): void {
    const run = this.requireRun(key);
    if (!this.isInterrupted(key)) return;
    this.recordLoss(run, 0);
  }

  /** Interrupted battle: replay it from the start (same opponent and seed). Not possible in the game. */
  restartInterrupted(key: RunKey): void {
    const run = this.requireRun(key);
    if (!this.isInterrupted(key)) return;
    this.save({ ...run, status: 'ready' });
  }

  /** Give up the challenge between battles. Ends the streak. */
  retire(key: RunKey): void {
    const run = this.requireRun(key);
    if (!isFinished(run)) this.endRun(run, 'retired');
  }

  /** Remove a finished run after its results were shown. */
  dismiss(key: RunKey): void {
    const run = this.run(key);
    if (run && isFinished(run)) this.store.setRun(key, null);
  }

  /** Defaults used to pre-fill new challenges. */
  updateDefaults(patch: Partial<RunSettings>): void {
    this.store.updateProfile(p => ({ ...p, settings: { ...p.settings, ...patch } }));
  }

  /** Erase records, BP, the Super unlock and saved runs. */
  resetProgress(): void {
    this.active = null;
    this.store.reset();
  }

  /**
   * Debug: the next battle is against special trainers or Battle Legends you choose (one; two in a
   * Multi Battle, not your partner or their twin). Makes the challenge unranked. Later battles are
   * drawn as usual.
   */
  debugChooseOpponent(key: RunKey, trainerIds: number[]): void {
    const run = this.requireRun(key);
    if (run.status !== 'ready') throw new Error('Choose opponents between battles.');
    const partnerId = run.partner?.trainerId;
    const banned = partnerId === undefined ? [] : [partnerId, ...(pairedTrainer(partnerId) ? [pairedTrainer(partnerId)!.partnerId] : [])];
    if (trainerIds.some(id => banned.includes(id))) throw new Error("Your partner (and their twin) can't be your opponent.");
    const next = planChosenOpponent(run.seedText, run.format, run.battle, trainerIds);
    this.save({ ...run, next, debug: true });
  }

  /** Debug helper: unlock Super Singles / Super Doubles (Multi: both) without clearing Normal. */
  debugUnlockSuper(format: Format = 'singles'): void {
    const formats: UnlockFormat[] = format === 'multi' ? ['singles', 'doubles'] : [format];
    this.store.updateProfile(p => ({ ...p, superUnlocked: { ...p.superUnlocked, ...Object.fromEntries(formats.map(f => [f, true])) } }));
  }

  /**
   * Buys a special trainer you've beaten as a Multi partner: 1000 BP after one win, 100 BP less for
   * each further win, at least 100 (partnerPrice).
   * Their offer (the six Pokémon you'll choose their two from) is rolled now.
   */
  buyPartner(name: string): void {
    const { profile } = this.store.getState();
    const timesBeaten = profile.partners.beaten[name] ?? 0;
    if (!timesBeaten) throw new Error(`Beat ${name} in a challenge before buying them as a partner.`);
    if (profile.partners.owned[name]) throw new Error(`${name} is already your partner.`);
    const price = partnerPrice(timesBeaten);
    if (bpBalance(profile) < price) throw new Error(`${name} costs ${price} BP.`);
    const offer = rollOffer(name, new Rng(`partner-offer|${name}|${this.now()}`));
    this.store.updateProfile(p => ({
      ...p,
      bpSpent: p.bpSpent + price,
      partners: { ...p.partners, owned: { ...p.partners.owned, [name]: { offer } } },
    }));
  }

  private onBattle(s: BattleSnapshot) {
    const active = this.active;
    if (!active || s.battleId !== active.battleId) return;
    const run = this.run(active.key);
    if (!run || run.status !== 'in-battle') return;

    if (s.phase === 'ended' && s.result) {
      this.active = null;
      if (s.result.winner === 'p1') this.recordWin(run, s.result.turns);
      else this.recordLoss(run, s.result.turns);
    } else if (s.phase === 'invalid-team' || s.phase === 'error') {
      this.active = null;
      this.error = s.phase === 'invalid-team' ? `Team rejected: ${s.problems.join(' ')}` : `Engine error: ${s.error}`;
      this.save({ ...run, status: 'ready' });
    }
  }

  private recordWin(run: RunState, turns: number) {
    const bp = bpForWin(run.course, run.battle);
    const wins = run.wins + 1;
    const history = [...run.history, { battle: run.battle, opponent: opponentLabel(run.next), result: 'win' as const, bp, turns, seedText: run.next.seedText }];
    const length = courseSchedule(run.format, run.course).length;
    const cleared = length !== null && run.battle >= length;
    const key = runKey(run.format, run.course);

    if (!run.debug) {
      this.store.updateProfile(p => ({
        ...p,
        bpTotal: p.bpTotal + bp,
        // Beating the Normal course's Battle Legend unlocks that format's Super course.
        superUnlocked: run.format === 'multi' ? p.superUnlocked : { ...p.superUnlocked, [run.format]: p.superUnlocked[run.format] || (run.course === 'normal' && cleared) },
        records: { ...p.records, [key]: { ...p.records[key], best: Math.max(p.records[key].best, wins) } },
        partners: withBeaten(p, run.next),
      }));
    }

    const base = { ...run, wins, bp: run.bp + bp, history };
    if (cleared) {
      this.finish({ ...base, status: 'cleared' });
    } else {
      const battle = run.battle + 1;
      this.save({ ...base, battle, status: 'ready', next: planOpponent(run.seedText, run.format, run.course, battle, run.settings, run.partner?.trainerId) });
    }
  }

  private recordLoss(run: RunState, turns: number) {
    const history = [...run.history, { battle: run.battle, opponent: opponentLabel(run.next), result: 'loss' as const, bp: 0, turns, seedText: run.next.seedText }];
    this.finish({ ...run, history, status: 'lost' });
  }

  private endRun(run: RunState, status: 'retired') {
    this.finish({ ...run, status });
  }

  private finish(run: RunState) {
    if (!run.debug) {
      this.store.updateProfile(p => {
        const key = runKey(run.format, run.course);
        return { ...p, records: { ...p.records, [key]: { best: Math.max(p.records[key].best, run.wins), last: run.wins } } };
      });
    }
    this.save(run);
  }

  private requireRun(key: RunKey): RunState {
    const run = this.run(key);
    if (!run) throw new Error(`No ${key} run in progress.`);
    return run;
  }

  private save(run: RunState) {
    this.store.setRun(runKey(run.format, run.course), { ...run, updatedAt: this.now() });
  }

  private build(): ControllerSnapshot {
    return { ...this.store.getState(), active: this.active, error: this.error };
  }

  private refresh() {
    this.snapshot = this.build();
    this.listeners.forEach(l => l());
  }
}

const LOCKED: Record<Format, string> = {
  singles: 'Super Singles unlocks after beating the Battle Legend in Normal Singles.',
  doubles: 'Super Doubles unlocks after beating the Battle Legend in Normal Doubles.',
  multi: 'Super Multi unlocks once Super Singles and Super Doubles are both unlocked.',
};

/** Counts a win over each special trainer just beaten (Battle Legends don't count): it sets their partner price. */
function withBeaten(p: TreeProfile, next: PlannedOpponent): TreeProfile['partners'] {
  const beaten = { ...p.partners.beaten };
  for (const t of [next, ...(next.second ? [next.second] : [])]) {
    if (t.kind !== 'special') continue;
    const { name } = TRAINERS[t.trainerId];
    beaten[name] = (beaten[name] ?? 0) + 1;
  }
  return { ...p.partners, beaten };
}

export const isFinished = (run: RunState) => run.status === 'cleared' || run.status === 'lost' || run.status === 'retired';

function checkBring(team: RunTeam, format: Format) {
  const { bring, sets } = team;
  const n = BRING[format];
  if (sets.length < MIN_REGISTERED[format]) throw new Error(`A ${format} team needs at least ${MIN_REGISTERED[format]} Pokémon.`);
  if (bring.length !== n || new Set(bring).size !== n || bring.some(i => i < 0 || i >= sets.length)) {
    throw new Error(`Choose exactly ${n} different Pokémon to bring.`);
  }
}
