import type { BattleTreeFormat } from '../../engine/format-constants';
import { useEffect, useState, useSyncExternalStore } from 'react';
import type { Move } from '@pkmn/data';
import type { TeamStore } from '../../storage/team-store';
import { paradoxFormForSet } from '../../data/custom/paradox';
import { learnableMoves } from '../../team/dex';
import type { PokemonSet, TeamValidation } from '../../team/types';
import { getValidationClient } from '../services';

export function useTeams(store: TeamStore) {
  return useSyncExternalStore(store.subscribe, store.getTeams);
}

const learnsetCache = new Map<string, Move[]>();

/**
 * Learnable moves for a species (null while loading; learnsets load lazily).
 * With a Paradoxorb that fits, they're its Paradox form's moves.
 */
export function useLearnset(species: string, item = ''): Move[] | null {
  const paradox = paradoxFormForSet(species, item);
  const key = paradox ? `${species}>${paradox}` : species;
  const [loaded, setLoaded] = useState<{ key: string; moves: Move[] } | null>(null);
  const cached = learnsetCache.get(key);
  useEffect(() => {
    if (learnsetCache.has(key)) return;
    let live = true;
    void learnableMoves(species, paradox ? item : undefined).then(moves => {
      learnsetCache.set(key, moves);
      if (live) setLoaded({ key, moves });
    });
    return () => { live = false; };
  }, [key, species, item, paradox]);
  return cached ?? (loaded?.key === key ? loaded.moves : null);
}

export interface ValidationState {
  pending: boolean;
  result: TeamValidation | null;
}

/** Debounced validation through the engine worker (Showdown's TeamValidator). */
export function useTeamValidation(sets: PokemonSet[], format: BattleTreeFormat = 'singles', delayMs = 250): ValidationState {
  // The format is part of the key: a team can be legal for Singles (3) but not Doubles (4).
  const key = `${format}|${JSON.stringify(sets)}`;
  const [state, setState] = useState<{ key: string; result: TeamValidation } | null>(null);
  useEffect(() => {
    let live = true;
    const timer = setTimeout(() => {
      const [fmt, json] = [key.slice(0, key.indexOf('|')), key.slice(key.indexOf('|') + 1)];
      void getValidationClient().validate(fmt as BattleTreeFormat, JSON.parse(json) as PokemonSet[]).then(result => {
        if (live) setState({ key, result });
      });
    }, delayMs);
    return () => { live = false; clearTimeout(timer); };
  }, [key, delayMs]);
  return { pending: state?.key !== key, result: state?.result ?? null };
}
