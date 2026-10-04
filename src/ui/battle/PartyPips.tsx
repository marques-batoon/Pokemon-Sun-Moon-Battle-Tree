import type { Side } from '@pkmn/client';
import { STATUS_LABELS } from '../types';

/**
 * One pip per Pokémon on a side, like the in-game party balls: healthy,
 * statused, fainted, or not yet seen (opponent Pokémon that haven't come out).
 */
export function PartyPips({ side, label }: { side: Side; label: string }) {
  // With Team Preview every registered Pokémon is "known"; the player's request
  // lists only the ones actually brought, so use it to trim the player's pips.
  const brought = side.id === 'p1' ? side.battle.request?.side?.pokemon.map(p => p.ident) : undefined;
  const team = brought ? side.team.filter(p => brought.includes(p.originalIdent)) : side.team;
  const total = brought ? team.length : Math.max(side.totalPokemon, team.length);
  const pips = Array.from({ length: total }, (_, i) => team[i] ?? null);
  return (
    <div className="party-pips" aria-label={label}>
      {pips.map((p, i) => {
        if (!p) return <span key={i} className="pip unknown" title="Not seen yet">?</span>;
        const state = p.fainted ? 'fainted' : p.status ? 'statused' : 'healthy';
        const text = `${p.speciesForme}${p.fainted ? ' (fainted)' : p.status ? ` (${STATUS_LABELS[p.status]})` : ''}`;
        return <span key={i} className={`pip ${state}`} title={text} aria-label={text} />;
      })}
    </div>
  );
}
