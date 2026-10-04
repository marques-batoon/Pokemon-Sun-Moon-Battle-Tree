/** Placeholder type colors (no official artwork). Text color chosen for contrast on each. */
export const TYPE_COLORS: Record<string, { bg: string; fg: string }> = {
  Normal: { bg: '#A8A77A', fg: '#111' },
  Fire: { bg: '#EE8130', fg: '#111' },
  Water: { bg: '#6390F0', fg: '#fff' },
  Electric: { bg: '#F7D02C', fg: '#111' },
  Grass: { bg: '#7AC74C', fg: '#111' },
  Ice: { bg: '#96D9D6', fg: '#111' },
  Fighting: { bg: '#C22E28', fg: '#fff' },
  Poison: { bg: '#A33EA1', fg: '#fff' },
  Ground: { bg: '#E2BF65', fg: '#111' },
  Flying: { bg: '#A98FF3', fg: '#111' },
  Psychic: { bg: '#F95587', fg: '#111' },
  Bug: { bg: '#A6B91A', fg: '#111' },
  Rock: { bg: '#B6A136', fg: '#111' },
  Ghost: { bg: '#735797', fg: '#fff' },
  Dragon: { bg: '#6F35FC', fg: '#fff' },
  Dark: { bg: '#705746', fg: '#fff' },
  Steel: { bg: '#B7B7CE', fg: '#111' },
  Fairy: { bg: '#D685AD', fg: '#111' },
  '???': { bg: '#68A090', fg: '#111' },
};

export const typeColor = (type: string) => TYPE_COLORS[type] ?? TYPE_COLORS['???'];

export const STATUS_LABELS: Record<string, string> = {
  brn: 'BRN', par: 'PAR', psn: 'PSN', tox: 'TOX', slp: 'SLP', frz: 'FRZ',
};

export const BOOST_LABELS: Record<string, string> = {
  atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe', accuracy: 'Acc', evasion: 'Eva',
};
