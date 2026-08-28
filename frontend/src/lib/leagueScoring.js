// League Scoring Customization
//
// The site's default rankings (Site Rank, positionRank, projectedPoints)
// use a fixed, one-size-fits-all model: skaters are ranked by real NHL
// points (goals + assists) projected to a full season, and goalies by
// the formula in functions/src/ingestDraftGuide.js (GOALIE_FANTASY_WEIGHTS).
// Real fantasy leagues score categories very differently (some leagues
// don't count assists the same as goals, some give heavy shot or power
// play point bonuses, etc). This file lets a signed-in-or-not visitor
// plug in their own league's per-category point values and get a
// second ranking, "Your League Rank", computed entirely client-side
// from the same raw per-player season totals already in the player
// pool (see hooks/usePlayerPool.js) - no extra Firestore reads.
//
// Formulas are intentionally simple and named/tunable, same pattern as
// functions/src/scoring.js and functions/src/ingestDraftGuide.js: take a
// player's per-game rate this season, project it across an assumed full
// season, multiply each category by the league's point value for it,
// and sum. See README.md "Key decisions" for why this stays deterministic
// (no AI, no external ADP) rather than a black box.

// Assumed full season length for projecting skater counting stats. Mirrors
// PROJECTED_SEASON_GAMES in functions/src/ingestDraftGuide.js so the client
// projection lines up with the server's default projectedPoints.
export const PROJECTED_SEASON_GAMES = 82;

// Assumed full season length for projecting goalie counting stats. Mirrors
// PROJECTED_GOALIE_GAMES in functions/src/ingestDraftGuide.js.
export const PROJECTED_GOALIE_GAMES = 55;

// Default skater category point values. These are a reasonable generic
// starting point (roughly typical of common public fantasy hockey
// defaults), not Steven's real league - the whole point of this file is
// that a visitor can change any of these to match their own league and
// see the board re-rank immediately.
export const DEFAULT_SKATER_WEIGHTS = Object.freeze({
  goals: 4,
  assists: 3,
  shots: 0.2,
  powerPlayPoints: 1,
});

// Default goalie category point values. wins/shutouts are flat point
// values per projected occurrence; save percentage only contributes
// once it clears replacementSavePctg, same "above replacement" idea as
// the server-side GOALIE_FANTASY_WEIGHTS this mirrors by default.
export const DEFAULT_GOALIE_WEIGHTS = Object.freeze({
  wins: 2,
  shutouts: 3,
  savePctgScale: 1600,
  replacementSavePctg: 0.89,
});

// Compute one player's custom fantasy points under a given set of league
// weights. Returns 0 for a player with no games played this season (no
// per-game rate to project from) rather than NaN.
export function computeCustomPoints(player, skaterWeights, goalieWeights) {
  if (!player || !player.gamesPlayed) return 0;

  if (player.position === 'G') {
    const w = goalieWeights;
    const savePctgBonus = Math.max(0, (player.savePctg || 0) - w.replacementSavePctg) * w.savePctgScale;
    return Number(
      ((player.projectedWins || 0) * w.wins + (player.projectedShutouts || 0) * w.shutouts + savePctgBonus).toFixed(1)
    );
  }

  const w = skaterWeights;
  const gp = player.gamesPlayed;
  const projGoals = ((player.totalGoals || 0) / gp) * PROJECTED_SEASON_GAMES;
  const projAssists = ((player.totalAssists || 0) / gp) * PROJECTED_SEASON_GAMES;
  const projShots = ((player.totalShots || 0) / gp) * PROJECTED_SEASON_GAMES;
  const projPpp = ((player.totalPpp || 0) / gp) * PROJECTED_SEASON_GAMES;
  return Number(
    (projGoals * w.goals + projAssists * w.assists + projShots * w.shots + projPpp * w.powerPlayPoints).toFixed(1)
  );
}

// Rank an entire player pool under custom league weights, separately
// within skaters and within goalies (a league rank should compare
// skaters to skaters and goalies to goalies, same as Site Rank does not
// mix them into one list on the Draft Board). Returns a Map keyed by
// playerId so callers can look up { customPoints, leagueRank } for any
// player in one pass, without re-sorting per lookup.
export function rankByLeagueScoring(pool, skaterWeights, goalieWeights) {
  const withPoints = pool.map((p) => ({
    playerId: p.playerId,
    isGoalie: p.position === 'G',
    customPoints: computeCustomPoints(p, skaterWeights, goalieWeights),
  }));

  const skaters = withPoints.filter((p) => !p.isGoalie).sort((a, b) => b.customPoints - a.customPoints);
  const goalies = withPoints.filter((p) => p.isGoalie).sort((a, b) => b.customPoints - a.customPoints);

  const result = new Map();
  skaters.forEach((p, i) => result.set(p.playerId, { customPoints: p.customPoints, leagueRank: i + 1 }));
  goalies.forEach((p, i) => result.set(p.playerId, { customPoints: p.customPoints, leagueRank: i + 1 }));
  return result;
}
