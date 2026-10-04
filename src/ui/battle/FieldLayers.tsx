import type { CSSProperties } from 'react';
import { ROOMS, TERRAINS, type BattleAnimation } from '../../client/playback';
import { FIELD_COLORS } from './fx/catalog';

interface Props {
  /** Active terrain id (electricterrain, grassyterrain, psychicterrain, mistyterrain), if any. */
  terrain: string | null;
  /** Active rooms (trickroom, magicroom, wonderroom, gravity). */
  rooms: string[];
  anim: BattleAnimation | null;
}

/**
 * Terrains cover the ground (crackling yellow for Electric, grass for Grassy, pink waves for
 * Psychic, drifting mist for Misty); rooms enclose the field in a glowing grid (Trick Room purple,
 * Magic Room pink, Wonder Room blue) or, for Gravity, dark streaks pulling down. A layer that just
 * ended fades away.
 */
export function FieldLayers({ terrain, rooms, anim }: Props) {
  const ended = anim?.kind === 'field-end' ? anim.condition : undefined;
  const terrains = terrain ? [{ id: terrain, ending: false }] : [];
  if (ended && (TERRAINS as readonly string[]).includes(ended) && ended !== terrain) terrains.push({ id: ended, ending: true });
  const roomList = rooms.map(id => ({ id, ending: false }));
  if (ended && (ROOMS as readonly string[]).includes(ended) && !rooms.includes(ended)) roomList.push({ id: ended, ending: true });
  return (
    <>
      {roomList.map(r => (
        <div key={r.id} className={`room-layer room-${r.id} ${r.ending ? 'ending' : ''}`} style={{ '--c': FIELD_COLORS[r.id] } as CSSProperties} aria-hidden>
          <div className="room-wall" />
          <div className="room-floor" />
        </div>
      ))}
      {terrains.map(t => (
        <div key={t.id} className={`terrain-layer terrain-${t.id} ${t.ending ? 'ending' : ''}`} style={{ '--c': FIELD_COLORS[t.id] } as CSSProperties} aria-hidden />
      ))}
    </>
  );
}
