import { Fragment, type ReactNode } from 'react';

/**
 * Renders @pkmn/view LogFormatter markup:
 * - `**text**` -> bold (Pokémon and move names)
 * - `||detail||shown||` -> "shown (detail)"; used for the player's own exact HP loss.
 */
export function LogText({ text }: { text: string }) {
  const out: ReactNode[] = [];
  const parts = text.split(/\|\|([^|]*)\|\|([^|]*)\|\|/);
  parts.forEach((part, i) => {
    const mod = i % 3;
    if (mod === 0) out.push(...bold(part, i));
    else if (mod === 2) out.push(<span key={`h${i}`}>{part} <span className="muted">({parts[i - 1]})</span></span>);
  });
  return <>{out}</>;
}

function bold(text: string, key: number): ReactNode[] {
  return text.split('**').map((t, j) => (j % 2 ? <strong key={`${key}b${j}`}>{t}</strong> : <Fragment key={`${key}t${j}`}>{t}</Fragment>));
}
