import type { CurrentMove } from '../../client/battle-client';
import { LogText } from './LogText';
import { TypeBadge } from './TypeBadge';

/** What is happening on the stage right now: the move being used and the current event's text. */
export function NowPlaying({ move, caption }: { move: CurrentMove | null; caption: string | null }) {
  // Under the move, the latest event if it says something new ("It's super effective!").
  const line = caption && caption !== move?.text ? caption : null;
  return (
    <div className="now-playing">
      {move ? (
        <div className={`now-move side-${move.side ?? 'none'}`}>
          <TypeBadge type={move.type} />
          <strong className="now-move-name">{move.name}</strong>
          <span className="muted small">{move.category}</span>
          <span className="now-move-user small"><LogText text={move.text} /></span>
        </div>
      ) : null}
      {line ? <div className="now-caption"><LogText text={line} /></div> : !move && <div className="now-caption">…</div>}
    </div>
  );
}
