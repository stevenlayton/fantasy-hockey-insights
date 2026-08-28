const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { logger } = require('firebase-functions');
const { fetchJson } = require('./nhlApi');

/**
 * Pulls today's NHL scoreboard (live scores, final results, upcoming start
 * times) from the same public NHL API used for stats ingestion and writes
 * it to the scoreboard collection, one doc per game. Meant to be cheap
 * and frequent (a single API call) unlike the heavier stats pipeline.
 *
 * The collection is fully replaced on every run so it never accumulates
 * stale games from previous days - "now" always resolves to today server
 * side, so a full wipe + rewrite keeps this simple and correct.
 */
async function runScoreboardIngestion() {
  const db = getFirestore();
  const startedAt = Date.now();

  const data = await fetchJson('/v1/score/now');
  const games = Array.isArray(data.games) ? data.games : [];

  const existing = await db.collection('scoreboard').listDocuments();
  if (existing.length > 0) {
    const deleteBatch = db.batch();
    existing.forEach((ref) => deleteBatch.delete(ref));
    await deleteBatch.commit();
  }

  if (games.length > 0) {
    const batch = db.batch();
    for (const g of games) {
      const ref = db.collection('scoreboard').doc(String(g.id));
      batch.set(ref, {
        gameId: g.id,
        gameDate: g.gameDate || null,
        gameState: g.gameState || 'FUT',
        startTimeUTC: g.startTimeUTC || null,
        venue: g.venue && g.venue.default ? g.venue.default : '',
        awayTeam: {
          abbrev: g.awayTeam && g.awayTeam.abbrev ? g.awayTeam.abbrev : '',
          name: g.awayTeam && g.awayTeam.name ? g.awayTeam.name.default : '',
          logo: g.awayTeam && g.awayTeam.logo ? g.awayTeam.logo : '',
          score: g.awayTeam && typeof g.awayTeam.score === 'number' ? g.awayTeam.score : null,
        },
        homeTeam: {
          abbrev: g.homeTeam && g.homeTeam.abbrev ? g.homeTeam.abbrev : '',
          name: g.homeTeam && g.homeTeam.name ? g.homeTeam.name.default : '',
          logo: g.homeTeam && g.homeTeam.logo ? g.homeTeam.logo : '',
          score: g.homeTeam && typeof g.homeTeam.score === 'number' ? g.homeTeam.score : null,
        },
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  }

  await db.collection('meta').doc('scoreboardIngestion').set({
    lastRunAt: FieldValue.serverTimestamp(),
    gamesFound: games.length,
    durationMs: Date.now() - startedAt,
  });

  logger.info('ingestScoreboard: done. ' + games.length + ' games in ' + (Date.now() - startedAt) + 'ms');
  return { gamesFound: games.length, durationMs: Date.now() - startedAt };
}

module.exports = { runScoreboardIngestion };
