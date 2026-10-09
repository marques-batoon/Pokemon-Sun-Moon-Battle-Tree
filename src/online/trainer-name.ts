// Trainer names: shown in battle (and to other players in online Multi Battles).
// Shared by the app and the relay server (relay/), which checks every name
// again, so a modified app can't get a name past it.
import { englishDataset, englishRecommendedTransformers, RegExpMatcher } from 'obscenity';

export const TRAINER_NAME_MAX = 16;

/** Letters (any language), digits, spaces and a little punctuation; starts with a letter or digit. */
const ALLOWED = /^[\p{L}\p{N}][\p{L}\p{N} .'_-]*$/u;

const matcher = new RegExpMatcher({ ...englishDataset.build(), ...englishRecommendedTransformers });

/** Names that would read as the game talking or as someone else. */
const RESERVED = /^(player|partner|opponent|system|admin|moderator|host)\s*\d*$/i;

export type NameCheck = { ok: true; name: string } | { ok: false; error: string };

/**
 * Cleans up and checks a trainer name: trims and collapses spaces, then rejects
 * names that are empty, too long, use other characters (no "|", which would
 * break the battle protocol, no emoji or control characters), are reserved, or
 * contain a slur or profanity.
 */
export function checkTrainerName(raw: unknown): NameCheck {
  if (typeof raw !== 'string') return { ok: false, error: 'Enter a name.' };
  const name = raw.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (!name) return { ok: false, error: 'Enter a name.' };
  if ([...name].length > TRAINER_NAME_MAX) return { ok: false, error: `Use at most ${TRAINER_NAME_MAX} characters.` };
  if (!ALLOWED.test(name)) return { ok: false, error: 'Use letters, numbers, spaces and . \' _ - only, starting with a letter or number.' };
  if (RESERVED.test(name)) return { ok: false, error: 'That name is reserved. Pick another.' };
  if (matcher.hasMatch(name)) return { ok: false, error: "That name isn't allowed. Pick another." };
  return { ok: true, name };
}

/** The name to battle under: the saved name if it's (still) valid, else "Player". */
export function battleName(saved: string | undefined): string {
  const check = checkTrainerName(saved ?? '');
  return check.ok ? check.name : 'Player';
}
