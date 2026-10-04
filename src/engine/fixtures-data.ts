// Phase 2 test teams as plain data, safe to import on the main thread (no
// simulator code). Builders that need @pkmn/sim live in fixtures.ts.

/**
 * Hardcoded player team for Phase 2 (engine wiring). Six Pokémon so Team
 * Preview has a real choice; Salamence is Lv. 100 to exercise the Lv. 50 cap.
 * Replaced by builder teams in Phase 3.
 */
export const TEST_PLAYER_TEAM_TEXT = `
Salamence @ Salamencite
Ability: Intimidate
Level: 100
EVs: 4 HP / 252 Atk / 252 Spe
Adamant Nature
- Double-Edge
- Earthquake
- Dragon Dance
- Roost

Aegislash @ Leftovers
Ability: Stance Change
EVs: 252 HP / 252 SpA / 4 SpD
Quiet Nature
IVs: 0 Spe
- King's Shield
- Shadow Ball
- Sacred Sword
- Flash Cannon

Chansey @ Eviolite
Ability: Natural Cure
EVs: 252 HP / 252 Def / 4 SpD
Bold Nature
IVs: 0 Atk
- Seismic Toss
- Soft-Boiled
- Toxic
- Protect

Tapu Lele @ Choice Scarf
Ability: Psychic Surge
EVs: 4 HP / 252 SpA / 252 Spe
Timid Nature
IVs: 0 Atk
- Psychic
- Moonblast
- Focus Blast
- Shadow Ball

Kartana @ Life Orb
Ability: Beast Boost
EVs: 4 HP / 252 Atk / 252 Spe
Jolly Nature
- Leaf Blade
- Sacred Sword
- Smart Strike
- Swords Dance

Garchomp @ Groundium Z
Ability: Rough Skin
EVs: 4 HP / 252 Atk / 252 Spe
Jolly Nature
- Earthquake
- Dragon Claw
- Stone Edge
- Swords Dance
`;

/**
 * Hardcoded opponent for Phase 2: three of Super Red's real sets (one Mega, one
 * Z-Crystal) at his IVs. Real trainer/team selection arrives in Phase 4.
 */
export const TEST_OPPONENT_SET_LABELS = ['Charizard-4', 'Snorlax-3', 'Lapras-4'];
