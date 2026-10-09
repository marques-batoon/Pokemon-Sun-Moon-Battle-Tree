import { OnlineRoom, type Role } from '../../online/link-room';
import { RELAY_URL, relayConnector } from '../../online/relay-client';
import { engine, newBattleClient } from '../services';

// The online room you're in, kept outside the page so visiting another page
// (the Team Builder, Settings) doesn't drop you from the room.
let room: OnlineRoom | null = null;
const listeners = new Set<() => void>();

export const roomStore = {
  get: () => room,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  /** Makes (host) or joins (guest) a room on the relay. */
  open(role: Role, code: string, name: string) {
    if (!RELAY_URL) throw new Error('Online play is not set up.');
    room?.dispose();
    room = new OnlineRoom({
      role, code, name,
      connect: relayConnector(RELAY_URL, code, role === 'host', name),
      engine: role === 'host' ? engine() : undefined,
      makeClient: newBattleClient,
    });
    listeners.forEach(l => l());
  },
  close() {
    room?.dispose();
    room = null;
    listeners.forEach(l => l());
  },
};
