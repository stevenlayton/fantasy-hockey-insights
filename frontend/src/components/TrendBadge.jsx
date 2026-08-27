import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

/** Small colored pill showing a composite score with an up/down/flat glyph. */
export default function TrendBadge({ score, size = 'md' }) {
  const value = typeof score === 'number' ? score : 0;
  const isUp = value > 0.05;
  const isDown = value < -0.05;
  const Icon = isUp ? ArrowUpRight : isDown ? ArrowDownRight : Minus;
  const color = isUp ? 'text-up bg-up/10 ring-up/30' : isDown ? 'text-down bg-down/10 ring-down/30' : 'text-slate-400 bg-rink-700/50 ring-rink-600';
  const padding = size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-sm';

  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full font-semibold ring-1 ${color} ${padding}`}>
      <Icon size={size === 'sm' ? 12 : 14} />
      {value.toFixed(2)}
    </span>
  );
}
