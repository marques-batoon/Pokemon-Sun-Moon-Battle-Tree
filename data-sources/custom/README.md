# Custom trainers: how to edit them

Everything here is designed by you (not from the games). After editing any file in
this folder, rebuild and check, from the project folder:

```bash
npm run data:custom
```

```bash
npm test
```

Then `npm run build` and upload `dist/` as usual. `npm run data:custom` stops with a
message if something doesn't parse (a misspelled Pokémon or move, a trainer with no
team, ...).

## Battle-50 trainers (Marques, Thomas, Tai, Matt, and Battle Legends Elio, Kris, Brendan, May, Dawn, Rosa, Gloria)

- **Teams:** `battle-50-trainers.txt`, in Showdown's export format (Team Builder →
  Export, or Pokémon Showdown's teambuilder). Each `=== [format] Name ===` section
  adds Pokémon to that trainer; "Thomas 2" and "Thomas 3" are both Thomas. A trainer needs at
  least 2 Pokémon with different items and species (they bring 2 in a Multi Battle).
  **Adding Pokémon to a trainer who already has a team:** put them in a new section whose
  name ends in "(block N)", after that trainer's other sections, e.g.
  `=== [gen7battlespotsingles] Thomas 4 (block 3) ===`. Don't add them under an existing
  section: every set has an id, and saved runs and partners refer to sets by id, so new
  sets must come after everyone else's. Block 2 is taken (Marques's and Thomas's
  additions, 2026-10-23), so the next additions are block 3, then 4, and so on. A
  brand-new trainer's first team needs no block.
  IV lines are ignored (they battle at 31); EVs, natures, Abilities, items, moves and
  genders are used as written.
- **Who, where, how often:** `battle-50-trainers.json`. `trainers` sets each one's
  class ("Pokémon Trainer", "Battle Legend"), gender, sprite file and, optionally,
  `lead`: the Pokémon (species) that always leads their team (Tai's Agumon, Matt's
  Gabumon). `battles` lists who can appear at battle 50 of which format and course and
  their weight (Red / Blue are 7); a trainer can be in several entries, and an entry
  can name the game's Battle Legends ("Red", "Blue") to put them in another format's
  slot with their Super teams. It can also name a trainer from `digidestined.json` (Tai & Takato), who brings
  their own team. The battle-50 draw also happens at 100, 150, ... In a
  Multi entry the first name is the first opponent (shown on the left).
- **A brand-new trainer added after others' data exists** gets `"block": N` in `trainers`, so they and their
  sets come after everyone else in the app's data and no id moves. Block 2 is taken (Elio, Kris, Brendan, May,
  Dawn, Rosa, Gloria, 2026-10-23). A new block also needs its own line in `src/data/battle-tree/index.ts`,
  after the last block there (this `block` is separate from the "(block N)" sections in the `.txt`).
- **Sprites:** PNGs with a transparent background in `public/trainers/` (square works
  best), named in `battle-50-trainers.json`. A trainer with no `sprite` there uses a Pokémon Showdown
  sprite named in `src/data/battle-tree/trainer-sprites.json` (`named`, with any Pokémon Masters outfits in
  `masters`; the PNGs bundled in `public/trainers/showdown/` and `public/trainers/masters/`), like Elio.
- **Lines:** `src/data/battle-tree/trainer-quotes.json`, under `"quotes"` → `"Marques"`
  and `"Thomas"` (Tai and Matt: `"quotes"` for when they battle alone, three each, and
  `"multi"` for when they battle together, three each in matching order; the later Battle Legends: `"quotes"`
  for when they battle alone, three each, and `"duos"` for each Multi pair, e.g. `"Kris & May"`, three each in
  matching order). Each entry is `{ "greeting": "...", "trainerWins": "...",
  "trainerLoses": "..." }` (at most 120 characters each; "trainerWins" is said when
  they beat you). They're picked at random per battle, the same position for both, so
  give Marques and Thomas the same number of entries in matching order (three each). No Pokémon
  names. No `npm run data:custom` needed for lines; `npm test` checks them.

## The DigiDestined and Digimon Tamers (Izzy, Kaito, Takato, Henry, Rika)

- **Teams:** `digidestined.txt`, same format, one section per trainer (eight Pokémon each).
- **Who, how often, partners:** `digidestined.json`, by section title. If a trainer's name is taken (the game
  has a Gentleman Henry), use another section title ("Henry (Tamer)") and give `"name": "Henry"`: the title is
  then their key for lines. Each trainer has a class ("DigiDestined", "Digimon Tamer"),
  gender, sprite (in `public/trainers/`), `lead` (the Pokémon that always leads: Izzy's Tentomon),
  `weight` in the special-trainer pool (all 7), or `"legend": true` to make them a Battle Legend instead (Takato,
  Henry: then `battle-50-trainers.json` says where and how often, and they have no weight or partners), and `partners`: as an opponent in a Multi Battle
  they always battle alongside one of these, picked with equal chance, and the partner goes first
  (on the left). A partner can be a Battle Legend (Tai), another trainer in this file, or any other special
  trainer (Izzy's Colress, one of the game's own, and Cheren, a Gym Leader). To give
  Izzy Mimi or Joe as partners too, add them here (with their own teams) and list them in his
  `partners`.
- **Lines:** `trainer-quotes.json`: their own lines under `"quotes"`, and team-up lines with each
  partner under `"duos"`, e.g. `"Tai & Izzy": { "Tai": [...], "Izzy": [...] }`, three sets each in
  matching order (used whenever those two battle together). `npm test` checks them.

## Elite Four and Champions

- **Teams:** `elite-four.txt`, same format, one section per trainer (eight Pokémon each).
  Who they are (class, gender, region) is set in `scripts/build-custom-trainers.mjs`
  (`ELITE_FOUR`, `CHAMPIONS`, `ELITE_FEMALE`); a new name must be added there too.
  They're special trainers at weight 3.5. `npm test` checks every set against the
  game's rules (learnsets, Abilities, items).
- **Lines and pair greetings:** `trainer-quotes.json`, like the Gym Leaders'.

## Evil team leaders and admins

- **Teams:** `evil-teams.txt`, one section per trainer, titled with their key: the
  name, or "Archie (RSE)" / "Archie (ORAS)" style when two share a name. Class,
  gender and region are in `scripts/build-custom-trainers.mjs` (`EVIL_TEAMS`); a new
  trainer must be added there too. Weight 1 each (Courtney 7): `EVIL_WEIGHT` and `weight` in
  `EVIL_TEAMS`. `npm test` checks every set.
- **Lines and pair greetings:** `trainer-quotes.json`, under the same key.

## Regular trainers (Veteran Mildred, the Paradox trainers)

- **Teams:** `regular-trainers.txt`, same format, one section per trainer.
- **Who and from when:** `regular-trainers.json`: class ("Veteran"), gender, `spriteId` (a Pokémon Showdown
  trainer sprite, e.g. `veteranf-gen6`: see https://play.pokemonshowdown.com/sprites/trainers/) and
  `fromBattle`: from that battle on (over 50), they're in the regular trainers' pool of Super Singles,
  Super Doubles and Super Multi. IV 31 (IV lines are ignored).
- **How often:** `weights` at the top of `regular-trainers.json`, by battle, against 1 for each of the game's
  trainers: 1.1 from battle 100, 1.5 from battle 200. A trainer can have their own `weights` list.
- **`alwaysParadox: true`** (the 21 Paradox trainers): one of their sets holding a Paradoxorb is on every team
  they bring, at a random place; the rest come from their other sets. Give them at least one Paradoxorb set and
  enough others (with different items) to fill a team of 4. No Mega Stones (`npm run data:custom` checks).
- **Sprites** are bundled: put the PNG in `public/trainers/showdown/<spriteId>.png` (download it from Showdown's
  trainer sprites) and add the id to `bundled` in `src/data/battle-tree/trainer-sprites.json`.
  `node scripts/check-trainer-sprites.mjs` checks every one is there. Bronson's, Ignatius's and Delta's
  aren't bundled yet: they load from Showdown until they are.
- **`block`** (2, 3, 4): a trainer added after other data exists comes after it, so no trainer's or set's id
  moves: 2 after Lillie, Hau, Lana and Marley; 3 after Marques's and Thomas's added Pokémon (Percival); 4 after
  the later Battle Legends (Bronson, Ignatius, Delta). The next new regular trainer is block 5, which also
  needs its own line in `src/data/battle-tree/index.ts`, after the last block there.
- **Opponents' teams** follow Species Clause and Item Clause, so Pokémon holding the same item never
  battle together (Mildred's three Paradoxorb-A beasts: at most one per battle).
- **Lines:** `trainer-quotes.json` under `"quotes"` → their name, three entries. `npm test` checks them.

## Other special trainers (Lillie, Hau, Lana, Marley)

- **Teams:** `special-trainers.txt`, same format, one section per trainer (eight Pokémon each).
- **Who:** `special-trainers.json`: class, gender, region (for pair greetings) and weight (7).
- **Sprites:** `src/data/battle-tree/trainer-sprites.json` (`named`, `masters`, and `bundled` with the PNG in
  `public/trainers/showdown/`).
- **Lines and pair greetings:** `trainer-quotes.json`, like the Gym Leaders'.

## Gym Leaders

- **Teams:** `gym-leaders.txt`, same format; "Brock 1" and "Brock 2" are both Brock.
- **Weight:** 7 each, like the game's special trainers; Giovanni 1 (`GYM_WEIGHT` in `scripts/build-custom-trainers.mjs`).
- **Lines:** `trainer-quotes.json` under their names (three entries each).
- **Pair greetings (Multi Battles):** `trainer-quotes.json` under `"pairs"`. When two
  special trainers who share a region or a type (Brock and Misty, Misty and Juan...)
  are drawn together, each uses their lines from the pair's entry instead of their
  usual ones: a greeting and both closing remarks. Each entry is
  `"Brock & Misty": { "Brock": [ { "greeting": "...", "trainerWins": "...", "trainerLoses": "..." }, {...}, {...} ], "Misty": [ ... ] }`
  (the label is just for you; the two names inside are what count): three sets each, in matching
  order (the same set is picked for both, so they answer each other). To add a pair, add
  an entry like that. At most 120 characters each, no Pokémon names (their shared type is
  fine), and no line used twice. `npm test` checks them.
