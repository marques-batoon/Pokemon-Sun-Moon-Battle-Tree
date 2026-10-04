import { describe, expect, it } from 'vitest';
import { gen7 } from '../../team/dex';
import { zMoveInfo } from './z-move-info';

const info = (base: string, z: string) => zMoveInfo(gen7.moves.get(base)!, z);

describe('zMoveInfo', () => {
  it('type Z-Moves take their power and category from the base move', () => {
    expect(info('Close Combat', 'All-Out Pummeling')).toMatchObject({ type: 'Fighting', category: 'Physical', power: '190' });
    expect(info('Low Kick', 'All-Out Pummeling')).toMatchObject({ power: '160' }); // variable-power move
    expect(info('Thunderbolt', 'Gigavolt Havoc')).toMatchObject({ type: 'Electric', category: 'Special', power: '175' });
    expect(info('Hidden Power', 'Breakneck Blitz')).toMatchObject({ type: 'Normal', category: 'Special', power: '120' });
  });

  it('exclusive Z-Moves show their own power', () => {
    expect(info('Volt Tackle', 'Catastropika')).toMatchObject({ name: 'Catastropika', type: 'Electric', category: 'Physical', power: '210' });
    expect(info('Photon Geyser', 'Light That Burns the Sky')).toMatchObject({ power: '200', category: 'Special' });
  });

  it('custom Poliwrathium Z moves use Fightinium / Waterium / Icium Z power', () => {
    expect(info('Close Combat', 'Omega Wrath')).toMatchObject({ type: 'Fighting', category: 'Physical', power: '190' });
    expect(info('Waterfall', 'Riptide Rocket Rush')).toMatchObject({ type: 'Water', power: '160' });
    expect(info('Ice Punch', 'Glacial Guardian Gauntlet')).toMatchObject({ type: 'Ice', power: '140' });
  });

  it('status Z-Moves show their Z-Power effect instead of power', () => {
    expect(info('Swords Dance', 'Z-Swords Dance')).toEqual({ name: 'Z-Swords Dance', type: 'Normal', category: 'Status', power: '—', effect: 'resets lowered stats' });
    expect(info('Splash', 'Z-Splash').effect).toBe('+3 Atk');
    expect(info('Celebrate', 'Z-Celebrate').effect).toBe('+1 all stats');
    expect(info('Haze', 'Z-Haze').effect).toBe('restores all HP');
    expect(info('Metronome', 'Z-Metronome').effect).toBeNull();
  });
});
