/** A gold trophy cup (the Duo Tournament's prize). */
export function Trophy({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg className={`trophy ${className}`} width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id="trophy-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff3b0" /><stop offset="0.45" stopColor="#f6c73c" /><stop offset="1" stopColor="#c48a12" />
        </linearGradient>
      </defs>
      <path d="M18 8h28v14c0 9-6 16-14 16S18 31 18 22z" fill="url(#trophy-gold)" stroke="#9a6a08" strokeWidth="2" />
      <path d="M18 12H9c0 9 4 14 11 15M46 12h9c0 9-4 14-11 15" fill="none" stroke="#c48a12" strokeWidth="4" strokeLinecap="round" />
      <rect x="28" y="38" width="8" height="10" fill="#d9a21e" stroke="#9a6a08" strokeWidth="2" />
      <rect x="20" y="48" width="24" height="8" rx="2" fill="url(#trophy-gold)" stroke="#9a6a08" strokeWidth="2" />
      <path d="M25 14c0 6 2 12 6 15" fill="none" stroke="#fffbe0" strokeWidth="3" strokeLinecap="round" opacity="0.8" />
    </svg>
  );
}
