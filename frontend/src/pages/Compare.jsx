import { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePlayerPool } from '../hooks/usePlayerPool';
import AdSlot from '../components/AdSlot';
import TrendBadge from '../components/TrendBadge';
import { GitCompare, Search, X } from 'lucide-react';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

const MAX_PLAYERS = 4;
const POSITION_LABELS = { C: 'C', L: 'LW', R: 'RW', D: 'D' };

export default function Compare() {
  useDocumentMeta('Compare Players', 'Compare NHL players side by side on trend scores, projections, and per game stats.', '/compare');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);

  const { pool, loading } = usePlayerPool();

  const selected = selectedIds
    .map((id) => pool.find((p) => p.playerId === id))
    .filter(Boolean);

  const searchResults = search
    ? pool
        .filter(
          (p) =>
            p.name.toLowerCase().includes(search.toLowerCase()) && !selectedIds.includes(p.playerId)
        )
        .slice(0, 8)
    : [];

  const addPlayer = (id) => {
    if (selectedIds.length >= MAX_PLAYERS) return;
    setSelectedIds((prev) => [...prev, id]);
    setSearch('');
  };

  const removePlayer = (id) => {
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  };

  const rows = [
    { label: 'Team / Pos', render: (p) => `${p.team} · ${POSITION_LABELS[p.position] || p.position}` },
    {
      label: 'Trend Score',
      render: (p) => (p.hasTrendData ? <TrendBadge score={p.score} size="sm" /> : <span className="text-slate-600">No data yet</span>),
    },
    { label: 'PPG (Last 5)', render: (p) => p.display?.pointsPerGameLast5?.toFixed(2) ?? '-' },
    { label: 'PPG (Season)', render: (p) => p.display?.pointsPerGameSeason?.toFixed(2) ?? '-' },
    { label: 'TOI/G (Last 5)', render: (p) => p.display?.toiPerGameLast5?.toFixed(1) ?? '-' },
    { label: 'Shots/G (Last 5)', render: (p) => p.display?.shotsPerGameLast5?.toFixed(1) ?? '-' },
    {
      label: 'Preseason Rank',
      render: (p) => (p.positionRank ? `#${p.positionRank} at ${POSITION_LABELS[p.position] || p.position}` : 'N/A'),
    },
    {
      label: 'Projected Pts',
      render: (p) => p.projectedPoints ?? 'N/A',
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <GitCompare size={20} className="text-ice-500" />
          <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">
            Compare Players
          </h1>
        </div>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Add up to {MAX_PLAYERS} players to see their trend scores and stats side by side.
        </p>
      </div>

      <div className="mb-6 relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          disabled={selectedIds.length >= MAX_PLAYERS}
          placeholder={
            selectedIds.length >= MAX_PLAYERS ? `Max ${MAX_PLAYERS} players selected` : 'Search players to compare...'
          }
          className="w-full rounded-md border border-rink-border bg-rink-900 py-2 pl-9 pr-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-ice-500 focus:outline-none disabled:opacity-50"
        />
        {searchResults.length > 0 && (
          <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-rink-border bg-rink-900 shadow-lg">
            {searchResults.map((p) => (
              <button
                key={p.playerId}
                onClick={() => addPlayer(p.playerId)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-rink-800"
              >
                <span className="text-slate-200">{p.name}</span>
                <span className="text-xs text-slate-500">
                  {p.team} · {POSITION_LABELS[p.position] || p.position}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mb-6">
        <AdSlot variant="header" />
      </div>

      {loading && <p className="text-sm text-slate-500">Loading...</p>}

      {!loading && selected.length === 0 && (
        <div className="rounded-lg border border-dashed border-rink-border p-8 text-center text-sm text-slate-500">
          Search for players above to start comparing.
        </div>
      )}

      {selected.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-rink-border">
          <table className="w-full min-w-[500px] text-sm">
            <thead className="bg-rink-800 text-left text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-4 py-3">Metric</th>
                {selected.map((p) => (
                  <th key={p.playerId} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <Link to={`/player/${p.playerId}`} className="font-semibold text-slate-100 hover:text-ice-400">
                        {p.name}
                      </Link>
                      <button onClick={() => removePlayer(p.playerId)} className="text-slate-500 hover:text-down">
                        <X size={14} />
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-rink-border">
              {rows.map((row) => (
                <tr key={row.label} className="bg-rink-900">
                  <td className="px-4 py-2.5 font-medium text-slate-400">{row.label}</td>
                  {selected.map((p) => (
                    <td key={p.playerId} className="px-4 py-2.5 text-slate-200">
                      {row.render(p)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
