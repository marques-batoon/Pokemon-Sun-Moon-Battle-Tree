import { describe, expect, it } from 'vitest';
import { Protocol } from '@pkmn/protocol';
import { Battle, Teams } from '@pkmn/sim';
import { registerBattleTreeFormats } from '../engine/format';
import { nextTimers, NO_TIMERS, timerText, type FieldTimers } from './field-timers';

const apply = (state: FieldTimers, ...lines: string[]) => lines.reduce((t, line) => {
  const { args, kwArgs } = Protocol.parseBattleLine(line);
  return nextTimers(t, args as readonly string[], kwArgs as Record<string, unknown>);
}, state);

describe('field timers', () => {
  it('counts an effect from its first turn and clears it when it ends', () => {
    let t = apply(NO_TIMERS, '|turn|3', '|move|p1a: Politoed|Rain Dance|p1a: Politoed', '|-weather|RainDance|[turns] 5');
    expect(timerText(t, 'weather')).toBe('1/5');
    t = apply(t, '|-weather|RainDance|[upkeep]', '|upkeep');
    expect(timerText(t, 'weather')).toBe('1/5'); // still turn 3 until the next turn starts
    t = apply(t, '|turn|4');
    expect(timerText(t, 'weather')).toBe('2/5');
    t = apply(t, '|turn|7');
    expect(timerText(t, 'weather')).toBe('5/5');
    t = apply(t, '|-weather|none');
    expect(timerText(t, 'weather')).toBeNull();
  });

  it('counts from the next turn when the effect starts after the end of the turn (switch-in after a faint)', () => {
    const t = apply(NO_TIMERS, '|turn|5', '|upkeep', '|switch|p2a: Politoed|Politoed, L50|100/100', '|-weather|RainDance|[from] ability: Drizzle|[of] p2a: Politoed|[turns] 5', '|turn|6');
    expect(timerText(t, 'weather')).toBe('1/5');
  });

  it('tracks terrain, rooms and each side\'s Tailwind separately', () => {
    let t = apply(NO_TIMERS,
      '|turn|1',
      '|-fieldstart|move: Electric Terrain|[from] ability: Electric Surge|[of] p1a: Tapu Koko|[turns] 5',
      '|-fieldstart|move: Trick Room|[of] p2a: Bronzong|[turns] 5',
      '|-sidestart|p2: Red|move: Tailwind|[turns] 4',
      '|upkeep', '|turn|2',
      '|-fieldstart|move: Psychic Terrain|[from] ability: Psychic Surge|[of] p2a: Tapu Lele|[turns] 8',
    );
    expect(timerText(t, 'terrain')).toBe('1/8'); // a new terrain replaces the old one
    expect(timerText(t, 'trickroom')).toBe('2/5');
    expect(timerText(t, 'p2:tailwind')).toBe('2/4');
    expect(timerText(t, 'p1:tailwind')).toBeNull();
    t = apply(t, '|-fieldend|move: Trick Room', '|-sideend|p2: Red|move: Tailwind');
    expect(timerText(t, 'trickroom')).toBeNull();
    expect(timerText(t, 'p2:tailwind')).toBeNull();
  });

  it('matches the simulator in a real battle: Damp Rock rain lasts 8 turns', () => {
    registerBattleTreeFormats();
    const b = new Battle({ formatid: 'gen7battletreesinglesnopreview' as never, seed: '1,2,3,4' });
    const team = (lead: string) => Teams.pack(Teams.import(`${lead}\n\nChansey @ Eviolite\nAbility: Natural Cure\nLevel: 50\n- Soft-Boiled\n\nSnorlax @ Leftovers\nAbility: Thick Fat\nLevel: 50\n- Rest`));
    b.setPlayer('p1', { name: 'A', team: team('Politoed @ Damp Rock\nAbility: Drizzle\nLevel: 50\n- Protect') });
    b.setPlayer('p2', { name: 'B', team: team('Blissey @ Leftovers\nAbility: Natural Cure\nLevel: 50\n- Soft-Boiled') });
    let t = NO_TIMERS;
    let seen = 0;
    const feed = () => { for (const line of b.log.slice(seen)) t = apply(t, line); seen = b.log.length; };
    feed();
    expect(timerText(t, 'weather')).toBe('1/8');
    for (let turn = 2; turn <= 8; turn++) {
      b.makeChoices('move 1', 'move 1');
      feed();
      expect(b.field.weather, `turn ${turn}`).toBe('raindance');
      expect(timerText(t, 'weather')).toBe(`${turn}/8`);
    }
    b.makeChoices('move 1', 'move 1');
    feed();
    expect(b.field.weather).toBe('');
    expect(timerText(t, 'weather')).toBeNull();
  });
});
