import { useSyncExternalStore } from 'react';

const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
};

/** Current route from the URL hash ("#/builder" -> "builder"), so reloads keep the page. */
export function useHashRoute<T extends string>(routes: readonly T[], fallback: T): T {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);
  const route = hash.replace(/^#\/?/, '') as T;
  return routes.includes(route) ? route : fallback;
}
