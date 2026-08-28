/**
* === Pickup / Drop scoring model ===
*
* Goal: turn a player's recent game log into a single "trending score" that
* ranks players by how much better/worse they're playing lately relative to
* their own season baseline - not their absolute talent level. A depth
* forward on a hot streak should rank above a superstar in a slump for
* "pickup" purposes, because fantasy pickups are about trend, not talent.
*
* INPUT: a player's gameLog array from the NHL API, ordered MOST RECENT
* FIRST (that's the order the API returns), each entry shaped like:
*   { goals, assists, points, shots, powerPlayPoints, toi: "MM:SS", ... }
*
* STEP 1 - per-player raw signal (four signals, each a "recent vs baseline" delta):
*
*   recentWeightedPPG   = 0.55 * avgPoints(last 5)  + 0.30 * avgPoints(last 10) + 0.15 * avgPoints(last 15)
*   baselinePPG         = avgPoints(all available games, up to 15)
*   pointsTrend         = recentWeightedPPG - baselinePPG
*
*   (same recency-weighted-vs-baseline pattern for ice time, shots, and PP points)
*   iceTimeTrend        = recency-weighted avg TOI(min)      - baseline avg TOI(min)
*   shotsTrend          = recency-weighted avg shots/game     - baseline avg shots/game
*   powerPlayTrend      = recency-weighted avg PP points/game - baseline avg PP points/game
*
*   NOTE on powerPlayTrend: the NHL "game-log" endpoint does not expose
*   power-play TIME ON ICE (only powerPlayGoals/powerPlayPoints), so PP
*   points/game is used as a proxy for "is this guy seeing more PP usage."
*   If NHL ever exposes PP TOI on this endpoint, swap it in here - it'd be
*   a cleaner signal.
*
*   The 0.55 / 0.30 / 0.15 split is the "recency weighting" the spec calls
*   for: the last 5 games matter roughly 2x as much as games 6-10, which in
*   turn matter 2x as much as games 11-15.
*
* STEP 2 - normalize across the full player pool for this run:
*   Raw trend deltas are in incompatible units (points/game vs. minutes vs.
*   shots), so before combining them we z-score each signal across every
*   player processed in the same ingestion run:
*     z = (value - poolMean) / poolStdDev   (0 if stdDev is 0)
*
* STEP 3 - weighted composite:
*   score = 0.40 * z(pointsTrend)
*         + 0.25 * z(iceTimeTrend)
*         + 0.20 * z(shotsTrend)
*         + 0.15 * z(powerPlayTrend)
*
*   These four weights are the main knob for tuning the model. They live
*   in SCORE_WEIGHTS below - change them in one place, no other code needs
*   to move. They currently favor scoring trend the most (it's what
*   fantasy managers care about first) while still rewarding usage trends
*   (ice time / PP time) since those often *lead* scoring by a game or two.
*
* OUTPUT: players sorted descending by score are "pickup" candidates
* (trending up); sorted ascending are "drop" candidates (trending down).
* `rosteredEstimate` is a heuristic (see below) used to bias the pickup
* list toward players likely to actually be on waivers, since we have no
* real fantasy-platform ownership % data (no paid API budget for that).
*/

const SCORE_WEIGHTS = Object.freeze({ points: 0.40, iceTime: 0.25, shots: 0.20, powerPlay: 0.15 });

const RECENCY_WEIGHTS = Object.freeze({ last5: 0.55, last10: 0.30, last15: 0.15 });

function average(nums) {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/**
* Compute the raw (pre-normalization) trend signals for one player from
* their game log (most-recent-first array, already sliced to <= 15 games
* by the caller).
*/
function computeRawSignals(gameLog, toiToMinutes) {
  const last5 = gameLog.slice(0, 5);
  const last10 = gameLog.slice(0, 10);
  const last15 = gameLog.slice(0, 15);
  const baseline = gameLog; // "season" baseline = all games we fetched (<=15)

const recencyWeighted = (metricFn) =>
  RECENCY_WEIGHTS.last5 * average(last5.map(metricFn)) +
  RECENCY_WEIGHTS.last10 * average(last10.map(metricFn)) +
  RECENCY_WEIGHTS.last15 * average(last15.map(metricFn));

const pointsFn = (g) => g.points || 0;
  const toiFn = (g) => toiToMinutes(g.toi);
  const shotsFn = (g) => g.shots || 0;
  const ppFn = (g) => g.powerPlayPoints || 0;

return {
  gamesSampled: baseline.length,
  pointsTrend: recencyWeighted(pointsFn) - average(baseline.map(pointsFn)),
  iceTimeTrend: recencyWeighted(toiFn) - average(baseline.map(toiFn)),
  shotsTrend: recencyWeighted(shotsFn) - average(baseline.map(shotsFn)),
  powerPlayTrend: recencyWeighted(ppFn) - average(baseline.map(ppFn)),
  // plain-language stats stored alongside the score for display on the frontend
  display: {
    pointsPerGameLast5: average(last5.map(pointsFn)),
    pointsPerGameSeason: average(baseline.map(pointsFn)),
    toiPerGameLast5: average(last5.map(toiFn)),
    toiPerGameSeason: average(baseline.map(toiFn)),
    shotsPerGameLast5: average(last5.map(shotsFn)),
    shotsPerGameSeason: average(baseline.map(shotsFn)),
  },
};
}

function meanAndStdDev(values) {
  const mean = average(values);
  const variance = average(values.map((v) => (v - mean) ** 2));
  return { mean, stdDev: Math.sqrt(variance) };
}

function zScore(value, { mean, stdDev }) {
  if (!stdDev) return 0;
  return (value - mean) / stdDev;
}

/**
 * === Consistency (boom-or-bust) score ===
 *
 * Fantasy managers often care not just about a player's average output but
 * how PREDICTABLE it is week to week - a player who scores 1 point every
 * game is a very different draft asset than one who alternates between a
 * 4-point game and three straight zeros, even if their season averages
 * match. This measures that using the coefficient of variation (CV) of a
 * player's per-game point totals over the sampled game log:
 *
 *   CV = stdDev(points) / mean(points)
 *
 * A low CV means point totals cluster tightly around the average
 * (consistent); a high CV means they swing wildly (boom or bust). CV is
 * unitless, so it is comparable across players regardless of scoring
 * level, unlike raw stdDev.
 *
 * CV is then mapped onto a 0-100 "Consistency Score" (100 = rock solid,
 * 0 = totally unpredictable) by clamping it between the two constants
 * below and scaling linearly. These thresholds were picked by eyeballing
 * CV values across a range of real players' 15-game logs, not derived
 * from a formal study - tune them if they feel off for your league.
 */
const CONSISTENCY_MIN_GAMES = 5; // fewer sampled games than this and CV is too noisy to trust
const CONSISTENCY_MIN_PPG_FOR_CV = 0.15; // below this points-per-game, CV is meaningless (near-zero mean)
const CONSISTENCY_CV_FLOOR = 0.35; // CV at/below this scores a perfect 100 (very consistent)
const CONSISTENCY_CV_CEILING = 1.4; // CV at/above this scores a 0 (boom or bust)
const CONSISTENCY_STRONG_THRESHOLD = 70; // score >= this => "Consistent" label
const CONSISTENCY_WEAK_THRESHOLD = 35; // score <= this => "Boom or bust" label

/**
 * Compute a consistency score from a player's game log (same shape as
 * computeRawSignals' input). Returns null when there isn't enough signal
 * to say anything meaningful (too few games, or production too low for CV
 * to be stable), rather than a misleading number.
 */
function computeConsistency(gameLog) {
  const points = gameLog.map((g) => g.points || 0);
  if (points.length < CONSISTENCY_MIN_GAMES) return null;

  const { mean, stdDev } = meanAndStdDev(points);
  if (mean < CONSISTENCY_MIN_PPG_FOR_CV) return null;

  const cv = stdDev / mean;
  const clamped = Math.min(Math.max(cv, CONSISTENCY_CV_FLOOR), CONSISTENCY_CV_CEILING);
  const score = Math.round(
    100 - ((clamped - CONSISTENCY_CV_FLOOR) / (CONSISTENCY_CV_CEILING - CONSISTENCY_CV_FLOOR)) * 100
  );
  const label =
    score >= CONSISTENCY_STRONG_THRESHOLD
      ? 'Consistent'
      : score <= CONSISTENCY_WEAK_THRESHOLD
        ? 'Boom or bust'
        : 'Moderate';

  return { score, label, coefficientOfVariation: Number(cv.toFixed(2)) };
}

/**
* Given raw signals for EVERY player processed in this ingestion run,
* compute pool-wide z-scores and the final composite score for each.
* Mutates nothing; returns a new array of { ...input, score, zScores }.
*/
function scorePlayerPool(playersWithRawSignals) {
  const pointsStats = meanAndStdDev(playersWithRawSignals.map((p) => p.raw.pointsTrend));
  const iceTimeStats = meanAndStdDev(playersWithRawSignals.map((p) => p.raw.iceTimeTrend));
  const shotsStats = meanAndStdDev(playersWithRawSignals.map((p) => p.raw.shotsTrend));
  const ppStats = meanAndStdDev(playersWithRawSignals.map((p) => p.raw.powerPlayTrend));

return playersWithRawSignals.map((p) => {
  const zPoints = zScore(p.raw.pointsTrend, pointsStats);
  const zIceTime = zScore(p.raw.iceTimeTrend, iceTimeStats);
  const zShots = zScore(p.raw.shotsTrend, shotsStats);
  const zPowerPlay = zScore(p.raw.powerPlayTrend, ppStats);

                                 const score =
                                   SCORE_WEIGHTS.points * zPoints +
                                   SCORE_WEIGHTS.iceTime * zIceTime +
                                   SCORE_WEIGHTS.shots * zShots +
                                   SCORE_WEIGHTS.powerPlay * zPowerPlay;

                                 // Heuristic "is this player likely already rostered in a typical
                                 // fantasy league" flag. We have no real ownership-% data source, so we
                                 // approximate using season-long role: meaningful point production or
                                 // significant ice time implies a player fantasy managers would already
                                 // have rostered. Tune the two thresholds below as a stand-in until/unless
                                 // real ownership data becomes available.
                                 const seasonPPG = p.raw.display.pointsPerGameSeason;
  const seasonTOI = p.raw.display.toiPerGameSeason;
  const rosteredEstimate = seasonPPG >= 0.4 || seasonTOI >= 15;

                                 return {
                                   ...p,
                                   score: Number(score.toFixed(4)),
                                   zScores: {
                                     points: Number(zPoints.toFixed(3)),
                                     iceTime: Number(zIceTime.toFixed(3)),
                                     shots: Number(zShots.toFixed(3)),
                                     powerPlay: Number(zPowerPlay.toFixed(3)),
                                   },
                                   rosteredEstimate,
                                 };
});
}


/**
 * ===== Goalie pickup/drop scoring =====
 *
 * Same "recent vs baseline" philosophy as the skater model above, applied
 * to goalie-specific signals since points/shots/toi don't apply to
 * goalies. Uses the same RECENCY_WEIGHTS (last 5 / 10 / 15 games) so both
 * models trend on the same time window.
 *
 * Signals (each a recent-vs-baseline delta, like the skater model):
 *   savePctgTrend      = recencyWeighted(savePctg) - baseline(savePctg)
 *   goalsAgainstTrend  = baseline(goalsAgainst) - recencyWeighted(goalsAgainst)
 *                        (inverted: allowing FEWER goals recently is an
 *                        improvement, so a positive trend means better play)
 *   winRateTrend       = recencyWeighted(isWin) - baseline(isWin)
 *
 * These are z-scored across the goalie pool the same way as skaters, then
 * combined with GOALIE_SCORE_WEIGHTS below. Weights favor save percentage
 * first (the clearest signal of a goalie actually playing better, not just
 * getting better run support), then goals against, then win rate last
 * (wins are heavily influenced by the team in front of the goalie).
 */
const GOALIE_SCORE_WEIGHTS = Object.freeze({ savePctg: 0.45, goalsAgainst: 0.30, wins: 0.25 });

/**
 * Compute the raw (pre-normalization) trend signals for one goalie from
 * their game log (most-recent-first array, already sliced to <= 15 games
 * by the caller). gameLog entries are expected to have: decision ('W' on
 * a win, anything else counted as a non-win), savePctg, goalsAgainst, toi.
 */
function computeGoalieRawSignals(gameLog) {
  const last5 = gameLog.slice(0, 5);
  const last10 = gameLog.slice(0, 10);
  const last15 = gameLog.slice(0, 15);
  const baseline = gameLog;

  const recencyWeighted = (metricFn) =>
    RECENCY_WEIGHTS.last5 * average(last5.map(metricFn)) +
    RECENCY_WEIGHTS.last10 * average(last10.map(metricFn)) +
    RECENCY_WEIGHTS.last15 * average(last15.map(metricFn));

  const savePctgFn = (g) => g.savePctg || 0;
  const goalsAgainstFn = (g) => g.goalsAgainst || 0;
  const winFn = (g) => (g.decision === 'W' ? 1 : 0);

  return {
    gamesSampled: baseline.length,
    savePctgTrend: recencyWeighted(savePctgFn) - average(baseline.map(savePctgFn)),
    goalsAgainstTrend: average(baseline.map(goalsAgainstFn)) - recencyWeighted(goalsAgainstFn),
    winRateTrend: recencyWeighted(winFn) - average(baseline.map(winFn)),
    display: {
      savePctgLast5: average(last5.map(savePctgFn)),
      savePctgSeason: average(baseline.map(savePctgFn)),
      goalsAgainstLast5: average(last5.map(goalsAgainstFn)),
      goalsAgainstSeason: average(baseline.map(goalsAgainstFn)),
      winsSeason: baseline.filter((g) => g.decision === 'W').length,
    },
  };
}

/**
 * Given raw signals for EVERY goalie processed in this ingestion run,
 * compute pool-wide z-scores and the final composite score for each.
 * Mirrors scorePlayerPool above but for the goalie signal set.
 */
function scoreGoaliePool(goaliesWithRawSignals) {
  const saveStats = meanAndStdDev(goaliesWithRawSignals.map((g) => g.raw.savePctgTrend));
  const gaStats = meanAndStdDev(goaliesWithRawSignals.map((g) => g.raw.goalsAgainstTrend));
  const winStats = meanAndStdDev(goaliesWithRawSignals.map((g) => g.raw.winRateTrend));

  return goaliesWithRawSignals.map((g) => {
    const zSave = zScore(g.raw.savePctgTrend, saveStats);
    const zGa = zScore(g.raw.goalsAgainstTrend, gaStats);
    const zWin = zScore(g.raw.winRateTrend, winStats);

    const score =
      GOALIE_SCORE_WEIGHTS.savePctg * zSave +
      GOALIE_SCORE_WEIGHTS.goalsAgainst * zGa +
      GOALIE_SCORE_WEIGHTS.wins * zWin;

    // Same "likely already rostered" heuristic as skaters, adapted for
    // goalies: a goalie who has actually been getting starts (5+ games
    // sampled) is assumed rostered in a typical league.
    const rosteredEstimate = g.raw.gamesSampled >= 5;

    return {
      ...g,
      score: Number(score.toFixed(4)),
      zScores: {
        savePctg: Number(zSave.toFixed(3)),
        goalsAgainst: Number(zGa.toFixed(3)),
        wins: Number(zWin.toFixed(3)),
      },
      rosteredEstimate,
    };
  });
}

module.exports = {
  SCORE_WEIGHTS,
  RECENCY_WEIGHTS,
  computeRawSignals,
  computeConsistency,
  scorePlayerPool,
  average,
  GOALIE_SCORE_WEIGHTS,
  computeGoalieRawSignals,
  scoreGoaliePool,
};
