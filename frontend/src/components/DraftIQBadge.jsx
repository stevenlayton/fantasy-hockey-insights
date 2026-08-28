import { Sparkles } from 'lucide-react';

// Score bands: >= 70 is a strong Draft IQ signal (green, matches
// TrendBadge's up color), <= 35 is a weak signal (red, matches
// TrendBadge's down color), everything between is neutral. See
// lib/draftIQ.js for how the underlying 0-100 score is computed.
const STRONG_THRESHOLD = 70;
const WEAK_THRESHOLD = 35;

/**
 * Small colored pill showing a player's Draft IQ score (see
 * lib/draftIQ.js). Pass `title` (typically the output of
 * explainDraftIQ()) to surface the deterministic why as a native
 * tooltip on hover.
 */
export default function DraftIQBadge({ score, title, size = 'md' }) {
  const value = typeof score === 'number' ? score : 0;
  const isStrong = value >= STRONG_THRESHOLD;
  const isWeak = value <= WEAK_THRESHOLD;
  const color = isStrong
    ? 'text-up bg-up/10 ring-up/30'
    : isWeak
    ? 'text-down bg-down/10 ring-down/30'
    : 'text-slate-400 bg-rink-700/50 ring-rink-600';
  const padding = size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-sm';

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-0.5 rounded-full font-semibold ring-1 ${color} ${padding}`}
    >
      <Sparkles size={size === 'sm' ? 12 : 14} />
      {Math.round(value)}
    </span>
  );
}
