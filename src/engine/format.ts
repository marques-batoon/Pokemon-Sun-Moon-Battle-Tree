import { Dex, type ActiveMove, type Battle, type Move, type Pokemon, type PokemonSet, type Species, type TeamValidator } from '@pkmn/sim';
import { RULES } from '../data/battle-tree';
import { AURA_GUARD, CHAMPIONS_MOD, championsOverrides, NEW_LEARNSET_IDS, NEW_MOVE_IDS } from '../data/champions';
import { customOverrides, isCustomLearn, mergeModData } from '../data/custom';
import { canHoldItem, paradoxOverrides, PARADOX_LABELS, PARADOX_MOVE_IDS, paradoxFormForSet, paradoxKindOfItem } from '../data/custom/paradox';
import { addCustomBattleLogic, CUSTOM_ACTIONS } from './custom';
import { USUM_ONLY_SPECIES } from './format-constants';

export { FORMAT_IDS, IGNORED_VALIDATOR_PROBLEMS, NO_PREVIEW_FORMAT_IDS, simFormatId, USUM_ONLY_SPECIES, type BattleTreeFormat } from './format-constants';

/**
 * Flat rules for the battle itself: Showdown applies "Adjust Level Down" and
 * "Default Level" inside the team validator (by mutating sets), not in the
 * battle engine, so the session normalizes every team explicitly.
 * Pokémon above Lv. 50 fight at 50; lower levels are kept.
 */
export function applyFlatRules(team: PokemonSet[]): PokemonSet[] {
  const cap = RULES.level.max;
  const zero = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  const max = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };
  return team.map(set => ({
    ...set,
    level: Math.min(set.level || cap, cap),
    evs: { ...zero, ...set.evs },
    ivs: { ...max, ...set.ivs },
  }));
}

let registered = false;

/**
 * Gen 7 plus the Pokémon Champions Megas (see DATA_NOTES.md): their stones, the
 * Pokémon, moves and Abilities they need, Champions' Mega data, and Aura Guard;
 * plus the custom additions (Mega Politoed, Poliwrathium Z) and duration tags
 * on field-effect start messages.
 */
function registerChampionsMod(): void {
  const gen7 = Dex.mod('gen7').data;
  const data = mergeModData(championsOverrides(), customOverrides({ species: gen7.Pokedex as never }), paradoxOverrides({ ui: false })) as ReturnType<typeof championsOverrides> & Record<string, Record<string, Record<string, unknown>>>;
  addCustomBattleLogic(data as never, { Conditions: gen7.Conditions as never, Moves: gen7.Moves as never });
  Object.assign(data.Abilities[AURA_GUARD.id], {
    onSourceModifyDamage(this: Battle, _damage: number, source: Pokemon, target: Pokemon, move: ActiveMove) {
      // Contact as the game counts it: Long Reach (and Protective Pads) mean no contact.
      if (this.checkMoveMakesContact(move, source, target)) {
        this.debug('Aura Guard halves contact damage');
        return this.chainModify(0.5);
      }
    },
  });
  Dex.mod(CHAMPIONS_MOD, { Scripts: { inherit: 'gen7', gen: 7, actions: CUSTOM_ACTIONS }, ...data } as never);
}

/**
 * Falinks, Scovillain, Glimmora and Baxcalibur (Champions Megas, Gen 8-9) learn
 * from their newest learnsets; everyone else uses the Gen 7 rules, plus the
 * app's custom extra moves (CUSTOM_LEARNS). A Pokémon holding a Paradoxorb
 * learns its Paradox form's moves instead (newest learnset, no restrictions).
 */
// Problems start with a space: the validator puts the Pokémon's name in front.
function checkCanLearn(this: TeamValidator, move: Move, species: Species, setSources: Parameters<TeamValidator['checkCanLearn']>[2], set: PokemonSet): string | null {
  const id = species.id;
  const paradox = paradoxFormForSet(species.name, set.item);
  if (paradox) {
    const learnset = Dex.species.getLearnsetData(toId(paradox) as never).learnset ?? {};
    return move.id in learnset ? null : ` can't learn ${move.name} (its Paradox form ${paradox} doesn't).`;
  }
  if (isCustomLearn(id, move.id)) return null;
  if (NEW_LEARNSET_IDS.has(id)) {
    const learnset = Dex.species.getLearnsetData(id).learnset ?? {};
    return move.id in learnset ? null : ` can't learn ${move.name}.`;
  }
  if (NEW_MOVE_IDS.has(move.id) || PARADOX_MOVE_IDS.has(move.id)) return ` can't learn ${move.name}.`;
  return this.checkCanLearn(move, species, setSources, set);
}

const toId = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Paradoxorbs only go on Pokémon with that kind of Paradox form. */
function onValidateSet(this: TeamValidator, set: PokemonSet): string[] | undefined {
  const kind = paradoxKindOfItem(set.item);
  const species = this.dex.species.get(set.species);
  if (!kind || canHoldItem(species.name, set.item)) return undefined;
  return [`${species.name} can't hold ${this.dex.items.get(set.item).name}: it has no ${PARADOX_LABELS[kind]} Paradox form.`];
}

/**
 * Item Clause (1 of each item), as Showdown words it, except that any number of
 * Pokémon may hold a Paradoxorb: Paradox Evolution has no once-per-battle limit.
 */
function onValidateTeam(this: TeamValidator, team: PokemonSet[]): string[] | undefined {
  const seen = new Set<string>();
  for (const set of team) {
    const item = toId(set.item ?? '');
    if (!item || paradoxKindOfItem(item)) continue;
    if (seen.has(item)) return ['You are limited to 1 of each item by Item Clause.', `(You have more than 1 ${this.dex.items.get(item).name})`];
    seen.add(item);
  }
  return undefined;
}

/**
 * Registers the Battle Tree formats with @pkmn/sim's Dex. Idempotent; must run
 * in every context that starts battles or validates teams (worker, tests).
 *
 * Rules (see DATA_NOTES.md section 5):
 * - Flat rules: Pokémon above Lv. 50 are lowered to 50, lower levels stay.
 * - Species Clause and Item Clause over the whole registered team (Paradoxorbs exempt).
 * - Singles: register 3-6 Pokémon, bring 3. Doubles: register 4-6, bring 4 (Team Preview or the game rule).
 * - Sun/Moon banlist (restricted legendaries + mythicals) plus USUM-only species.
 * No Sleep/Evasion/OHKO clauses: the Battle Tree has none.
 */
export function registerBattleTreeFormats(): void {
  if (registered) return;
  registered = true;
  registerChampionsMod();
  const singles = RULES.teamSize.singles;
  const doubles = RULES.teamSize.doubles as Required<typeof RULES.teamSize.doubles>;
  const multi = RULES.teamSize.multi as Required<typeof RULES.teamSize.multi>;
  const shared = [
    'Cancel Mod',
    'Max Level = 100',
    `Default Level = ${RULES.level.max}`,
    `Adjust Level Down = ${RULES.level.max}`,
    'Obtainable',
    'Species Clause',
  ];
  const banlist = [...new Set([...RULES.bannedSpecies.species, ...USUM_ONLY_SPECIES])];
  Dex.formats.extend([
    { section: 'Battle Tree (Sun/Moon)' },
    {
      name: '[Gen 7] Battle Tree Singles',
      desc: 'Registered team of 3-6; Team Preview picks 3 each battle (Showdown-style option).',
      mod: CHAMPIONS_MOD,
      checkCanLearn,
      onValidateSet,
      onValidateTeam,
      gameType: 'singles',
      ruleset: [
        'Team Preview',
        `Max Team Size = ${singles.registeredMax}`,
        `Min Team Size = ${singles.registeredMin}`,
        `Picked Team Size = ${singles.bring}`,
        ...shared,
      ],
      banlist,
    },
    {
      name: '[Gen 7] Battle Tree Singles (No Preview)',
      desc: 'Game rule: the 3 brought Pokémon in battle order; no Team Preview.',
      mod: CHAMPIONS_MOD,
      checkCanLearn,
      onValidateSet,
      onValidateTeam,
      gameType: 'singles',
      ruleset: [`Max Team Size = ${singles.bring}`, `Min Team Size = ${singles.bring}`, ...shared],
      banlist,
    },
    {
      name: '[Gen 7] Battle Tree Doubles',
      desc: 'Registered team of 4-6; Team Preview picks 4 each battle (Showdown-style option).',
      mod: CHAMPIONS_MOD,
      checkCanLearn,
      onValidateSet,
      onValidateTeam,
      gameType: 'doubles',
      ruleset: [
        'Team Preview',
        `Max Team Size = ${doubles.registeredMax}`,
        `Min Team Size = ${doubles.registeredMin}`,
        `Picked Team Size = ${doubles.bring}`,
        ...shared,
      ],
      banlist,
    },
    {
      name: '[Gen 7] Battle Tree Doubles (No Preview)',
      desc: 'Game rule: the 4 brought Pokémon in battle order (first two lead); no Team Preview.',
      mod: CHAMPIONS_MOD,
      checkCanLearn,
      onValidateSet,
      onValidateTeam,
      gameType: 'doubles',
      ruleset: [`Max Team Size = ${doubles.bring}`, `Min Team Size = ${doubles.bring}`, ...shared],
      banlist,
    },
    {
      name: '[Gen 7] Battle Tree Multi',
      desc: 'Registered team of 2-6 (validation only); you bring 2.',
      mod: CHAMPIONS_MOD,
      checkCanLearn,
      onValidateSet,
      onValidateTeam,
      gameType: 'multi',
      ruleset: [`Max Team Size = ${multi.registeredMax}`, `Min Team Size = ${multi.registeredMin}`, ...shared],
      banlist,
    },
    {
      name: '[Gen 7] Battle Tree Multi (No Preview)',
      desc: 'Multi Battle: you and your partner (2 Pokémon each) against two trainers (2 each). Clauses apply per trainer.',
      mod: CHAMPIONS_MOD,
      checkCanLearn,
      onValidateSet,
      onValidateTeam,
      gameType: 'multi',
      ruleset: [`Max Team Size = ${multi.bring}`, `Min Team Size = ${multi.bring}`, ...shared],
      banlist,
    },
  ]);
}
