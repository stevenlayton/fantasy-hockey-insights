// Client-side Firebase init. This app ONLY reads from Firestore - all
// writes happen server-side in Cloud Functions via the Admin SDK, which
// bypasses these rules entirely (see /firestore.rules). It is safe for
// this config to be public; Firebase web API keys are not secrets, they
// just identify which project to talk to. Real protection comes from
// firestore.rules (read-only for everyone) and Firebase App Check
// (recommended follow-up, see README roadmap).
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

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
