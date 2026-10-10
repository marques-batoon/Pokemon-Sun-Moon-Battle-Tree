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

## Battle-50 trainers (Marques, Thomas)

- **Teams:** `battle-50-trainers.txt`, in Showdown's export format (Team Builder →
  Export, or Pokémon Showdown's teambuilder). Each `=== [format] Name ===` section
  adds Pokémon to that trainer; "Thomas 2" and "Thomas 3" are both Thomas, so you
  can add a new section or add Pokémon under an existing one. A trainer needs at
  least 2 Pokémon with different items and species (they bring 2 in a Multi Battle).
  IV lines are ignored (they battle at 31); EVs, natures, Abilities, items, moves and
  genders are used as written.
- **Who, where, how often:** `battle-50-trainers.json`. `trainers` sets each one's
  class ("Pokémon Trainer"), gender and sprite file; `battles` lists who can appear
  at battle 50 of which course and their weight (Red / Blue are 7). In a Multi entry
  the first name is the first opponent (shown on the left).
- **Sprites:** PNGs with a transparent background in `public/trainers/` (square works
  best), named in `battle-50-trainers.json`.
- **Lines:** `src/data/battle-tree/trainer-quotes.json`, under `"quotes"` → `"Marques"`
  and `"Thomas"`. Each entry is `{ "greeting": "...", "trainerWins": "...",
  "trainerLoses": "..." }` (at most 120 characters each; "trainerWins" is said when
  they beat you). They're picked at random per battle, the same position for both, so
  give Marques and Thomas the same number of entries in matching order. No Pokémon
  names. No `npm run data:custom` needed for lines; `npm test` checks them.

## Gym Leaders

- **Teams:** `gym-leaders.txt`, same format; "Brock 1" and "Brock 2" are both Brock.
- **Lines:** `trainer-quotes.json` under their names (three entries each).
- **Pair greetings (Multi Battles):** `trainer-quotes.json` under `"pairs"`. When two
  special trainers who share a region or a type (Brock and Misty, Misty and Juan...)
  are drawn together, each greets you with their line from the pair's entry instead
  of their usual greeting; their closing remarks stay their usual ones. Each entry is
  `"Brock & Misty": { "Brock": "...", "Misty": "..." }` (the label is just for you; the
  two names inside are what count). To add a pair, add an entry like that. At most 120
  characters each, no Pokémon names (their shared type is fine). `npm test` checks them.
