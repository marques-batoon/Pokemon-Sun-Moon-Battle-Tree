// A new screen within a page (a challenge starting, a battle, its results...) opens at the top of the page, not
// scrolled down to where the button that led to it was.
import { useLayoutEffect, useRef } from 'react';

/** Scrolls the page to the top whenever `screen` (a name for what's shown) changes; not on the first render. */
export function useScrollToTopOn(screen: string): void {
  const shown = useRef(screen);
  useLayoutEffect(() => {
    if (shown.current === screen) return;
    shown.current = screen;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [screen]);
}
