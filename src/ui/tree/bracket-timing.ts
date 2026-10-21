import { matchCount } from '../../run/tournament';

/**
 * ms between one match's result and the next when a round is revealed on the bracket (at normal speed): quicker for
 * a big round (32 pairs: 16 matches), so it doesn't drag.
 */
export const revealStagger = (round: number, rounds: number) => (matchCount(round, rounds) > 8 ? 260 : 420);
/** How long one match's reveal takes: both pairs glow, the losers fade, the winners move on. */
const REVEAL_MATCH_MS = 1150;
/** How long revealing round r's results takes (at normal speed), in a bracket of `rounds` rounds. */
export const revealDuration = (round: number, rounds: number) => (matchCount(round, rounds) - 1) * revealStagger(round, rounds) + REVEAL_MATCH_MS;
