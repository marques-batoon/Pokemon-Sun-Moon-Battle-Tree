// Format facts shared by the worker (simulator) and the UI thread. No
// simulator imports here, so the UI bundle doesn't pull in @pkmn/sim.

/**
 * Species that exist in Gen 7 data but were not obtainable in Sun/Moon (added in
 * Ultra Sun/Ultra Moon). Approved decision: Showdown's merged Gen 7 learnsets are
 * accepted, but the species list is limited to Sun/Moon.
 */
export const USUM_ONLY_SPECIES = ['Poipole', 'Naganadel', 'Stakataka', 'Blacephalon', 'Zeraora', 'Lycanroc-Dusk'];

/** Showdown format ids with Team Preview (bring 3 of the registered team each battle); also used for validation. */
export const FORMAT_IDS = {
  singles: 'gen7battletreesingles',
  doubles: 'gen7battletreedoubles',
  /** Multi: validates the registered team; battles always use the no-preview format (4 trainers, 2 Pokémon each). */
  multi: 'gen7battletreemulti',
} as const;
export type BattleTreeFormat = keyof typeof FORMAT_IDS;

/**
 * Game rule: no Team Preview. The player's team is exactly the Pokémon brought,
 * in battle order (lead first), and the opponent's team stays hidden.
 */
export const NO_PREVIEW_FORMAT_IDS: Record<BattleTreeFormat, string> = {
  singles: 'gen7battletreesinglesnopreview',
  doubles: 'gen7battletreedoublesnopreview',
  multi: 'gen7battletreemultinopreview',
};

/** Multi Battles never use Team Preview (each trainer just brings 2). */
export const simFormatId = (format: BattleTreeFormat, teamPreview: boolean) =>
  teamPreview && format !== 'multi' ? FORMAT_IDS[format] : NO_PREVIEW_FORMAT_IDS[format];

/** Showdown's "you have 0 EVs" nag. Zero EVs is legal in the Battle Tree. */
export const IGNORED_VALIDATOR_PROBLEMS = [/has exactly 0 EVs/];
