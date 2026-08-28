const { initializeApp } = require('firebase-admin/app');
// Deploy service account has Cloud Scheduler Admin (added Aug 2026) so schedule updates on scheduled functions now apply cleanly.
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onRequest } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const { logger } = require('firebase-functions');

const { runStatsIngestion } = require('./src/ingestStats');
const { runNewsIngestion } = require('./src/ingestNews');
const { runDraftGuideIngestion } = require('./src/ingestDraftGuide');
const { runScoreboardIngestion } = require('./src/ingestScoreboard');

initializeApp();

// Cloud Functions v2 defaults are conservative; the stats pipeline walks
// every roster + every skater's game log (roughly 700+ NHL API calls), so
// give it real headroom. Adjust if you see timeouts in the logs.
setGlobalOptions({ region: 'us-central1', timeoutSeconds: 300, memory: '512MiB' });

const CURRENT_SEASON_START_YEAR = 2025; // update each September when a new season starts
const PRIOR_SEASON = Number(`${CURRENT_SEASON_START_YEAR - 1}${CURRENT_SEASON_START_YEAR}`); // e.g. 20242025

/**
 * Stats + scoring pipeline. Every 4-6 hours as specced. NHL schedules
 * cluster games in the evening (US time), so this cadence catches new
 * results without hammering the API constantly.
 */
exports.scheduledStatsIngestion = onSchedule(
  { schedule: 'every 5 hours', timeoutSeconds: 540, memory: '1GiB' },
  async () => {
    await runStatsIngestion();
  }
);

/**
 * News RSS pipeline. Runs more often than stats since news moves faster
 * than box scores - hourly is cheap (RSS fetches are tiny compared to the
 * ~700 NHL API calls stats ingestion makes).
 */
exports.scheduledNewsIngestion = onSchedule('every 1 hours', async () => {
  await runNewsIngestion();
});

/**
 * Draft guide only needs prior-season totals, which don't change day to
 * day. Once daily is already overkill during the season; kept simple on
 * purpose. Bump to weekly (e.g. "every monday 08:00") once this is stable.
 */
exports.scheduledDraftGuideIngestion = onSchedule(
  { schedule: 'every 24 hours', timeoutSeconds: 540, memory: '1GiB' },
  async () => {
    await runDraftGuideIngestion(PRIOR_SEASON);
  }
);

/**
 * Live scoreboard pipeline. A single cheap NHL API call, so a tight
 * cadence is fine - this is what keeps the "Around the League" widget
 * showing current scores during games instead of stale ones.
 */
exports.scheduledScoreboardIngestion = onSchedule('every 15 minutes', async () => {
  await runScoreboardIngestion();
});

/**
 * Manual HTTPS trigger to run any pipeline on-demand - useful for the
 * initial data load (don't wait 5 hours for the first scheduled run after
 * deploy) and for debugging. Not secured beyond obscurity + being a GET
 * with a query param; lock this down (e.g. check a shared secret header,
 * or delete it) before this project has real traffic.
 *
 * Usage: https://<region>-<project>.cloudfunctions.net/runIngestionNow?job=stats
 * ?job=news | ?job=draftGuide | ?job=scoreboard | ?job=all
 */
exports.runIngestionNow = onRequest({ timeoutSeconds: 540, memory: '1GiB' }, async (req, res) => {
  const job = req.query.job || 'all';
  try {
    const results = {};
    if (job === 'stats' || job === 'all') results.stats = await runStatsIngestion();
    if (job === 'news' || job === 'all') results.news = await runNewsIngestion();
    if (job === 'draftGuide' || job === 'all') results.draftGuide = await runDraftGuideIngestion(PRIOR_SEASON);
    if (job === 'scoreboard' || job === 'all') results.scoreboard = await runScoreboardIngestion();
    res.status(200).json({ ok: true, job, results });
  } catch (err) {
    logger.error('runIngestionNow failed', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});
