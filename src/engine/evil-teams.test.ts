import { describe, expect, it } from 'vitest';
import { Dex, TeamValidator, type PokemonSet as SimSet } from '@pkmn/sim';
import { SETS, trainerKey, trainerQuotes, TRAINER_QUOTES, TRAINERS } from '../data/battle-tree';
import { treeSetToPokemonSet } from '../run/opponent';
import { partnerTrainer } from '../run/partners';
import { Rng } from '../run/rng';
import { planOpponent, scheduleSlot } from '../run/selection';
import { DEFAULT_SETTINGS } from '../run/types';
import { trainerArt, trainerSpriteId } from '../ui/sprites';
import { FORMAT_IDS, IGNORED_VALIDATOR_PROBLEMS, registerBattleTreeFormats } from './format';

registerBattleTreeFormats();
const validator = new TeamValidator(Dex.formats.get(FORMAT_IDS.singles));
const EVIL = TRAINERS.filter(t => t.kind === 'special' && t.source.sets?.includes('evil-teams.txt'));
const byKey = (key: string) => TRAINERS.find(t => trainerKey(t) === key)!;
const BENCH: SimSet[] = [
  { name: '', species: 'Chansey', item: 'Eviolite', ability: 'Natural Cure', moves: ['Soft-Boiled'], nature: 'Bold', gender: 'F', evs: {} as never, ivs: {} as never, level: 50 },
  { name: '', species: 'Blissey', item: 'Shed Shell', ability: 'Natural Cure', moves: ['Soft-Boiled'], nature: 'Bold', gender: 'F', evs: {} as never, ivs: {} as never, level: 50 },
  { name: '', species: 'Audino', item: 'Bright Powder', ability: 'Healer', moves: ['Pound'], nature: 'Bold', gender: 'F', evs: {} as never, ivs: {} as never, level: 50 },
];

describe('evil team leaders and admins', () => {
  it('are 26 special trainers at weight 1 (Courtney 7) with eight sets each, every set legal for a player in Sun & Moon', () => {
    expect(EVIL).toHaveLength(26);
    expect(EVIL.every(t => t.kind === 'special' && t.weight === (t.name === 'Courtney' ? 7 : 1) && t.roster.length === 8 && t.iv === 31)).toBe(true);
    const problems: string[] = [];
    for (const t of EVIL) {
      for (const id of t.roster) {
        const set = treeSetToPokemonSet(SETS[id], 31, new Rng('x')) as unknown as SimSet;
        const bench = BENCH.filter(b => b.species !== set.species && b.item !== set.item).slice(0, 2);
        const found = (validator.validateTeam([set, ...bench]) ?? []).filter(p => !IGNORED_VALIDATOR_PROBLEMS.some(r => r.test(p)));
        if (found.length) problems.push(`${trainerKey(t)} / ${SETS[id].label}: ${found.join(' | ')}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('has two versions of Archie and Maxie, told apart by class, key, lines and pictures', () => {
    for (const [name, older, newer] of [['Archie', 'Aqua Leader', 'Team Aqua Leader'], ['Maxie', 'Magma Leader', 'Team Magma Leader']]) {
      const rse = byKey(`${name} (RSE)`);
      const oras = byKey(`${name} (ORAS)`);
      expect([rse.name, rse.class, oras.name, oras.class]).toEqual([name, older, name, newer]);
      expect(TRAINER_QUOTES[`${name} (RSE)`]).not.toEqual(TRAINER_QUOTES[`${name} (ORAS)`]);
      expect(trainerSpriteId(rse)).toMatch(/-gen3$/);
      expect(trainerSpriteId(oras)).toMatch(/-gen6$/);
      expect(trainerArt(rse)!.url).toMatch(/Ruby_and_Sapph/);
      expect(trainerArt(oras)!.url).toMatch(/Omega_Ruby/);
    }
    // The Ruby / Sapphire / Emerald versions have no Mega Evolution; the remakes' do.
    const megas = (key: string) => byKey(key).roster.filter(id => /ite$|ite [XY]$/.test(SETS[id].item)).length;
    expect([megas('Archie (RSE)'), megas('Maxie (RSE)')]).toEqual([0, 0]);
    expect(megas('Archie (ORAS)')).toBeGreaterThan(0);
    expect(megas('Maxie (ORAS)')).toBeGreaterThan(0);
  });

  it("keeps Team Aqua's Matt apart from Tai's partner Matt", () => {
    const aqua = byKey('Matt (Team Aqua)');
    const digimon = TRAINERS.find(t => t.name === 'Matt' && t.kind === 'legend')!;
    expect([aqua.name, aqua.class]).toEqual(['Matt', 'Team Aqua Admin']);
    expect(trainerQuotes(aqua, 'k')).not.toBe(trainerQuotes(digimon, 'k'));
    expect(trainerSpriteId(aqua)).toBe('matt');
    expect(partnerTrainer('Matt (Team Aqua)')).toBe(aqua);
  });

  it('never puts two versions of the same character in one Multi Battle, or against your partner', () => {
    const battle = Array.from({ length: 60 }, (_, i) => i + 1).find(n => scheduleSlot('multi', 'super', n).type === 'special')!;
    const archie = [byKey('Archie (RSE)').id, byKey('Archie (ORAS)').id];
    let seenArchie = 0;
    for (let i = 0; i < 3000; i++) {
      const o = planOpponent(`two-archies-${i}`, 'multi', 'super', battle, DEFAULT_SETTINGS);
      const ids = [o.trainerId, o.second!.trainerId];
      expect(archie.every(id => ids.includes(id)), `run ${i}`).toBe(false);
      if (ids.some(id => archie.includes(id))) seenArchie++;
      const withPartner = planOpponent(`partner-archie-${i}`, 'multi', 'super', battle, DEFAULT_SETTINGS, archie[0]);
      expect([withPartner.trainerId, withPartner.second!.trainerId]).not.toContain(archie[1]);
    }
    expect(seenArchie).toBeGreaterThan(0);
  });
});
