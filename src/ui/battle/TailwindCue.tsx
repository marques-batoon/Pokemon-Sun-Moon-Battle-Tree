import type { Side } from './fx/geometry';

/**
 * Tailwind blowing on a side (it lasts 4 turns): wind streaks and a few leaves keep crossing that side of the
 * stage, behind its Pokémon, toward the foe (index.css .tailwind-cue).
 */
export function TailwindCue({ side }: { side: Side }) {
  return (
    <div className={`tailwind-cue tw-${side}`} aria-hidden>
      {[0, 1, 2, 3, 4].map(i => <span key={i} className="wind" />)}
      <span className="wind leafy" /><span className="wind leafy" />
    </div>
  );
}
