import { typeColor } from '../types';

export function TypeBadge({ type }: { type: string }) {
  const { bg, fg } = typeColor(type);
  return <span className="type-badge" style={{ background: bg, color: fg }}>{type}</span>;
}
