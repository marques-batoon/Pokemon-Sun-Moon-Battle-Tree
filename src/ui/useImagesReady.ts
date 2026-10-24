import { useEffect, useState } from 'react';
import { IMAGE_WAIT_MS, imagesSettled, preloadImages } from './image-preload';
import { useAppSettings } from './useAppSettings';

type Lists = readonly (readonly string[])[];

/**
 * Whether a screen's pictures are ready to show: loads them (image-preload) and turns true once they all have, or after
 * `maxWait` ms, whichever comes first. True at once when they're already loaded (preloaded ahead) or pictures are off.
 */
export function useImagesReady(lists: Lists, maxWait = IMAGE_WAIT_MS): boolean {
  const { sprites } = useAppSettings();
  const key = JSON.stringify(lists);
  const [readyKey, setReadyKey] = useState<string | null>(null);

  useEffect(() => {
    const wanted = JSON.parse(key) as string[][];
    if (!sprites || imagesSettled(wanted)) return;
    let live = true;
    const ready = () => { if (live) setReadyKey(key); };
    const timer = setTimeout(ready, maxWait);
    void preloadImages(wanted).then(ready);
    return () => { live = false; clearTimeout(timer); };
  }, [key, sprites, maxWait]);

  return !sprites || readyKey === key || imagesSettled(lists);
}

/** Starts loading pictures a later screen will show (nothing waits for them). */
export function usePreloadImages(lists: Lists): void {
  const { sprites } = useAppSettings();
  const key = JSON.stringify(lists);
  useEffect(() => {
    if (sprites) void preloadImages(JSON.parse(key) as string[][]);
  }, [key, sprites]);
}
