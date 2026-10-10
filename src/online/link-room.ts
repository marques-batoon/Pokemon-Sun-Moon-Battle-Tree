import { BattleClient } from '../client/battle-client';
import { quotePick } from '../data/battle-tree';
import type { RunTeam } from '../run/controller';
import type { EngineTransport } from '../client/transport';
import type { FromEngine, ToEngine } from '../engine/protocol';
import { planChosenOpponent, planOpponent } from '../run/selection';
import { DEFAULT_SETTINGS, PARTNER_BRING, retryStart, type PlannedOpponent } from '../run/types';
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
  /** Host: just lost at battle 10 or later, so the next streak can also start from the last multiple of 10. */
  retryFrom: number | null;
}

/** Battles an online streak can start from (host's choice; online streaks earn no records or BP). */
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
}

const newSeed = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const EMPTY_LOBBY: LobbyView = { course: 'super', streak: 0, battle: 1, next: [], quotePick: null, hostReady: false, guestReady: false, inBattle: false, notice: null };

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
  private unlistenEngine: (() => void) | null = null;
  // Guest: hands the host's battle messages to the guest's battle client.
  private readonly relayed = new Set<(msg: FromEngine) => void>();

  constructor(opts: RoomOptions) {
    this.opts = opts;
    this.seedText = opts.seedText ?? newSeed();
    this.snapshot = {
      role: opts.role, code: opts.code, status: 'connecting', error: null, seat: null, members: [], partnerName: null,
      ready: false, lobby: EMPTY_LOBBY, battleId: null, battleFoes: [], battleQuotePick: null, aiPartner: false,
      startFrom: 1, fresh: true, retryFrom: null,
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
    this.set({
      battleId, battleFoes: [next.trainerId, next.second!.trainerId], battleQuotePick: quotePick(next.seedText), aiPartner: false, retryFrom: null,
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
   * or right after a loss at battle 10 or later, the last multiple of 10 before it (that time only).
   * Only before the streak's first win.
   */
  setStartBattle(battle: number): void {
    const { lobby, fresh } = this.snapshot;
    if (this.opts.role !== 'host' || lobby.inBattle || !fresh) throw new Error('Only the host can choose where a streak starts, before its first battle.');
    const options = this.startOptions();
    if (!options.includes(battle)) throw new Error(`A streak can start from battle ${options.join(', ').replace(/, (\d+)$/, ' or $1')}.`);
    this.planNext(battle);
    const sticky = (ONLINE_START_BATTLES as readonly number[]).includes(battle);
    this.set({ ...(sticky ? { startFrom: battle } : {}), lobby: { ...lobby, battle, streak: battle - 1, notice: null } });
    this.publishLobby();
  }

  /**
   * Host: the room's mode, Super Multi or All Star Mode (special trainers in every battle, the
   * battle-50 draw every 5th; online streaks earn no records or BP either way). Only before the
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
    this.next = planOpponent(this.seedText, 'multi', this.snapshot.lobby.course, battle, DEFAULT_SETTINGS);
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
        // A lost streak starts over (at the chosen starting battle) against new opponents; after a loss
        // at battle 10 or later, the host can also start again from the last multiple of 10.
        if (!won) this.seedText = newSeed();
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
      this.set({ battleId: engineMsg.battleId, battleFoes: this.snapshot.lobby.next, battleQuotePick: this.snapshot.lobby.quotePick });
    }
    this.relayed.forEach(h => h(engineMsg));
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
