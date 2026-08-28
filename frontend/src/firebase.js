// Client-side Firebase init.
//
// Firestore: almost all data (players, scores, draftGuide, news,
// scoreboard, meta) is written exclusively by the Cloud Functions
// scheduled jobs using the Admin SDK, which bypasses firestore.rules
// entirely - the frontend only ever reads that data. The one exception is
// users/{uid}: if someone opts into Google sign-in (see hooks/useAuth.js),
// the frontend writes their own roster and league settings directly to
// their own document there, protected by firestore.rules so nobody can
// read or write anyone else's (request.auth.uid == uid). See
// hooks/useMyRoster.js and hooks/useLeagueSettings.js for how that sync
// works, and README.md for the full write-up.
//
// Auth: Google sign-in is entirely optional. Signed-out visitors get the
// exact same localStorage-only experience DraftCrease always had.
//
// It is safe for this config to be public; Firebase web API keys are not
// secrets, they just identify which project to talk to. Real protection
// comes from firestore.rules and Firebase App Check (recommended
// follow-up, see README roadmap).
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
