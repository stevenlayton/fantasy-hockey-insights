import { useState, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useFirestoreQuery } from '../hooks/useFirestoreQuery';
import AdSlot from '../components/AdSlot';
import FreshnessBadge from '../components/FreshnessBadge';
import { ClipboardList, Printer } from 'lucide-react';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

const POSITION_TABS = [
  { code: 'C', label: 'Centers' },
  { code: 'L', label: 'Left Wing' },
  { code: 'R', label: 'Right Wing' },
  { code: 'D', label: 'Defense' },
  { code: 'G', label: 'Goalies' },
];

export default function DraftGuide() {
  useDocumentMeta('Draft Guide', 'Positional rankings and projections to help you dominate your NHL fantasy hockey draft.', '/draft-guide');
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

  const activeLabel = POSITION_TABS.find((t) => t.code === position)?.label || position;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 print:max-w-none print:px-0">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 print:mb-4">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardList size={20} className="text-gold" />
            <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Draft Guide</h1>
          </div>
          <p className="mt-1 text-sm text-slate-500 print:hidden">
            Pre-season positional rankings, projected from last season's per-game production.
          </p>
          <p className="mt-1 hidden text-sm text-slate-700 print:block">
            {activeLabel} rankings, projected from last season's per-game production.
          </p>
        </div>
        <FreshnessBadge metaDocId="draftGuideIngestion" />
      </div>

      <div className="mb-4 print:hidden">
        <AdSlot variant="header" />
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2 overflow-x-auto print:hidden">
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
        <button
          onClick={() => window.print()}
          title="Print this position's rankings"
          className="ml-auto flex items-center gap-1.5 rounded-md bg-rink-800 px-3 py-1.5 text-sm font-semibold text-slate-400 hover:text-slate-100"
        >
          <Printer size={14} />
          Print
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-rink-border print:rounded-none print:border-0">
        <table className="w-full text-sm">
          <thead className="bg-rink-800 text-left text-xs uppercase tracking-wider text-slate-400 print:bg-transparent print:text-slate-700">
            <tr>
              <th className="px-4 py-3">Rank</th>
              <th className="px-4 py-3">Player</th>
              <th className="px-4 py-3">Team</th>
              <th className="px-4 py-3 text-right">{position === 'G' ? 'Wins / Save %' : 'Last Season PPG'}</th>
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
                  No draft rankings yet for this position - check back soon.
                </td>
              </tr>
            )}
            {rankings.map((p, i) => (
              <Fragment key={p.id}>
                <tr className="bg-rink-900 hover:bg-rink-800 print:bg-transparent">
                  <td className="px-4 py-3 font-semibold text-slate-400 print:text-slate-700">{p.positionRank}</td>
                  <td className="px-4 py-3">
                    <Link to={`/player/${p.playerId}`} className="font-medium text-slate-100 hover:text-ice-400 print:text-slate-900">
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-500 print:text-slate-700">{p.team}</td>
                  <td className="px-4 py-3 text-right text-slate-300 print:text-slate-700">
                    {position === 'G'
                      ? `${p.wins ?? '-'}W / ${p.savePctg != null ? p.savePctg.toFixed(3) : '-'}`
                      : p.pointsPerGame?.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gold print:text-slate-900">{p.projectedPoints}</td>
                </tr>
                {i === 9 && (
                  <tr className="print:hidden">
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
