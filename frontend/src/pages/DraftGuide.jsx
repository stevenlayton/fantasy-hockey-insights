import { useState, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useFirestoreQuery } from '../hooks/useFirestoreQuery';
import AdSlot from '../components/AdSlot';
import FreshnessBadge from '../components/FreshnessBadge';
import { ClipboardList } from 'lucide-react';

const POSITION_TABS = [
  { code: 'C', label: 'Centers' },
  { code: 'L', label: 'Left Wing' },
  { code: 'R', label: 'Right Wing' },
  { code: 'D', label: 'Defense' },
];

export default function DraftGuide() {
  const [position, setPosition] = useState('C');

  const { data: rankings, loading } = useFirestoreQuery(
    () =>
      query(
        collection(db, 'draftGuide'),
        where('position', '==', position),
        orderBy('positionRank', 'asc'),
        limit(50)
      ),
    [position]
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardList size={20} className="text-gold" />
            <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Draft Guide</h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Pre-season positional rankings, projected from last season's per-game production.
          </p>
        </div>
        <FreshnessBadge metaDocId="draftGuideIngestion" />
      </div>

      <div className="mb-4">
        <AdSlot variant="header" />
      </div>

      <div className="mb-6 flex gap-2 overflow-x-auto">
        {POSITION_TABS.map((tab) => (
          <button
            key={tab.code}
            onClick={() => setPosition(tab.code)}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
              position === tab.code
                ? 'bg-gold text-rink-950'
                : 'bg-rink-800 text-slate-400 hover:text-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-rink-border">
        <table className="w-full text-sm">
          <thead className="bg-rink-800 text-left text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-4 py-3">Rank</th>
              <th className="px-4 py-3">Player</th>
              <th className="px-4 py-3">Team</th>
              <th className="px-4 py-3 text-right">Last Season PPG</th>
              <th className="px-4 py-3 text-right">Projected Pts</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rink-border">
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && rankings.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  No draft rankings yet for this position - run{' '}
                  <code>runIngestionNow?job=draftGuide</code>.
                </td>
              </tr>
            )}
            {rankings.map((p, i) => (
              <Fragment key={p.id}>
                <tr className="bg-rink-900 hover:bg-rink-800">
                  <td className="px-4 py-3 font-semibold text-slate-400">{p.positionRank}</td>
                  <td className="px-4 py-3">
                    <Link to={`/player/${p.playerId}`} className="font-medium text-slate-100 hover:text-ice-400">
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{p.team}</td>
                  <td className="px-4 py-3 text-right text-slate-300">{p.pointsPerGame?.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gold">{p.projectedPoints}</td>
                </tr>
                {i === 9 && (
                  <tr>
                    <td colSpan={5} className="bg-rink-950 p-2">
                      <AdSlot variant="in-feed" />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
