import { describe, expect, it } from 'vitest';
import { Battle as ClientBattle } from '@pkmn/client';
import { Protocol } from '@pkmn/protocol';
import { Battle, Teams } from '@pkmn/sim';
import { NO_PREVIEW_FORMAT_IDS, registerBattleTreeFormats } from '../engine/format';
import { gens } from '../team/dex';
import { TreeLogFormatter } from './log-formatter';

describe('battle text after Warp Digivolution', () => {
  const run = (lines: string[]) => {
    const battle = new ClientBattle(gens);
    const formatter = new TreeLogFormatter('p1', battle);
    const out: string[] = [];
    for (const line of lines) {
      const { args, kwArgs } = Protocol.parseBattleLine(line);
      out.push(formatter.formatText(args, kwArgs).trim());
      battle.add(args, kwArgs);
    }
    return out;
  };
  const start = ['|player|p1|A|', '|player|p2|B|', '|gametype|singles', '|gen|7', '|start'];

  it('calls the Pokémon by its new form ("BlackWarGreymon used Dramon Destroyer!"), on both sides', () => {
    const out = run([
      ...start,
      '|switch|p1a: Agumon|Agumon, L50, M|100/100', '|switch|p2a: Agumon|Agumon, L50, M|100/100',
      '|move|p1a: Agumon|Pepper Breath|p2a: Agumon',
      '|detailschange|p1a: Agumon|BlackWarGreymon, L50, M', '|detailschange|p2a: Agumon|WarGreymon, L50, M',
      '|move|p1a: Agumon|Dramon Destroyer|p2a: Agumon', '|move|p2a: Agumon|Gaia Force|p1a: Agumon',
    ]);
    expect(out).toContain('Agumon used **Pepper Breath**!');
    expect(out).toContain('BlackWarGreymon used **Dramon Destroyer**!');
    expect(out).toContain('The opposing WarGreymon used **Gaia Force**!');
  });

  it('keeps a nickname, and Mega Evolved Pokémon keep their name (as in the games)', () => {
    const out = run([
      ...start,
      '|switch|p1a: Aggy|Agumon, L50, M|100/100', '|switch|p2a: Charizard|Charizard, L50, M|100/100',
      '|detailschange|p1a: Aggy|WarGreymon, L50, M', '|detailschange|p2a: Charizard|Charizard-Mega-Y, L50, M',
      '|move|p1a: Aggy|Gaia Force|p2a: Charizard', '|move|p2a: Charizard|Flamethrower|p1a: Aggy',
    ]);
    expect(out).toContain('Aggy used **Gaia Force**!');
    expect(out).toContain('The opposing Charizard used **Flamethrower**!');
  });
});

describe('battle text after Paradox Evolution', () => {
  const format = (lines: string[]) => {
    const battle = new ClientBattle(gens);
    const formatter = new TreeLogFormatter('p1', battle);
    return lines.map(line => {
      const { args, kwArgs } = Protocol.parseBattleLine(line);
      const text = formatter.formatText(args, kwArgs).trim();
      battle.add(args, kwArgs);
      return text;
    });
  };

  it('calls the Pokémon by its Paradox form ("Great Tusk used Headlong Rush!"), on both sides; a nickname stays', () => {
    const out = format([
      '|player|p1|A|', '|player|p2|B|', '|gametype|singles', '|gen|7', '|start',
      '|switch|p1a: Donphan|Donphan, L50, M|100/100', '|switch|p2a: Volcarona|Volcarona, L50, F|100/100',
      '|detailschange|p1a: Donphan|Great Tusk, L50', '|detailschange|p2a: Volcarona|Iron Moth, L50',
      '|move|p1a: Donphan|Headlong Rush|p2a: Volcarona', '|move|p2a: Volcarona|Fiery Dance|p1a: Donphan',
    ]);
    expect(out).toContain('Great Tusk used **Headlong Rush**!');
    expect(out).toContain('The opposing Iron Moth used **Fiery Dance**!');
    const nicknamed = format([
      '|player|p1|A|', '|player|p2|B|', '|gametype|singles', '|gen|7', '|start',
      '|switch|p1a: Tusky|Donphan, L50, M|100/100', '|detailschange|p1a: Tusky|Great Tusk, L50', '|move|p1a: Tusky|Headlong Rush|p2a: Foe',
    ]);
    expect(nicknamed).toContain('Tusky used **Headlong Rush**!');
  });

  it('does so in a real battle: the Paradoxorb holder goes by its form from the moment it evolves', () => {
    registerBattleTreeFormats();
    const team = (t: string) => Teams.pack(Teams.import(t)!);
    const sim = new Battle({ formatid: NO_PREVIEW_FORMAT_IDS.singles as never, seed: [1, 2, 3, 4] as never });
    sim.setPlayer('p1', { name: 'A', team: team('Donphan @ Paradoxorb-A\nAbility: Sturdy\nLevel: 50\n- Headlong Rush\n- Rapid Spin') });
    sim.setPlayer('p2', { name: 'B', team: team('Snorlax @ Leftovers\nAbility: Thick Fat\nLevel: 50\n- Splash') });
    sim.makeChoices('move 1', 'move 1');
    const out = format(sim.log.filter(l => l.startsWith('|') && !l.startsWith('|split')));
    expect(out.find(l => l.includes('Paradox Evolved'))).toMatch(/Donphan Paradox Evolved into Great Tusk!/);
    expect(out).toContain('Great Tusk used **Headlong Rush**!');
    expect(out.join('\n')).not.toMatch(/Donphan used/);
  });
});
