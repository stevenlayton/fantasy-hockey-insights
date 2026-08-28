import { useEffect, useState, useCallback, useRef } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './useAuth';
import { DEFAULT_SKATER_WEIGHTS, DEFAULT_GOALIE_WEIGHTS } from '../lib/leagueScoring';

const SCORING_KEY = 'draftcrease:leagueScoring';

function readWeights() {
  if (typeof window === 'undefined') return { skaterWeights: DEFAULT_SKATER_WEIGHTS, goalieWeights: DEFAULT_GOALIE_WEIGHTS };
  try {
    const raw = window.localStorage.getItem(SCORING_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object') {
      return { skaterWeights: DEFAULT_SKATER_WEIGHTS, goalieWeights: DEFAULT_GOALIE_WEIGHTS };
    }
    return {
      skaterWeights: { ...DEFAULT_SKATER_WEIGHTS, ...(parsed.skaterWeights || {}) },
      goalieWeights: { ...DEFAULT_GOALIE_WEIGHTS, ...(parsed.goalieWeights || {}) },
    };
  } catch {
    return { skaterWeights: DEFAULT_SKATER_WEIGHTS, goalieWeights: DEFAULT_GOALIE_WEIGHTS };
  }
}

function writeWeights(skaterWeights, goalieWeights) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SCORING_KEY, JSON.stringify({ skaterWeights, goalieWeights }));
  } catch {
    // localStorage can throw in private browsing / storage-full states.
    // Failing silently just means custom weights do not persist across
    // reloads for that visit, same tradeoff made in useLeagueSettings.js.
  }
}

/**
 * Lets a visitor plug in their own league's per-category point values (see
 * lib/leagueScoring.js for the formulas) instead of the site's one-size-
 * fits-all default ranking. Follows the exact same signed-in/signed-out
 * dual-mode sync pattern as useMyRoster.js and useLeagueSettings.js:
 *
 * Signed OUT: saved to this browser's localStorage only.
 *
 * Signed IN: the same weights live in Firestore at
 * users/{uid}.leagueScoring, kept in sync in real time via onSnapshot. The
 * first time a given account signs in with no Firestore document yet,
 * whatever is already in this browser's localStorage is pushed up once
 * rather than discarded.
 *
 * Two independent suppressWrite refs (one for skaterWeights, one for
 * goalieWeights) rather than one shared ref - see useMyRoster.js for why
 * a single shared flag would incorrectly skip only the first of two
 * simultaneous write-back effects and let the second slip through as a
 * redundant (if harmless) write.
 */
export function useLeagueScoring() {
  const { user } = useAuth();
  const uid = user?.uid || null;

  const initial = readWeights();
  const [skaterWeights, setSkaterWeights] = useState(initial.skaterWeights);
  const [goalieWeights, setGoalieWeights] = useState(initial.goalieWeights);
  const suppressSkaterWrite = useRef(false);
  const suppressGoalieWrite = useRef(false);
  const hasSeeded = useRef(false);

  useEffect(() => {
    if (uid) return;
    writeWeights(skaterWeights, goalieWeights);
  }, [uid, skaterWeights, goalieWeights]);

  useEffect(() => {
    hasSeeded.current = false;
    if (!uid) return undefined;

    const ref = doc(db, 'users', uid);
    const unsub = onSnapshot(ref, (snap) => {
      const leagueScoring = snap.exists() ? snap.data().leagueScoring : null;
      if (leagueScoring) {
        suppressSkaterWrite.current = true;
        setSkaterWeights({ ...DEFAULT_SKATER_WEIGHTS, ...(leagueScoring.skaterWeights || {}) });
        suppressGoalieWrite.current = true;
        setGoalieWeights({ ...DEFAULT_GOALIE_WEIGHTS, ...(leagueScoring.goalieWeights || {}) });
      } else if (!hasSeeded.current) {
        hasSeeded.current = true;
        const local = readWeights();
        setDoc(ref, { leagueScoring: local }, { merge: true });
      }
    });
    return unsub;
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    if (suppressSkaterWrite.current) {
      suppressSkaterWrite.current = false;
      return;
    }
    setDoc(doc(db, 'users', uid), { leagueScoring: { skaterWeights } }, { merge: true });
  }, [uid, skaterWeights]);

  useEffect(() => {
    if (!uid) return;
    if (suppressGoalieWrite.current) {
      suppressGoalieWrite.current = false;
      return;
    }
    setDoc(doc(db, 'users', uid), { leagueScoring: { goalieWeights } }, { merge: true });
  }, [uid, goalieWeights]);

  const setSkaterWeight = useCallback((category, value) => {
    setSkaterWeights((prev) => ({ ...prev, [category]: Number(value) || 0 }));
  }, []);

  const setGoalieWeight = useCallback((category, value) => {
    setGoalieWeights((prev) => ({ ...prev, [category]: Number(value) || 0 }));
  }, []);

  const resetWeights = useCallback(() => {
    setSkaterWeights(DEFAULT_SKATER_WEIGHTS);
    setGoalieWeights(DEFAULT_GOALIE_WEIGHTS);
  }, []);

  const isCustomized =
    JSON.stringify(skaterWeights) !== JSON.stringify(DEFAULT_SKATER_WEIGHTS) ||
    JSON.stringify(goalieWeights) !== JSON.stringify(DEFAULT_GOALIE_WEIGHTS);

  return { skaterWeights, goalieWeights, setSkaterWeight, setGoalieWeight, resetWeights, isCustomized };
}
