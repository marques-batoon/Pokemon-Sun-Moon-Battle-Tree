import { useEffect, useRef } from 'react';
import type { LogEntry } from '../../client/battle-client';
import { LogText } from './LogText';

export function BattleLog({ entries }: { entries: LogEntry[] }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [entries.length]);
  return (
    <div className="battle-log" aria-live="polite">
      {entries.map(e => <div key={e.id} className={`log-${e.kind}`}><LogText text={e.text} /></div>)}
      <div ref={end} />
    </div>
  );
}
