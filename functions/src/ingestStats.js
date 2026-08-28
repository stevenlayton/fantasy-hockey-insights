const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { logger } = require('firebase-functions');
const { TEAM_CODES, getTeamRoster, getPlayerGameLogNow, toiToMinutes, flattenRoster } = require('./nhlApi');
const { computeRawSignals, computeConsistency, scorePlayerPool, computeGoalieRawSignals, scoreGoaliePool } = require('./scoring');

const GAMES_TO_SAMPLE = 15; // "last 15 games" ceiling used as the season baseline window
const CONCURRENCY = 8; // simultaneous in-flight NHL API requests - be a polite citizen of a free, undocumented API
const REQUEST_STAGGER_MS = 50; // small delay between batches so we don't hammer the API

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Run `worker` over `items` with at most `concurrency` in flight at once. */
async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;

async function runOne() {
  while (cursor < items.length) {
    const idx = cursor++;
    try {
      results[idx] = await worker(items[idx], idx);
    } catch (err) {
      logger.warn(`ingestStats: worker failed for item ${idx}: ${err.message}`);
      results[idx] = null;
    }
    await sleep(REQUEST_STAGGER_MS);
  }
}

const runners = Array.from({ length: Math.min(concurrency, items.length) }, runOne);
  await Promise.all(runners);
  return results;
}

/**
* Full pipeline: NHL API -> raw signals -> pool-normalized scores -> Firestore.
* Exported as a plain function (not the scheduled trigger itself) so it can
* be unit-tested or invoked manually via an HTTPS admin endpoint if needed.
*/
async function runStatsIngestion() {
  const db = getFirestore();
  const startedAt = Date.now();
  logger.info('ingestStats: starting run', { teams: TEAM_CODES.length });

// 1. Pull every team roster once (skaters + goalies together, one NHL API
  // call per team) then split by position - cheaper than fetching twice.
  const rosters = await mapWithConcurrency(TEAM_CODES, CONCURRENCY, async (team) => {
    const roster = await getTeamRoster(team);
    return { team, players: flattenRoster(roster, { includeGoalies: true }) };
  });

  const allTeamPlayers = rosters
    .filter(Boolean)
    .flatMap(({ team, players }) => players.map((p) => ({ ...p, team })));

  const allSkaters = allTeamPlayers.filter((p) => p.positionCode !== 'G');
  const allGoalies = allTeamPlayers.filter((p) => p.positionCode === 'G');

  logger.info(`ingestStats: fetched ${allSkaters.length} skaters and ${allGoalies.length} goalies across ${TEAM_CODES.length} teams`);

// 2. Pull each skater's game log and compute raw (pre-normalization) signals.
const withRawSignals = await mapWithConcurrency(allSkaters, CONCURRENCY, async (player) => {
  const log = await getPlayerGameLogNow(player.id);
  const gameLog = (log.gameLog || []).slice(0, GAMES_TO_SAMPLE);
  if (gameLog.length === 0) return null; // player hasn't played this season yet (injured/AHL/etc)

                                                const raw = computeRawSignals(gameLog, toiToMinutes);
  const consistency = computeConsistency(gameLog);
  return { player, gameLog, raw, consistency };
});

const validPlayers = withRawSignals.filter(Boolean);
  logger.info(`ingestStats: ${validPlayers.length}/${allSkaters.length} skaters had a usable game log`);

// 3. Normalize across the whole pool and compute the final composite score.
const scored = scorePlayerPool(validPlayers);

// 4. Write to Firestore: players/{id}, players/{id}/gamelogs/{gameId}, scores/{id}.
// Batched in chunks of 400 writes (Firestore batch limit is 500) to stay safe.
const BATCH_LIMIT = 400;
  let batch = db.batch();
  let opsInBatch = 0;
  const commits = [];

const commitIfNeeded = async () => {
  if (opsInBatch >= BATCH_LIMIT) {
    commits.push(batch.commit());
    batch = db.batch();
    opsInBatch = 0;
  }
};

for (const entry of scored) {
  const { player, gameLog, raw, score, zScores, rosteredEstimate } = entry;

  const playerRef = db.collection('players').doc(String(player.id));
  batch.set(
    playerRef,
    {
      firstName: player.firstName?.default || '',
      lastName: player.lastName?.default || '',
      team: player.team,
      position: player.positionCode,
      sweaterNumber: player.sweaterNumber || null,
      headshot: player.headshot || null,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
    );
  opsInBatch++;
  await commitIfNeeded();

  // Store the sampled game log (small collection per player, capped at 15 docs).
  for (const game of gameLog) {
    const gameRef = playerRef.collection('gamelogs').doc(String(game.gameId));
    batch.set(gameRef, {
      gameDate: game.gameDate,
      opponentAbbrev: game.opponentAbbrev,
      goals: game.goals,
      assists: game.assists,
      points: game.points,
      shots: game.shots,
      powerPlayPoints: game.powerPlayPoints,
      toi: game.toi,
      pim: game.pim ?? 0,
      plusMinus: game.plusMinus ?? 0,
    });
    opsInBatch++;
    await commitIfNeeded();
  }

  const scoreRef = db.collection('scores').doc(String(player.id));
  batch.set(scoreRef, {
    playerId: player.id,
    name: `${player.firstName?.default || ''} ${player.lastName?.default || ''}`.trim(),
    team: player.team,
    position: player.positionCode,
    score,
    zScores,
    rosteredEstimate,
    gamesSampled: raw.gamesSampled,
    display: raw.display,
    consistency: consistency || null,
    computedAt: FieldValue.serverTimestamp(),
  });
  opsInBatch++;
  await commitIfNeeded();
}

commits.push(batch.commit());
  await Promise.all(commits);

  // 5. Goalies: same game-log-driven trend model, different signals (save
  // percentage, goals against, wins instead of points/shots/toi). See
  // computeGoalieRawSignals in scoring.js for the formula.
  const withGoalieRawSignals = await mapWithConcurrency(allGoalies, CONCURRENCY, async (player) => {
    const log = await getPlayerGameLogNow(player.id);
    const gameLog = (log.gameLog || []).slice(0, GAMES_TO_SAMPLE);
    if (gameLog.length === 0) return null;
    const raw = computeGoalieRawSignals(gameLog);
    return { player, gameLog, raw };
  });

  const validGoalies = withGoalieRawSignals.filter(Boolean);
  logger.info(`ingestStats: ${validGoalies.length}/${allGoalies.length} goalies had a usable game log`);

  const scoredGoalies = scoreGoaliePool(validGoalies);

  batch = db.batch();
  opsInBatch = 0;

  for (const entry of scoredGoalies) {
    const { player, gameLog, raw, score, zScores, rosteredEstimate } = entry;

    const playerRef = db.collection('players').doc(String(player.id));
    batch.set(
      playerRef,
      {
        firstName: player.firstName?.default || '',
        lastName: player.lastName?.default || '',
        team: player.team,
        position: player.positionCode,
        sweaterNumber: player.sweaterNumber || null,
        headshot: player.headshot || null,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    opsInBatch++;
    await commitIfNeeded();

    // Store the sampled game log (goalie-shaped fields instead of skater stats).
    for (const game of gameLog) {
      const gameRef = playerRef.collection('gamelogs').doc(String(game.gameId));
      batch.set(gameRef, {
        gameDate: game.gameDate,
        opponentAbbrev: game.opponentAbbrev,
        decision: game.decision || null,
        // NHL API omits these fields entirely for some very short relief
        // appearances - Firestore rejects "undefined" outright (unlike
        // null), so every goalie numeric field needs an explicit fallback.
        goalsAgainst: game.goalsAgainst ?? null,
        shotsAgainst: game.shotsAgainst ?? null,
        savePctg: game.savePctg ?? null,
        shutout: Boolean(game.shutouts),
        toi: game.toi || null,
      });
      opsInBatch++;
      await commitIfNeeded();
    }

    const scoreRef = db.collection('scores').doc(String(player.id));
    batch.set(scoreRef, {
      playerId: player.id,
      name: `${player.firstName?.default || ''} ${player.lastName?.default || ''}`.trim(),
      team: player.team,
      position: player.positionCode,
      score,
      zScores,
      rosteredEstimate,
      gamesSampled: raw.gamesSampled,
      display: raw.display,
      computedAt: FieldValue.serverTimestamp(),
    });
    opsInBatch++;
    await commitIfNeeded();
  }

  commits.push(batch.commit());
  await Promise.all(commits);

await db.collection('meta').doc('statsIngestion').set({
    lastRunAt: FieldValue.serverTimestamp(),
    playersProcessed: scored.length,
    goaliesProcessed: scoredGoalies.length,
    durationMs: Date.now() - startedAt,
  });

  logger.info(`ingestStats: done. ${scored.length} skaters and ${scoredGoalies.length} goalies scored in ${Date.now() - startedAt}ms`);
  return { playersProcessed: scored.length, goaliesProcessed: scoredGoalies.length, durationMs: Date.now() - startedAt };
}

module.exports = { runStatsIngestion };
