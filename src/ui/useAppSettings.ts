import { useSyncExternalStore } from 'react';
import { getSettingsStore } from './services';

export function useAppSettings() {
  const store = getSettingsStore();
  return useSyncExternalStore(store.subscribe, store.getSettings);
}
