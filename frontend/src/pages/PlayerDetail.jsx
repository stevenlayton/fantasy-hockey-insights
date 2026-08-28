import { useParams, Link } from 'react-router-dom';
import { doc, collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '../firebase';
import { useFirestoreQuery } from '../hooks/useFirestoreQuery';
import { useMyRoster } from '../hooks/useMyRoster';
import TrendChart from '../components/TrendChart';
import TrendBadge from '../components/TrendBadge';
import AdSlot from '../components/AdSlot';
import RosterPanel from '../components/RosterPanel';
import { ArrowLeft, ShieldAlert, Plus, UserX, Undo2, ClipboardList } from 'lucide-react';

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
  const playerIdNum = Number(id);
  const { data: player, loading: playerLoading } = useDoc(['players', id]);
  const { data: scoreDoc, loading: scoreLoading } = useDoc(['scores', id]);
  const { data: guideDoc } = useDoc(['draftGuide', id]);
  const { data: gameLogs, loading: logsLoading } = useFirestoreQuery(
    () => query(collection(db, 'players', id, 'gamelogs'), orderBy('gameDate', 'asc')),
    [id]
  );
  const { myTeam, draftedElsewhere, addToMyTeam, markDraftedElsewhere, undraft } = useMyRoster();

  const loading = playerLoading || scoreLoading || logsLoading;

  if (loading) {
    return <div className="mx-auto max-w-6xl px-4 py-10 text-slate-500">Loading player...</div>;
  }

  if (!player) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
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

  const isMine = myTeam.includes(playerIdNum);
  const isOther = draftedElsewhere.includes(playerIdNum);
  const isDrafted = isMine || isOther;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <Link to="/" className="mb-4 inline-flex items-center gap-1 text-sm text-ice-400 hover:underline">
        <ArrowLeft size={14} /> Back to trends
      </Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
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
            <div className="flex items-center gap-1.5">
              {isMine && (
                <span className="rounded bg-ice-500/20 px-2 py-1 text-[10px] font-semibold uppercase text-ice-400">
                  My team
                </span>
              )}
              {isOther && (
                <span className="rounded bg-rink-700 px-2 py-1 text-[10px] font-semibold uppercase text-slate-400">
                  Drafted
                </span>
              )}
              {!isDrafted ? (
                <>
                  <button
                    onClick={() => addToMyTeam(playerIdNum)}
                    title="Add to my team"
                    className="rounded-md bg-ice-500/10 p-2 text-ice-400 ring-1 ring-ice-500/30 hover:bg-ice-500/20"
                  >
                    <Plus size={16} />
                  </button>
                  <button
                    onClick={() => markDraftedElsewhere(playerIdNum)}
                    title="Mark drafted by someone else"
                    className="rounded-md bg-rink-700 p-2 text-slate-400 ring-1 ring-rink-600 hover:text-slate-200"
                  >
                    <UserX size={16} />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => undraft(playerIdNum)}
                  title="Undo"
                  className="flex items-center gap-1 rounded-md bg-rink-700 px-2 py-2 text-xs text-slate-400 ring-1 ring-rink-600 hover:text-slate-200"
                >
                  <Undo2 size={14} /> Undo
                </button>
              )}
            </div>
          </div>

          {guideDoc && (
            <div className="mb-6 flex flex-wrap items-center gap-2 rounded-lg border border-rink-border bg-rink-900 p-3 text-sm">
              <ClipboardList size={16} className="text-gold" />
              <span className="text-slate-400">
                Preseason rank: <span className="font-semibold text-slate-200">#{guideDoc.positionRank} at {guideDoc.position}</span>
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-400">
                Projected pts: <span className="font-semibold text-gold">{guideDoc.projectedPoints}</span>
              </span>
            </div>
          )}

          <div className="mb-6 flex items-center gap-2 rounded-lg border border-dashed border-rink-border bg-rink-900/50 p-3 text-xs text-slate-500">
            <ShieldAlert size={14} />
            Injury status: not available yet. The NHL's public data doesn't reliably include injury
            designations, so we're not able to show this here right now.
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

        <aside className="lg:col-span-1">
          <div className="lg:sticky lg:top-6">
            <RosterPanel excludePlayerId={playerIdNum} />
          </div>
        </aside>
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
