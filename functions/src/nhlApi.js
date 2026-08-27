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

async function fetchJson(path, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const url = `${NHL_BASE}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // Node 20 (the runtime this is deployed on) has global fetch - no extra dependency needed.
  const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`NHL API ${path} -> ${res.status} ${res.statusText}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
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
