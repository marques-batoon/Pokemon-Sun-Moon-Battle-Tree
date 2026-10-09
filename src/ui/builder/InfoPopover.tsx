import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { Move } from '@pkmn/data';
import { gen7 } from '../../team/dex';
import { TypeBadge } from '../battle/TypeBadge';

/** A small "i" button that opens a description next to it (closes on Escape or a click elsewhere). */
export function InfoButton({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return (
    <span className="info" ref={box}>
      <button
        type="button"
        className="info-btn"
        aria-label={`About ${label}`}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={e => { e.preventDefault(); setOpen(o => !o); }}
      >i</button>
      {open && <div id={id} className="info-pop" role="note">{children}</div>}
    </span>
  );
}

const fmtAccuracy = (a: Move['accuracy']) => (a === true ? '—' : `${a}%`);

/** What a move does: type, category, power, accuracy, PP, priority and its description. */
export function MoveDetails({ move, brief = false }: { move: Move; brief?: boolean }) {
  const text = brief ? move.shortDesc || move.desc : move.desc || move.shortDesc;
  return (
    <span className="info-body">
      {!brief && <strong>{move.name}</strong>}
      <span className="info-meta">
        <TypeBadge type={move.type} /> {move.category}
        {' · '}Power {move.category === 'Status' || !move.basePower ? '—' : move.basePower}
        {' · '}Accuracy {fmtAccuracy(move.accuracy)}
        {' · '}PP {move.pp}
        {move.priority ? ` · Priority ${move.priority > 0 ? '+' : ''}${move.priority}` : ''}
      </span>
      {text && <span className="info-text">{text}</span>}
    </span>
  );
}

/** What an Ability does. */
export function AbilityDetails({ name }: { name: string }) {
  const ability = gen7.abilities.get(name);
  return (
    <span className="info-body">
      <strong>{ability?.name ?? name}</strong>
      <span className="info-text">{ability ? ability.desc || ability.shortDesc : 'No description.'}</span>
    </span>
  );
}
