import { useEffect, useState, useCallback, useRef } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './useAuth';

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
 * centers, wingers, defensemen and goalies a full roster needs), instead
 * of a hardcoded assumption.
 *
 * Signed OUT (no Google account): saved to this browser's localStorage
 * only, exactly as DraftCrease always worked before optional accounts
 * existed.
 *
 * Signed IN (see hooks/useAuth.js): the same targets live in Firestore at
 * users/{uid}.leagueSettings, kept in sync in real time via onSnapshot, so
 * custom targets follow the person to any browser or device they sign
 * into. The first time a given account signs in with no Firestore
 * document yet, whatever is already in this browser's localStorage is
 * pushed up once as a starting point rather than being silently
 * discarded. This mirrors the exact same pattern used in useMyRoster.js -
 * see that file for a more detailed explanation of the suppressWrite ref
 * below, which just avoids writing back to Firestore the same data that
 * was JUST received from Firestore.
 */
export function useLeagueSettings() {
  const { user } = useAuth();
  const uid = user?.uid || null;

  const [targets, setTargets] = useState(() => readTargets());
  const suppressWrite = useRef(false);
  const hasSeeded = useRef(false);

  useEffect(() => {
    if (uid) return;
    writeTargets(targets);
  }, [uid, targets]);

  useEffect(() => {
    hasSeeded.current = false;
    if (!uid) return undefined;

    const ref = doc(db, 'users', uid);
    const unsub = onSnapshot(ref, (snap) => {
      const leagueSettings = snap.exists() ? snap.data().leagueSettings : null;
      if (leagueSettings) {
        suppressWrite.current = true;
        setTargets({ ...DEFAULT_TARGETS, ...leagueSettings });
      } else if (!hasSeeded.current) {
        hasSeeded.current = true;
        setDoc(ref, { leagueSettings: readTargets() }, { merge: true });
      }
    });
    return unsub;
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    if (suppressWrite.current) {
      suppressWrite.current = false;
      return;
    }
    setDoc(doc(db, 'users', uid), { leagueSettings: targets }, { merge: true });
  }, [uid, targets]);

  const setTarget = useCallback((position, value) => {
    const clamped = Math.max(0, Math.min(12, Number(value) || 0));
    setTargets((prev) => ({ ...prev, [position]: clamped }));
  }, []);

  const resetTargets = useCallback(() => {
    setTargets(DEFAULT_TARGETS);
  }, []);

  return { targets, setTarget, resetTargets };
}
