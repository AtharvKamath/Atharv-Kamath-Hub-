/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAnalytics, isSupported, Analytics } from 'firebase/analytics';
import firebaseConfig from '../firebase-applet-config.json';

export const OWNER_EMAIL = 'business.atharvk@gmail.com';

const app = initializeApp(firebaseConfig);

const databaseId = firebaseConfig.firestoreDatabaseId?.trim();
export const db =
  databaseId && databaseId !== '(default)'
    ? getFirestore(app, databaseId)
    : getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export { firebaseConfig };

let analyticsPromise: Promise<Analytics | null> | null = null;

export function getFirebaseAnalyticsInstance(): Promise<Analytics | null> {
  if (typeof window === 'undefined' || !firebaseConfig.measurementId) {
    return Promise.resolve(null);
  }
  if (!analyticsPromise) {
    analyticsPromise = isSupported()
      .then((supported) => (supported ? getAnalytics(app) : null))
      .catch(() => null);
  }
  return analyticsPromise;
}

export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

testConnection();
