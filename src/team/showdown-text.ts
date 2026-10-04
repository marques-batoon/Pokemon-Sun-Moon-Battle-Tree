import { Team, Teams } from '@pkmn/sets';
import { dex7, gen7, speciesAbilities } from './dex';
import { hiddenPowerType } from './sets';
import { MAX_IV, MAX_TEAM_SIZE, STAT_IDS, type PokemonSet } from './types';

export interface ImportedTeam {
  name: string | null;
  sets: PokemonSet[];
}

export interface ImportResult {
  teams: ImportedTeam[];
  warnings: string[];
}

/** Showdown text omits the Level line for Lv. 100. */
const SHOWDOWN_DEFAULT_LEVEL = 100;

const HIDDEN_POWER = /^Hidden Power\s*\[?\s*([A-Za-z]+)\s*\]?$/;

/**
 * Parses Showdown export text: plain sets (one team) or backups with
 * "=== [format] Name ===" headers (several teams). Unknown species are dropped,
 * unknown moves/items/abilities are removed, each with a warning; nothing is guessed.
 * A missing "Level:" line means Lv. 100, as in Showdown (it omits Level: 100 on
 * export); the battle level is capped at 50 either way.
 */
export function importShowdownText(text: string): ImportResult {
  const warnings: string[] = [];
  const raw = text.includes('===')
    ? Teams.importTeams(text, dex7).map(t => ({ name: t.name ?? null, sets: t.team }))
    : [{ name: null, sets: Teams.importTeam(text, dex7)?.team ?? [] }];

  const teams = raw.map(({ name, sets }, t) => {
    const label = raw.length > 1 ? `${name ?? `Team ${t + 1}`}: ` : '';
    const out: PokemonSet[] = [];
    for (const partial of sets) {
      const set = normalizeSet(partial, w => warnings.push(label + w));
      if (!set) continue;
      if (out.length === MAX_TEAM_SIZE) {
        warnings.push(`${label}Only the first ${MAX_TEAM_SIZE} Pokémon were kept.`);
        break;
      }
      out.push(set);
    }
    return { name, sets: out };
  }).filter(t => t.sets.length > 0);

  if (!teams.length) warnings.push('No Pokémon found in the pasted text.');
  return { teams, warnings };
}

function normalizeSet(p: Partial<PokemonSet>, warn: (w: string) => void): PokemonSet | null {
  const species = p.species ? gen7.species.get(p.species) : undefined;
  if (!species) {
    warn(`Unknown Pokémon "${p.name || p.species || '?'}" was skipped.`);
    return null;
  }
  const who = species.name;

  let item = '';
  if (p.item) {
    const found = gen7.items.get(p.item);
    if (found) item = found.name;
    else warn(`${who}: unknown item "${p.item}" was removed.`);
  }

  const abilities = speciesAbilities(species.name);
  let ability = abilities[0] ?? '';
  if (p.ability) {
    const found = gen7.abilities.get(p.ability);
    if (found) ability = found.name;
    else warn(`${who}: unknown ability "${p.ability}" was replaced with ${ability}.`);
  }

  const evs = Object.fromEntries(STAT_IDS.map(s => [s, p.evs?.[s] ?? 0])) as PokemonSet['evs'];
  const ivs = Object.fromEntries(STAT_IDS.map(s => [s, p.ivs?.[s] ?? MAX_IV])) as PokemonSet['ivs'];
  const ivsGiven = !!p.ivs && STAT_IDS.some(s => p.ivs?.[s] !== undefined && p.ivs[s] !== MAX_IV);

  const moves: string[] = [];
  for (const name of p.moves ?? []) {
    const hp = HIDDEN_POWER.exec(name);
    if (hp && hp[1].toLowerCase() !== 'power') {
      const type = gen7.types.get(hp[1]);
      // Gen 7 derives the type from IVs; apply the standard spread if no IVs were given.
      if (type?.HPivs && !ivsGiven) Object.assign(ivs, type.HPivs);
      moves.push('Hidden Power');
      continue;
    }
    const move = gen7.moves.get(name);
    if (move) moves.push(move.name);
    else warn(`${who}: unknown move "${name}" was removed.`);
  }
  if (moves.length > 4) warn(`${who}: only the first 4 moves were kept.`);

  const nature = p.nature && gen7.natures.get(p.nature) ? gen7.natures.get(p.nature)!.name : 'Hardy';
  return {
    name: p.name && p.name !== species.name ? p.name : species.name,
    species: species.name,
    item,
    ability,
    moves: [...new Set(moves)].slice(0, 4),
    nature,
    gender: species.gender ?? (p.gender === 'M' || p.gender === 'F' ? p.gender : ''),
    evs,
    ivs,
    level: p.level ? Math.max(1, Math.min(100, p.level)) : SHOWDOWN_DEFAULT_LEVEL,
    ...(p.shiny ? { shiny: true } : {}),
    ...(p.happiness !== undefined ? { happiness: p.happiness } : {}),
  };
}

/** Showdown export text for one team (no header), importable by Showdown's teambuilder. */
export function exportShowdownText(sets: PokemonSet[]): string {
  const forExport = sets.map(set => ({
    ...set,
    moves: set.moves.map(m => (m === 'Hidden Power' ? `Hidden Power [${hiddenPowerType(set)}]` : m)),
  }));
  return new Team(forExport).export(dex7).trim();
}

/**
 * Format id written into backup headers. Showdown has no Battle Tree format;
 * Gen 7 Battle Spot Singles (bring 3 of 6, Lv. 50, Species/Item Clause) is the
 * closest real one, so the teams land in a sensible folder when imported there.
 * This app ignores the format when importing.
 */
export const BACKUP_FORMAT = 'gen7battlespotsingles';

/**
 * Several teams as one Showdown backup ("=== [format] Name ===" headers), the
 * same format Showdown's teambuilder uses for "Backup all teams". Empty teams
 * are skipped (there is nothing to import from them).
 */
export function exportShowdownBackup(teams: readonly { name: string; sets: PokemonSet[] }[]): string {
  return teams
    .filter(t => t.sets.length > 0)
    .map(t => `=== [${BACKUP_FORMAT}] ${t.name.replace(/[\r\n]+/g, ' ').trim() || 'Untitled team'} ===\n\n${exportShowdownText(t.sets)}`)
    .join('\n\n\n');
}

/** Safe .txt file name for an exported team. */
export const fileNameFor = (name: string) => `${name.trim().replace(/[^\w\- ]+/g, '').replace(/\s+/g, '-') || 'team'}.txt`;
