import { useEffect, useState, type ReactNode } from 'react';

/** How close to the top edge (px) the pointer has to come to bring the header back. */
const TOP_EDGE = 24;
/** Scroll distance (px) that counts as scrolling up or down. */
const SCROLL_STEP = 6;

/**
 * The site header. In battle focus mode it slides out of the way and comes
 * back when you scroll up, move the pointer to the top edge, tap the handle at
 * the top, or tab into it; it hides again when you scroll down or leave it.
 */
export function SiteHeader({ autoHide, children }: { autoHide: boolean; children: ReactNode }) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!autoHide) return;
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (y < lastY - SCROLL_STEP) setShown(true);
      else if (y > lastY + SCROLL_STEP) setShown(false);
      if (Math.abs(y - lastY) > SCROLL_STEP) lastY = y;
    };
    const onPointer = (e: MouseEvent) => { if (e.clientY <= TOP_EDGE) setShown(true); };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('mousemove', onPointer, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('mousemove', onPointer);
    };
  }, [autoHide]);

  if (!autoHide) return <header className="app-header">{children}</header>;
  return (
    <>
      <button type="button" className="header-reveal" aria-label="Show navigation" onClick={() => setShown(true)} />
      <header className={`app-header autohide ${shown ? 'shown' : ''}`} onMouseLeave={() => setShown(false)}>
        {children}
      </header>
    </>
  );
}
