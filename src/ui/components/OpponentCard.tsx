import type { ReactNode } from 'react';
import type { Trainer } from '../../data/battle-tree';
import { displayName } from '../../run/selection';
import { OpponentPortrait } from './OpponentPortrait';

const KIND_LABEL = { regular: null, special: 'Special trainer', legend: 'Battle Legend battle' } as const;

interface Props {
  /** The opposing trainer, or both in a Multi Battle. */
  trainers: Trainer[];
  /** Each trainer's greeting for this battle (null: none). */
  greetings: (string | null)[];
  /** Line above the names ("Battle 12 · win for 3 BP"). */
  detail: ReactNode;
  /** Identifies this battle: the special-battle entrance plays once per key. */
  battleKey: string;
}

/**
 * The next opponent(s) between battles: their portrait (artwork or a big sprite), names, a tag for
 * special trainers and Battle Legends, and their greetings. Special battles open with the
 * full-screen entrance. Used by the Battle Tree challenge and the online room.
 */
export function OpponentCard({ trainers, greetings, detail, battleKey }: Props) {
  const multi = trainers.length > 1;
  const kind = trainers.some(t => t.kind === 'legend') ? 'legend' : trainers.some(t => t.kind === 'special') ? 'special' : 'regular';
  return (
    <div className={`opponent-card kind-${kind}`}>
      <div className="opponent-stage">
        <OpponentPortrait
          key={battleKey}
          trainers={trainers}
          intro={kind !== 'regular' ? battleKey : null}
          captions={trainers.map((t, i) => ({ name: displayName(t), quote: greetings[i] ?? null }))}
        />
      </div>
      <div className="opponent-info">
        <span className="muted small">{detail}</span>
        <strong className="opponent-name">{trainers.map(displayName).join(' & ')}</strong>
        {KIND_LABEL[kind] && <span className="tag">{multi && kind === 'legend' ? 'Battle Legends battle' : KIND_LABEL[kind]}</span>}
        {trainers.map((t, i) => greetings[i] && (
          <q key={t.id} className="opponent-quote">
            {multi && <span className="quote-speaker">{t.name}: </span>}{greetings[i]}
          </q>
        ))}
      </div>
    </div>
  );
}
