import { useState } from 'react';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useFirestoreQuery } from '../hooks/useFirestoreQuery';
import PlayerCard from '../components/PlayerCard';
import AdSlot from '../components/AdSlot';
import FreshnessBadge from '../components/FreshnessBadge';
import { ArrowLeftRight } from 'lucide-react';

const POSITIONS = ['ALL', 'C', 'L', 'R', 'D'];

export default function PickupDrop() {
  const [position, setPosition] = useState('ALL');

  // Pull a generous pool client-side (position filtering + the
  // rosteredEstimate split happen in-browser since Firestore can't combine
  // an inequality/boolean filter with two different sort orders in one
  // query without extra composite indexes per position).
  const { data: pool, loading } = useFirestoreQuery(
    () => query(collection(db, 'scores'), orderBy('score', 'desc'), limit(300)),
    []
  );

  const filtered = position === 'ALL' ? pool : pool.filter((p) => p.position === position);

  const pickups = filtered
    .filter((p) => !p.rosteredEstimate)
    .sort((a, b) => b.score - a.score)
    .slice(0, 15);

  const drops = filtered
    .filter((p) => p.rosteredEstimate)
    .sort((a, b) => a.score - b.score)
    .slice(0, 15);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ArrowLeftRight size={20} className="text-ice-500" />
            <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">
              Pickup / Drop
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Waiver-wire targets trending up, and rostered names cooling off. Ranked by our scoring
            model, not real ownership % (see README for why).
          </p>
        </div>
        <FreshnessBadge metaDocId="statsIngestion" />
      </div>

      <div className="mb-6 flex gap-2">
        {POSITIONS.map((pos) => (
          <button
            key={pos}
            onClick={() => setPosition(pos)}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
              position === pos
                ? 'bg-ice-500 text-rink-950'
                : 'bg-rink-800 text-slate-400 hover:text-slate-100'
            }`}
          >
            {pos}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 font-display text-lg font-semibold uppercase tracking-wide text-up">
            Add - Trending Up
          </h2>
          <div className="space-y-2">
            {loading && <p className="text-sm text-slate-500">Loading…</p>}
            {!loading && pickups.length === 0 && <EmptyState />}
            {pickups.map((s, i) => (
              <div key={s.id}>
                <PlayerCard scoreDoc={s} />
                {i === 5 && (
                  <div className="my-2">
                    <AdSlot variant="in-feed" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 font-display text-lg font-semibold uppercase tracking-wide text-down">
            Drop - Trending Down
          </h2>
          <div className="space-y-2">
            {loading && <p className="text-sm text-slate-500">Loading…</p>}
            {!loading && drops.length === 0 && <EmptyState />}
            {drops.map((s, i) => (
              <div key={s.id}>
                <PlayerCard scoreDoc={s} />
                {i === 5 && (
                  <div className="my-2">
                    <AdSlot variant="in-feed" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-rink-border p-6 text-center text-sm text-slate-500">
      No players in this bucket yet.
    </div>
  );
}
