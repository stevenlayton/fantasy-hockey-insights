import { useEffect, useState, useCallback } from 'react';

const SETTINGS_KEY = 'draftcrease:leagueSettings';

const DEFAULT_TARGETS = { C: 2, L: 2, R: 2, D: 4, G: 2 };

function readTargets() {
  if (typeof window === 'undefined') return DEFAULT_TARGETS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object') return DEFAULT_TARGETS;
    return { ...DEFAULT_TARGETS, ...parsed };
  } catch {
    return DEFAULT_TARGETS;
  }
}

function writeTargets(targets) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(targets));
  } catch {
    // localStorage can throw in private browsing / storage-full states.
    // Failing silently just means the custom targets won't persist across reloads.
  }
}

/**
 * Lets a user customize their league's roster requirements (how many
 * centers, wingers, and defensemen a full roster needs) so My Team's
 * "filled vs needed" indicators match their actual league instead of a
 * hardcoded assumption. Saved to this browser only, same as the roster
 * itself - there are no accounts to sync settings across devices.
 */
export function useLeagueSettings() {
  const [targets, setTargets] = useState(() => readTargets());

  useEffect(() => writeTargets(targets), [targets]);

  const setTarget = useCallback((position, value) => {
    const clamped = Math.max(0, Math.min(12, Number(value) || 0));
    setTargets((prev) => ({ ...prev, [position]: clamped }));
  }, []);

  const resetTargets = useCallback(() => {
    setTargets(DEFAULT_TARGETS);
  }, []);

  return { targets, setTarget, resetTargets };
}
