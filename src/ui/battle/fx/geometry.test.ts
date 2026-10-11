import { describe, expect, it } from 'vitest';
import { BATTLE_BACKGROUNDS, DEFAULT_APP_SETTINGS } from '../../../settings/settings-store';
import { HORIZON, horizonVar } from './geometry';

describe('stage horizon', () => {
  it('is the same CSS value the stages use (scenery, terrain, rooms) as the move effects use', () => {
    expect(HORIZON).toBe(0.36);
    expect(horizonVar['--horizon']).toBe('36%');
  });

  it('offers the five battle backgrounds, grass by default', () => {
    expect(BATTLE_BACKGROUNDS.map(b => b.id)).toEqual(['grass', 'stadium', 'mountain', 'ocean', 'forest']);
    expect(DEFAULT_APP_SETTINGS.battleBackground).toBe('grass');
  });
});
