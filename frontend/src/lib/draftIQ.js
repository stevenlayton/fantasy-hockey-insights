// Draft IQ engine
//
// A single, deterministic 0-100 signal for how good a pick is right now,
// combining five real, calculated sub-scores. Nothing here is generated
// or judged by an AI model - every sub-score is a plain arithmetic
// function of real inputs already in the player pool, the drafted state,
// and (optionally) the user's own roster targets. See README.md "Key
// decisions: deterministic, not LLM-generated, explanations" for why.
//
// Draft IQ changes live as a mock draft progresses: Team Fit and
// Scarcity both depend on who has been drafted so far, so the same
// player's score can (and should) move as the board fills in.

// ===== Tunable constants =====

// How the five sub-scores combine into one 0-100 Draft IQ score. The
// first four weight the score upward; risk is subtracted (a higher risk
// score pulls the final number down), which is why it is applied with a
// minus sign in computeDraftIQForPool below rather than summed the same
// way as the others. All five weights sum to 1 so the result stays on a
// roughly 0-100 scale before clamping.
export const DRAFT_IQ_WEIGHTS = Object.freeze({
  value: 0.30,
  teamFit: 0.15,
  scarcity: 0.15,
  upside: 0.20,
  risk: 0.20,
});

// How many undrafted players at a position still need to remain on the
// board before that position stops being considered scarce. A typical
// 12-team league needs roughly this many startable players at a
// position in circulation at once; fewer than this and Scarcity climbs
// toward 100.
export const SCARCITY_REFERENCE_COUNT = 24;

// TrendBadge's underlying score field is a small-magnitude number
// (typically -2..2) representing recent-vs-season performance swing.
// These floor/ceiling values map that range onto the 0-100 Upside
// scale; see components/TrendBadge.jsx for the same scale used there.
export const UPSIDE_SCORE_FLOOR = -2;
export const UPSIDE_SCORE_CEILING = 2;

// A full, healthy season games-played reference used only for the Risk
// sub-score: a skater or goalie who played far fewer games than this
// last season is a bigger unknown (new role, missed time, late call-up,
// etc), even though the public NHL API does not expose real injury data
// (confirmed during an earlier investigation - see README). Mirrors the
// same PROJECTED_SEASON_GAMES / PROJECTED_GOALIE_GAMES assumptions used
// elsewhere in the app.
export const RISK_REFERENCE_SKATER_GAMES = 82;
export const RISK_REFERENCE_GOALIE_GAMES = 55;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// ===== Sub-score formulas =====
// Each returns a 0-100 number from plain numeric inputs, with no
// lookups or side effects, so each is easy to unit test or tune on its
// own separate from the pooling logic below.

// Value: how strong is this player's own projection relative to
// everyone else at their exact position (C/L/R/D/G kept separate, same
// grouping the site's own positionRank already uses). A player near the
// top of a deep position pool scores near 100; the last player at a
// position scores near 0.
export function computeValue(positionRank, totalAtPosition) {
  if (!totalAtPosition || totalAtPosition <= 1) return 50;
  return clamp(100 * (1 - (positionRank - 1) / (totalAtPosition - 1)), 0, 100);
}

// Team Fit: does this team still need this position? 100 means the
// team has zero of a position it wants target of; 0 means the team
// already has at least as many as its target (still draftable, just no
// longer a fit priority). A target of 0 (a position the user has not
// set a target for) returns a neutral 50 so Draft IQ does not zero out
// positions nobody has configured.
export function computeTeamFit(currentCount, target) {
  if (!target) return 50;
  return clamp(100 * (1 - currentCount / target), 0, 100);
}

// Scarcity: how thin is the remaining undrafted pool at this position
// right now, relative to SCARCITY_REFERENCE_COUNT. Fewer undrafted
// players left pushes this toward 100 - draft them now, they may not
// be there next round.
export function computeScarcity(undraftedCountAtPosition) {
  return clamp(100 * (1 - undraftedCountAtPosition / SCARCITY_REFERENCE_COUNT), 0, 100);
}

// Upside: maps the existing Pickup/Drop trend score (see
// functions/src/scoring.js) onto 0-100. A player with no trend data yet
// (hasTrendData === false, e.g. during the off-season) is treated as
// neutral (50) rather than being penalized for a stat that has simply
// not populated yet.
export function computeUpside(score, hasTrendData) {
  if (!hasTrendData || score === undefined || score === null) return 50;
  const span = UPSIDE_SCORE_CEILING - UPSIDE_SCORE_FLOOR;
  return clamp((100 * (score - UPSIDE_SCORE_FLOOR)) / span, 0, 100);
}

// Risk: fewer games played last season than a full healthy season (see
// RISK_REFERENCE_*_GAMES above) means less recent data to trust this
// projection on, so risk climbs as gamesPlayed drops.
export function computeRisk(gamesPlayed, isGoalie) {
  const reference = isGoalie ? RISK_REFERENCE_GOALIE_GAMES : RISK_REFERENCE_SKATER_GAMES;
  if (!reference) return 50;
  return clamp(100 * (1 - (gamesPlayed || 0) / reference), 0, 100);
}

// ===== Pool-level computation =====

// Computes Draft IQ for an entire player pool in one efficient pass.
// Everything that would otherwise need to be recomputed per player
// (position totals, undrafted-by-position counts) is precomputed once
// up front, so this stays O(n) overall rather than O(n^2) for a
// several-hundred-player pool.
export function computeDraftIQForPool(pool, draftedIds, rosterCounts, targets) {
  const draftedSet = new Set(draftedIds || []);

  const totalAtPosition = {};
  const undraftedAtPosition = {};
  for (const p of pool) {
    totalAtPosition[p.position] = (totalAtPosition[p.position] || 0) + 1;
    if (!draftedSet.has(p.playerId)) {
      undraftedAtPosition[p.position] = (undraftedAtPosition[p.position] || 0) + 1;
    }
  }

  const result = new Map();
  for (const p of pool) {
    const isGoalie = p.position === 'G';
    const value = computeValue(p.positionRank, totalAtPosition[p.position]);
    const teamFit = computeTeamFit(
      (rosterCounts && rosterCounts[p.position]) || 0,
      (targets && targets[p.position]) || 0
    );
    const scarcity = computeScarcity(undraftedAtPosition[p.position] || 0);
    const upside = computeUpside(p.score, p.hasTrendData);
    const risk = computeRisk(p.gamesPlayed, isGoalie);

    const w = DRAFT_IQ_WEIGHTS;
    const rawScore =
      value * w.value + teamFit * w.teamFit + scarcity * w.scarcity + upside * w.upside - risk * w.risk;
    const score = Math.round(clamp(rawScore, 0, 100));

    result.set(p.playerId, { score, components: { value, teamFit, scarcity, upside, risk } });
  }
  return result;
}

// ===== Deterministic explanation =====

// Builds a short, template-based why string from the already-computed
// components above - never a live AI call (see README.md "Key
// decisions"). Leads with whichever factor is most notable, then adds
// the others as supporting detail, so the copy reads like a real
// scouting note rather than a dump of five numbers.
export function explainDraftIQ(player, components) {
  const { value, teamFit, scarcity, upside, risk } = components;
  const parts = [];

  if (value >= 70) {
    parts.push(`One of the stronger remaining ${player.position} options by projection.`);
  } else if (value <= 30) {
    parts.push(`A weaker projection relative to other ${player.position}s still available.`);
  }

  if (scarcity >= 70) {
    parts.push(`${player.position} is running thin on the board right now.`);
  }

  if (teamFit >= 70) {
    parts.push(`Fills a real need on your roster at ${player.position}.`);
  } else if (teamFit <= 20) {
    parts.push(`Your roster is already well stocked at ${player.position}.`);
  }

  if (upside >= 70) {
    parts.push('Trending up recently.');
  } else if (upside <= 30) {
    parts.push('Trending down recently.');
  }

  if (risk >= 60) {
    parts.push('Limited recent game data adds some uncertainty.');
  }

  if (parts.length === 0) {
    parts.push('A solid, unremarkable option at this point in the draft.');
  }

  return parts.join(' ');
}
