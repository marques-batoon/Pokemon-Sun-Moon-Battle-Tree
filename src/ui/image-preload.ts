// Pictures loaded before the screens that show them (the next opponents' sprites, the tournament bracket, the next
// battle's Pokémon), so a screen opens with its pictures in place instead of filling them in as they arrive. Each
// picture is a list of URLs tried in order, as the components fall back (a Pokémon Masters sprite, then the usual one;
// a Pokémon's pixel sprite, then its artwork...).

/** How long a screen waits for its pictures before showing anyway (a slow or failed network never holds it up). */
export const IMAGE_WAIT_MS = 2000;

const keyOf = (urls: readonly string[]) => urls.join('\n');
/** Lists being loaded, by key. */
const pending = new Map<string, Promise<void>>();
/** Lists settled: loaded, or every URL failed (the component then shows its placeholder; nothing to wait for). */
const settled = new Set<string>();
/** The latest pictures loaded, kept referenced so the browser keeps them ready to draw (the oldest let go past KEEP). */
const kept = new Map<string, HTMLImageElement>();
const KEEP = 400;

function keep(key: string, img: HTMLImageElement) {
  kept.delete(key);
  kept.set(key, img);
  if (kept.size > KEEP) kept.delete(kept.keys().next().value!);
}

/** Loads (and decodes) the first URL of the list that works. Settles either way. */
export function preloadImage(urls: readonly string[]): Promise<void> {
  const key = keyOf(urls);
  if (!urls.length || settled.has(key) || typeof Image === 'undefined') return Promise.resolve();
  let loading = pending.get(key);
  if (!loading) {
    loading = new Promise<void>(resolve => {
      const finish = (img?: HTMLImageElement) => {
        if (img) keep(key, img);
        settled.add(key);
        pending.delete(key);
        resolve();
      };
      const load = (i: number) => {
        if (i >= urls.length) return finish();
        const img = new Image();
        img.onload = () => { void (img.decode ? img.decode() : Promise.resolve()).catch(() => {}).then(() => finish(img)); };
        img.onerror = () => load(i + 1);
        img.src = urls[i];
      };
      load(0);
    });
    pending.set(key, loading);
  }
  return loading;
}

/** Loads every list; resolves when all have settled. */
export const preloadImages = (lists: readonly (readonly string[])[]): Promise<void> => Promise.all(lists.map(preloadImage)).then(() => {});

/** Whether every list has settled (always, where there are no images to load). */
export const imagesSettled = (lists: readonly (readonly string[])[]): boolean =>
  typeof Image === 'undefined' || lists.every(urls => !urls.length || settled.has(keyOf(urls)));
