export function HpBar({ percent }: { percent: number }) {
  const tone = percent > 50 ? 'good' : percent > 20 ? 'warn' : 'bad';
  return (
    <div className="hpbar" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)}>
      <div className={`hpbar-fill hp-${tone}`} style={{ width: `${percent}%` }} />
    </div>
  );
}
