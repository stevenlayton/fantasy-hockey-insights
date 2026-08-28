import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useFirestoreQuery } from '../hooks/useFirestoreQuery';
import AdSlot from '../components/AdSlot';
import TrendBadge from '../components/TrendBadge';
import FreshnessBadge from '../components/FreshnessBadge';
import { Flame, Snowflake } from 'lucide-react';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

const POSITION_LABELS = { C: 'C', L: 'LW', R: 'RW', D: 'D' };

/**
 * Cross-references preseason draft rank (expectation) with current trend
 * score (reality) to surface two things:
 *   - Breakouts: ranked in the back half at their position preseason, but
 *     trending up now - i.e. outperforming what was expected of them.
 *   - Fallers: ranked in the top quarter at their position preseason (a
 *     player who was expected to be a stud), but trending down now.
 * Both lists are computed entirely client-side from data already in
 * Firestore - no extra ingestion job needed.
 */
export default function Sleepers() {
  useDocumentMeta('Sleepers and Breakouts', 'Discover NHL fantasy hockey sleepers and breakout candidates before your league catches on.', '/sleepers');
  const { data: guide, loading: guideLoading } = useFirestoreQuery(
    () => query(collection(db, 'draftGuide'), orderBy('projectedPoints', 'desc'), limit(600)),
    []
  );
  const { data: scores, loading: scoresLoading } = useFirestoreQuery(
    () => query(collection(db, 'scores'), orderBy('score', 'desc'), limit(600)),
    []
  );

  const loading = guideLoading || scoresLoading;

  const { breakouts, fallers } = useMemo(() => {
    const totalsByPosition = {};
    guide.forEach((p) => {
      totalsByPosition[p.position] = Math.max(totalsByPosition[p.position] || 0, p.positionRank);
    });

    const scoreById = new Map(scores.map((s) => [s.playerId, s]));

    const joined = guide
      .map((g) => {
        const s = scoreById.get(g.playerId);
        if (!s) return null;
        const total = totalsByPosition[g.position] || 1;
        return { ...s, positionRank: g.positionRank, positionTotal: total };
      })
      .filter(Boolean);

    const breakoutCandidates = joined
      .filter((p) => p.positionRank > p.positionTotal / 2 && p.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 15);

    const fallerCandidates = joined
      .filter((p) => p.positionRank <= p.positionTotal / 4 && p.score < 0)
      .sort((a, b) => a.score - b.score)
      .slice(0, 15);

    return { breakouts: breakoutCandidates, fallers: fallerCandidates };
  }, [guide, scores]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Flame size={20} className="text-gold" />
            <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">
              Sleepers &amp; Breakouts
            </h1>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Players outperforming or underperforming their preseason draft rank, based on current
            trend score.
          </p>
        </div>
        <FreshnessBadge metaDocId="statsIngestion" />
      </div>

      <div className="mb-6">
        <AdSlot variant="header" />
      </div>

      {loading && <p className="text-sm text-slate-500">Loading…</p>}

      {!loading && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section>
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold uppercase tracking-wide text-up">
              <Flame size={18} /> Breakouts
            </h2>
            <div className="space-y-2">
              {breakouts.length === 0 && (
                <p className="text-sm text-slate-500">No standout breakouts right now - check back as the season goes on.</p>
              )}
              {breakouts.map((p) => (
                <SleeperRow key={p.playerId} player={p} />
              ))}
            </div>
          </section>
          <section>
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold uppercase tracking-wide text-down">
              <Snowflake size={18} /> Fallers
            </h2>
            <div className="space-y-2">
              {fallers.length === 0 && (
                <p className="text-sm text-slate-500">No highly-ranked players are cooling off right now.</p>
              )}
              {fallers.map((p) => (
                <SleeperRow key={p.playerId} player={p} />
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function SleeperRow({ player }) {
  return (
    <Link
      to={`/player/${player.playerId}`}
      className="group flex items-center gap-3 rounded-lg border border-rink-border bg-rink-900 p-3 transition-colors hover:border-ice-500/40 hover:bg-rink-800"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rink-700 text-sm font-bold text-slate-300">
        {POSITION_LABELS[player.position] || player.position}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-slate-100 group-hover:text-ice-400">{player.name}</p>
        <p className="text-xs text-slate-500">
          {player.team} · Preseason #{player.positionRank} at {POSITION_LABELS[player.position] || player.position}
        </p>
      </div>
      <TrendBadge score={player.score} size="sm" />
    </Link>
  );
}
