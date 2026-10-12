import { describe, expect, it } from 'vitest';
import { Dex, TeamValidator, type PokemonSet as SimSet } from '@pkmn/sim';
import { multiPartners, SETS, TRAINER_DUO_QUOTES, TRAINER_QUOTES, trainerQuotes, TRAINERS } from '../data/battle-tree';
import { treeSetToPokemonSet } from '../run/opponent';
import { Rng } from '../run/rng';
import { multiDuo, planChosenOpponent, planOpponent, scheduleSlot } from '../run/selection';
import { DEFAULT_SETTINGS } from '../run/types';
import { FORMAT_IDS, IGNORED_VALIDATOR_PROBLEMS, registerBattleTreeFormats } from './format';

registerBattleTreeFormats();
const validator = new TeamValidator(Dex.formats.get(FORMAT_IDS.singles));
const izzy = TRAINERS.find(t => t.name === 'Izzy')!;
const tai = TRAINERS.find(t => t.name === 'Tai' && t.kind === 'legend')!;
const kaito = TRAINERS.find(t => t.name === 'Kaito')!;
const BENCH: SimSet[] = [
  { name: '', species: 'Chansey', item: 'Eviolite', ability: 'Natural Cure', moves: ['Soft-Boiled'], nature: 'Bold', gender: 'F', evs: {} as never, ivs: {} as never, level: 50 },
  { name: '', species: 'Blissey', item: 'Shed Shell', ability: 'Natural Cure', moves: ['Soft-Boiled'], nature: 'Bold', gender: 'F', evs: {} as never, ivs: {} as never, level: 50 },
  { name: '', species: 'Audino', item: 'Bright Powder', ability: 'Healer', moves: ['Pound'], nature: 'Bold', gender: 'F', evs: {} as never, ivs: {} as never, level: 50 },
];
const species = (o: { setIds: number[] }) => o.setIds.map(id => SETS[id].species);
const multiSpecial = Array.from({ length: 60 }, (_, i) => i + 1).find(n => scheduleSlot('multi', 'super', n).type === 'special')!;

describe('Izzy (DigiDestined)', () => {
  it('is a special trainer at weight 7 with eight sets, every one legal for a player in Sun & Moon', () => {
    expect(izzy.kind === 'special' && izzy.weight).toBe(7);
    expect([izzy.kind, izzy.class, izzy.custom, izzy.iv, izzy.roster.length]).toEqual(['special', 'DigiDestined', true, 31, 8]);
    const problems: string[] = [];
    for (const id of izzy.roster) {
      const set = treeSetToPokemonSet(SETS[id], 31, new Rng('x')) as unknown as SimSet;
      const bench = BENCH.filter(b => b.species !== set.species && b.item !== set.item).slice(0, 2);
      const found = (validator.validateTeam([set, ...bench]) ?? []).filter(p => !IGNORED_VALIDATOR_PROBLEMS.some(r => r.test(p)));
      if (found.length) problems.push(`${SETS[id].label}: ${found.join(' | ')}`);
    }
    expect(problems).toEqual([]);
    expect(new Set(izzy.roster.map(id => SETS[id].item)).size).toBe(8);
  });

  it('always leads with Tentomon holding Herculeskabuterite', () => {
    for (const format of ['singles', 'doubles'] as const) {
      for (let i = 0; i < 20; i++) {
        const o = planChosenOpponent(`izzy-${format}-${i}`, format, 7, [izzy.id]);
        expect(SETS[o.setIds[0]]).toMatchObject({ species: 'Tentomon', item: 'Herculeskabuterite' });
        expect(o.team).toHaveLength(format === 'singles' ? 3 : 4);
      }
    }
  });

  it('in a Multi Battle always brings Tai, who goes first; neither appears with anyone else that way', () => {
    expect(multiPartners(izzy.id)).toEqual([tai.id]);
    expect(multiDuo(izzy.id)).toEqual([tai.id, izzy.id]);
    let seen = 0;
    for (let i = 0; i < 4000; i++) {
      const o = planOpponent(`izzy-multi-${i}`, 'multi', 'super', multiSpecial, DEFAULT_SETTINGS);
      const ids = [o.trainerId, o.second!.trainerId];
      if (ids.includes(izzy.id)) {
        seen++;
        expect(ids, `run ${i}`).toEqual([tai.id, izzy.id]);
        expect([species(o)[0], species(o.second!)[0]]).toEqual(['Agumon', 'Tentomon']);
        expect([o.team.length, o.second!.team.length]).toEqual([2, 2]);
      }
      // Tai only appears with Izzy or Kaito, first.
      if (ids.includes(tai.id)) expect([ids[0], [izzy.id, kaito.id].includes(ids[1])]).toEqual([tai.id, true]);
    }
    expect(seen).toBeGreaterThan(0);
    // Debug mode: choosing Izzy brings Tai too, Tai first.
    const chosen = planChosenOpponent('chosen-izzy', 'multi', 7, [izzy.id]);
    expect([chosen.trainerId, chosen.second!.trainerId]).toEqual([tai.id, izzy.id]);
  });

  it('never appears against you when he is your partner', () => {
    for (let i = 0; i < 1000; i++) {
      const o = planOpponent(`izzy-partner-${i}`, 'multi', 'super', multiSpecial, DEFAULT_SETTINGS, izzy.id);
      expect([o.trainerId, o.second!.trainerId]).not.toContain(izzy.id);
    }
  });

  it('greets you with his own lines, and with team-up lines (matching Tai\'s) when they battle together', () => {
    expect(TRAINER_QUOTES.Izzy).toHaveLength(3);
    const duo = TRAINER_DUO_QUOTES['Tai & Izzy'];
    expect(duo.Tai).toHaveLength(3);
    expect(duo.Izzy).toHaveLength(3);
    for (let k = 0; k < 3; k++) {
      expect(trainerQuotes(izzy, k, [tai, izzy])).toEqual(duo.Izzy[k]);
      expect(trainerQuotes(tai, k, [tai, izzy])).toEqual(duo.Tai[k]);
      expect(trainerQuotes(izzy, k)).toEqual(TRAINER_QUOTES.Izzy[k]);
    }
    const names = [...new Set([...Dex.species.all()].map(s => s.baseSpecies))].filter(n => n.length > 2);
    const pokemon = new RegExp(`(?<![\\w-])(${names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')}|Tentomon|Kabuterimon)(?!\\w)`);
    const lines = [...TRAINER_QUOTES.Izzy, ...duo.Tai, ...duo.Izzy].flatMap(q => [q.greeting, q.trainerWins, q.trainerLoses]);
    for (const text of lines) {
      expect(text.length).toBeLessThanOrEqual(120);
      expect(text).not.toMatch(pokemon);
    }
    const everyOtherLine = Object.entries(TRAINER_QUOTES).filter(([k]) => k !== 'Izzy').flatMap(([, v]) => v).flatMap(q => [q.greeting, q.trainerWins, q.trainerLoses]);
    expect(new Set([...lines, ...everyOtherLine]).size).toBe(lines.length + everyOtherLine.length);
  });
});

describe('Kaito (Digimon Tamer)', () => {
  it('is a special trainer at weight 7 with eight sets, every one legal for a player in Sun & Moon', () => {
    expect([kaito.kind, kaito.class, kaito.custom, kaito.iv, kaito.roster.length, kaito.kind === 'special' && kaito.weight]).toEqual(['special', 'Digimon Tamer', true, 31, 8, 7]);
    const problems: string[] = [];
    for (const id of kaito.roster) {
      const set = treeSetToPokemonSet(SETS[id], 31, new Rng('x')) as unknown as SimSet;
      const bench = BENCH.filter(b => b.species !== set.species && b.item !== set.item).slice(0, 2);
      const found = (validator.validateTeam([set, ...bench]) ?? []).filter(p => !IGNORED_VALIDATOR_PROBLEMS.some(r => r.test(p)));
      if (found.length) problems.push(`${SETS[id].label}: ${found.join(' | ')}`);
    }
    expect(problems).toEqual([]);
    expect(new Set(kaito.roster.map(id => SETS[id].item)).size).toBe(8);
  });

  it('always leads with Agumon holding Blackwargreyite, and in a Multi Battle always brings Tai, Tai first', () => {
    const o = planChosenOpponent('kaito-singles', 'singles', 7, [kaito.id]);
    expect(SETS[o.setIds[0]]).toMatchObject({ species: 'Agumon', item: 'Blackwargreyite', moves: expect.arrayContaining(['Dramon Destroyer']) });
    expect(multiPartners(kaito.id)).toEqual([tai.id]);
    let seen = 0;
    for (let i = 0; i < 4000; i++) {
      const m = planOpponent(`kaito-multi-${i}`, 'multi', 'super', multiSpecial, DEFAULT_SETTINGS);
      const ids = [m.trainerId, m.second!.trainerId];
      if (ids.includes(kaito.id)) {
        seen++;
        expect(ids).toEqual([tai.id, kaito.id]);
        expect([species(m)[0], species(m.second!)[0]]).toEqual(['Agumon', 'Agumon']);
      }
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('has his own lines, and team-up lines with Tai (three each, matching)', () => {
    expect(TRAINER_QUOTES.Kaito).toHaveLength(3);
    const duo = TRAINER_DUO_QUOTES['Tai & Kaito'];
    expect([duo.Tai.length, duo.Kaito.length]).toEqual([3, 3]);
    for (let k = 0; k < 3; k++) {
      expect(trainerQuotes(kaito, k, [tai, kaito])).toEqual(duo.Kaito[k]);
      expect(trainerQuotes(tai, k, [tai, kaito])).toEqual(duo.Tai[k]);
    }
    const names = [...new Set([...Dex.species.all()].map(s => s.baseSpecies))].filter(n => n.length > 2);
    const pokemon = new RegExp(`(?<![\\w-])(${names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')}|Greymon|Agumon)(?!\\w)`);
    for (const q of [...TRAINER_QUOTES.Kaito, ...duo.Tai, ...duo.Kaito]) {
      for (const text of [q.greeting, q.trainerWins, q.trainerLoses]) {
        expect(text.length).toBeLessThanOrEqual(120);
        expect(text).not.toMatch(pokemon);
        // Kaito looks up to Tai, without the word itself (on request).
        expect(text).not.toMatch(/senpai/i);
      }
    }
  });
});
