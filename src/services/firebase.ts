import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  writeBatch,
  onSnapshot,
  query,
  orderBy,
  limit,
  getDocFromServer,
  Unsubscribe,
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { DetectionEvent, ProductionCounters, CheckpointStation } from '../types';
import { LiveConveyorSyncState } from './crossTabSync';

export const DEFAULT_STATIONS: CheckpointStation[] = [
  {
    id: 'main_gate',
    name: 'Main Gate Checkpoint',
    stationType: 'physical',
    operatorName: 'Campus Security',
    description: 'Primary security lane for physical ESP8266 + LJ12A3 rig',
  },
  {
    id: 'demo_sandbox',
    name: 'Interactive Virtual Demo',
    stationType: 'virtual',
    operatorName: 'Guest Inspector',
    description: 'Isolated sandbox for autonomous simulations and testing',
  },
  {
    id: 'lab_bench',
    name: 'Electronics Lab Bench',
    stationType: 'custom',
    operatorName: 'Engineering Lab',
    description: 'Secondary testing bench for calibration and sensor debugging',
  },
];

export function sanitizeStationId(raw: string): string {
  const sanitized = raw.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 48);
  return sanitized || 'main_gate';
}

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp({
  apiKey: firebaseConfig.apiKey,
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  storageBucket: firebaseConfig.storageBucket,
  messagingSenderId: firebaseConfig.messagingSenderId,
  appId: firebaseConfig.appId,
});

// Initialize Firestore with custom database ID if provided
export const db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Initialize Firebase Auth
export const auth = getAuth(app);

let currentUser: User | null = null;

// Auto sign-in anonymously for operator sessions with immediate guest fallback
export function initFirebaseAuth(onUserReady?: (user: User) => void): () => void {
  let isReadyCalled = false;

  const notifyReady = (u: User | { uid: string }) => {
    if (!isReadyCalled && onUserReady) {
      isReadyCalled = true;
      onUserReady(u as User);
    }
  };

  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      notifyReady(user);
    } else {
      try {
        const credential = await signInAnonymously(auth);
        currentUser = credential.user;
        notifyReady(credential.user);
      } catch (err) {
        console.warn('Firebase anonymous auth notice (using guest checkpoint session):', err);
        notifyReady({ uid: 'operator-' + Math.random().toString(36).substring(2, 8) } as User);
      }
    }
  });

  // Fast fallback timer: Ensure Firestore subscriptions start even if auth network request hangs
  setTimeout(() => {
    if (!isReadyCalled) {
      notifyReady({ uid: 'operator-checkpoint' } as User);
    }
  }, 1000);

  return unsubscribe;
}

export function getCurrentUserUid(): string {
  return currentUser?.uid || auth.currentUser?.uid || 'operator-checkpoint';
}

// Test connectivity as specified in guidelines
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'checkpoint_stats', 'main_checkpoint'));
    return true;
  } catch (error: any) {
    console.warn('Firestore connection check notice:', error?.message || error);
    return false;
  }
}

// Real-time listener for baggage screening events for a specific station
export function subscribeToScreeningEvents(
  stationId: string,
  onUpdate: (events: DetectionEvent[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const sId = sanitizeStationId(stationId);
  const eventsRef = collection(db, 'stations', sId, 'screening_events');
  const q = query(eventsRef, orderBy('createdAt', 'desc'), limit(100));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: DetectionEvent[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        items.push({
          id: data.id || docSnap.id,
          timestamp: data.timestamp,
          signalStrength: data.signalStrength,
          threshold: data.threshold,
          conveyorSpeedPwm: data.conveyorSpeedPwm,
          rejected: data.rejected,
          materialClassification: data.materialClassification,
        });
      });
      onUpdate(items);
    },
    (err) => {
      console.warn(`Firestore screening_events subscription notice [${sId}]:`, err.message);
      if (onError) onError(err);
    }
  );
}

// Add a metal alert screening event for a specific station
export async function saveScreeningEventToCloud(stationId: string, event: DetectionEvent): Promise<void> {
  try {
    const sId = sanitizeStationId(stationId);
    const userUid = getCurrentUserUid();
    const eventDocRef = doc(db, 'stations', sId, 'screening_events', event.id);
    await setDoc(eventDocRef, {
      id: event.id,
      timestamp: event.timestamp,
      createdAt: Date.now(),
      signalStrength: event.signalStrength,
      threshold: event.threshold,
      conveyorSpeedPwm: event.conveyorSpeedPwm,
      rejected: event.rejected,
      materialClassification: event.materialClassification,
      operatorUid: userUid,
    });
  } catch (err) {
    console.warn('Could not save screening event to Firestore:', err);
  }
}

// Delete an individual screening event for a specific station
export async function deleteScreeningEventFromCloud(stationId: string, eventId: string): Promise<void> {
  try {
    const sId = sanitizeStationId(stationId);
    await deleteDoc(doc(db, 'stations', sId, 'screening_events', eventId));
  } catch (err) {
    console.warn('Could not delete event from Firestore:', err);
  }
}

// Clear all current events for a specific station from cloud
export async function clearAllScreeningEventsFromCloud(stationId: string, eventIds?: string[]): Promise<void> {
  try {
    const sId = sanitizeStationId(stationId);
    const eventsRef = collection(db, 'stations', sId, 'screening_events');
    const snapshot = await getDocs(eventsRef);
    if (!snapshot.empty) {
      const batch = writeBatch(db);
      snapshot.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      await batch.commit();
    }
  } catch (err) {
    console.warn('Could not clear all events via batch from Firestore:', err);
    if (eventIds && eventIds.length > 0) {
      const sId = sanitizeStationId(stationId);
      await Promise.all(
        eventIds.map((id) => deleteDoc(doc(db, 'stations', sId, 'screening_events', id)).catch(() => {}))
      );
    }
  }
}

// Real-time listener for checkpoint statistics for a specific station
export function subscribeToCheckpointStats(
  stationId: string,
  onUpdate: (stats: ProductionCounters) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const sId = sanitizeStationId(stationId);
  const statsDocRef = doc(db, 'stations', sId, 'checkpoint_stats', 'main_checkpoint');

  return onSnapshot(
    statsDocRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        onUpdate({
          totalPassed: data.totalPassed || 0,
          cleanPassed: data.cleanPassed || 0,
          metalDetected: data.metalDetected || 0,
          currentBatch: data.currentBatch || 0,
          batchTarget: data.batchTarget || 100,
          itemsPerMin: data.itemsPerMin || 0,
        });
      }
    },
    (err) => {
      console.warn(`Firestore checkpoint_stats subscription notice [${sId}]:`, err.message);
      if (onError) onError(err);
    }
  );
}

// Save or sync checkpoint statistics for a specific station to cloud
let saveStatsTimeout: NodeJS.Timeout | null = null;
export function saveCheckpointStatsToCloud(stationId: string, counters: ProductionCounters, immediate = false): void {
  const performSave = async () => {
    try {
      const sId = sanitizeStationId(stationId);
      const userUid = getCurrentUserUid();
      const statsDocRef = doc(db, 'stations', sId, 'checkpoint_stats', 'main_checkpoint');
      await setDoc(
        statsDocRef,
        {
          totalPassed: counters.totalPassed,
          cleanPassed: counters.cleanPassed,
          metalDetected: counters.metalDetected,
          currentBatch: counters.currentBatch,
          batchTarget: counters.batchTarget,
          itemsPerMin: counters.itemsPerMin,
          updatedAt: Date.now(),
          operatorUid: userUid,
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('Could not save checkpoint stats to Firestore:', err);
    }
  };

  if (immediate) {
    if (saveStatsTimeout) clearTimeout(saveStatsTimeout);
    performSave();
  } else {
    if (saveStatsTimeout) clearTimeout(saveStatsTimeout);
    saveStatsTimeout = setTimeout(performSave, 800);
  }
}

// Save/update station metadata in Firestore
export async function saveStationProfileToCloud(station: CheckpointStation): Promise<void> {
  try {
    const sId = sanitizeStationId(station.id);
    const userUid = getCurrentUserUid();
    const stationDocRef = doc(db, 'stations', sId);
    await setDoc(
      stationDocRef,
      {
        id: sId,
        name: station.name,
        stationType: station.stationType,
        operatorName: station.operatorName,
        updatedAt: Date.now(),
        operatorUid: userUid,
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Could not save station profile to Firestore:', err);
  }
}

// Subscribe to all registered stations
export function subscribeToStationProfiles(
  onUpdate: (stations: CheckpointStation[]) => void
): Unsubscribe {
  const stationsRef = collection(db, 'stations');
  return onSnapshot(
    stationsRef,
    (snapshot) => {
      const list: CheckpointStation[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: data.id || docSnap.id,
          name: data.name || docSnap.id,
          stationType: data.stationType || 'custom',
          operatorName: data.operatorName || 'Operator',
        });
      });
      if (list.length > 0) {
        onUpdate(list);
      }
    },
    (err) => {
      console.warn('Stations list subscription notice:', err.message);
    }
  );
}

// Delete / archive a station profile from Firestore (Admin only)
export async function deleteStationProfileFromCloud(stationId: string): Promise<void> {
  try {
    const sId = sanitizeStationId(stationId);
    await deleteDoc(doc(db, 'stations', sId));
  } catch (err) {
    console.warn('Could not delete station profile from Firestore:', err);
  }
}

// Live Conveyor State Synchronization for multi-tab and remote observers
let saveConveyorTimeout: NodeJS.Timeout | null = null;
export async function saveConveyorStateToCloud(
  stationId: string,
  state: Partial<LiveConveyorSyncState>,
  immediate = false
): Promise<void> {
  const performSave = async () => {
    try {
      const sId = sanitizeStationId(stationId);
      const userUid = getCurrentUserUid();
      const conveyorDocRef = doc(db, 'stations', sId, 'conveyor_state', 'live');
      await setDoc(
        conveyorDocRef,
        {
          running: Boolean(state.running),
          haltedByDetection: Boolean(state.haltedByDetection),
          eStop: Boolean(state.eStop),
          speedPwm: typeof state.speedPwm === 'number' ? state.speedPwm : 175,
          speedRpm: typeof state.speedRpm === 'number' ? state.speedRpm : Math.round(((state.speedPwm ?? 175) / 255) * 210),
          speedMps: typeof state.speedMps === 'number' ? state.speedMps : Number((((state.speedPwm ?? 175) / 255) * 0.55).toFixed(2)),
          direction: state.direction === 'reverse' ? 'reverse' : 'forward',
          autoStopOnMetal: typeof state.autoStopOnMetal === 'boolean' ? state.autoStopOnMetal : true,
          isMetalDetected: Boolean(state.isMetalDetected),
          currentSignal: typeof state.currentSignal === 'number' ? state.currentSignal : 180,
          action: state.action || 'update',
          updatedAt: Date.now(),
          operatorUid: userUid,
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('Could not save conveyor state to Firestore:', err);
    }
  };

  if (immediate) {
    if (saveConveyorTimeout) clearTimeout(saveConveyorTimeout);
    await performSave();
  } else {
    if (saveConveyorTimeout) clearTimeout(saveConveyorTimeout);
    saveConveyorTimeout = setTimeout(performSave, 200);
  }
}

export function subscribeToConveyorState(
  stationId: string,
  onUpdate: (state: LiveConveyorSyncState) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const sId = sanitizeStationId(stationId);
  const conveyorDocRef = doc(db, 'stations', sId, 'conveyor_state', 'live');

  return onSnapshot(
    conveyorDocRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        onUpdate({
          running: Boolean(data.running),
          haltedByDetection: Boolean(data.haltedByDetection),
          eStop: Boolean(data.eStop),
          speedPwm: typeof data.speedPwm === 'number' ? data.speedPwm : 175,
          speedRpm: typeof data.speedRpm === 'number' ? data.speedRpm : 145,
          speedMps: typeof data.speedMps === 'number' ? data.speedMps : 0.38,
          direction: data.direction === 'reverse' ? 'reverse' : 'forward',
          autoStopOnMetal: typeof data.autoStopOnMetal === 'boolean' ? data.autoStopOnMetal : true,
          isMetalDetected: Boolean(data.isMetalDetected),
          currentSignal: typeof data.currentSignal === 'number' ? data.currentSignal : undefined,
          action: data.action,
          updatedAt: data.updatedAt,
          operatorUid: data.operatorUid,
        });
      }
    },
    (err) => {
      console.warn(`Firestore conveyor_state subscription notice [${sId}]:`, err.message);
      if (onError) onError(err);
    }
  );
}
