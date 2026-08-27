import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Clock } from 'lucide-react';

/** Reads meta/{metaDocId} and shows "Data as of X ago" - lets visitors trust (or distrust) freshness. */
export default function FreshnessBadge({ metaDocId }) {
  const [lastRunAt, setLastRunAt] = useState(null);

  useEffect(() => {
    return onSnapshot(doc(db, 'meta', metaDocId), (snap) => {
      setLastRunAt(snap.exists() ? snap.data().lastRunAt : null);
    });
  }, [metaDocId]);

  if (!lastRunAt) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-slate-600">
        <Clock size={12} /> Awaiting first data run
      </span>
    );
  }

  const date = lastRunAt.toDate ? lastRunAt.toDate() : new Date(lastRunAt);
  return (
    <span className="inline-flex items-center gap-1 text-xs text-slate-500">
      <Clock size={12} /> Data as of {date.toLocaleString()}
    </span>
  );
}
