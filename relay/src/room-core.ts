// The relay's rules, without Cloudflare APIs (so they can be unit-tested).
import {
  GUEST_SEAT, HOST_SEAT, MAX_MESSAGE_CHARS, RATE_LIMIT, RATE_WINDOW_MS, type ClientMessage,
} from '../../src/online/relay-protocol';

/** What the relay remembers about each connection (kept on the WebSocket, survives hibernation). */
export interface Attachment {
  seat: number;
  /** Set once the trainer name is accepted. */
  name: string | null;
  windowStart: number;
  count: number;
}

/** Seat for a new connection, or why it can't join. `create`: making the room. `taken`: seats in use. */
export function joinSeat(create: boolean, taken: readonly number[]): number | string {
  if (create) return taken.length ? 'That room code is already in use. Make a new room.' : HOST_SEAT;
  if (!taken.includes(HOST_SEAT)) return 'No room with that code (or it has closed).';
  if (taken.includes(GUEST_SEAT)) return 'That room is full.';
  return GUEST_SEAT;
}

/** Counts a message; false when the connection is over its limit. Updates the attachment in place. */
export function withinRate(att: Attachment, now: number): boolean {
  if (now - att.windowStart >= RATE_WINDOW_MS) {
    att.windowStart = now;
    att.count = 0;
  }
  att.count++;
  return att.count <= RATE_LIMIT;
}

/** A message from the app, or null if it isn't one (wrong type, too big, not JSON, unknown shape). */
export function parseClientMessage(raw: unknown): ClientMessage | null {
  if (typeof raw !== 'string' || raw.length > MAX_MESSAGE_CHARS) return null;
  let msg: unknown;
  try { msg = JSON.parse(raw); } catch { return null; }
  if (!msg || typeof msg !== 'object') return null;
  const m = msg as { t?: unknown; name?: unknown; data?: unknown };
  if (m.t === 'hello' && typeof m.name === 'string') return { t: 'hello', name: m.name };
  if (m.t === 'msg' && 'data' in m) return { t: 'msg', data: m.data };
  return null;
}

/** Whether a page at `origin` may use the relay. `allowed`: comma-separated origins (ALLOWED_ORIGINS). */
export function originAllowed(origin: string | null, allowed: string): boolean {
  if (!origin) return false;
  return allowed.split(',').map(o => o.trim().replace(/\/+$/, '')).filter(Boolean).includes(origin);
}
