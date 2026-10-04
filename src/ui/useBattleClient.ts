import { useSyncExternalStore } from 'react';
import type { BattleClient } from '../client/battle-client';

export function useBattleSnapshot(client: BattleClient) {
  return useSyncExternalStore(client.subscribe, client.getSnapshot);
}
