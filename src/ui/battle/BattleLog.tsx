import { useLayoutEffect, useRef } from 'react';
import type { LogEntry } from '../../client/battle-client';
import type { TrainerLine } from '../../data/battle-tree';
import { displayName } from '../../run/selection';
import { LogText } from './LogText';

/**
 * The battle log. It opens with the opposing trainers' greetings and, once the battle is over, closes with their
 * closing remarks (if they have lines). New lines scroll the log itself to the bottom (never the page: on phones,
 * where the log sits below the battle, scrolling it into view made the battle jump as each line came in), unless you
 * have scrolled up to read earlier lines.
 */
export function BattleLog({ entries, greetings = [], closings = [], onHide }: { entries: LogEntry[]; greetings?: TrainerLine[]; closings?: TrainerLine[]; onHide?: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  useLayoutEffect(() => {
    const el = box.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [entries.length, closings.length]);
  return (
    <div className="battle-log-panel">
      {onHide && (
        <div className="battle-log-head">
          <span className="muted small">Battle log</span>
          <button className="link-button small" onClick={onHide}>Hide</button>
        </div>
      )}
      <div
        ref={box}
        className="battle-log"
        aria-live="polite"
        onScroll={e => { const el = e.currentTarget; atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24; }}
      >
        {greetings.length > 0 && <Said lines={greetings} className="log-greetings" />}
        {entries.map(e => <div key={e.id} className={`log-${e.kind}`}><LogText text={e.text} /></div>)}
        {closings.length > 0 && <Said lines={closings} className="log-closings" />}
      </div>
    </div>
  );
}

/** Trainers' lines in the log, each after their name. */
function Said({ lines, className }: { lines: TrainerLine[]; className: string }) {
  return (
    <div className={`log-said ${className}`}>
      {lines.map((l, i) => <div key={i}><strong>{displayName(l.trainer)}:</strong> <q>{l.line}</q></div>)}
    </div>
  );
}
