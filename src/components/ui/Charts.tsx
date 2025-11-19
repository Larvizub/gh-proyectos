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

export function StackedBar({ segments, height = 24 }: { segments: { label: string; value: number; color?: string }[]; height?: number }) {
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0) || 1;
  return (
    <div className="w-full">
      <div className="w-full bg-muted rounded overflow-hidden" style={{ height }}>
        <div className="flex h-full">
          {segments.map((s, i) => (
            <div key={i} style={{ width: `${(s.value / total) * 100}%`, background: s.color || ['#34d399', '#60a5fa', '#f97316', '#f87171'][i % 4] }} />
          ))}
        </div>
      </div>
      <div className="mt-2 flex gap-3 flex-wrap text-xs">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ background: s.color || ['#34d399', '#60a5fa', '#f97316', '#f87171'][i % 4] }} />
            <span className="text-muted-foreground">{s.label} ({s.value})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PieChart({ data, size = 120 }: { data: DonutSlice[]; size?: number }) {
  // reuse Donut logic but without hole
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
        return <path key={i} d={path} fill={d.color || ['#fde68a', '#fca5a5', '#a7f3d0', '#93c5fd'][i % 4]} stroke="transparent" />;
      })}
    </svg>
  );
}

export function LineChart({ points, width = 240, height = 52 }: { points: number[]; width?: number; height?: number }) {
  if (!points || points.length === 0) return <div />;
  const max = Math.max(...points, 1);
  const step = width / Math.max(1, points.length - 1);
  const coords = points.map((v, i) => `${i * step},${height - (v / max) * height}`).join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline fill="none" stroke="#60a5fa" strokeWidth={2} points={coords} strokeLinecap="round" strokeLinejoin="round" />
      {points.map((v, i) => {
        const x = i * step;
        const y = height - (v / max) * height;
        return <circle key={i} cx={x} cy={y} r={2} fill="#60a5fa" />;
      })}
    </svg>
  );
}
