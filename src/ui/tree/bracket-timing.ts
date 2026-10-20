import { matchCount } from '../../run/tournament';

/** ms between one match's result and the next when a round is revealed on the bracket (at normal speed). */
export const REVEAL_STAGGER_MS = 420;
/** How long one match's reveal takes: both pairs glow, the losers fade, the winners move on. */
const REVEAL_MATCH_MS = 1150;
/** How long revealing round r's results takes (at normal speed). */
export const revealDuration = (round: number) => (matchCount(round) - 1) * REVEAL_STAGGER_MS + REVEAL_MATCH_MS;
