# Battle Tree raw sources

These are the inputs to `scripts/build-battle-tree-data.mjs` (`npm run data:build`), which writes `src/data/battle-tree/*.json`. Everything was retrieved on 2026-10-03.

| File | What it is | Origin |
|---|---|---|
| `tre-sm-tree-pokemon.csv` | All 996 Sun/Moon (v1.1) Battle Tree sets in game index order: label, nature, item, 4 moves, EV stats. The 10th column holds Team Rocket Elite's two v1.0→v1.1 change notes. | Team Rocket Elite, "SM full trainer and moveset data", tab **Tree Pokemon**, exported as xlsx → CSV. <https://docs.google.com/spreadsheets/d/1D7T0jCHBkDppjTB0_rJyK0houk8zE3wLmZ1DlVXEkXg/edit#gid=0> (linked from the OP of Smogon's [Battle Tree Discussion and Records](https://www.smogon.com/forums/threads/battle-tree-discussion-and-records.3587215/) thread) |
| `tre-sm-tree-trainers.txt` | All 205 Sun/Moon Battle Tree trainers in game index order, each with its roster of set labels. | Same spreadsheet, tab **Tree Trainers** |
| `bulbapedia-trainer-brackets.json` | Bulbapedia's table of the 190 regular trainers: number, class, name, and the battle ranges (1-10, 11-19, 21-29, 31-39, 41-49, 51+) each appears in. | Parsed from the Wayback snapshot of [List of Battle Tree Trainers](https://web.archive.org/web/20260817222050/https://bulbapedia.bulbagarden.net/wiki/List_of_Battle_Tree_Trainers) (bulbapedia.bulbagarden.net blocks scripted requests) |

## Sources used for cross-checking only (not copied)

- **Bulbapedia, [List of Battle Tree Pokémon](https://web.archive.org/web/20260218191326/https://bulbapedia.bulbagarden.net/wiki/List_of_Battle_Tree_Pok%C3%A9mon)**: the 996 rows tagged SM or untagged match `tre-sm-tree-pokemon.csv` exactly (item, moves, nature, numeric EVs, order).
- **Bulbapedia, [Battle Tree](https://bulbapedia.bulbagarden.net/wiki/Battle_Tree)** (raw wikitext, read in a browser): courses, restrictions, banned species, BP table, Red's Normal and Super sets, special trainers by version, Anabel condition.
- **Level 51, [SM Battle Tree Informant](https://docs.google.com/spreadsheets/d/1FFsMrmL9WPVRsbWTE7mvKZ9mz_J4_E_aDCWguGLrKV0/edit)**: same sets and rosters (it's built on the Team Rocket Elite dump).
- **SadisticMystic, [Trainer + Pokémon lookup](https://docs.google.com/spreadsheets/d/1w-xYTGS9SW8np4Qxg9KjB99QkSxfPDhmjTzHk8GOT04/edit)**: USUM rosters plus per-trainer SM deltas, min/max battle per trainer, the IV-tier formula, special trainer notes (Anabel 7× rarer; version exclusives).
- **[cristiannomartins/Tree-Sets](https://github.com/cristiannomartins/Tree-Sets)**: SM trainer→pool mapping (used to settle the Kendra and regional-form questions).
- **Smogon, [Battle Tree Mechanics and Guide](https://www.smogon.com/forums/threads/battle-tree-mechanics-and-guide-gp-0-2.3613222/)**: team generation, ability odds, BP, banlist, Item Clause scope, level rule, AI behaviour.
- **atsync, [Smogon post #7392593](https://www.smogon.com/forums/threads/battle-tree-discussion-and-records.3587215/page-83#post-7392593)**: opponent IVs by trainer number, and that Normal uses the same trainers as Super's first 20 battles (tested, labelled an educated guess by the author).
- **[pastebin jt9TQEdP](https://pastebin.com/jt9TQEdP)**: SM→USUM set changes; confirms SM had 996 sets.
- **Serebii, [Battle Tree (SM)](https://www.serebii.net/sunmoon/battletree.shtml)**: special trainers every 10 wins in Super (older, partial list).
