import { useEffect, useState, useCallback, useRef } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './useAuth';

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
 * else ("draftedElsewhere").
 *
 * Signed OUT (no Google account): stored only in this browser's
 * localStorage, exactly as DraftCrease always worked before optional
 * accounts existed. Nothing leaves the browser, and there is nothing to
 * sync across devices.
 *
 * Signed IN (see hooks/useAuth.js): the same two lists live in Firestore
 * at users/{uid}.myTeam and users/{uid}.draftedElsewhere, kept in sync in
 * real time via onSnapshot, so the roster follows the person to any
 * browser or device they sign into. The very first time a given account
 * signs in and has no Firestore document yet, whatever is already in this
 * browser's localStorage is pushed up once as a starting point (a
 * one-time "claim" of the local list) rather than being silently
 * discarded - see the seeded refs below. After that first seed, Firestore
 * is the source of truth while signed in, and localStorage is the source
 * of truth while signed out.
 *
 * The suppressTeamWrite / suppressDraftedWrite refs exist only to avoid a
 * pointless round trip: when a change arrives FROM Firestore (someone
 * else's tab, or another device), we set local state to match, and
 * without this flag that state change would immediately trigger writing
 * the exact same data straight back to Firestore.
 */
export function useMyRoster() {
  const { user } = useAuth();
  const uid = user?.uid || null;

  const [myTeam, setMyTeam] = useState(() => readIds(TEAM_KEY));
  const [draftedElsewhere, setDraftedElsewhere] = useState(() => readIds(DRAFTED_KEY));

  const suppressTeamWrite = useRef(false);
  const suppressDraftedWrite = useRef(false);
  const hasSeeded = useRef(false);

  // Signed-out mode: mirror state to localStorage, same as always.
  useEffect(() => {
    if (uid) return;
    writeIds(TEAM_KEY, myTeam);
  }, [uid, myTeam]);

  useEffect(() => {
    if (uid) return;
    writeIds(DRAFTED_KEY, draftedElsewhere);
  }, [uid, draftedElsewhere]);

  // Signed-in mode: subscribe to this account's Firestore document.
  useEffect(() => {
    hasSeeded.current = false;
    if (!uid) return undefined;

    const ref = doc(db, 'users', uid);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        suppressTeamWrite.current = true;
        setMyTeam(Array.isArray(data.myTeam) ? data.myTeam : []);
        suppressDraftedWrite.current = true;
        setDraftedElsewhere(Array.isArray(data.draftedElsewhere) ? data.draftedElsewhere : []);
      } else if (!hasSeeded.current) {
        hasSeeded.current = true;
        setDoc(
          ref,
          { myTeam: readIds(TEAM_KEY), draftedElsewhere: readIds(DRAFTED_KEY) },
          { merge: true }
        );
      }
    });
    return unsub;
  }, [uid]);

  // Signed-in mode: push local changes up to Firestore (skipped once for
  // whichever update just arrived FROM Firestore, see doc comment above).
  useEffect(() => {
    if (!uid) return;
    if (suppressTeamWrite.current) {
      suppressTeamWrite.current = false;
      return;
    }
    setDoc(doc(db, 'users', uid), { myTeam }, { merge: true });
  }, [uid, myTeam]);

  useEffect(() => {
    if (!uid) return;
    if (suppressDraftedWrite.current) {
      suppressDraftedWrite.current = false;
      return;
    }
    setDoc(doc(db, 'users', uid), { draftedElsewhere }, { merge: true });
  }, [uid, draftedElsewhere]);

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
