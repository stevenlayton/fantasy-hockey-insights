import { Link } from 'react-router-dom';
import TrendBadge from './TrendBadge';

const POSITION_LABELS = { C: 'C', L: 'LW', R: 'RW', D: 'D', G: 'G' };

export default function PlayerCard({ scoreDoc }) {
  const { playerId, name, team, position, score, display } = scoreDoc;

  return (
    <Link
      to={`/player/${playerId}`}
      className="group flex items-center gap-3 rounded-lg border border-rink-border bg-rink-900 p-3 transition-colors hover:border-ice-500/40 hover:bg-rink-800"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rink-700 text-sm font-bold text-slate-300">
        {POSITION_LABELS[position] || position}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-slate-100 group-hover:text-ice-400">{name}</p>
        <p className="text-xs text-slate-500">
          {team} · {POSITION_LABELS[position] || position}
          {typeof display?.pointsPerGameLast5 === 'number' && (
            <> · {display.pointsPerGameLast5.toFixed(2)} PPG (L5)</>
          )}
        </p>
      </div>
      <TrendBadge score={score} size="sm" />
    </Link>
  );
}
