const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { logger } = require('firebase-functions');
const { TEAM_CODES, getTeamRoster, getPlayerGameLog, toiToMinutes, flattenRoster } = require('./nhlApi');

const CONCURRENCY = 8;
const REQUEST_STAGGER_MS = 50;
const PROJECTED_SEASON_GAMES = 82;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function runOne() {
    while (cursor < items.length) {
      const idx = cursor++;
      try {
        results[idx] = await worker(items[idx], idx);
      } catch (err) {
        logger.warn(`ingestDraftGuide: worker failed for item ${idx}: ${err.message}`);
        results[idx] = null;
      }
      await sleep(REQUEST_STAGGER_MS);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runOne));
  return results;
}

/**
* Draft guide = pre-season positional rankings built from PRIOR full season
* stats, projected forward. This is intentionally simple ("basic
* projections" per spec, not a real projection model):
*
*   projectedPoints = (priorSeasonPoints / priorSeasonGamesPlayed) * 82
*
* i.e. "if this player's per-game production last season holds and they
* play a full 82-game season, here's the point total." No aging curve, no
* injury risk, no linemate/system change adjustments - those are natural
* follow-ups once this MVP is live (see README roadmap).
*
* Players are ranked within their own position (C / L / R / D) since
* fantasy draft value is inherently positional.
*
* This runs far less often than stats ingestion (daily is plenty - prior
* season totals don't change) to limit NHL API load; see index.js schedule.
*/
async function runDraftGuideIngestion(priorSeason) {
  const db = getFirestore();
  const startedAt = Date.now();
  logger.info('ingestDraftGuide: starting run', { priorSeason });

const rosters = await mapWithConcurrency(TEAM_CODES, CONCURRENCY, async (team) => {
  const roster = await getTeamRoster(team);
  return { team, players: flattenRoster(roster, { includeGoalies: false }) };
});

const allSkaters = rosters
  .filter(Boolean)
  .flatMap(({ team, players }) => players.map((p) => ({ ...p, team })));

const withSeasonTotals = await mapWithConcurrency(allSkaters, CONCURRENCY, async (player) => {
  const log = await getPlayerGameLog(player.id, priorSeason, 2);
  const games = log.gameLog || [];
  if (games.length === 0) return null; // rookie / no prior-season NHL games

                                                  const gamesPlayed = games.length;
  const totalPoints = games.reduce((sum, g) => sum + (g.points || 0), 0);
  const totalGoals = games.reduce((sum, g) => sum + (g.goals || 0), 0);
  const totalAssists = games.reduce((sum, g) => sum + (g.assists || 0), 0);
  const avgToi = games.reduce((sum, g) => sum + toiToMinutes(g.toi), 0) / gamesPlayed;
  const pointsPerGame = totalPoints / gamesPlayed;
  const projectedPoints = Number((pointsPerGame * PROJECTED_SEASON_GAMES).toFixed(1));

                                                  return {
                                                    player,
                                                    gamesPlayed,
                                                    totalPoints,
                                                    totalGoals,
                                                    totalAssists,
                                                    pointsPerGame: Number(pointsPerGame.toFixed(2)),
                                                    avgToi: Number(avgToi.toFixed(2)),
                                                    projectedPoints,
                                                  };
});

const valid = withSeasonTotals.filter(Boolean);

// Rank within position.
const byPosition = {};
  for (const entry of valid) {
    const pos = entry.player.positionCode;
    if (!byPosition[pos]) byPosition[pos] = [];
    byPosition[pos].push(entry);
  }
  for (const pos of Object.keys(byPosition)) {
    byPosition[pos].sort((a, b) => b.projectedPoints - a.projectedPoints);
    byPosition[pos].forEach((entry, i) => {
      entry.positionRank = i + 1;
    });
  }

const BATCH_LIMIT = 400;
  let batch = db.batch();
  let ops = 0;
  const commits = [];
  const commitIfNeeded = async () => {
    if (ops >= BATCH_LIMIT) {
      commits.push(batch.commit());
      batch = db.batch();
      ops = 0;
    }
  };

for (const entry of valid) {
  const { player, positionRank, ...rest } = entry;
  const ref = db.collection('draftGuide').doc(String(player.id));
  batch.set(ref, {
    playerId: player.id,
    name: `${player.firstName?.default || ''} ${player.lastName?.default || ''}`.trim(),
    team: player.team,
    position: player.positionCode,
    priorSeason,
    positionRank,
    ...rest,
    updatedAt: FieldValue.serverTimestamp(),
  });
  ops++;
  await commitIfNeeded();
}
  commits.push(batch.commit());
  await Promise.all(commits);

await db.collection('meta').doc('draftGuideIngestion').set({
  lastRunAt: FieldValue.serverTimestamp(),
  priorSeason,
  playersProcessed: valid.length,
  durationMs: Date.now() - startedAt,
});

logger.info(`ingestDraftGuide: done. ${valid.length} players ranked in ${Date.now() - startedAt}ms`);
  return { playersProcessed: valid.length, durationMs: Date.now() - startedAt };
}

module.exports = { runDraftGuideIngestion };
