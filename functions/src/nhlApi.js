/**
 * Thin client for the NHL's free public "web api" (api-web.nhle.com).
 *
 * This is an UNOFFICIAL, undocumented-by-NHL API. It's free and requires no
 * key, which is why it's used here (project has no paid data budget), but it
 * can change shape without notice. Schemas below were confirmed by hitting
 * the live endpoints directly while building this (Aug 2026):
 *   - /v1/roster/{team}/current      -> { forwards: [...], defensemen: [...], goalies: [...] }
 *   - /v1/player/{id}/game-log/now   -> { seasonId, gameTypeId, gameLog: [ {...}, ... ] }
 *       gameLog is ordered MOST RECENT GAME FIRST.
 * If NHL changes these shapes, ingestStats.js will start throwing/skip
 * players - check functions logs first when debugging "no data" issues.
 */

const NHL_BASE = 'https://api-web.nhle.com';

// All 32 current NHL three-letter team codes.
const TEAM_CODES = [
  'ANA', 'BOS', 'BUF', 'CGY', 'CAR', 'CHI', 'COL', 'CBJ', 'DAL', 'DET',
  'EDM', 'FLA', 'LAK', 'MIN', 'MTL', 'NSH', 'NJD', 'NYI', 'NYR', 'OTT',
  'PHI', 'PIT', 'SEA', 'SJS', 'STL', 'TBL', 'TOR', 'UTA', 'VAN', 'VGK',
  'WSH', 'WPG',
];

const DEFAULT_TIMEOUT_MS = 10000;
const MAX_RETRIES = 4;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(path, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const url = `${NHL_BASE}${path}`;
  let lastErr;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res;
    try {
      // Node 20 (the runtime this is deployed on) has global fetch - no extra dependency needed.
      // A real User-Agent header matters here - NHL's API has been observed
      // rate-limiting/blocking requests with no UA or a generic one.
      res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'DraftCreaseBot/1.0 (+https://draftcrease.com)' },
      });
    } catch (err) {
      // Network error or timeout (AbortError) - both are worth retrying.
      lastErr = err;
      clearTimeout(timer);
      if (attempt < MAX_RETRIES) {
        await sleep(Math.min(500 * 2 ** attempt, 8000));
        continue;
      }
      throw new Error(`NHL API ${path} -> ${err.name}: ${err.message} (gave up after ${attempt + 1} attempts)`);
    }
    clearTimeout(timer);

    if (res.status === 429 || res.status === 503) {
      // Rate limited or transiently unavailable - back off and retry.
      // Respect Retry-After if NHL sends one; otherwise exponential backoff + jitter.
      lastErr = new Error(`NHL API ${path} -> ${res.status} ${res.statusText}`);
      if (attempt < MAX_RETRIES) {
        const retryAfterHeader = Number(res.headers.get('retry-after'));
        const backoffMs = Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
          ? retryAfterHeader * 1000
          : Math.min(500 * 2 ** attempt, 8000) + Math.random() * 250;
        await sleep(backoffMs);
        continue;
      }
      throw new Error(`NHL API ${path} -> ${res.status} ${res.statusText} (gave up after ${attempt + 1} attempts)`);
    }

    if (!res.ok) {
      throw new Error(`NHL API ${path} -> ${res.status} ${res.statusText}`);
    }
    return await res.json();
  }

  // Unreachable in practice (every branch above returns or throws), but keeps
  // the function's return type honest if MAX_RETRIES were ever set to -1.
  throw lastErr || new Error(`NHL API ${path} -> exhausted retries`);
}

/** Get a team's current roster: { forwards, defensemen, goalies }, each an array of skater objects. */
function getTeamRoster(teamCode) {
  return fetchJson(`/v1/roster/${teamCode}/current`);
}

/** Get a player's game log for the current season ("now" resolves the right season/game-type server-side). */
function getPlayerGameLogNow(playerId) {
  return fetchJson(`/v1/player/${playerId}/game-log/now`);
}

/**
 * Get a player's game log for an explicit season + game type.
 * @param season number - YYYYYYYY format, e.g. 20242025
 * @param gameType number - 2 = regular season, 3 = playoffs
 */
function getPlayerGameLog(playerId, season, gameType = 2) {
  return fetchJson(`/v1/player/${playerId}/game-log/${season}/${gameType}`);
}

/** Get a player's bio/landing info (headshot, current team, etc). Used sparingly - one extra call per player. */
function getPlayerLanding(playerId) {
  return fetchJson(`/v1/player/${playerId}/landing`);
}

/** Parse NHL's "MM:SS" time-on-ice string into decimal minutes. Returns 0 for missing/malformed input. */
function toiToMinutes(toiStr) {
  if (!toiStr || typeof toiStr !== 'string' || !toiStr.includes(':')) return 0;
  const [mm, ss] = toiStr.split(':').map(Number);
  if (Number.isNaN(mm) || Number.isNaN(ss)) return 0;
  return mm + ss / 60;
}

/** Flatten the roster response into a single array of { id, firstName, lastName, positionCode, ... }. */
function flattenRoster(roster, { includeGoalies = false } = {}) {
  const groups = includeGoalies
    ? [...(roster.forwards || []), ...(roster.defensemen || []), ...(roster.goalies || [])]
    : [...(roster.forwards || []), ...(roster.defensemen || [])];
  return groups;
}

module.exports = {
  NHL_BASE,
  TEAM_CODES,
  fetchJson,
  getTeamRoster,
  getPlayerGameLogNow,
  getPlayerGameLog,
  getPlayerLanding,
  toiToMinutes,
  flattenRoster,
};
