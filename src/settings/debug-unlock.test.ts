import { describe, expect, it } from 'vitest';
import { checkDebugPassword } from './debug-unlock';

describe('debug tools password', () => {
  it('accepts only the developer password, exactly', async () => {
    expect(await checkDebugPassword('gamedev')).toBe(true);
    for (const wrong of ['', 'Gamedev', 'gamedev ', '"gamedev"', 'gamedevs']) expect(await checkDebugPassword(wrong)).toBe(false);
  });
});
