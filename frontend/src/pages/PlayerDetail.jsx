import { useParams, Link } from 'react-router-dom';
import { doc, collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '../firebase';
import { useFirestoreQuery } from '../hooks/useFirestoreQuery';
import TrendChart from '../components/TrendChart';
import TrendBadge from '../components/TrendBadge';
import AdSlot from '../components/AdSlot';
import { ArrowLeft, ShieldAlert } from 'lucide-react';

function useDoc(path) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    return onSnapshot(doc(db, ...path), (snap) => {
      setData(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      setLoading(false);
    });
  }, path); // eslint-disable-line react-hooks/exhaustive-deps
  return { data, loading };
}

export default function PlayerDetail() {
  const { id } = useParams();
  const { data: player, loading: playerLoading } = useDoc(['players', id]);
  const { data: scoreDoc, loading: scoreLoading } = useDoc(['scores', id]);
  const { data: gameLogs, loading: logsLoading } = useFirestoreQuery(
    () => query(collection(db, 'players', id, 'gamelogs'), orderBy('gameDate', 'asc')),
    [id]
  );

  const loading = playerLoading || scoreLoading || logsLoading;

  if (loading) {
    return <div className="mx-auto max-w-5xl px-4 py-10 text-slate-500">Loading player…</div>;
  }

  if (!player) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-ice-400 hover:underline">
          <ArrowLeft size={14} /> Back
        </Link>
        <p className="mt-4 text-slate-400">
          No player found with ID {id}. Either the stats pipeline hasn't run yet, or this player
          hasn't played this season.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <Link to="/" className="mb-4 inline-flex items-center gap-1 text-sm text-ice-400 hover:underline">
        <ArrowLeft size={14} /> Back to trends
      </Link>

      <div className="mb-6 flex flex-wrap items-center gap-4 rounded-lg border border-rink-border bg-rink-900 p-5">
        {player.headshot && (
          <img
            src={player.headshot}
            alt={`${player.firstName} ${player.lastName}`}
            className="h-20 w-20 rounded-full bg-rink-700 object-cover"
          />
        )}
        <div className="flex-1">
          <h1 className="font-display text-2xl font-bold text-white">
            {player.firstName} {player.lastName}
          </h1>
          <p className="text-sm text-slate-500">
            {player.team} · {player.position} {player.sweaterNumber ? `· #${player.sweaterNumber}` : ''}
          </p>
        </div>
        {scoreDoc && <TrendBadge score={scoreDoc.score} />}
      </div>

      <div className="mb-6 flex items-center gap-2 rounded-lg border border-dashed border-rink-border bg-rink-900/50 p-3 text-xs text-slate-500">
        <ShieldAlert size={14} />
        Injury status: not available in this data source yet. NHL's public API doesn't reliably
        expose injury designations - adding a source is on the roadmap (see README).
      </div>

      {gameLogs.length > 0 ? (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <ChartCard title="Points" gameLogs={gameLogs} dataKey="points" />
          <ChartCard title="Shots on Goal" gameLogs={gameLogs} dataKey="shots" />
          <ChartCard title="Ice Time (min)" gameLogs={gameLogs} dataKey="toiMinutes" />
        </div>
      ) : (
        <p className="mb-6 text-sm text-slate-500">No recent game log data yet.</p>
      )}

      <div className="mb-6">
        <AdSlot variant="in-feed" />
      </div>

      <div className="overflow-hidden rounded-lg border border-rink-border">
        <table className="w-full text-sm">
          <thead className="bg-rink-800 text-left text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Opp</th>
              <th className="px-4 py-2 text-right">G</th>
              <th className="px-4 py-2 text-right">A</th>
              <th className="px-4 py-2 text-right">P</th>
              <th className="px-4 py-2 text-right">SOG</th>
              <th className="px-4 py-2 text-right">TOI</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rink-border">
            {[...gameLogs].reverse().map((g) => (
              <tr key={g.id} className="bg-rink-900">
                <td className="px-4 py-2 text-slate-400">{g.gameDate}</td>
                <td className="px-4 py-2 text-slate-400">{g.opponentAbbrev}</td>
                <td className="px-4 py-2 text-right">{g.goals}</td>
                <td className="px-4 py-2 text-right">{g.assists}</td>
                <td className="px-4 py-2 text-right font-semibold text-slate-200">{g.points}</td>
                <td className="px-4 py-2 text-right">{g.shots}</td>
                <td className="px-4 py-2 text-right">{g.toi}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ChartCard({ title, gameLogs, dataKey }) {
  const withMinutes = gameLogs.map((g) => ({
    ...g,
    toiMinutes: g.toi ? Number(g.toi.split(':')[0]) + Number(g.toi.split(':')[1]) / 60 : 0,
  }));
  return (
    <div className="rounded-lg border border-rink-border bg-rink-900 p-3">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      <TrendChart gameLogs={withMinutes} dataKey={dataKey} label={title} />
    </div>
  );
}
