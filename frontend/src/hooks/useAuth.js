import { useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';

/**
 * Thin wrapper around Firebase Auth for DraftCrease's optional Google
 * sign-in.
 *
 * DraftCrease works fully without an account - a signed-out visitor's
 * roster and league settings are saved only to that browser's
 * localStorage, exactly as before this feature existed. Signing in with
 * Google additionally syncs those same two things (roster and league
 * settings) to Firestore under users/{uid}, so they follow the person to
 * any other browser or device they sign into. See useMyRoster.js and
 * useLeagueSettings.js for exactly how that sync works, and firestore.rules
 * for the security rule that only allows a signed-in user to read or
 * write their own users/{uid} document.
 */
export function useAuth() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthLoading(false);
    });
  }, []);

  const signIn = useCallback(async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      // The most common cause by far is the person closing the popup
      // themselves. That is not an error worth surfacing in the UI, so
      // just log it and leave them signed out.
      console.warn('Google sign-in did not complete:', err?.message || err);
    }
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
  }, []);

  return { user, authLoading, signIn, signOut };
}
