import { ConveyorState } from '../types';

export interface LiveConveyorSyncState {
  running: boolean;
  haltedByDetection: boolean;
  eStop: boolean;
  speedPwm: number;
  speedRpm?: number;
  speedMps?: number;
  direction: 'forward' | 'reverse';
  autoStopOnMetal: boolean;
  isMetalDetected: boolean;
  currentSignal?: number;
  action?: string;
  updatedAt?: number;
  operatorUid?: string;
}

export type CrossTabMessage =
  | {
      type: 'CONVEYOR_STATE_UPDATE';
      stationId: string;
      senderTabId: string;
      state: LiveConveyorSyncState;
    }
  | {
      type: 'CONVEYOR_RESUMED';
      stationId: string;
      senderTabId: string;
    };

const CURRENT_TAB_ID = 'tab_' + Math.random().toString(36).substring(2, 9);

let broadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel('esp8266_conveyor_sync_channel');
  }
} catch {
  broadcastChannel = null;
}

/**
 * Broadcast live conveyor state across browser tabs instantly with zero latency
 */
export function broadcastLiveConveyorState(stationId: string, state: LiveConveyorSyncState): void {
  if (!broadcastChannel) return;
  try {
    broadcastChannel.postMessage({
      type: 'CONVEYOR_STATE_UPDATE',
      stationId,
      senderTabId: CURRENT_TAB_ID,
      state,
    } as CrossTabMessage);
  } catch (err) {
    console.warn('Cross-tab broadcast warning:', err);
  }
}

/**
 * Broadcast explicit conveyor resumption notification
 */
export function broadcastConveyorResumed(stationId: string): void {
  if (!broadcastChannel) return;
  try {
    broadcastChannel.postMessage({
      type: 'CONVEYOR_RESUMED',
      stationId,
      senderTabId: CURRENT_TAB_ID,
    } as CrossTabMessage);
  } catch (err) {
    console.warn('Cross-tab broadcast warning:', err);
  }
}

/**
 * Listen for conveyor changes from other tabs in the same browser
 */
export function subscribeToCrossTabConveyor(
  stationId: string,
  onStateUpdate: (state: LiveConveyorSyncState) => void,
  onResumed?: () => void
): () => void {
  if (!broadcastChannel) return () => {};

  const handleMessage = (evt: MessageEvent<CrossTabMessage>) => {
    const data = evt.data;
    if (!data || data.senderTabId === CURRENT_TAB_ID) return;
    if (data.stationId !== stationId) return;

    if (data.type === 'CONVEYOR_STATE_UPDATE') {
      onStateUpdate(data.state);
    } else if (data.type === 'CONVEYOR_RESUMED') {
      onResumed?.();
    }
  };

  broadcastChannel.addEventListener('message', handleMessage);
  return () => {
    broadcastChannel?.removeEventListener('message', handleMessage);
  };
}
