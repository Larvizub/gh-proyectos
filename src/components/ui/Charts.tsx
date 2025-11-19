// Lightweight chart components (SVG) used in Dashboard

type DonutSlice = { label: string; value: number; color?: string };

export function DonutChart({ data, size = 120, hole = 48 }: { data: DonutSlice[]; size?: number; hole?: number }) {
  const total = data.reduce((s, d) => s + Math.max(0, d.value), 0) || 1;
  let cumulative = 0;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2;

  function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY + radius * Math.sin(angleInRadians),
    };
  }

  function describeArc(x: number, y: number, radius: number, startAngle: number, endAngle: number) {
    const start = polarToCartesian(x, y, radius, endAngle);
    const end = polarToCartesian(x, y, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
    const d = ['M', start.x, start.y, 'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y, 'L', x, y, 'Z'].join(' ');
    return d;
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {data.map((d, i) => {
        const startAngle = (cumulative / total) * 360;
        cumulative += d.value;
        const endAngle = (cumulative / total) * 360;
        const path = describeArc(cx, cy, radius, startAngle, endAngle);
        return <path key={i} d={path} fill={d.color || ['#34d399', '#60a5fa', '#f97316', '#f87171'][i % 4]} stroke="transparent" />;
      })}
      <circle cx={cx} cy={cy} r={hole} fill="var(--card)" />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize={Math.max(12, size * 0.12)} fill="var(--foreground)">
        {data.reduce((s, d) => s + d.value, 0)}
      </text>
    </svg>
  );
}

export function BarChart({ items }: { items: { label: string; value: number; color?: string }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="space-y-2">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-3">
          <div className="w-28 text-xs text-muted-foreground truncate">{it.label}</div>
          <div className="flex-1 bg-muted rounded h-3 overflow-hidden">
            <div style={{ width: `${(it.value / max) * 100}%`, background: it.color || '#60a5fa' }} className="h-3" />
          </div>
          <div className="w-10 text-right text-sm font-medium">{it.value}</div>
        </div>
      ))}
    </div>
  );
}
