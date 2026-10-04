import type { Battle, Side } from '@pkmn/client';
import { NO_TIMERS, timerText, type FieldTimers } from '../../client/field-timers';
import { gen7 } from '../../team/dex';

const conditionName = (id: string) => gen7.conditions.get(id)?.name ?? gen7.moves.get(id)?.name ?? id;
/** "Trick Room 2/5" when the effect is timed. */
const withTimer = (name: string, timer: string | null) => (timer ? `${name} ${timer}` : name);

function sideConditions(side: Side, timers: FieldTimers): string[] {
  return Object.entries(side.sideConditions).map(([id, c]) => {
    const name = c.level > 1 ? `${c.name} ×${c.level}` : c.name;
    return withTimer(name, timerText(timers, `${side.id}:${id}`));
  });
}

export function FieldStatus({ battle, timers = NO_TIMERS }: { battle: Battle; timers?: FieldTimers }) {
  const { field } = battle;
  const pseudo = Object.keys(field.pseudoWeather).map(id => withTimer(conditionName(id), timerText(timers, id)));
  const items = [
    field.weather && withTimer(`Weather: ${field.weather}`, timerText(timers, 'weather')),
    field.terrain && withTimer(`${field.terrain} Terrain`, timerText(timers, 'terrain')),
    ...pseudo,
  ].filter(Boolean) as string[];
  const foe = sideConditions(battle.p2, timers);
  const mine = sideConditions(battle.p1, timers);

  return (
    <div className="field-status">
      <span className="turn">Turn {battle.turn}</span>
      {items.map(i => <span key={i} className="tag tag-field">{i}</span>)}
      {foe.length > 0 && <span className="tag">Foe: {foe.join(', ')}</span>}
      {mine.length > 0 && <span className="tag">You: {mine.join(', ')}</span>}
    </div>
  );
}
