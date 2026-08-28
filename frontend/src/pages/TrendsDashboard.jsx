import { collection, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useFirestoreQuery } from '../hooks/useFirestoreQuery';
import PlayerCard from '../components/PlayerCard';
import NewsFeed from '../components/NewsFeed';
import ScoreboardWidget from '../components/ScoreboardWidget';
import AdSlot from '../components/AdSlot';
import FreshnessBadge from '../components/FreshnessBadge';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

export default function TrendsDashboard() {
  useDocumentMeta('Trends', 'Live NHL player trend scores, breakouts, and fantasy hockey insights updated daily.', '/');
  const { data: risers, loading: risersLoading } = useFirestoreQuery(
    () => query(collection(db, 'scores'), orderBy('score', 'desc'), limit(12)),
    []
  );
  const { data: fallers, loading: fallersLoading } = useFirestoreQuery(
    () => query(collection(db, 'scores'), orderBy('score', 'asc'), limit(12)),
    []
  );
  const { data: news, loading: newsLoading } = useFirestoreQuery(
    () => query(collection(db, 'news'), orderBy('publishedAt', 'desc'), limit(20)),
    []
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6">
        <AdSlot variant="header" />
      </div>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Player Trends</h1>
          <p className="mt-1 text-sm text-slate-500">
            Who's heating up and who's cooling off, based on the last 5-15 games.
          </p>
        </div>
        <FreshnessBadge metaDocId="statsIngestion" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr_320px]">
        <section>
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp size={18} className="text-up" />
            <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-slate-200">
              Trending Up
            </h2>
          </div>
          <div className="space-y-2">
            {risersLoading && <p className="text-sm text-slate-500">Loading...</p>}
            {!risersLoading && risers.length === 0 && <EmptyState />}
            {risers.map((s, i) => (
              <div key={s.id}>
                <PlayerCard scoreDoc={s} />
                {i === 4 && (
                  <div className="my-2">
                    <AdSlot variant="in-feed" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2">
            <TrendingDown size={18} className="text-down" />
            <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-slate-200">
              Trending Down
            </h2>
          </div>
          <div className="space-y-2">
            {fallersLoading && <p className="text-sm text-slate-500">Loading...</p>}
            {!fallersLoading && fallers.length === 0 && <EmptyState />}
            {fallers.map((s, i) => (
              <div key={s.id}>
                <PlayerCard scoreDoc={s} />
                {i === 4 && (
                  <div className="my-2">
                    <AdSlot variant="in-feed" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <aside className="space-y-4">
          <ScoreboardWidget />
          <NewsFeed articles={news} loading={newsLoading} />
          <AdSlot variant="sidebar" />
        </aside>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-rink-border p-6 text-center text-sm text-slate-500">
      No trending players yet - check back soon.
    </div>
  );
}
