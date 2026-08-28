import { useEffect, useState, useCallback } from 'react';

const TEAM_KEY = 'draftcrease:myTeam';
const DRAFTED_KEY = 'draftcrease:draftedElsewhere';

function readIds(key) {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeIds(key, ids) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // localStorage can throw in private browsing / storage-full states.
    // Failing silently just means the list won't persist across reloads.
  }
}

/**
 * Your fantasy roster ("myTeam") and the list of players drafted by someone
 * else ("draftedElsewhere"), both stored only in this browser's localStorage.
 *
 * DraftCrease has no user accounts, so there's nothing to sync across
 * devices - this is intentionally a lightweight, no-login tool. Clearing
 * browser data (or using a different browser/device) clears these lists.
 */
export function useMyRoster() {
  const [myTeam, setMyTeam] = useState(() => readIds(TEAM_KEY));
  const [draftedElsewhere, setDraftedElsewhere] = useState(() => readIds(DRAFTED_KEY));

  useEffect(() => writeIds(TEAM_KEY, myTeam), [myTeam]);
  useEffect(() => writeIds(DRAFTED_KEY, draftedElsewhere), [draftedElsewhere]);

  const addToMyTeam = useCallback((playerId) => {
    setMyTeam((prev) => (prev.includes(playerId) ? prev : [...prev, playerId]));
    setDraftedElsewhere((prev) => prev.filter((id) => id !== playerId));
  }, []);

  const removeFromMyTeam = useCallback((playerId) => {
    setMyTeam((prev) => prev.filter((id) => id !== playerId));
  }, []);

  const markDraftedElsewhere = useCallback((playerId) => {
    setDraftedElsewhere((prev) => (prev.includes(playerId) ? prev : [...prev, playerId]));
  }, []);

  const undraft = useCallback((playerId) => {
    setMyTeam((prev) => prev.filter((id) => id !== playerId));
    setDraftedElsewhere((prev) => prev.filter((id) => id !== playerId));
  }, []);

  const resetDraft = useCallback(() => {
    setMyTeam([]);
    setDraftedElsewhere([]);
  }, []);

  return {
    myTeam,
    draftedElsewhere,
    addToMyTeam,
    removeFromMyTeam,
    markDraftedElsewhere,
    undraft,
    resetDraft,
  };
}
