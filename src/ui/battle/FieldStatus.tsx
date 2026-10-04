import type { Battle, Side } from '@pkmn/client';
import { gen7 } from '../../team/dex';

const conditionName = (id: string) => gen7.conditions.get(id)?.name ?? gen7.moves.get(id)?.name ?? id;

function sideConditions(side: Side): string[] {
  return Object.values(side.sideConditions).map(c => (c.level > 1 ? `${c.name} ×${c.level}` : c.name));
}

export function FieldStatus({ battle }: { battle: Battle }) {
  const { field } = battle;
  const pseudo = Object.keys(field.pseudoWeather).map(conditionName);
  const items = [
    field.weather && `Weather: ${field.weather}`,
    field.terrain && `${field.terrain} Terrain`,
    ...pseudo,
  ].filter(Boolean) as string[];
  const foe = sideConditions(battle.p2);
  const mine = sideConditions(battle.p1);

  return (
    <div className="field-status">
      <span className="turn">Turn {battle.turn}</span>
      {items.map(i => <span key={i} className="tag tag-field">{i}</span>)}
      {foe.length > 0 && <span className="tag">Foe: {foe.join(', ')}</span>}
      {mine.length > 0 && <span className="tag">You: {mine.join(', ')}</span>}
    </div>
  );
}
