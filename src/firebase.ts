/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

let app: any;
let db: any;
let auth: any;

try {
  app = initializeApp(firebaseConfig);
  // Init firestore with the custom databaseId provided by the platform config
  db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  auth = getAuth();
  
  async function testConnection() {
    try {
      await getDocFromServer(doc(db, 'test', 'connection'));
    } catch (error) {
      if (error instanceof Error && error.message.includes('the client is offline')) {
        console.warn("Firebase direct connection is in fallback mode. Offline storage might be used.");
      }
    }
  }
  
  testConnection();
} catch (error) {
  console.warn('Firebase initialization failed - running in offline mode:', error);
  // Mock exports for offline mode
  db = null;
  auth = null;
}

export { db, auth };
