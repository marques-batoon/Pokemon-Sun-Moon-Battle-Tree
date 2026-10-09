// Messages between the app and the relay server (relay/). Shared by both, no
// dependencies. The relay only passes `msg` data between the two players of a
// room; it never reads it. See relay/README.md.

/** Room codes: 8 characters without look-alikes (no 0/O, 1/I), about 40 bits: unguessable, easy to read out. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE = /^[A-HJ-NP-Z2-9]{8}$/;

/** Seats: 0 made the room (runs the battle), 1 joined it. */
export const HOST_SEAT = 0;
export const GUEST_SEAT = 1;

/** Largest message the relay accepts (characters). A battle turn for one player is a few KB. */
export const MAX_MESSAGE_CHARS = 64_000;
/** Messages a connection may send per RATE_WINDOW_MS before the relay disconnects it. */
export const RATE_LIMIT = 60;
export const RATE_WINDOW_MS = 10_000;
/** Rooms close this long after they're made, whatever happens. */
export const ROOM_LIFETIME_MS = 6 * 60 * 60 * 1000;
/** Keep-alive text the app sends; the relay answers "pong" without waking the room. */
export const PING = 'ping';
export const PONG = 'pong';

export interface Member {
  seat: number;
  name: string;
}

/** App to relay. "hello" first (with the trainer name), then any number of "msg". */
export type ClientMessage =
  | { t: 'hello'; name: string }
  | { t: 'msg'; data: unknown };

/** Relay to app. "error" is followed by the relay closing the connection. */
export type ServerMessage =
  | { t: 'welcome'; seat: number }
  | { t: 'members'; members: Member[] }
  | { t: 'msg'; from: number; data: unknown }
  | { t: 'error'; message: string };

/** WebSocket close codes the relay uses (4000-4999 are free for apps). */
export const CLOSE = {
  rejected: 4000,
  badName: 4001,
  expired: 4002,
  badMessage: 4003,
  tooMany: 4008,
} as const;

/** A fresh room code, from the browser's (or Worker's) cryptographic random source. */
export function newRoomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return [...bytes].map(b => ROOM_CODE_ALPHABET[b % ROOM_CODE_ALPHABET.length]).join('');
}
