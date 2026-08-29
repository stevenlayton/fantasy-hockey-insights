// Post-Draft Report Card
//
// My Team's Team Grade is a fill-ratio + trend score. This file adds the
// pieces the README's Aug 2026 spec calls out as still missing: a Best
// Pick and Biggest Reach callout, and a letter grade per category (not
// just the raw percentage lib/rosterCategories.js already shows).
//
// Best Pick / Biggest Reach: these are computed from each rostered
// player's CURRENT Draft IQ score (see lib/draftIQ.js), not their score
// at the moment they were actually drafted, since the app does not
// record real draft order or pick timestamps. Framed honestly as "your
// best value right now" rather than a claim about draft-day value, the
// same honesty pattern as Site Rank not claiming to be real ADP (see
// README.md "Key decisions").
//
// Category grades: reuses CATEGORY_STRONG_RATIO/CATEGORY_WEAK_RATIO from
// lib/rosterCategories.js as the B and C cutoffs, so the letter grade
// and the percentage text under each bar always agree with each other.

import { computeDraftIQForPool, explainDraftIQ } from './draftIQ';
import { CATEGORY_STRONG_RATIO, CATEGORY_WEAK_RATIO } from './rosterCategories';

// Ratio-to-letter-grade cutoffs for a single category. A ratio of 1.0
// means the roster exactly matches an average roster in that category,
// which is graded C (average), not A - unlike a raw percentage, a grade
// should treat "at the expected average" as the middle of the scale.
export const CATEGORY_GRADE_BANDS = Object.freeze([
  { minRatio: 1.25, grade: 'A' },
  { minRatio: CATEGORY_STRONG_RATIO, grade: 'B' },
  { minRatio: CATEGORY_WEAK_RATIO, grade: 'C' },
  { minRatio: 0.75, grade: 'D' },
  { minRatio: 0, grade: 'F' },
]);

function gradeForRatio(ratio) {
  if (ratio == null) return null;
  const band = CATEGORY_GRADE_BANDS.find((b) => ratio >= b.minRatio);
  return band ? band.grade : 'F';
}

// pool: full player pool from usePlayerPool.
// myTeam / draftedElsewhere: playerId arrays from useMyRoster.
// positionCounts / targets: from MyTeam's own state (position fill vs
// league roster-target settings), the same inputs Draft IQ's Team Fit
// sub-score already uses elsewhere (Draft Board).
// categoryBreakdown: the array computeCategoryIntelligence returns.
export function computeReportCard({
  pool,
  myTeam,
  draftedElsewhere,
  positionCounts,
  targets,
  categoryBreakdown,
}) {
  const draftedIds = [...(myTeam || []), ...(draftedElsewhere || [])];
  const iqByPlayerId = computeDraftIQForPool(pool, draftedIds, positionCounts, targets);

  const myPlayers = pool.filter((p) => (myTeam || []).includes(p.playerId));
  const scored = myPlayers
    .map((p) => {
      const iq = iqByPlayerId.get(p.playerId);
      if (!iq) return null;
      return {
        playerId: p.playerId,
        name: p.name,
        position: p.position,
        team: p.team,
        score: iq.score,
        why: explainDraftIQ(p, iq.components),
      };
    })
    .filter(Boolean);

  let bestPick = null;
  let biggestReach = null;
  for (const entry of scored) {
    if (!bestPick || entry.score > bestPick.score) bestPick = entry;
    if (!biggestReach || entry.score < biggestReach.score) biggestReach = entry;
  }
  // With only one rostered player, avoid calling the same pick both the
  // best pick and the biggest reach.
  if (scored.length < 2) biggestReach = null;

  const categoryGrades = (categoryBreakdown || []).map((cat) => ({
    key: cat.key,
    label: cat.label,
    grade: gradeForRatio(cat.ratio),
  }));

  return { bestPick, biggestReach, categoryGrades };
}
