# Opponent AI (heuristic)

The Sun/Moon Battle Tree AI hasn't been disassembled publicly, so this is an **approximation**. It's built from behaviour the community documented in Smogon's [Battle Tree Mechanics and Guide](https://www.smogon.com/forums/threads/battle-tree-mechanics-and-guide-gp-0-2.3613222/) (cited as "guide" below), plus general good play where the guide is silent.

Code lives in `src/ai/heuristic/`:

| File | What it does |
|---|---|
| `config.ts` | Every tuning knob, with defaults |
| `calc.ts` | Turns live simulator state into `@smogon/calc` inputs and returns damage estimates |
| `evaluate.ts` | Scores each move, rates bench Pokémon |
| `heuristic-ai.ts` | Turns scores into a choice; switching and replacements |

The AI implements the same `BattleAI` interface as the random AI (`src/ai/types.ts`). It runs in the battle worker, and every call records its options, scores and reason in `lastDecision`.

## Knowledge

Like the in-game AI, it sees the whole battle state. That includes your Pokémon's real stats, moves, item and ability. The guide's AI behaviour (Lightning Rod / Levitate awareness, switching to absorb your attack) implies the game reads that information too. Damage numbers come from `@smogon/calc`: expected damage is the midpoint of the roll range, crits are ignored, and a "KO" means every roll knocks the target out.

The calc reports 0 for OHKO moves (Sheer Cold, Fissure...) and Endeavor, so those are worked out directly: an OHKO move kills unless the target is immune, has Sturdy or is a higher level. Showdown species names are mapped to the calc's: "Aegislash" becomes "Aegislash-Shield", and cosmetic formes fall back to their base species. A test checks every Battle Tree set, every builder species and every Gen 7 Mega. A Paradox form's Protosynthesis / Quark Drive boost is passed to the calc as its `boostedStat`, so the 1.3x counts in the estimates. Calc errors are counted in `calcErrors` (tests assert zero) rather than silently scoring a move as useless.

## Turning scores into a choice

Each usable move is scored, along with Z-Move versions of damaging moves. A damaging move scores the expected damage as a fraction of the target's remaining HP, capped at 1. A guaranteed KO scores `koScore` (1.4), plus 0.2 if it lands before the foe acts.

1. **Mega Evolution:** always used when available. Damage is evaluated as the Mega forme.
2. **Z-Moves:** offered on a turn with probability `zMoveChance` (0.8).
3. **Switch check:** see "Switching" below.
4. **KO:** if any option is a guaranteed KO, it's taken with probability `koBias` (0.9). The AI prefers a KO that lands first, then a plain move over spending the Z-Move. The guide: the AI "appears to be able to calculate when it can OHKO".
5. **Otherwise, a weighted roll.** Scores are normalized by the best option and fed to a softmax with `temperature` 0.12:

   | Option strength (vs the best) | How often it's picked, relative to the best |
   |---|---|
   | 90% | about 0.43× |
   | 70% | about 0.08× |

   Options that score 0.04 or less are dropped unless nothing else is left. That covers failing moves, weather already up, Protect twice in a row. The guide: move choice "is based on a potentially weighted roll ... significant chance for the AI to not select the highest damage attack" when no OHKO is available.
6. **Accuracy is ignored** (`considerAccuracy: false`). The guide: the AI "does not factor in the accuracy of the moves", for example choosing Focus Blast over a sure KO.

## Move scores

Non-damaging scores are on the same scale (0–1+). Values come from `config.scores`.

| Situation | Rule | Basis |
|---|---|---|
| Sleep / paralysis | 1.0 / 0.9 if the foe can be afflicted | guide: status, especially paralysis, is "very high on the priority list" |
| Can the foe be afflicted? | Not if: already statused; behind a Substitute; Safeguard; Grass type vs powder moves, Overcoat, Safety Goggles; type immunities (Ground vs Thunder Wave, Electric vs paralysis, Fire vs burn, Poison/Steel vs poison); Limber, Insomnia etc.; Misty Terrain (grounded); Electric Terrain blocks sleep | guide; game rules |
| Will-O-Wisp | 0.85 vs a physical attacker, 0.3 otherwise | guide: "priorized if your active Pokemon have high Attack" |
| Toxic / poison | 0.45 / 0.35 | guide: Toxic "does not look like having a particularly high priority" |
| Fake Out | 1.2 on the first turn out; 0 if the foe is a Ghost type or Psychic Terrain protects it | guide: used the first turn out "unless something prevents it" |
| Weather / terrain | 0.85 / 0.8 if not already up and no KO is available | guide: "priorizes setting it up if there's no option to OHKO" |
| Tailwind | 0.95 unless Tailwind or Trick Room is up | guide: "nearly always is set anytime is not up and Trick Room is not active" |
| Trick Room | 0.9 when the foe is faster; 0.27 to undo it when it helps the foe | guide |
| Speed-lowering attack (Icy Wind etc.) | +0.15 when the foe is faster | guide: Icy Wind "is generally spammed" |
| Phazing (Roar, Whirlwind, Dragon Tail) | 0.95 when the foe has stat boosts and something to switch in | guide: "high priority for the AI if your Pokemon have boosts active" |
| Setup (Swords Dance, Dragon Dance, Calm Mind...) | 0.8 while safe (foe's best hit < 45% of our HP, foe can't KO first); 0.25× when unsafe. Stops once the stat reaches +2 or the breakpoint is met (outspeeds for Speed boosts; can KO for Attack / Sp. Atk) | guide: boosts "until a certain breakpoint ... outspeeding your Pokemon or being able to OHKO them" |
| Stockpile | until 2 stacks | guide: Stockpile users "attempt to reach 2 stacks and then heal" |
| Recovery | 1.0 × missing HP fraction; less if we won't survive the next hit; never above 85% HP | general |
| Rest | when below 70% HP or statused; never under Misty or Electric Terrain | guide: never Rests "if affected by Misty Terrain (as well as by Electric Terrain)" |
| Protect | 0.12 normally; 0.45 while the foe takes passive damage (poison, burn, Leech Seed); never twice in a row | guide: stall sets "alternate the damage over time move to Protect" |
| Hazards / screens / Aurora Veil | 0.55 / 0.55 (matching the foe's attacking side) / 0.8 in hail | general |
| Counter / Metal Burst | 0.9 at full HP with Sturdy or a Focus Sash | guide: Sturdy / Sash + Metal Burst sets |
| Self-KO moves (Explosion) | 0.3× unless they KO or we're below 25% HP | guide: Explosion use "is generally inconsistent" |

## Switching

The AI considers switching only in two cases:

- **About to be KO'd:** the foe has a KO that lands before ours, and we have no KO that lands first.
- **Locked into nothing useful:** every option scores 0.04 or less, for example Choice-locked or Encored into a move that fails.

A bench Pokémon qualifies as a switch-in if:
- it takes at most `switchInMaxDamage` (45%) from the foe's best move, and
- it has a super-effective attack, or its best attack does at least 50%.

When a switch-in qualifies, the AI switches with probability `switchChance` (0.45). When locked into nothing useful, the probability is `lockedSwitchChance` (0.85). Otherwise it stays in. It never switches when trapped. Guide: the AI may swap "to resist the last attack that connected, to absorb it with an immunity, or to circumvent move-locking into a ineffective move ... the incoming Pokemon will also have a move that can hit your active Pokemon for supereffective damage."

**After a faint**, it sends in the bench Pokémon with the highest damage potential against your active Pokémon (lightly penalised for damage it would take). Guide: "the AI will priorize sending in the Pokemon with the highest damage potential."

## Double Battles

The guide documents the Singles AI; the Doubles logic is an **approximation** built on the same scores (`chooseDoublesActions` / `chooseDoublesReplacements` in `heuristic-ai.ts`).

- Each active Pokémon picks its own action with the Singles rules (KO bias, weighted roll), one after the other.
- **Targets:** a single-target move is scored against each foe still standing, and the choice names the target. So the AI aims at whichever foe it hurts most, usually the one it can knock out.
- **Spread moves** (Rock Slide, Heat Wave, Earthquake...) are scored against every foe they hit. The calc gets the Doubles field, so the spread damage reduction is included. A move that also hits the partner (Earthquake, Surf, Explosion...) loses `partnerDamagePenalty` (1.5) per fraction of the partner's HP. A KO that also does 30%+ to the partner isn't taken automatically; it goes to the weighted roll.
- **Partner-only moves** (Helping Hand and other moves aimed only at the ally) score `partnerSupportScore` (0.25) while the partner is up.
- **One Mega Evolution and one Z-Move per turn**, the first Pokémon that picks one.
- **No voluntary switching** in Doubles. Replacements after a faint: the strongest remaining Pokémon against a foe still standing, never the same one twice.
- Not modelled: redirection (Follow Me, Rage Powder, Lightning Rod pulling moves), Wide Guard / Quick Guard decisions, targeting a foe that is likely to Protect, or coordinating the two actions (e.g. Trick Room plus a slow attacker).

## Known gaps

- Doesn't model the guide's quirks:
  - Misty Terrain not being recognised for Nuzzle/Swagger
  - Encore loops
  - Doubles-only behaviour (spread moves, Wide Guard)
- Mega Evolution's speed change is ignored when deciding who moves first. (In Gen 7 the new speed applies that same turn.)
- Hidden information is ignored: the AI always knows your exact set. That's intended, to match the game.

## Tuning and checks

Change defaults in `config.ts`, or pass overrides: `new HeuristicAI({ switchChance: 0.3, scores: { setup: 0.6 } })`.

`src/ai/heuristic/heuristic-ai.test.ts` checks scenario behaviour:
- super-effective KO preference
- immunity avoidance
- status rules
- Fake Out
- weather
- setup breakpoints
- phazing
- Mega / Z
- randomness
- switching (threatened, Choice-locked, trapped)
- replacements

It also runs:
- 12 full battles between real Battle Tree teams with no invalid choices
- a win-rate check against the random AI with mirrored teams

A local benchmark of 100 mirrored games against the random AI (not in the test suite) gave the heuristic 93 wins. Decisions averaged about 0.4 ms (max about 10 ms), with no calc errors.
