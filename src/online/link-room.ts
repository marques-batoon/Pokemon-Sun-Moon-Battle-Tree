import { BattleClient } from '../client/battle-client';
import { quotePick } from '../data/battle-tree';
import type { RunTeam } from '../run/controller';
import type { EngineTransport } from '../client/transport';
import type { FromEngine, ToEngine } from '../engine/protocol';
import { bpForWin, planChosenOpponent, planOpponent } from '../run/selection';
import { PARTNER_BRING, retryStart, type PlannedOpponent } from '../run/types';
import type { PokemonSet } from '../team/types';
import {
  parseToGuest, parseToHost, withoutNicknames, type GuestEngineMessage, type LobbyView, type OnlineCourse, type ToGuest, type ToHost,
} from './link-protocol';
import type { ConnectRelay, RelayLink } from './relay-client';
import { GUEST_SEAT, HOST_SEAT, type Member, type ServerMessage } from './relay-protocol';
import { checkTrainerName } from './trainer-name';

export type Role = 'host' | 'guest';

export interface RoomSnapshot {
  role: Role;
  code: string;
  status: 'connecting' | 'open' | 'closed';
  /** Why the room closed, or what went wrong. */
  error: string | null;
  /** Your seat once the relay accepted you. */
  seat: number | null;
  members: Member[];
  /** The other player's name, while they're in the room. */
  partnerName: string | null;
  /** Your two Pokémon are chosen. */
  ready: boolean;
  lobby: LobbyView;
  /** Battle on screen (host: their own client's battle; guest: the one they follow). */
  battleId: string | null;
  /** That battle's opposing trainers (Battle Tree ids); the lobby moves on to the next pair when it ends. */
  battleFoes: number[];
  /** Which of their lines that battle uses (greeting and closing remark; see quotePick). */
  battleQuotePick: number | null;
  /** Host: the AI is playing for the partner in this battle. */
  aiPartner: boolean;
  /** Host: the battle each streak starts from (ONLINE_START_BATTLES). */
  startFrom: number;
  /** Host: no battle won yet since this streak started, so where it starts can still change. */
  fresh: boolean;
  /** Host: just lost after battle 10, so the next streak can also start from the last multiple of 10 won. */
  retryFrom: number | null;
  /** What your last win gave you (All Star Mode: BP and partner progress, in your own app), until the next battle. */
  lastReward: OnlineReward | null;
}

/** An online All Star Multi win, for each player's own records: BP and the trainers beaten (partner shop). */
export interface OnlineReward {
  course: 'allstar';
  battle: number;
  bp: number;
  trainerIds: number[];
}

/**
 * Battles an online streak can start from (host's choice). Online streaks earn no records; All Star Mode wins earn
 * BP and partner progress, in a streak started from battle 1 (or again from the last multiple of 10 after a loss).
 */
export const ONLINE_START_BATTLES = [1, 20] as const;

export interface RoomOptions {
  role: Role;
  code: string;
  /** Your trainer name (already checked). */
  name: string;
  connect: ConnectRelay;
  /** Host: the battle engine (the app's worker). */
  engine?: EngineTransport;
  /** Makes the battle client that shows the battle (host: on the engine; guest: on the relayed view). */
  makeClient: (transport: EngineTransport, perspective: 'p1' | 'p3') => BattleClient;
  /** Host: base seed of the first streak (random if left out; each new streak gets a new one). */
  seedText?: string;
  /** A won battle that earns rewards (All Star Mode): record them in this player's own app (RunController.recordOnlineWin). */
  onReward?: (reward: OnlineReward) => void;
}

const newSeed = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const EMPTY_LOBBY: LobbyView = { course: 'super', streak: 0, battle: 1, next: [], quotePick: null, hostReady: false, guestReady: false, inBattle: false, notice: null, rewards: false };

/**
 * One online Multi Battle room for one of its two players. Two friends team up
 * against Battle Tree trainers (Super Multi rules, Red and Blue at 50), keeping
 * a streak while they win.
 *
 * The host (who made the room) runs the battle engine: their Pokémon are p1,
 * the guest's are p3. The guest's client only shows the battle the host's
 * engine reports from the guest's side and sends back the guest's choices;
 * everything the guest sends is checked first (link-protocol.ts) and their
 * team is validated by the engine like the host's. The relay in between only
 * passes messages, so neither player learns the other's IP address.
 */
export class OnlineRoom {
  readonly client: BattleClient;
  private snapshot: RoomSnapshot;
  private readonly listeners = new Set<() => void>();
  private readonly opts: RoomOptions;
  private readonly link: RelayLink;
  // Host
  private myTeam: PokemonSet[] | null = null;
  private guestTeam: PokemonSet[] | null = null;
  private seedText: string;
  /** Your team choice (registered team and the two brought), kept so it survives the battle screen. */
  teamChoice: RunTeam | null = null;
  private next: PlannedOpponent | null = null;
  /** Host: this streak can earn rewards (it started at battle 1, or again from a retry battle after a loss). */
  private streakCounts = true;
  /** Host: the next opponents were chosen with debug tools (that battle earns nothing). */
  private debugNext = false;
  /** The battle on screen: its number, opponents and whether a win earns rewards (fixed when it starts). */
  private current: { battleId: string | null; battle: number; trainerIds: number[]; rewards: boolean; rewarded: boolean } | null = null;
  private unlistenEngine: (() => void) | null = null;
  // Guest: hands the host's battle messages to the guest's battle client.
  private readonly relayed = new Set<(msg: FromEngine) => void>();

  constructor(opts: RoomOptions) {
    this.opts = opts;
    this.seedText = opts.seedText ?? newSeed();
    this.snapshot = {
      role: opts.role, code: opts.code, status: 'connecting', error: null, seat: null, members: [], partnerName: null,
      ready: false, lobby: EMPTY_LOBBY, battleId: null, battleFoes: [], battleQuotePick: null, aiPartner: false,
      startFrom: 1, fresh: true, retryFrom: null, lastReward: null,
    };
    if (opts.role === 'host') {
      if (!opts.engine) throw new Error('The host needs the battle engine.');
      this.client = opts.makeClient(opts.engine, 'p1');
      this.unlistenEngine = opts.engine.listen(msg => this.fromEngine(msg));
      this.planNext(1);
    } else {
      this.client = opts.makeClient(this.guestTransport(), 'p3');
    }
    this.link = opts.connect({ onMessage: m => this.fromRelay(m), onClose: reason => this.closed(reason) });
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  getSnapshot = () => this.snapshot;

  /** Your two Pokémon (lead first), or null while not chosen. `choice`: the team picker's state, to restore it later. */
  setTeam(sets: PokemonSet[] | null, choice: RunTeam | null = null): void {
    this.teamChoice = choice;
    const team = sets && sets.length === PARTNER_BRING ? withoutNicknames(sets) : null;
    if (this.opts.role === 'host') {
      this.myTeam = team;
      this.set({ ready: !!team });
      this.publishLobby();
    } else {
      this.set({ ready: !!team });
      this.send({ k: 'team', sets: team });
    }
  }

  /** Host: starts the next battle (both teams ready, partner present). */
  startBattle(): void {
    const { partnerName, lobby } = this.snapshot;
    if (this.opts.role !== 'host' || !this.myTeam || !this.guestTeam || !partnerName || !this.next || lobby.inBattle) return;
    const next = this.next;
    const battleId = this.client.start({
      format: 'multi',
      teamPreview: false,
      seedText: next.seedText,
      player: { name: this.opts.name, team: this.myTeam },
      partner: { name: partnerName, team: this.guestTeam, human: true },
      opponent: { kind: 'team', name: next.displayName, team: next.team },
      opponent2: { kind: 'team', name: next.second!.displayName, team: next.second!.team },
      ai: 'heuristic',
    });
    this.current = { battleId, battle: next.battle, trainerIds: [next.trainerId, next.second!.trainerId], rewards: this.snapshot.lobby.rewards, rewarded: false };
    this.set({
      battleId, battleFoes: [next.trainerId, next.second!.trainerId], battleQuotePick: quotePick(next.seedText), aiPartner: false, retryFrom: null, lastReward: null,
      lobby: { ...this.snapshot.lobby, inBattle: true, notice: null },
    });
    this.publishLobby();
  }

  /**
   * Host with debug tools: the next battle is against these special trainers (two; Tate and Liza
   * come together). The guest only sees who the next opponents are, as for any battle.
   */
  debugChooseOpponents(trainerIds: number[]): void {
    if (this.opts.role !== 'host' || !this.next || this.snapshot.lobby.inBattle) throw new Error('Only the host can choose opponents, between battles.');
    this.next = planChosenOpponent(this.seedText, 'multi', this.next.battle, trainerIds);
    this.debugNext = true;
    this.publishLobby();
  }

  /** Host: the battles the next streak can start from (1, 20, and after a loss the last multiple of 10). */
  startOptions(): number[] {
    const { retryFrom } = this.snapshot;
    return [...new Set([...ONLINE_START_BATTLES, ...(retryFrom ? [retryFrom] : [])])].sort((a, b) => a - b);
  }

  /**
   * Host: start the streak from this battle instead, with the wins before it counted, as when a
   * local challenge starts at a later battle: 1 or 20 (a lost streak starts again from that one too),
   * or right after a loss after battle 10, the last multiple of 10 won before it (that time only).
   * Only before the streak's first win.
   */
  setStartBattle(battle: number): void {
    const { lobby, fresh } = this.snapshot;
    if (this.opts.role !== 'host' || lobby.inBattle || !fresh) throw new Error('Only the host can choose where a streak starts, before its first battle.');
    const options = this.startOptions();
    if (!options.includes(battle)) throw new Error(`A streak can start from battle ${options.join(', ').replace(/, (\d+)$/, ' or $1')}.`);
    // As a local challenge: a streak counts from battle 1, or started again from the last multiple of 10 after a loss.
    this.streakCounts = battle === 1 || battle === this.snapshot.retryFrom;
    this.planNext(battle);
    const sticky = (ONLINE_START_BATTLES as readonly number[]).includes(battle);
    this.set({ ...(sticky ? { startFrom: battle } : {}), lobby: { ...lobby, battle, streak: battle - 1, notice: null } });
    this.publishLobby();
  }

  /**
   * Host: the room's mode, Super Multi or All Star Mode (special trainers in every battle, the
   * battle-50 draw every 10th; its wins earn each player BP and partner progress). Only before the
   * streak's first win, like where it starts.
   */
  setCourse(course: OnlineCourse): void {
    const { lobby, fresh } = this.snapshot;
    if (this.opts.role !== 'host' || lobby.inBattle || !fresh) throw new Error('Only the host can change the mode, before a streak\'s first battle.');
    this.set({ lobby: { ...lobby, course, notice: null } });
    this.planNext(lobby.battle);
    this.publishLobby();
  }

  /** Host: the AI plays the partner's Pokémon for the rest of this battle (they left or stopped answering). */
  aiTakeOver(): void {
    const { battleId, lobby, aiPartner } = this.snapshot;
    if (this.opts.role !== 'host' || !battleId || !lobby.inBattle || aiPartner) return;
    this.opts.engine!.send({ type: 'takeover', battleId, side: 'p3' });
    this.set({ aiPartner: true });
  }

  /** Back to the room after a battle (clears the finished battle from the screen). */
  leaveBattleScreen(): void {
    this.set({ battleId: null });
  }

  leave(): void {
    this.link.close();
    this.closed('You left the room.');
  }

  dispose(): void {
    if (this.snapshot.status !== 'closed') this.leave();
    this.client.dispose();
  }

  // --- relay ---

  private fromRelay(msg: ServerMessage) {
    switch (msg.t) {
      case 'welcome':
        this.set({ status: 'open', seat: msg.seat });
        if (this.opts.role === 'host') this.publishLobby();
        return;
      case 'members': {
        const otherSeat = this.opts.role === 'host' ? GUEST_SEAT : HOST_SEAT;
        const other = msg.members.find(m => m.seat === otherSeat);
        // The relay checked the name; check again in case it's out of date or modified.
        const check = other ? checkTrainerName(other.name) : null;
        const partnerName = check ? (check.ok ? check.name : 'Partner') : null;
        const left = !!this.snapshot.partnerName && !partnerName;
        this.set({ members: msg.members, partnerName });
        if (this.opts.role === 'host') {
          if (left) {
            this.guestTeam = null;
            if (this.snapshot.lobby.inBattle) this.aiTakeOver();
          }
          this.publishLobby();
        } else if (left) {
          this.closed('The host left the room.');
          this.link.close();
        }
        return;
      }
      case 'msg':
        if (this.opts.role === 'host' && msg.from === GUEST_SEAT) this.fromGuest(parseToHost(msg.data));
        else if (this.opts.role === 'guest' && msg.from === HOST_SEAT) this.fromHost(parseToGuest(msg.data));
        return;
      default:
        return;
    }
  }

  private send(data: ToHost | ToGuest) {
    this.link.send(data);
  }

  private closed(reason: string) {
    if (this.snapshot.status === 'closed') return;
    this.unlistenEngine?.();
    const { battleId, lobby } = this.snapshot;
    // Host: a battle can't go on without the room (the guest is gone too).
    if (this.opts.role === 'host' && battleId && lobby.inBattle) this.opts.engine!.send({ type: 'stop', battleId });
    this.set({ status: 'closed', error: reason, partnerName: null });
  }

  // --- host ---

  private planNext(battle: number) {
    this.next = planOpponent(this.seedText, 'multi', this.snapshot.lobby.course, battle);
    this.debugNext = false;
  }

  /** A win of the battle on screen: its rewards (All Star Mode), once, for this player's own app. */
  private reward() {
    const c = this.current;
    if (!c || !c.rewards || c.rewarded) return;
    c.rewarded = true;
    const reward: OnlineReward = { course: 'allstar', battle: c.battle, bp: bpForWin('allstar', c.battle), trainerIds: c.trainerIds };
    this.opts.onReward?.(reward);
    this.set({ lastReward: reward });
  }

  private publishLobby() {
    if (this.opts.role !== 'host' || !this.next) return;
    const lobby: LobbyView = {
      ...this.snapshot.lobby,
      battle: this.next.battle,
      next: [this.next.trainerId, this.next.second!.trainerId],
      quotePick: quotePick(this.next.seedText),
      hostReady: !!this.myTeam,
      guestReady: !!this.guestTeam,
      rewards: this.snapshot.lobby.course === 'allstar' && this.streakCounts && !this.debugNext,
    };
    this.set({ lobby });
    if (this.snapshot.partnerName) this.send({ k: 'lobby', lobby });
  }

  private fromGuest(msg: ToHost | null) {
    if (!msg) return;
    const { battleId, lobby, aiPartner } = this.snapshot;
    if (msg.k === 'team') {
      if (lobby.inBattle) return;
      this.guestTeam = msg.sets;
      this.set({ lobby: { ...lobby, notice: null } });
      this.publishLobby();
    } else if (msg.k === 'choose' && msg.battleId === battleId && lobby.inBattle && !aiPartner) {
      this.opts.engine!.send({ type: 'choose', battleId, choice: msg.choice, side: 'p3' });
    }
  }

  /** The host's engine: relays the guest's view of the current battle and keeps score. */
  private fromEngine(msg: FromEngine) {
    const { battleId } = this.snapshot;
    if (!('battleId' in msg) || msg.battleId !== battleId) return;
    switch (msg.type) {
      case 'started':
        // The guest knows their own team; the seed stays with the host.
        this.relay({ ...msg, seed: '', playerTeam: this.guestTeam ?? [] });
        return;
      case 'chunks':
        if (msg.side === 'p3') this.relay({ type: 'chunks', battleId: msg.battleId, chunks: msg.chunks });
        return;
      case 'end': {
        // Only who won and how long it took: the input log would show every team.
        this.relay({ type: 'end', battleId: msg.battleId, result: { ...msg.result, inputLog: [], seed: '' as never } });
        const won = msg.result.winner === 'p1';
        const ended = this.snapshot.lobby.streak;
        const lostAt = this.next!.battle;
        const { startFrom } = this.snapshot;
        if (won) this.reward();
        // A lost streak starts over (at the chosen starting battle) against new opponents; after a loss
        // after battle 10, the host can also start again from the last multiple of 10 won (retryStart).
        if (!won) {
          this.seedText = newSeed();
          this.streakCounts = startFrom === 1;
        }
        this.planNext(won ? lostAt + 1 : startFrom);
        const retry = won ? null : retryStart(lostAt);
        const restart = ended > startFrom - 1 ? `The streak ended at ${ended}. Start again from battle ${startFrom}` : `You lost battle ${lostAt}. Try again from battle ${startFrom}`;
        const notice = won ? null : `${restart}${retry && retry !== startFrom ? `, or from battle ${retry}` : ''}.`;
        this.set({
          fresh: !won, retryFrom: retry && retry !== startFrom ? retry : null,
          lobby: { ...this.snapshot.lobby, streak: won ? ended + 1 : startFrom - 1, inBattle: false, notice },
        });
        this.publishLobby();
        return;
      }
      case 'invalid-team':
      case 'error': {
        this.relay(msg);
        // Most likely the guest's team: ask them for another.
        const notice = msg.type === 'invalid-team' ? msg.problems.join(' ') : `Battle error: ${msg.message}`;
        if (msg.type === 'invalid-team') this.guestTeam = null;
        this.set({ lobby: { ...this.snapshot.lobby, inBattle: false, notice } });
        this.publishLobby();
        return;
      }
      default:
        return;
    }
  }

  private relay(msg: GuestEngineMessage) {
    this.send({ k: 'engine', msg });
  }

  // --- guest ---

  private fromHost(msg: ToGuest | null) {
    if (!msg) return;
    if (msg.k === 'lobby') {
      this.set({ lobby: msg.lobby, ...(msg.lobby.notice && !msg.lobby.guestReady ? { ready: false } : {}) });
      return;
    }
    const engineMsg = msg.msg;
    if (engineMsg.battleId !== this.snapshot.battleId) {
      // A new battle opens with its first message (or with the host's engine turning it down).
      if (engineMsg.type !== 'started' && engineMsg.type !== 'invalid-team' && engineMsg.type !== 'error') return;
      this.client.attach(engineMsg.battleId);
      const { lobby } = this.snapshot;
      this.current = { battleId: engineMsg.battleId, battle: lobby.battle, trainerIds: lobby.next, rewards: lobby.rewards, rewarded: false };
      this.set({ battleId: engineMsg.battleId, battleFoes: lobby.next, battleQuotePick: lobby.quotePick, lastReward: null });
    }
    this.relayed.forEach(h => h(engineMsg));
    // Won together (the host's side, p1, is the guest's too): the guest's own rewards.
    if (engineMsg.type === 'end' && engineMsg.result.winner === 'p1' && this.current?.battleId === engineMsg.battleId) this.reward();
  }

  /** The guest's battle client talks to the host's engine through the room. */
  private guestTransport(): EngineTransport {
    return {
      send: (msg: ToEngine) => {
        if (msg.type === 'choose') this.send({ k: 'choose', battleId: msg.battleId, choice: msg.choice });
      },
      listen: handler => { this.relayed.add(handler); return () => { this.relayed.delete(handler); }; },
      dispose: () => this.relayed.clear(),
    };
  }

  private set(patch: Partial<RoomSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach(l => l());
  }
}
