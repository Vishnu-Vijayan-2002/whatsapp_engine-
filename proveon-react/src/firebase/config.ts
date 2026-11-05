import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getAuth, type Auth } from 'firebase/auth';
import { getAnalytics, isSupported, type Analytics } from 'firebase/analytics';

// Live Firebase configuration for whats-14dec
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyBdvAMyj6A0Q7E0yN0ADYdZvRJn6bs59Vk',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'whats-14dec.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'whats-14dec',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'whats-14dec.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '614275332975',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:614275332975:web:197dda5867aa6da833869a',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-Z3TLWVB1BL',
};

export const isLiveFirebaseConfigured = true;

let app: FirebaseApp;
let db: Firestore;
let auth: Auth;
let analytics: Analytics | undefined;

if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

db = getFirestore(app);
auth = getAuth(app);

// Safe Analytics initialization for browser runtime
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  }).catch(() => {
    // Analytics optional in restricted environments
  });
}

export { app, db, auth, analytics, firebaseConfig };
