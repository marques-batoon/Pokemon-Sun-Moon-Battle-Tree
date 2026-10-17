import { describe, expect, it } from 'vitest';
import { Battle as ClientBattle } from '@pkmn/client';
import { Protocol } from '@pkmn/protocol';
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
