// Roster Category Intelligence
//
// My Team's Team Grade is one blended number. This file breaks a roster
// down into the individual fantasy categories that make it up (goals,
// assists, power play points, hits, blocked shots, and goaltending) so a
// visitor can see exactly which categories a roster is ahead or behind on,
// not just an overall grade.
//
// How the expected/average line for each category is set: rather than a
// hardcoded number of teams or players, we look at the CURRENT PLAYER POOL
// and average the pool's top N players in that category, where N is the
// visitor's own league roster-target slot count for that player type
// (see useLeagueSettings/My Team's League settings panel). That total
// represents what a fully drafted, competitive roster's total in that
// category looks like right now. A roster's own total divided by that
// baseline is the ratio shown on each bar. This keeps the comparison tied
// to the visitor's real league size/settings and to the live player pool,
// rather than a fixed assumption that could drift out of date.
//
// Skater category math mirrors lib/leagueScoring.js's computeCustomPoints:
// a player's raw per-game rate from their prior season game log (already
// on every draftGuide doc via usePlayerPool) is projected across a full
// season. Hits and blocked shots are already projected server-side by
// functions/src/ingestDraftGuide.js, so those are used as-is.
//
// Goaltending is not broken into wins/shutouts/save% separately here;
// it uses the single projectedPoints number functions/src/ingestDraftGuide.js
// already computes for goalies (see GOALIE_FANTASY_WEIGHTS in that file),
// since that number already fairly blends all three goalie categories on
// one scale.

// Assumed full season length for projecting skater counting stats. Mirrors
// PROJECTED_SEASON_GAMES in functions/src/ingestDraftGuide.js and
// lib/leagueScoring.js so this stays consistent with the rest of the app.
export const PROJECTED_SEASON_GAMES = 82;

// A category's ratio (your roster's total divided by the average-roster
// baseline total) at or above this is shown as a strength.
export const CATEGORY_STRONG_RATIO = 1.1;

// A category's ratio at or below this is shown as needing help.
// Between CATEGORY_WEAK_RATIO and CATEGORY_STRONG_RATIO is neutral/on pace.
export const CATEGORY_WEAK_RATIO = 0.9;

function projectedSkaterRate(total, gamesPlayed) {
  if (!gamesPlayed) return 0;
  return ((total || 0) / gamesPlayed) * PROJECTED_SEASON_GAMES;
}

// Each entry: key/label for display, and getValue(player) returning that
// player's own projected total for the category. Hits/blocked shots are
// already projected server-side, so those getValue functions read the
// field directly instead of re-deriving it from a per-game rate.
const SKATER_CATEGORIES = [
  {
    key: 'goals',
    label: 'Goals',
    getValue: (p) => projectedSkaterRate(p.totalGoals, p.gamesPlayed),
  },
  {
    key: 'assists',
    label: 'Assists',
    getValue: (p) => projectedSkaterRate(p.totalAssists, p.gamesPlayed),
  },
  {
    key: 'powerPlayPoints',
    label: 'PPP',
    getValue: (p) => projectedSkaterRate(p.totalPpp, p.gamesPlayed),
  },
  {
    key: 'hits',
    label: 'Hits',
    getValue: (p) => p.projectedHits || 0,
  },
  {
    key: 'blockedShots',
    label: 'Blocks',
    getValue: (p) => p.projectedBlockedShots || 0,
  },
];

function buildCategoryResult(key, label, yourTotal, baselineTotal) {
  const ratio = baselineTotal > 0 ? yourTotal / baselineTotal : null;
  let status = 'neutral';
  if (ratio != null) {
    if (ratio >= CATEGORY_STRONG_RATIO) status = 'strong';
    else if (ratio <= CATEGORY_WEAK_RATIO) status = 'weak';
  }
  return {
    key,
    label,
    yourTotal: Number(yourTotal.toFixed(1)),
    baselineTotal: Number(baselineTotal.toFixed(1)),
    ratio,
    status,
    why: buildWhyText(label, status, ratio),
  };
}

function buildWhyText(label, status, ratio) {
  if (ratio == null) {
    return `Set your league roster targets above to see how your ${label} production compares to an average roster.`;
  }
  const pct = Math.round(ratio * 100);
  if (status === 'strong') {
    return `${pct}% of an average roster's ${label} total, a real strength you can lean on.`;
  }
  if (status === 'weak') {
    return `${pct}% of an average roster's ${label} total, consider targeting a ${label} contributor on waivers or your next pick.`;
  }
  return `${pct}% of an average roster's ${label} total, right in line with a typical roster.`;
}

// pool: full player pool from usePlayerPool (every drafted-or-not player).
// myPlayers: the subset of pool on the visitor's own roster.
// targets: { C, L, R, D, G } roster-target slot counts from useLeagueSettings.
export function computeCategoryIntelligence(pool, myPlayers, targets) {
  const skaterSlots =
    (targets.C || 0) + (targets.L || 0) + (targets.R || 0) + (targets.D || 0);
  const goalieSlots = targets.G || 0;

  const allSkaters = pool.filter((p) => p.position !== 'G');
  const allGoalies = pool.filter((p) => p.position === 'G');
  const mySkaters = myPlayers.filter((p) => p.position !== 'G');
  const myGoalies = myPlayers.filter((p) => p.position === 'G');

  const categories = SKATER_CATEGORIES.map((cat) => {
    const poolValues = allSkaters.map(cat.getValue).sort((a, b) => b - a);
    const baselineTotal =
      skaterSlots > 0
        ? poolValues.slice(0, skaterSlots).reduce((sum, v) => sum + v, 0)
        : 0;
    const yourTotal = mySkaters.reduce((sum, p) => sum + cat.getValue(p), 0);
    return buildCategoryResult(cat.key, cat.label, yourTotal, baselineTotal);
  });

  const goaliePoolValues = allGoalies
    .map((g) => g.projectedPoints || 0)
    .sort((a, b) => b - a);
  const goalieBaselineTotal =
    goalieSlots > 0
      ? goaliePoolValues.slice(0, goalieSlots).reduce((sum, v) => sum + v, 0)
      : 0;
  const myGoalieTotal = myGoalies.reduce((sum, p) => sum + (p.projectedPoints || 0), 0);
  categories.push(
    buildCategoryResult('goaltending', 'Goaltending', myGoalieTotal, goalieBaselineTotal)
  );

  return categories;
}
