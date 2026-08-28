import { useMemo } from 'react';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useFirestoreQuery } from './useFirestoreQuery';

// Shared player universe for any page that needs to look up players by ID
// or search by name (My Team, Compare, and anything else added later).
//
// Why this exists: draftGuide is the full player universe (preseason
// projections, available year-round) but scores only has a doc for a
// player once they have current-season game logs to compute a trend score
// from - which is empty or sparse for most of the off-season. Pages that
// queried `scores` directly as if it were the full player list would
// silently drop any player without a scores doc yet (e.g. added to My Team
// from the Draft Board, which correctly reads draftGuide, then vanishing
// on My Team, which incorrectly read only scores). This hook merges both
// so every page sees the same, complete player list with trend data
// layered on top when it exists.
export function usePlayerPool() {
  const { data: guide, loading: guideLoading } = useFirestoreQuery(
    () => query(collection(db, 'draftGuide'), orderBy('projectedPoints', 'desc'), limit(600)),
    []
  );
  const { data: scores, loading: scoresLoading } = useFirestoreQuery(
    () => query(collection(db, 'scores'), orderBy('score', 'desc'), limit(600)),
    []
  );

  const scoreById = useMemo(() => {
    const map = new Map();
    scores.forEach((s) => map.set(s.playerId, s));
    return map;
  }, [scores]);

  const pool = useMemo(() => {
    return guide.map((g) => {
      const s = scoreById.get(g.playerId);
      return {
        playerId: g.playerId,
        name: g.name,
        team: g.team,
        position: g.position,
        positionRank: g.positionRank,
        projectedPoints: g.projectedPoints,
        score: s ? s.score : 0,
        display: s ? s.display : undefined,
        hasTrendData: Boolean(s),
      };
    });
  }, [guide, scoreById]);

  return { pool, loading: guideLoading || scoresLoading };
}
