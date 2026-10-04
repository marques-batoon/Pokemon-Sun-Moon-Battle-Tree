/**
 * Tuning knobs for the heuristic Battle Tree AI. Scores are on a common scale
 * where a damaging move's base score is the fraction of the target's current
 * HP it's expected to remove (0-1). See AI_NOTES.md for what each knob models.
 */
export interface HeuristicConfig {
  /** Chance to take the best knock-out option when one exists. */
  koBias: number;
  /** Score given to a guaranteed KO (above any non-KO option). */
  koScore: number;
  /** Softmax temperature over scores normalized by the best option; higher = more random. */
  temperature: number;
  /** The in-game AI ignores accuracy (Smogon guide). Set true to weight damage by accuracy. */
  considerAccuracy: boolean;
  /** Chance to switch out when the active Pokémon is about to be KO'd and a good switch-in exists. */
  switchChance: number;
  /** Chance to switch when locked (Choice item, Encore) into a move that does nothing useful. */
  lockedSwitchChance: number;
  /** A switch-in must take at most this fraction of its HP from the foe's best move. */
  switchInMaxDamage: number;
  /** Setup moves stop once the boosted stat reaches this stage (or the breakpoint is met). */
  maxSetupStage: number;
  /** The foe's best move may take at most this fraction of our HP for setup to be "safe". */
  setupSafeThreat: number;
  /** Chance to use an available Z-Move when it is the best damaging option. */
  zMoveChance: number;
  /** Doubles: how much a move's damage to the AI's own partner counts against it (per fraction of the partner's HP). */
  partnerDamagePenalty: number;
  /** Doubles: score for a move that only helps the partner (Helping Hand, Follow Me...) while the partner is up. */
  partnerSupportScore: number;
  /** Base scores for non-damaging effects. */
  scores: {
    sleep: number;
    paralysis: number;
    burnPhysical: number;
    burnSpecial: number;
    toxic: number;
    poison: number;
    confusion: number;
    yawn: number;
    leechSeed: number;
    fakeOut: number;
    weather: number;
    terrain: number;
    tailwind: number;
    trickRoom: number;
    phaze: number;
    haze: number;
    hazard: number;
    screen: number;
    auroraVeil: number;
    setup: number;
    recovery: number;
    protect: number;
    protectStall: number;
    substitute: number;
    counter: number;
    destinyBond: number;
    painSplit: number;
    taunt: number;
    statDrop: number;
    speedControlBonus: number;
    other: number;
  };
}

export const DEFAULT_CONFIG: HeuristicConfig = {
  koBias: 0.9,
  koScore: 1.4,
  temperature: 0.12,
  considerAccuracy: false,
  switchChance: 0.45,
  lockedSwitchChance: 0.85,
  switchInMaxDamage: 0.45,
  maxSetupStage: 2,
  setupSafeThreat: 0.45,
  zMoveChance: 0.8,
  partnerDamagePenalty: 1.5,
  partnerSupportScore: 0.25,
  scores: {
    sleep: 1.0,
    paralysis: 0.9,
    burnPhysical: 0.85,
    burnSpecial: 0.3,
    toxic: 0.45,
    poison: 0.35,
    confusion: 0.3,
    yawn: 0.5,
    leechSeed: 0.5,
    fakeOut: 1.2,
    weather: 0.85,
    terrain: 0.8,
    tailwind: 0.95,
    trickRoom: 0.9,
    phaze: 0.95,
    haze: 0.8,
    hazard: 0.55,
    screen: 0.55,
    auroraVeil: 0.8,
    setup: 0.8,
    recovery: 1.0,
    protect: 0.12,
    protectStall: 0.45,
    substitute: 0.4,
    counter: 0.6,
    destinyBond: 0.6,
    painSplit: 0.6,
    taunt: 0.3,
    statDrop: 0.2,
    speedControlBonus: 0.15,
    other: 0.1,
  },
};
