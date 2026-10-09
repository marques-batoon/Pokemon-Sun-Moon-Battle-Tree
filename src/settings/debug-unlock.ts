// Debug tools are behind a password. Only its SHA-256 hash is in the code, so the
// password itself isn't readable in the built app. This keeps casual players out;
// it isn't real security (the app runs entirely in the browser).
const DEBUG_PASSWORD_SHA256 = '7b502b2fb272786fabec4f8b155106d434f8f3ad328f16e7408605f81455fa76';

/** Whether `input` is the debug password. Needs a secure page (https or localhost) for the browser's hashing. */
export async function checkDebugPassword(input: string): Promise<boolean> {
  if (!globalThis.crypto?.subtle) throw new Error('Debug tools can only be unlocked on https:// or localhost.');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  const hex = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
  return hex === DEBUG_PASSWORD_SHA256;
}
