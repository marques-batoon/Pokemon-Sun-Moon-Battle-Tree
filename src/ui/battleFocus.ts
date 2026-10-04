// "Focus mode" while a battle is on screen: the site header hides to give the
// battle more room. Battle screens register themselves; the header reads it.
import { useEffect, useSyncExternalStore } from 'react';

let active = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => { listeners.delete(l); };
};
const isFocused = () => active > 0;

/** Turns battle focus mode on while `on` is true and the calling component is mounted. */
export function useBattleFocusWhile(on: boolean): void {
  useEffect(() => {
    if (!on) return;
    active++;
    emit();
    return () => { active--; emit(); };
  }, [on]);
}

/** Whether a battle is on screen. */
export function useBattleFocus(): boolean {
  return useSyncExternalStore(subscribe, isFocused);
}
