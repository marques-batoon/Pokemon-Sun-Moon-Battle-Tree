import { useLayoutEffect, useRef } from 'react';
import type { LogEntry } from '../../client/battle-client';
import { LogText } from './LogText';

/**
 * The battle log. New lines scroll the log itself to the bottom (never the page: on phones, where the log sits
 * below the battle, scrolling it into view made the battle jump as each line came in), unless you have scrolled
 * up to read earlier lines.
 */
export function BattleLog({ entries, onHide }: { entries: LogEntry[]; onHide?: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  useLayoutEffect(() => {
    const el = box.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [entries.length]);
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
        {entries.map(e => <div key={e.id} className={`log-${e.kind}`}><LogText text={e.text} /></div>)}
      </div>
    </div>
  );
}
