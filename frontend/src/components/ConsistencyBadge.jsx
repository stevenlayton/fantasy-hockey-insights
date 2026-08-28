import { Repeat } from 'lucide-react';

// Score bands mirror DraftIQBadge's convention: >= 70 is "Consistent"
// (green), <= 35 is "Boom or bust" (red), everything between is neutral.
// See functions/src/scoring.js's computeConsistency() for how the
// underlying 0-100 score (based on coefficient of variation of per-game
// points) is computed.
const STRONG_THRESHOLD = 70;
const WEAK_THRESHOLD = 35;

/**
 * Small colored pill showing a player's Consistency score - how
 * predictable their per-game point production has been, not how good
 * they are. Pass `label` (one of "Consistent" / "Moderate" / "Boom or
 * bust", computed server-side) to show alongside the number.
 */
export default function ConsistencyBadge({ score, label, size = 'md' }) {
  const value = typeof score === 'number' ? score : 0;
  const isStrong = value >= STRONG_THRESHOLD;
  const isWeak = value <= WEAK_THRESHOLD;
  const color = isStrong
    ? 'text-up bg-up/10 ring-up/30'
    : isWeak
    ? 'text-down bg-down/10 ring-down/30'
    : 'text-slate-400 bg-rink-700/50 ring-rink-600/50';
  const padding = size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-sm';

  return (
    <span
      title={`Consistency score: ${Math.round(value)}/100 (based on game-to-game point variance). ${label || ''}`}
      className={`inline-flex items-center gap-0.5 rounded-full font-semibold ring-1 ${color} ${padding}`}
    >
      <Repeat size={size === 'sm' ? 12 : 14} />
      {label || Math.round(value)}
    </span>
  );
}
