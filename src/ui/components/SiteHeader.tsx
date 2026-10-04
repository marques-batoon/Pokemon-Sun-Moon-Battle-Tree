import { useEffect, useRef, useState, type ReactNode } from 'react';

/** How close to the top edge (px) the pointer has to come to bring the header back. */
const TOP_EDGE = 24;

/**
 * The site header. In battle focus mode it starts hidden and only comes back
 * when you move the pointer to the top edge, tap the handle at the top (touch
 * screens), or tab into it. Scrolling never brings it back: it hides again when
 * you scroll (unless the pointer is on it) or leave it.
 */
export function SiteHeader({ autoHide, children }: { autoHide: boolean; children: ReactNode }) {
  const [shown, setShown] = useState(false);
  const [wasAutoHide, setWasAutoHide] = useState(autoHide);
  const header = useRef<HTMLElement>(null);
  // Entering battle focus always starts hidden.
  if (wasAutoHide !== autoHide) {
    setWasAutoHide(autoHide);
    setShown(false);
  }

  useEffect(() => {
    if (!autoHide) return;
    const onScroll = () => { if (!header.current?.matches(':hover')) setShown(false); };
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
      <header ref={header} className={`app-header autohide ${shown ? 'shown' : ''}`} onMouseLeave={() => setShown(false)}>
        {children}
      </header>
    </>
  );
}
