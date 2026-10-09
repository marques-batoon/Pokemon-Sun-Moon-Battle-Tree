// Relay server for online Multi Battles (Cloudflare Worker + one Durable Object
// per room). It only passes messages between the two players of a room: it
// doesn't run battles, store anything about players, or log what they send.
//
//   GET /                      health check
//   GET /rooms/<CODE>?create=1 WebSocket: make a room (seat 0, the host)
//   GET /rooms/<CODE>          WebSocket: join it (seat 1)
//
// Protections: rooms are private (an unguessable code is the only way in) and
// hold two players; only pages from ALLOWED_ORIGINS can connect; trainer names
// are checked (checkTrainerName) before anything is passed on; messages are
// size- and rate-limited; rooms close after ROOM_LIFETIME_MS. Players never
// connect to each other directly, so neither learns the other's IP address.
import { DurableObject } from 'cloudflare:workers';
import {
  CLOSE, PING, PONG, ROOM_CODE, ROOM_LIFETIME_MS, type Member, type ServerMessage,
} from '../../src/online/relay-protocol';
import { checkTrainerName } from '../../src/online/trainer-name';
import { joinSeat, originAllowed, parseClientMessage, withinRate, type Attachment } from './room-core';

export interface Env {
  ROOMS: DurableObjectNamespace<Room>;
  ALLOWED_ORIGINS: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response('Battle Tree relay is running.', { headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }
    const match = /^\/rooms\/([A-Za-z0-9]+)$/.exec(url.pathname);
    if (!match || !ROOM_CODE.test(match[1])) return new Response('Not found', { status: 404 });
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
    if (!originAllowed(request.headers.get('Origin'), env.ALLOWED_ORIGINS)) return new Response('Forbidden', { status: 403 });
    const room = env.ROOMS.get(env.ROOMS.idFromName(match[1]));
    return room.fetch(request);
  },
} satisfies ExportedHandler<Env>;

const send = (ws: WebSocket, msg: ServerMessage) => {
  try { ws.send(JSON.stringify(msg)); } catch { /* already closed */ }
};

export class Room extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Keep-alive pings are answered without waking the room.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING, PONG));
  }

  async fetch(request: Request): Promise<Response> {
    const create = new URL(request.url).searchParams.get('create') === '1';
    const [client, server] = Object.values(new WebSocketPair());
    const taken = this.ctx.getWebSockets().map(ws => (ws.deserializeAttachment() as Attachment).seat);
    const seat = joinSeat(create, taken);
    if (typeof seat === 'string') {
      // Turned away: answer on a socket the room doesn't keep, then close it.
      server.accept();
      send(server, { t: 'error', message: seat });
      server.close(CLOSE.rejected, 'Rejected');
      return new Response(null, { status: 101, webSocket: client });
    }
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ seat, name: null, windowStart: Date.now(), count: 0 } satisfies Attachment);
    if (create) await this.ctx.storage.setAlarm(Date.now() + ROOM_LIFETIME_MS);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const att = ws.deserializeAttachment() as Attachment;
    if (!withinRate(att, Date.now())) return this.reject(ws, CLOSE.tooMany, 'Too many messages. Slow down and rejoin.');
    ws.serializeAttachment(att);
    const msg = parseClientMessage(raw);
    if (!msg) return this.reject(ws, CLOSE.badMessage, 'The relay got a message it doesn\'t understand.');

    if (msg.t === 'hello') {
      if (att.name) return;
      const check = checkTrainerName(msg.name);
      if (!check.ok) return this.reject(ws, CLOSE.badName, `Trainer name not accepted: ${check.error}`);
      att.name = check.name;
      ws.serializeAttachment(att);
      send(ws, { t: 'welcome', seat: att.seat });
      this.broadcastMembers();
      return;
    }
    // Nothing is passed on until the sender has a checked name.
    if (!att.name) return this.reject(ws, CLOSE.badMessage, 'Say hello first.');
    for (const other of this.ctx.getWebSockets()) {
      if (other !== ws && (other.deserializeAttachment() as Attachment).name) send(other, { t: 'msg', from: att.seat, data: msg.data });
    }
  }

  async webSocketClose(ws: WebSocket, code: number): Promise<void> {
    try { ws.close(code === 1005 ? 1000 : code, 'Bye'); } catch { /* already closed */ }
    this.left(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    this.left(ws);
  }

  /** The room's time is up: close it. */
  async alarm(): Promise<void> {
    for (const ws of this.ctx.getWebSockets()) this.reject(ws, CLOSE.expired, 'This room has closed (rooms last 6 hours).');
    await this.ctx.storage.deleteAll();
  }

  private reject(ws: WebSocket, code: number, message: string) {
    send(ws, { t: 'error', message });
    try { ws.close(code, 'Closed by the relay'); } catch { /* already closed */ }
    this.left(ws);
  }

  private left(ws: WebSocket) {
    const rest = this.ctx.getWebSockets().filter(other => other !== ws);
    this.broadcastMembers(rest);
    // Last one out: forget the room (and its closing alarm).
    if (!rest.length) void this.ctx.storage.deleteAlarm().then(() => this.ctx.storage.deleteAll());
  }

  private broadcastMembers(sockets = this.ctx.getWebSockets()) {
    const members: Member[] = [];
    for (const ws of sockets) {
      const { seat, name } = ws.deserializeAttachment() as Attachment;
      if (name) members.push({ seat, name });
    }
    for (const ws of sockets) send(ws, { t: 'members', members });
  }
}
