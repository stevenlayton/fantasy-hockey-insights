import { useMemo, useState } from 'react';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useFirestoreQuery } from '../hooks/useFirestoreQuery';
import { useMyRoster } from '../hooks/useMyRoster';
import PlayerCard from '../components/PlayerCard';
import AdSlot from '../components/AdSlot';
import { UserCircle, Search, X } from 'lucide-react';

const POSITIONS = ['C', 'L', 'R', 'D'];
const POSITION_LABELS = { C: 'C', L: 'LW', R: 'RW', D: 'D' };
const TARGET_COUNTS = { C: 2, L: 2, R: 2, D: 4 };

export default function MyTeam() {
  const [search, setSearch] = useState('');
  const { data: pool, loading } = useFirestoreQuery(
    () => query(collection(db, 'scores'), orderBy('score', 'desc'), limit(600)),
    []
  );
  const { myTeam, draftedElsewhere, addToMyTeam, removeFromMyTeam } = useMyRoster();

  const myPlayers = useMemo(
    () => pool.filter((p) => myTeam.includes(p.playerId)),
    [pool, myTeam]
  );

  const trendingUp = myPlayers.filter((p) => p.score > 0.05);
  const trendingDown = myPlayers.filter((p) => p.score < -0.05);

  const positionCounts = useMemo(() => {
    const counts = { C: 0, L: 0, R: 0, D: 0 };
    myPlayers.forEach((p) => {
      if (counts[p.position] !== undefined) counts[p.position] += 1;
    });
    return counts;
  }, [myPlayers]);

  const suggestions = useMemo(() => {
    const unavailableIds = new Set([...myTeam, ...draftedElsewhere]);
    return POSITIONS.map((pos) => ({
      position: pos,
      candidates: pool
        .filter((p) => p.position === pos && !unavailableIds.has(p.playerId))
        .slice(0, 3),
    })).filter((group) => group.candidates.length > 0);
  }, [pool, myTeam, draftedElsewhere]);

  const searchResults = search
    ? pool
        .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) && !myTeam.includes(p.playerId))
        .slice(0, 8)
    : [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <UserCircle size={20} className="text-ice-500" />
            <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">My Team</h1>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Track your roster's trends and see where the board suggests upgrading. Your roster is
            saved in this browser only (same list used on the Draft Board).
          </p>
        </div>
      </div>

      <div className="mb-6 relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search players to add to your team..."
          className="w-full rounded-md border border-rink-border bg-rink-900 py-2 pl-9 pr-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-ice-500 focus:outline-none"
        />
        {searchResults.length > 0 && (
          <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-rink-border bg-rink-900 shadow-lg">
            {searchResults.map((p) => (
              <button
                key={p.playerId}
                onClick={() => {
                  addToMyTeam(p.playerId);
                  setSearch('');
                }}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-rink-800"
              >
                <span className="text-slate-200">{p.name}</span>
                <span className="text-xs text-slate-500">{p.team} · {POSITION_LABELS[p.position] || p.position}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mb-4">
        <AdSlot variant="header" />
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {POSITIONS.map((pos) => (
          <span
            key={pos}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
              positionCounts[pos] < TARGET_COUNTS[pos]
                ? 'bg-down/10 text-down ring-1 ring-down/30'
                : 'bg-rink-800 text-slate-400'
            }`}
          >
            {POSITION_LABELS[pos]}: {positionCounts[pos]} / {TARGET_COUNTS[pos]}
          </span>
        ))}
      </div>

      {loading && <p className="text-sm text-slate-500">Loading…</p>}

      {!loading && myPlayers.length === 0 && (
        <div className="mb-8 rounded-lg border border-dashed border-rink-border p-6 text-center text-sm text-slate-500">
          Your team is empty. Search above or add players from the Draft Board.
        </div>
      )}

      {myPlayers.length > 0 && (
        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section>
            <h2 className="mb-3 font-display text-lg font-semibold uppercase tracking-wide text-up">
              Trending Up ({trendingUp.length})
            </h2>
            <div className="space-y-2">
              {trendingUp.length === 0 && <p className="text-sm text-slate-500">Nobody on your team is trending up right now.</p>}
              {trendingUp.map((s) => (
                <RosterRow key={s.playerId} scoreDoc={s} onRemove={() => removeFromMyTeam(s.playerId)} />
              ))}
            </div>
          </section>
          <section>
            <h2 className="mb-3 font-display text-lg font-semibold uppercase tracking-wide text-down">
              Trending Down ({trendingDown.length})
            </h2>
            <div className="space-y-2">
              {trendingDown.length === 0 && <p className="text-sm text-slate-500">Nobody on your team is trending down right now.</p>}
              {trendingDown.map((s) => (
                <RosterRow key={s.playerId} scoreDoc={s} onRemove={() => removeFromMyTeam(s.playerId)} />
              ))}
            </div>
          </section>
        </div>
      )}

      {suggestions.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-lg font-semibold uppercase tracking-wide text-slate-200">
            Suggested Waiver Targets
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {suggestions.map(({ position, candidates }) => (
              <div key={position} className="rounded-lg border border-rink-border bg-rink-900 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {POSITION_LABELS[position]}
                </p>
                <div className="space-y-2">
                  {candidates.map((p) => (
                    <PlayerCard key={p.playerId} scoreDoc={p} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function RosterRow({ scoreDoc, onRemove }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <PlayerCard scoreDoc={scoreDoc} />
      </div>
      <button
        onClick={onRemove}
        title="Remove from my team"
        className="rounded-md p-2 text-slate-600 hover:text-down"
      >
        <X size={16} />
      </button>
    </div>
  );
}
