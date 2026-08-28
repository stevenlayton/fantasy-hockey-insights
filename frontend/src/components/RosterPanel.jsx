import { Link } from 'react-router-dom';
import { usePlayerPool } from '../hooks/usePlayerPool';
import { useMyRoster } from '../hooks/useMyRoster';
import { useLeagueSettings } from '../hooks/useLeagueSettings';
import { Users, X } from 'lucide-react';

const POSITIONS = ['C', 'L', 'R', 'D', 'G'];
const POSITION_LABELS = { C: 'C', L: 'LW', R: 'RW', D: 'D', G: 'G' };

// Small panel showing the user's current roster so they can see what they
// already have, and whether there's room at a position, without leaving
// the page they're on. Reuses the same localStorage-backed hooks as My
// Team and Draft Board, so it always matches those pages exactly. Meant
// to sit in a sticky sidebar column (see PlayerDetail.jsx) on pages where
// someone is deciding whether to add a player.
export default function RosterPanel({ excludePlayerId }) {
  const { pool, loading } = usePlayerPool();
  const { myTeam, removeFromMyTeam } = useMyRoster();
  const { targets } = useLeagueSettings();

  const myPlayers = pool
    .filter((p) => myTeam.includes(p.playerId))
    .sort((a, b) => POSITIONS.indexOf(a.position) - POSITIONS.indexOf(b.position));

  const positionCounts = { C: 0, L: 0, R: 0, D: 0, G: 0 };
  myPlayers.forEach((p) => {
    if (positionCounts[p.position] !== undefined) positionCounts[p.position] += 1;
  });

  return (
    <div className="rounded-lg border border-rink-border bg-rink-900 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Users size={16} className="text-ice-500" />
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-slate-300">
          My Roster ({myPlayers.length})
        </h2>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {POSITIONS.map((pos) => (
          <span
            key={pos}
            className={`rounded px-2 py-1 text-xs font-semibold ${
              positionCounts[pos] < targets[pos]
                ? 'bg-down/10 text-down ring-1 ring-down/30'
                : 'bg-rink-800 text-slate-400'
            }`}
          >
            {POSITION_LABELS[pos]}: {positionCounts[pos]}/{targets[pos]}
          </span>
        ))}
      </div>

      {loading && <p className="text-xs text-slate-500">Loading roster...</p>}

      {!loading && myPlayers.length === 0 && (
        <p className="text-xs text-slate-500">
          Your team is empty. Add players from here, the Draft Board, or My Team.
        </p>
      )}

      {myPlayers.length > 0 && (
        <div className="max-h-[420px] space-y-1.5 overflow-y-auto pr-1">
          {myPlayers.map((p) => (
            <div
              key={p.playerId}
              className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm ${
                p.playerId === excludePlayerId ? 'bg-ice-500/10 ring-1 ring-ice-500/30' : 'bg-rink-800/60'
              }`}
            >
              <Link
                to={`/player/${p.playerId}`}
                className="min-w-0 flex-1 truncate text-slate-200 hover:text-ice-400"
              >
                {p.name}
              </Link>
              <span className="shrink-0 text-xs text-slate-500">
                {POSITION_LABELS[p.position] || p.position}
              </span>
              <button
                onClick={() => removeFromMyTeam(p.playerId)}
                title="Remove from my team"
                className="shrink-0 text-slate-600 hover:text-down"
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
