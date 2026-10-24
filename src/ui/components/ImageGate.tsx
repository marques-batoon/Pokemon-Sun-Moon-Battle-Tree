import { useState, type ReactNode } from 'react';
import { useImagesReady } from '../useImagesReady';

/**
 * Shows its children once their pictures are loaded (`lists`: see image-preload), so the screen opens complete
 * instead of filling in sprites as they arrive; at most IMAGE_WAIT_MS, then it shows anyway. Meanwhile an empty
 * panel ("Loading…" fades in if it takes a moment). Once shown, it stays shown: pictures added later (a tournament's
 * next opponents) are loaded without hiding the screen again.
 */
export function ImageGate({ lists, children }: { lists: readonly (readonly string[])[]; children: ReactNode }) {
  const ready = useImagesReady(lists);
  const [opened, setOpened] = useState(ready);
  if (ready && !opened) setOpened(true);
  if (ready || opened) return children;
  return <div className="panel image-gate" aria-busy="true"><span className="muted">Loading…</span></div>;
}
