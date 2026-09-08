export type ConnectionType = 'simulation' | 'serial' | 'wifi_http';

export type SystemInterlockMode = 
  | 'auto_stop_inspect' // Standard for school/lab projects: Belt halts immediately when metal is detected for manual inspection
  | 'relay_alarm_lamp'  // Relay switches a 12V warning beacon/lamp/buzzer
  | 'actuator_pusher';  // Optional mechanical pusher (if equipped)

export type RejectorType = 'relay_alarm_lamp' | 'auto_halt_inspect' | 'pneumatic_pusher' | 'diverter_arm';

export type RelayLogic = 'active_low' | 'active_high';

export interface ConveyorState {
  running: boolean;
  direction: 'forward' | 'reverse';
  speedPwm: number; // 0 - 255 to L298N ENA
  rpm: number;
  linearSpeedMps: number; // m/s
  eStop: boolean;
  autoStopOnMetal: boolean;
  haltedByDetection: boolean; // Indicates belt stopped because metal was found
}

export interface MetalSensorState {
  model: 'LJ12A3-4-Z/BX';
  currentSignal: number; // 0 - 1023 (or scaled ADC)
  baseline: number;
  threshold: number; // 0 - 1023
  isMetalDetected: boolean;
  peakSignal: number;
  frequencyHz: number;
  filterMode: 'raw' | 'moving_avg' | 'peak_hold';
  autoZero: boolean;
  debounceMs: number;
  sensingDistanceMm: number; // standard 4mm
  logicType: 'NPN_NO' | 'PNP_NO';
  stepperMethod: 'voltage_divider' | 'level_shifter';
}

export interface RejectorState {
  type: RejectorType;
  relayLogic: RelayLogic;
  autoReject: boolean;
  delayMs: number; // travel delay from sensor to reject station
  pulseDurationMs: number; // how long actuator extends
  isActive: boolean; // currently actuating
  rejectCount: number;
}

export interface ProductionCounters {
  totalPassed: number;
  metalDetected: number;
  cleanPassed: number;
  currentBatch: number;
  batchTarget: number;
  itemsPerMin: number;
}

export interface DetectionEvent {
  id: string;
  timestamp: string;
  signalStrength: number;
  threshold: number;
  conveyorSpeedPwm: number;
  rejected: boolean;
  materialClassification: string;
}

export interface SerialLogEntry {
  id: string;
  timestamp: string;
  direction: 'in' | 'out' | 'system';
  message: string;
}

export interface ConveyorItem {
  id: string;
  type: 'clear_bag' | 'bag_with_metal' | 'pencil_case_tools' | 'flagged_backpack';
  position: number; // 0 to 100% along the belt
  hasMetal: boolean;
  metalMass: number; // determines peak signal
  detected: boolean;
  rejectScheduledAt?: number;
  rejected?: boolean;
}

export interface HardwareConfig {
  connectionType: ConnectionType;
  ipAddress: string;
  port: number;
  baudRate: number;
  connected: boolean;
  lastPingMs: number;
  boardName: string;
  firmwareVersion: string;
  sensorModel: string;
  motorDriver: string;
}

export interface CheckpointStation {
  id: string;
  name: string;
  stationType: 'physical' | 'virtual' | 'custom';
  operatorName: string;
  description?: string;
}
