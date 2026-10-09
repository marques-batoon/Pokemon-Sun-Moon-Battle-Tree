import { useSyncExternalStore } from 'react';

const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
};

/** Current route from the URL hash ("#/builder" -> "builder", "#/online?room=X" -> "online"), so reloads keep the page. */
export function useHashRoute<T extends string>(routes: readonly T[], fallback: T): T {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);
  const route = hash.replace(/^#\/?/, '').split('?')[0] as T;
  return routes.includes(route) ? route : fallback;
}

/** A parameter from the hash's query ("#/online?room=ABCD" -> hashParam('room') = "ABCD"). */
export function hashParam(name: string): string | null {
  const query = window.location.hash.split('?')[1];
  return query ? new URLSearchParams(query).get(name) : null;
}
