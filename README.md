# Battle Tree Simulator (Pokémon Sun & Moon)

A web recreation of the Sun/Moon Battle Tree: a Showdown-style team builder plus faithful Battle Tree runs, starting with Single Battles in Normal and Super rank.

- Data and accuracy notes: [DATA_NOTES.md](DATA_NOTES.md)
- Opponent AI heuristics: [AI_NOTES.md](AI_NOTES.md)
- Raw data sources: [data-sources/battle-tree/SOURCES.md](data-sources/battle-tree/SOURCES.md)

## Scripts

```sh
npm run dev         # Vite dev server
npm test            # Vitest (data integrity, engine, client integration)
npm run build       # typecheck + production build
npm run data:build  # regenerate src/data/battle-tree/*.json from data-sources/
node scripts/check-trainer-sprites.mjs  # verify every trainer has a sprite that exists on Showdown (network)
```

## Layout

| Path | What |
|---|---|
| `src/data/battle-tree/` | Generated Battle Tree data (sets, trainers, brackets, bosses, rules) + typed loader |
| `src/data/custom/` | Custom additions made for this app: Politoedite (Mega Politoed), Poliwrathium Z and Paradox Evolution (Paradoxorb-A / -F; see DATA_NOTES.md) |
| `src/data/champions/` | Pokémon Champions Megas made legal for the player (sourced Mega data, generated availability and sprite tables) |
| `src/engine/` | Battle engine on `@pkmn/sim`: Battle Tree format, seeded `BattleSession`, worker host + protocol |
| `src/ai/` | Opponent AI behind the `BattleAI` interface: `heuristic/` (default, approximates the in-game AI with `@smogon/calc`) and `random-ai.ts` |
| `src/client/` | UI-thread clients for the worker: battles (`@pkmn/client` state, `@pkmn/view` log) and team validation |
| `src/team/` | Team model (UI-thread safe): eligible species, learnsets, Lv. 50 stats, Showdown import/export, clause checks |
| `src/storage/` | `KeyValueStore` interface (localStorage / memory) and the versioned `TeamStore` |
| `src/online/` | Online Multi Battles: trainer-name rules, relay connection, host/partner messages (`link-protocol.ts`, checked on receipt) and the room logic (`link-room.ts`) |
| `relay/` | The relay server for online play (Cloudflare Worker + Durable Object; separate `package.json`, see its README) |
| `src/run/` | Battle Tree run loop: seeded RNG, bracket/special trainer selection, opponent team generation, BP, Multi partners and scouting (`partners.ts`), `RunStore` (progress) and `RunController` (start/resume/battle/retire) |
| `src/settings/` | App preferences (theme, sprites, animation speed, battle aids, debug tools) |
| `src/ui/` | React components (Battle Tree, builder, battle stage, settings) |

Legality checks use Showdown's `TeamValidator` inside the worker, so `@pkmn/sim` never loads on the UI thread. The builder shows per-Pokémon and team-wide problems (clauses, team size) as you edit.

The simulator runs in a Web Worker (`src/engine/battle.worker.ts`). The UI sends choices and receives the protocol stream from the player's point of view. The opponent AI runs inside the worker with read-only access to the simulator state.

Battles are seeded: the same seed text plus the same choices reproduce the same battle. With debug tools on (Settings), the end screen offers the simulator input log.

## Battle presentation

- **Formats.** Single Battles (bring 3) and Double Battles (bring 4), each with a Normal course (20 battles, Battle Legend Red / Blue at 20) and an endless Super course. In Doubles you choose an action for each of your two Pokémon in turn and pick a target when the move needs one (effectiveness is shown per target); spread moves animate on every Pokémon they hit.
- **Multi Battles.** Super Multi opens once Super Singles and Super Doubles are both unlocked: you bring 2 and an AI partner (a special trainer) brings 2 against two trainers, with Red and Blue together at battle 50. Sina and Dexio are partners from the start; special trainers you beat can be bought for 100 BP on the Battle Tree page, and you pick two of a partner's (up to six) Pokémon by picture. See DATA_NOTES.md section 13.
- **Online Multi Battles.** Team up with a friend (Online page): one player hosts the battle in their browser, and a small relay server passes messages between you. Set up the relay with `relay/README.md`; the app needs its address in `VITE_RELAY_URL` at build time (`.env.example`). Trainer names are set in Settings.
- **Playback.** The battle client plays events one at a time (`src/client/playback.ts`). Each protocol line updates the state and the log, shows its animation, and the next line waits until that animation ends. Animated events: moves, hits and HP drain, healing, switch-out, switch-in, faints, Mega Evolution, forme changes, status, stat changes and misses. Animation speed is a setting (off / fast / normal / slow), and Skip jumps to the end of the turn.
- **Now playing.** While events play, the bar under the stage shows the move being carried out (type, name, category and who used it) and the text of the event on screen, so you can follow along before the log catches your eye.
- **Move animations.** Every move gets an animation from `src/ui/battle/fx/catalog.ts`, picked by what the move does (`src/client/move-class.ts`):
  - Attacks: a different look for each of the 18 types, with separate physical (contact at the target, the user lunges) and special (something travels from the user: fireball, water jet, lightning bolt, ice beam, shadow ball...) versions.
  - Status moves: stat boosts (glow and rising arrows on the user), stat drops (waves and falling arrows on the target), status conditions (coloured by condition: sparks for paralysis, flames for burns, bubbles for poison or sleep...), protection (Protect bubble, King's Shield, spiky shields), healing, weather / terrain / rooms, screens, hazards, Tailwind and Roar / Whirlwind.
  - Z-Moves: the user charges with Z-Power (dimmed screen, golden aura), then a giant orb and an oversized version of the type's effect with a flash and a strong screen shake.
  - Mega Evolution: rainbow energy gathers while the Pokémon glows white, then a burst reveals the Mega sprite, drawn 20% larger than a regular Pokémon.
  
- **Lasting states on the field.**
  - Substitute: the user builds its decoy in a puff of smoke, then the Substitute doll drops in and stands in for the Pokémon (Showdown's doll sprite, or a drawn doll with sprites off). Hits on it make the doll shake; the Pokémon steps out from behind it only to use its own moves; when it breaks, the doll bursts and the Pokémon reappears.
  - Screens: Reflect (semi-transparent white), Light Screen (yellow) and Aurora Veil (light blue) stand as translucent barriers in front of the protected side for as long as they last, and fade when they wear off. Safeguard (lilac) and Mist (pale green) work the same way.
  - Status conditions stay visible on the Pokémon (as particles and outlines, never a colour fill over it): flames at its feet (burn), rising bubbles (poison; darker and faster when badly poisoned), flickering sparks (paralysis), drifting Z's (sleep), an ice block (freeze), stars circling its head (confusion) and floating hearts (infatuation). Each one also has its own burst when it takes hold, when it stops the Pokémon from moving, and when it deals damage at the end of the turn.
  - Protect, Detect, King's Shield, Spiky Shield and Baneful Bunker leave a bubble around the Pokémon for the rest of the turn; a move that hits it bounces off with a flash.
  - Terrains cover the ground (crackling yellow Electric Terrain, grassy tufts, pink Psychic waves, drifting Misty fog) and sweep in when they start. Trick Room, Magic Room and Wonder Room enclose the field in a glowing grid (purple, pink, blue); Gravity pulls dark streaks down. They fade when they end.
  - Leech Seed: a seeded Pokémon carries sprouting seeds and a pulsing green glow. At the end of each turn a stream of green energy flows from it to the opponent. Draining moves (Giga Drain, Drain Punch, Draining Kiss...) show the same kind of stream from the target to the user.

  The effects are CSS animations on positioned elements (`src/ui/battle/fx/MoveEffects.tsx`, "Move effects" in `src/index.css`); their timing follows the animation speed setting. With debug tools on, Free Battle has an "Animation preview" that plays any move's animation on its own. Animations are this app's own; they are not taken from the games.
- **Sprites.** Pokémon sprites (animated, front and back; a Mega Evolution swaps to the Mega sprite), menu icons and trainer portraits load at runtime from Pokémon Showdown's sprite server via `@pkmn/img`. They are not bundled; © Nintendo / Creatures / GAME FREAK. Trainer classes map to sprites in `src/data/battle-tree/trainer-sprites.json`. Turning "Pokémon sprites and trainer portraits" off in Settings uses type-colored placeholders. Missing images fall back automatically: animated, then static, then placeholder.
