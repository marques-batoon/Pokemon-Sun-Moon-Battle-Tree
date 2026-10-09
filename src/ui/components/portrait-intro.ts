// Special-battle entrance for the opponent card: the trainer's artwork or
// sprite (Multi: both trainers', side by side) fills the screen's full height
// over a dimmed backdrop and stays there until the player clicks, taps or
// presses a key, then shrinks into its place on the card. Plain DOM + Web Animations (one element, layout properties so
// pixel-art sprites stay crisp while scaling).

const ENTER_MS = 300;
const EXIT_MS = 950;
/** Keys that continue (as well as a click or tap anywhere). */
const CONTINUE_KEYS = new Set(['Enter', ' ', 'Escape']);

// Remembered for the browser session (survives reloads); in memory if storage is unavailable.
const STORAGE_KEY = 'battletree:intros-played';
const played = new Set<string>(readPlayed());
function readPlayed(): string[] {
  try {
    const list: unknown = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((k): k is string => typeof k === 'string') : [];
  } catch {
    return [];
  }
}
function markPlayed(key: string) {
  played.add(key);
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...played].slice(-50))); } catch { /* memory only */ }
}
/** Whether the intro for this key (run + battle) has already played (or been skipped) this session. */
export const introPlayed = (key: string) => played.has(key);

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export interface IntroCaption { name: string; quote: string | null }

const px = (r: DOMRect) => ({ left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });

/**
 * Plays the intro for `targets` (images already laid out in their final spots;
 * two in a Multi Battle). The targets are hidden while fixed-position copies
 * fill the screen's height side by side; a click, tap, Enter, Space or Escape
 * sends each to its target's spot (a second one skips the flight). Returns a
 * cancel function (also restores the targets). Marked as played once they land.
 */
export function playPortraitIntro(targets: HTMLImageElement[], key: string, color: string, captions: IntroCaption[] = []): () => void {
  if (!targets.length || typeof targets[0].animate !== 'function') return () => {};

  const overlay = document.createElement('div');
  overlay.className = 'portrait-intro';
  overlay.style.setProperty('--kind', color);
  overlay.setAttribute('role', 'button');
  overlay.tabIndex = 0;
  const spoken = captions.map(c => `${c.name}${c.quote ? `: “${c.quote}”` : ''}`).join('. ');
  overlay.setAttribute('aria-label', spoken ? `${spoken}. Continue` : 'Continue');
  // Each copy gets an equal share of the screen's width (--i of --n).
  const copies = targets.map((target, i) => {
    const copy = target.cloneNode() as HTMLImageElement;
    copy.className = 'portrait-intro-img';
    copy.style.imageRendering = getComputedStyle(target).imageRendering;
    copy.style.setProperty('--i', String(i));
    copy.style.setProperty('--n', String(targets.length));
    overlay.append(copy);
    return copy;
  });
  // The trainers' greetings and a prompt to continue (they fade with the backdrop).
  const box = document.createElement('div');
  box.className = 'portrait-intro-caption';
  for (const caption of captions) {
    const name = document.createElement('span');
    name.className = 'portrait-intro-name';
    name.textContent = caption.name;
    box.append(name);
    if (caption.quote) {
      const quote = document.createElement('q');
      quote.className = 'portrait-intro-quote';
      quote.textContent = caption.quote;
      box.append(quote);
    }
  }
  const hint = document.createElement('span');
  hint.className = 'portrait-intro-hint';
  hint.textContent = 'Tap or click to continue';
  box.append(hint);
  overlay.append(box);
  document.body.append(overlay);
  targets.forEach(t => { t.style.visibility = 'hidden'; });
  overlay.focus({ preventScroll: true });

  const enter = [
    ...copies.map(copy => copy.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ENTER_MS, fill: 'forwards' })),
    overlay.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ENTER_MS, fill: 'forwards' }),
  ];
  let exit: Animation[] = [];
  let phase: 'waiting' | 'leaving' | 'done' = 'waiting';

  const finish = (completed: boolean) => {
    if (phase === 'done') return;
    phase = 'done';
    // Cancelled early (e.g. the screen unmounted, or React's dev double mount): it may play again.
    if (completed) markPlayed(key);
    targets.forEach(t => { t.style.visibility = ''; });
    overlay.remove();
    window.removeEventListener('keydown', onKey, true);
  };

  const proceed = () => {
    if (phase === 'leaving') { exit.forEach(a => a.finish()); return; }
    if (phase !== 'waiting') return;
    phase = 'leaving';
    enter.forEach(a => a.finish());
    // Measured now, so a resize while waiting doesn't matter.
    const flights = copies.map((copy, i) => {
      const from = px(copy.getBoundingClientRect());
      const to = px(targets[i].getBoundingClientRect());
      copy.classList.add('leaving');
      Object.assign(copy.style, to);
      return copy.animate([{ ...from, opacity: 1 }, { ...to, opacity: 1 }], { duration: EXIT_MS, easing: 'cubic-bezier(.2, .8, .2, 1)' });
    });
    exit = [...flights, overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: EXIT_MS, fill: 'forwards' })];
    Promise.all(flights.map(a => a.finished)).then(() => finish(true), () => finish(false));
  };

  const onKey = (e: KeyboardEvent) => {
    if (!CONTINUE_KEYS.has(e.key)) return;
    // Keep the key from also pressing whatever is focused behind the overlay.
    e.preventDefault();
    e.stopPropagation();
    proceed();
  };
  const stopScroll = (e: Event) => e.preventDefault();
  overlay.addEventListener('click', proceed);
  overlay.addEventListener('wheel', stopScroll, { passive: false });
  overlay.addEventListener('touchmove', stopScroll, { passive: false });
  window.addEventListener('keydown', onKey, true);

  return () => {
    [...enter, ...exit].forEach(a => a.cancel());
    finish(false);
  };
}
