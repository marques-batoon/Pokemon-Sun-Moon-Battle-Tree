import { PING, type ServerMessage } from './relay-protocol';

/** The relay server's address (https://….workers.dev), set at build time; online play is off without it. */
export const RELAY_URL: string | undefined = (import.meta.env.VITE_RELAY_URL as string | undefined)?.trim().replace(/\/+$/, '') || undefined;

export interface RelayHandlers {
  onMessage(msg: ServerMessage): void;
  /** The connection ended (the reason is shown to the player). */
  onClose(reason: string): void;
}

/** A player's connection to their room on the relay. */
export interface RelayLink {
  /** Sends app data to the other player (the relay wraps it as { t: 'msg' }). */
  send(data: unknown): void;
  close(): void;
}

export type ConnectRelay = (handlers: RelayHandlers) => RelayLink;

const KEEP_ALIVE_MS = 25_000;

const isServerMessage = (m: unknown): m is ServerMessage =>
  !!m && typeof m === 'object' && typeof (m as { t?: unknown }).t === 'string';

/**
 * Connects to a room over WebSocket: `create` makes the room (you host), otherwise
 * joins it. Sends the trainer name first; the relay checks it and answers with a
 * seat, or an error and a closed connection.
 */
export function relayConnector(baseUrl: string, code: string, create: boolean, name: string): ConnectRelay {
  return handlers => {
    const url = `${baseUrl.replace(/^http/, 'ws')}/rooms/${code}${create ? '?create=1' : ''}`;
    const ws = new WebSocket(url);
    let closed = false;
    let lastError: string | null = null;
    const keepAlive = setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.send(PING); }, KEEP_ALIVE_MS);
    const finish = (reason: string) => {
      if (closed) return;
      closed = true;
      clearInterval(keepAlive);
      handlers.onClose(reason);
    };
    ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', name }));
    ws.onmessage = e => {
      if (typeof e.data !== 'string' || e.data === 'pong') return;
      let msg: unknown;
      try { msg = JSON.parse(e.data); } catch { return; }
      if (!isServerMessage(msg)) return;
      if (msg.t === 'error') lastError = typeof msg.message === 'string' ? msg.message : 'The relay closed the connection.';
      else handlers.onMessage(msg);
    };
    ws.onerror = () => { lastError ??= "Couldn't reach the online server."; };
    ws.onclose = e => finish(lastError ?? (e.reason || 'Disconnected.'));
    return {
      send: data => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ t: 'msg', data })); },
      close: () => { closed = true; clearInterval(keepAlive); ws.close(1000, 'Left the room'); },
    };
  };
}
