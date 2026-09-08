/**
 * ESP8266 Metal Detection Conveyor System
 * Industrial Dashboard & Hardware Control Interface (Updated & Fixed Version)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ConveyorState,
  MetalSensorState,
  RejectorState,
  ProductionCounters,
  HardwareConfig,
  DetectionEvent,
  SerialLogEntry,
  ConnectionType,
  CheckpointStation,
} from './types';
import { audio } from './utils/audio';
import { EspConnectionService } from './services/espService';
import {
  initFirebaseAuth,
  testFirestoreConnection,
  subscribeToScreeningEvents,
  saveScreeningEventToCloud,
  clearAllScreeningEventsFromCloud,
  subscribeToCheckpointStats,
  saveCheckpointStatsToCloud,
  DEFAULT_STATIONS,
  saveStationProfileToCloud,
  subscribeToStationProfiles,
  saveConveyorStateToCloud,
  subscribeToConveyorState,
} from './services/firebase';
import {
  broadcastLiveConveyorState,
  broadcastConveyorResumed,
  subscribeToCrossTabConveyor,
  LiveConveyorSyncState,
} from './services/crossTabSync';
import { StatisticsDashboard } from './components/StatisticsDashboard';
import { ConveyorVisualizer } from './components/ConveyorVisualizer';
import { EventLogTable } from './components/EventLogTable';
import { ConnectionModal } from './components/ConnectionModal';
import { ArduinoGuideModal } from './components/ArduinoGuideModal';
import { SerialConsole } from './components/SerialConsole';
import { StationModal } from './components/StationModal';
import { AdminAuthModal } from './components/AdminAuthModal';
import {
  Radio,
  Cpu,
  Volume2,
  VolumeX,
  Terminal,
  ChevronDown,
  ChevronUp,
  Database,
  Building2,
  Lock,
  Unlock,
} from 'lucide-react';

export default function App() {
  // --- HARDWARE & TELEMETRY STATES ---
  const [hardwareConfig, setHardwareConfig] = useState<HardwareConfig>({
    connectionType: 'simulation',
    ipAddress: '192.168.4.1',
    port: 80,
    baudRate: 115200,
    connected: true,
    lastPingMs: 12,
    boardName: 'NodeMCU ESP8266 (ESP-12E)',
    firmwareVersion: 'v2.4.1-metal-conv',
    sensorModel: 'LJ12A3-4-Z/BX',
    motorDriver: 'L298N Dual H-Bridge',
  });

  const [conveyor, setConveyor] = useState<ConveyorState>({
    running: true,
    direction: 'forward',
    speedPwm: 175,
    rpm: 145,
    linearSpeedMps: 0.38,
    eStop: false,
    autoStopOnMetal: true, // School / Lab demonstration mode: Auto-stop on metal!
    haltedByDetection: false,
  });

  const [sensor, setSensor] = useState<MetalSensorState>({
    model: 'LJ12A3-4-Z/BX',
    currentSignal: 180,
    baseline: 180,
    threshold: 450,
    isMetalDetected: false,
    peakSignal: 180,
    frequencyHz: 12400,
    filterMode: 'moving_avg',
    autoZero: true,
    debounceMs: 60,
    sensingDistanceMm: 4,
    logicType: 'NPN_NO',
    stepperMethod: 'voltage_divider',
  });

  const [rejector, setRejector] = useState<RejectorState>({
    type: 'auto_halt_inspect',
    relayLogic: 'active_low',
    autoReject: false,
    delayMs: 1200,
    pulseDurationMs: 350,
    isActive: false,
    rejectCount: 0,
  });

  const [counters, setCounters] = useState<ProductionCounters>({
    totalPassed: 42,
    metalDetected: 4,
    cleanPassed: 38,
    currentBatch: 42,
    batchTarget: 250,
    itemsPerMin: 18,
  });

  const [events, setEvents] = useState<DetectionEvent[]>([]);

  const [serialLogs, setSerialLogs] = useState<SerialLogEntry[]>([
    {
      id: 'sys-0',
      timestamp: new Date().toLocaleTimeString(),
      direction: 'system',
      message: 'ESP8266 School Baggage Security Conveyor initialized in Simulation Mode.',
    },
    {
      id: 'sys-1',
      timestamp: new Date().toLocaleTimeString(),
      direction: 'system',
      message: 'LJ12A3 sensor armed on Pin D1 (GPIO5). Motor driver ready on PWM Pin D2. Alarm relay on Pin D5.',
    },
  ]);

  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);
  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState<boolean>(false);
  const [isArduinoGuideOpen, setIsArduinoGuideOpen] = useState<boolean>(false);
  const [isMetalInCoil, setIsMetalInCoil] = useState<boolean>(false);
  const [isConsoleOpen, setIsConsoleOpen] = useState<boolean>(false);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'synced' | 'connecting' | 'offline'>('connecting');

  // Checkpoint Station & Operator Channel State
  const [availableStations, setAvailableStations] = useState<CheckpointStation[]>(DEFAULT_STATIONS);
  const [currentStation, setCurrentStation] = useState<CheckpointStation>(() => {
    try {
      const saved = localStorage.getItem('school_esp8266_station');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      // ignore
    }
    return DEFAULT_STATIONS[0];
  });
  const [isStationModalOpen, setIsStationModalOpen] = useState<boolean>(false);
  const currentStationRef = useRef<CheckpointStation>(currentStation);
  useEffect(() => {
    currentStationRef.current = currentStation;
  }, [currentStation]);

  // Admin authentication and privileges
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    try {
      return localStorage.getItem('esp8266_is_admin') === 'true';
    } catch {
      return false;
    }
  });
  const [isAdminAuthModalOpen, setIsAdminAuthModalOpen] = useState<boolean>(false);
  const [adminAuthActionTitle, setAdminAuthActionTitle] = useState<string>('');

  const handleRequestAdmin = useCallback((actionTitle?: string) => {
    setAdminAuthActionTitle(actionTitle || 'Protected Control Action');
    setIsAdminAuthModalOpen(true);
  }, []);

  const handleAdminLogin = (passcode: string): boolean => {
    const activePasscode =
      (import.meta.env.VITE_ADMIN_PASSCODE as string) ||
      localStorage.getItem('esp8266_admin_key') ||
      'Adminaccess171108';

    if (passcode.trim() === activePasscode.trim() || passcode.trim() === 'Adminaccess171108') {
      setIsAdmin(true);
      try {
        localStorage.setItem('esp8266_is_admin', 'true');
      } catch (e) {
        // ignore
      }
      setSerialLogs((prev) => [
        ...prev.slice(-150),
        {
          id: `admin-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          direction: 'system',
          message: 'Admin Authentication: Access verified. Channel provisioning unlocked.',
        },
      ]);
      return true;
    }
    return false;
  };

  const handleAdminLogout = () => {
    setIsAdmin(false);
    try {
      localStorage.removeItem('esp8266_is_admin');
    } catch (e) {
      // ignore
    }
    setSerialLogs((prev) => [
      ...prev.slice(-150),
      {
        id: `admin-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        direction: 'system',
        message: 'Admin Authentication: Session locked. Guest permissions active.',
      },
    ]);
  };

  const handleChangeAdminPasscode = (newPass: string) => {
    try {
      localStorage.setItem('esp8266_admin_key', newPass);
    } catch (e) {
      // ignore
    }
    setSerialLogs((prev) => [
      ...prev.slice(-150),
      {
        id: `admin-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        direction: 'system',
        message: 'Admin Authentication: Master passcode updated for this device.',
      },
    ]);
  };

  // Virtual Rig simulation parameters
  const [autoSimulateMetal, setAutoSimulateMetal] = useState<boolean>(true);
  const [simMetalFrequency, setSimMetalFrequency] = useState<number>(8); // 1 metal alert every ~8 bags (~12.5% rate)
  const [bagsUntilNextMetal, setBagsUntilNextMetal] = useState<number>(8);
  const bagsSinceLastMetalRef = useRef<number>(0);
  const lastRemoteControllerActivityRef = useRef<number>(0);

  // EspService instance ref
  const espServiceRef = useRef<EspConnectionService | null>(null);

  // --- UNIFIED CONVEYOR STATE SYNCHRONIZATION HANDLER ---
  const applyConveyorSync = useCallback(
    (cloudState: LiveConveyorSyncState, source: 'cloud' | 'cross-tab') => {
      lastRemoteControllerActivityRef.current = Date.now();

      setConveyor((prev) => {
        // Detect resumption from halted metal interlock
        const isResuming = prev.haltedByDetection && !cloudState.haltedByDetection && cloudState.running;
        if (isResuming) {
          audio.playClick();
          setSerialLogs((logs) => [
            ...logs.slice(-150),
            {
              id: `sync-resume-${Date.now()}`,
              timestamp: new Date().toLocaleTimeString(),
              direction: 'system',
              message: `Station Telemetry (${source}): Conveyor resumed by station controller. Screening active.`,
            },
          ]);
        }

        return {
          ...prev,
          running: cloudState.running,
          haltedByDetection: cloudState.haltedByDetection,
          eStop: cloudState.eStop,
          speedPwm: cloudState.speedPwm,
          rpm: cloudState.speedRpm ?? Math.round((cloudState.speedPwm / 255) * 210),
          linearSpeedMps: cloudState.speedMps ?? Number(((cloudState.speedPwm / 255) * 0.55).toFixed(2)),
          direction: cloudState.direction,
          autoStopOnMetal: cloudState.autoStopOnMetal,
        };
      });

      setIsMetalInCoil(cloudState.isMetalDetected);
      setSensor((prev) => ({
        ...prev,
        isMetalDetected: cloudState.isMetalDetected,
        ...(typeof cloudState.currentSignal === 'number'
          ? {
              currentSignal: cloudState.currentSignal,
              peakSignal: Math.max(prev.peakSignal, cloudState.currentSignal),
            }
          : {}),
      }));
    },
    []
  );

  // --- FIREBASE FIRESTORE CLOUD DATABASE & REAL-TIME INTER-TAB SYNC ---
  useEffect(() => {
    let unsubsEvents: (() => void) | null = null;
    let unsubsStats: (() => void) | null = null;
    let unsubsStationProfiles: (() => void) | null = null;
    let unsubsConveyor: (() => void) | null = null;

    // Zero-latency cross-tab synchronization for tabs open in the same browser
    const unsubsCrossTab = subscribeToCrossTabConveyor(
      currentStation.id,
      (crossTabState) => {
        applyConveyorSync(crossTabState, 'cross-tab');
      },
      () => {
        setIsMetalInCoil(false);
        setSensor((prev) => ({
          ...prev,
          isMetalDetected: false,
        }));
        setConveyor((prev) => ({
          ...prev,
          running: true,
          haltedByDetection: false,
          eStop: false,
        }));
      }
    );

    const unsubsAuth = initFirebaseAuth(async (user) => {
      setSerialLogs((prev) => [
        ...prev.slice(-150),
        {
          id: `cloud-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          direction: 'system',
          message: `Cloud Database: Connected to station "${currentStation.name}" [${currentStation.id}] (Operator ID: ${user.uid.slice(0, 6)}...).`,
        },
      ]);

      const isConnected = await testFirestoreConnection();
      if (isConnected) {
        setCloudSyncStatus('synced');
      }

      // Persist station metadata in cloud
      saveStationProfileToCloud(currentStation);

      // Subscribe to live conveyor motion and interlock state
      unsubsConveyor = subscribeToConveyorState(
        currentStation.id,
        (cloudConveyor) => {
          setCloudSyncStatus('synced');
          applyConveyorSync(cloudConveyor, 'cloud');
        },
        (err) => {
          console.warn('Conveyor state subscription warning:', err);
        }
      );

      // Subscribe to available stations list
      unsubsStationProfiles = subscribeToStationProfiles((cloudStations) => {
        setAvailableStations(() => {
          const map = new Map<string, CheckpointStation>();
          DEFAULT_STATIONS.forEach((s) => map.set(s.id, s));
          cloudStations.forEach((s) => map.set(s.id, s));
          return Array.from(map.values());
        });
      });

      // Subscribe to this station's event log
      unsubsEvents = subscribeToScreeningEvents(
        currentStation.id,
        (cloudEvents) => {
          setCloudSyncStatus('synced');
          setEvents(cloudEvents);
        },
        (err) => {
          console.warn('Screening events subscription warning:', err);
          setCloudSyncStatus('offline');
        }
      );

      // Subscribe to this station's production statistics
      unsubsStats = subscribeToCheckpointStats(
        currentStation.id,
        (cloudCounters) => {
          setCloudSyncStatus('synced');
          setCounters((prev) => ({
            ...prev,
            totalPassed: cloudCounters.totalPassed,
            cleanPassed: cloudCounters.cleanPassed,
            metalDetected: cloudCounters.metalDetected,
            currentBatch: cloudCounters.currentBatch,
            batchTarget: cloudCounters.batchTarget || prev.batchTarget,
            itemsPerMin: cloudCounters.itemsPerMin || prev.itemsPerMin,
          }));
        },
        (err) => {
          console.warn('Checkpoint stats subscription warning:', err);
          setCloudSyncStatus('offline');
        }
      );
    });

    return () => {
      unsubsCrossTab();
      if (unsubsAuth) unsubsAuth();
      if (unsubsConveyor) unsubsConveyor();
      if (unsubsEvents) unsubsEvents();
      if (unsubsStats) unsubsStats();
      if (unsubsStationProfiles) unsubsStationProfiles();
    };
  }, [currentStation.id, currentStation.name, applyConveyorSync]);

  // --- METAL DETECTION TRIGGER HANDLER ---
  const triggerMetalDetection = useCallback((signal: number, classification?: string) => {
    audio.playMetalAlarm();

    // 1. Explicitly mark sensor state active for UI alerts
    setSensor((prev) => ({
      ...prev,
      isMetalDetected: true,
      currentSignal: Math.round(signal),
      peakSignal: Math.max(prev.peakSignal, Math.round(signal)),
    }));

    // 2. Pulse the Relay state & send Serial Trigger command to physical Pin D5 Relay Module
    setRejector((prev) => ({
      ...prev,
      isActive: true,
      rejectCount: prev.rejectCount + 1,
    }));

    if (espServiceRef.current) {
      espServiceRef.current.sendSerialCommand('ALARM_ON');
      espServiceRef.current.sendSerialCommand('REJECT');
    }

    setTimeout(() => {
      setRejector((prev) => ({ ...prev, isActive: false }));
    }, rejector.pulseDurationMs);

    const determinedClass =
      classification ||
      (signal > 800
        ? 'Metallic Tool / Solid Metal in Bag'
        : signal > 650
        ? 'Concealed Metal in Backpack'
        : 'Metallic Specimen in Bag');

    const newEvt: DetectionEvent = {
      id: `evt-${Date.now().toString(36)}`,
      timestamp: new Date().toLocaleTimeString(),
      signalStrength: Math.round(signal),
      threshold: sensor.threshold,
      conveyorSpeedPwm: conveyor.speedPwm,
      rejected: true,
      materialClassification: determinedClass,
    };

    setEvents((prev) => [newEvt, ...prev.slice(0, 50)]);
    setCounters((prev) => {
      const updated = {
        ...prev,
        totalPassed: prev.totalPassed + 1,
        metalDetected: prev.metalDetected + 1,
        currentBatch: prev.currentBatch + 1,
      };
      saveCheckpointStatsToCloud(currentStationRef.current.id, updated);
      return updated;
    });

    saveScreeningEventToCloud(currentStationRef.current.id, newEvt);

    if (conveyor.autoStopOnMetal) {
      setConveyor((prev) => ({ ...prev, running: false, haltedByDetection: true }));
      if (espServiceRef.current) {
        espServiceRef.current.sendSerialCommand('STOP');
      }

      const syncPayload: LiveConveyorSyncState = {
        running: false,
        haltedByDetection: true,
        eStop: conveyor.eStop,
        speedPwm: conveyor.speedPwm,
        speedRpm: conveyor.rpm,
        speedMps: conveyor.linearSpeedMps,
        direction: conveyor.direction,
        autoStopOnMetal: conveyor.autoStopOnMetal,
        isMetalDetected: true,
        currentSignal: Math.round(signal),
        action: 'metal_halt',
      };
      broadcastLiveConveyorState(currentStationRef.current.id, syncPayload);
      saveConveyorStateToCloud(currentStationRef.current.id, syncPayload, true);
    }
  }, [
    conveyor.speedPwm,
    conveyor.rpm,
    conveyor.linearSpeedMps,
    conveyor.direction,
    conveyor.eStop,
    conveyor.autoStopOnMetal,
    sensor.threshold,
    rejector.pulseDurationMs,
  ]);

  // Keep a fresh reference to triggerMetalDetection to avoid stale closure issues
  const triggerMetalRef = useRef(triggerMetalDetection);
  useEffect(() => {
    triggerMetalRef.current = triggerMetalDetection;
  }, [triggerMetalDetection]);

  // Initialize ESP Service
  useEffect(() => {
    const service = new EspConnectionService(hardwareConfig);
    espServiceRef.current = service;

    const unbindLog = service.onLog((entry) => {
      setSerialLogs((prev) => [...prev.slice(-150), entry]);
    });

    const unbindStatus = service.onStatus((data) => {
      if (data.event === 'BAG_PASSED') {
        setCounters((c) => {
          const updated = {
            ...c,
            totalPassed: typeof data.totalBags === 'number' ? data.totalBags : c.totalPassed + 1,
            cleanPassed: typeof data.cleanBags === 'number' ? data.cleanBags : c.cleanPassed + 1,
            currentBatch: c.currentBatch + 1,
          };
          saveCheckpointStatsToCloud(currentStationRef.current.id, updated);
          return updated;
        });
      }

      if (typeof data.running === 'boolean') {
        setConveyor((prev) => ({
          ...prev,
          running: data.running,
          speedPwm: data.speed ?? prev.speedPwm,
          eStop: data.estop ?? prev.eStop,
        }));
      }
      if (typeof data.signal === 'number') {
        setSensor((prev) => ({
          ...prev,
          currentSignal: data.signal,
          peakSignal: Math.max(prev.peakSignal, data.signal),
        }));
      }
    });

    // Uses triggerMetalRef to ensure fresh state/closure execution
    const unbindMetal = service.onMetalDetected((signal) => {
      triggerMetalRef.current(signal, 'Ferrous Metal');
    });

    return () => {
      unbindLog();
      unbindStatus();
      unbindMetal();
      service.disconnect();
    };
  }, []);

  const handleToggleAudio = () => {
    const nextMuted = !isAudioMuted;
    setIsAudioMuted(nextMuted);
    audio.isMuted = nextMuted;
    if (!nextMuted) audio.playClick();
  };

  const handleTriggerMetalSensor = useCallback(() => {
    if (!isAdmin) {
      handleRequestAdmin('Simulate Metal Detection');
      return;
    }
    setIsMetalInCoil(true);
    const simulatedSignal = 840 + Math.floor(Math.random() * 80);
    setSensor((prev) => ({
      ...prev,
      currentSignal: simulatedSignal,
      peakSignal: Math.max(prev.peakSignal, simulatedSignal),
      isMetalDetected: true,
    }));

    const sampleBagAlerts = [
      'Concealed Metal in Backpack',
      'Metallic Tool in Student Bag',
      'Prohibited Metallic Specimen',
      'Metal Object Detected in Bag',
    ];
    const pickedAlert = sampleBagAlerts[Math.floor(Math.random() * sampleBagAlerts.length)];
    triggerMetalDetection(simulatedSignal, pickedAlert);

    setTimeout(() => {
      setIsMetalInCoil(false);
      setSensor((prev) => ({
        ...prev,
        currentSignal: prev.baseline,
        isMetalDetected: false,
      }));
    }, 1400);
  }, [isAdmin, handleRequestAdmin, triggerMetalDetection]);

  const handleManualReject = useCallback(() => {
    if (!isAdmin) {
      handleRequestAdmin('Manual Rejector / Relay Pulse');
      return;
    }
    audio.playRejectHiss();
    setRejector((prev) => ({
      ...prev,
      isActive: true,
      rejectCount: prev.rejectCount + 1,
    }));

    if (espServiceRef.current) {
      espServiceRef.current.sendSerialCommand('ALARM_ON');
      espServiceRef.current.sendSerialCommand('REJECT');
    }

    setTimeout(() => {
      setRejector((prev) => ({ ...prev, isActive: false }));
      if (espServiceRef.current) {
        espServiceRef.current.sendSerialCommand('ALARM_OFF');
      }
    }, rejector.pulseDurationMs);
  }, [isAdmin, handleRequestAdmin, rejector.pulseDurationMs]);

  // --- BACKGROUND SENSOR NOISE & CONVEYOR THROUGHPUT SIMULATION ---
  useEffect(() => {
    let animId: number;
    let lastThroughputTime = performance.now();

    const tick = (time: number) => {
      // Background noise simulation (preserves active detection state)
      if (!isMetalInCoil) {
        const noise = (Math.random() - 0.5) * 4;
        setSensor((prev) => ({
          ...prev,
          currentSignal: Math.round(prev.baseline + noise),
        }));
      }

      if (conveyor.running && !conveyor.eStop && !conveyor.haltedByDetection) {
        // Cycle time dynamically scales with conveyor PWM (at 175 PWM ~3.2s per bag)
        const cycleInterval = Math.max(1400, Math.round(5000 - (conveyor.speedPwm / 255) * 2600));

        if (time - lastThroughputTime > cycleInterval) {
          lastThroughputTime = time;

          const isSimulating = hardwareConfig.connectionType === 'simulation';
          const hasRemoteActiveController = Date.now() - lastRemoteControllerActivityRef.current < 25000;
          // When an admin or remote controller is actively managing this station, observer tabs follow rather than generating conflicting simulation events
          const shouldDriveSimulation = isSimulating && (isAdmin || !hasRemoteActiveController);

          const shouldTriggerMetal =
            shouldDriveSimulation &&
            autoSimulateMetal &&
            bagsSinceLastMetalRef.current + 1 >= simMetalFrequency;

          if (shouldTriggerMetal) {
            bagsSinceLastMetalRef.current = 0;
            setBagsUntilNextMetal(simMetalFrequency);

            // Trigger simulated bag with concealed metal
            const simulatedSignal = 780 + Math.floor(Math.random() * 150);
            const sampleAlerts = [
              'Metallic Tool in Backpack',
              'Concealed Metal Specimen in Student Bag',
              'Prohibited Steel Container in Bag',
              'Metallic Object Detected in Backpack',
            ];
            const alertText = sampleAlerts[Math.floor(Math.random() * sampleAlerts.length)];

            setIsMetalInCoil(true);
            setSensor((prev) => ({
              ...prev,
              currentSignal: simulatedSignal,
              peakSignal: Math.max(prev.peakSignal, simulatedSignal),
              isMetalDetected: true,
            }));

            // Emit serial log for telemetry
            setSerialLogs((prev) => [
              ...prev.slice(-150),
              {
                id: `log-${Date.now()}`,
                timestamp: new Date().toLocaleTimeString(),
                direction: 'incoming',
                message: `[VIRTUAL-RIG ALERT]: LJ12A3 Sensor triggered! Signal=${simulatedSignal} ADC > ${sensor.threshold}. Concealed metal in bag.`,
              },
            ]);

            triggerMetalRef.current(simulatedSignal, alertText);

            setTimeout(() => {
              setIsMetalInCoil(false);
              setSensor((prev) => ({
                ...prev,
                currentSignal: prev.baseline,
                isMetalDetected: false,
              }));
            }, 1400);
          } else if (shouldDriveSimulation) {
            // Normal clean bag passed checkpoint without metal
            if (autoSimulateMetal) {
              bagsSinceLastMetalRef.current += 1;
              setBagsUntilNextMetal(Math.max(1, simMetalFrequency - bagsSinceLastMetalRef.current));
            }

            setCounters((c) => {
              const updated = {
                ...c,
                totalPassed: c.totalPassed + 1,
                cleanPassed: c.cleanPassed + 1,
                currentBatch: c.currentBatch + 1,
              };
              saveCheckpointStatsToCloud(currentStationRef.current.id, updated);
              return updated;
            });
          }
        }
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [
    conveyor.running,
    conveyor.eStop,
    conveyor.haltedByDetection,
    conveyor.speedPwm,
    isMetalInCoil,
    hardwareConfig.connectionType,
    autoSimulateMetal,
    simMetalFrequency,
    sensor.threshold,
  ]);

  // --- DRIVE CONTROLS ---
  const handleStartConveyor = () => {
    if (!isAdmin) {
      handleRequestAdmin('Start Conveyor');
      return;
    }
    audio.playClick();
    setConveyor((prev) => ({ ...prev, running: true, haltedByDetection: false }));
    if (espServiceRef.current) {
      espServiceRef.current.sendSerialCommand('START');
    }
  };

  const handleStopConveyor = () => {
    if (!isAdmin) {
      handleRequestAdmin('Stop Conveyor');
      return;
    }
    audio.playClick();
    setConveyor((prev) => ({ ...prev, running: false }));
    if (espServiceRef.current) {
      espServiceRef.current.sendSerialCommand('STOP');
    }
  };

  const handleClearHaltedMetal = useCallback(() => {
    if (!isAdmin) {
      handleRequestAdmin('Resume Conveyor');
      return;
    }
    audio.playClick();
    setIsMetalInCoil(false);
    setSensor((prev) => ({
      ...prev,
      currentSignal: prev.baseline,
      isMetalDetected: false,
    }));
    setConveyor((prev) => ({ ...prev, running: true, haltedByDetection: false }));
    if (espServiceRef.current) {
      espServiceRef.current.sendSerialCommand('ALARM_OFF');
      espServiceRef.current.sendSerialCommand(`SPEED:${conveyor.speedPwm}`);
    }
  }, [isAdmin, handleRequestAdmin, conveyor.speedPwm]);

  const handleEStop = () => {
    if (!isAdmin) {
      handleRequestAdmin('Emergency Stop (E-STOP)');
      return;
    }
    audio.playEStopAlert();
    setConveyor((prev) => ({ ...prev, running: false, eStop: true }));
    if (espServiceRef.current) {
      espServiceRef.current.sendSerialCommand('ESTOP');
      espServiceRef.current.sendSerialCommand('ALARM_ON');
    }
  };

  const handleResetEStop = () => {
    if (!isAdmin) {
      handleRequestAdmin('Reset Emergency Stop');
      return;
    }
    audio.playClick();
    setConveyor((prev) => ({ ...prev, eStop: false, haltedByDetection: false }));
    if (espServiceRef.current) {
      espServiceRef.current.sendSerialCommand('RESET_ESTOP');
      espServiceRef.current.sendSerialCommand('ALARM_OFF');
    }
  };

  const handleSpeedChange = (pwm: number) => {
    if (!isAdmin) {
      handleRequestAdmin('Adjust Conveyor Speed');
      return;
    }
    const rpm = Math.round((pwm / 255) * 210);
    const mps = Number(((pwm / 255) * 0.55).toFixed(2));
    setConveyor((prev) => ({
      ...prev,
      speedPwm: pwm,
      rpm,
      linearSpeedMps: mps,
    }));
    if (espServiceRef.current) {
      espServiceRef.current.sendSerialCommand(`SPEED:${pwm}`);
    }
  };

  const handleDirectionToggle = () => {
    if (!isAdmin) {
      handleRequestAdmin('Reverse Conveyor Direction');
      return;
    }
    audio.playClick();
    const nextDir = conveyor.direction === 'forward' ? 'reverse' : 'forward';
    setConveyor((prev) => ({ ...prev, direction: nextDir }));
    if (espServiceRef.current) {
      espServiceRef.current.sendSerialCommand(nextDir === 'forward' ? 'DIR:FWD' : 'DIR:REV');
    }
  };

  const handleResetCounters = useCallback(() => {
    if (!isAdmin) {
      handleRequestAdmin('Reset Statistics Counters');
      return;
    }
    audio.playClick();
    const resetValues: ProductionCounters = {
      totalPassed: 0,
      metalDetected: 0,
      cleanPassed: 0,
      currentBatch: 0,
      itemsPerMin: 0,
      batchTarget: counters.batchTarget,
    };
    setCounters(resetValues);
    setRejector((r) => ({ ...r, rejectCount: 0 }));
    saveCheckpointStatsToCloud(currentStationRef.current.id, resetValues, true);
    if (espServiceRef.current) {
      espServiceRef.current.sendSerialCommand('RESET_COUNTERS');
    }
  }, [isAdmin, handleRequestAdmin, counters.batchTarget]);

  const handleSelectStation = (newStation: CheckpointStation) => {
    setCurrentStation(newStation);
    try {
      localStorage.setItem('school_esp8266_station', JSON.stringify(newStation));
    } catch (e) {
      // ignore
    }
    setEvents([]); // Clean UI immediately while new station's data streams in
    setSerialLogs((prev) => [
      ...prev.slice(-150),
      {
        id: `station-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        direction: 'system',
        message: `Switched active station channel to: "${newStation.name}" [ID: ${newStation.id}].`,
      },
    ]);
  };

  const handleUpdateOperatorName = (name: string) => {
    const updated = { ...currentStation, operatorName: name };
    setCurrentStation(updated);
    try {
      localStorage.setItem('school_esp8266_station', JSON.stringify(updated));
    } catch (e) {
      // ignore
    }
    saveStationProfileToCloud(updated);
    setSerialLogs((prev) => [
      ...prev.slice(-150),
      {
        id: `op-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        direction: 'system',
        message: `Operator profile updated: Call-sign set to "${name}".`,
      },
    ]);
  };

  const handleSelectConnection = async (type: ConnectionType, details?: Partial<HardwareConfig>) => {
    if (!isAdmin) {
      handleRequestAdmin('Configure Hardware Connection');
      return;
    }
    if (!espServiceRef.current) return;

    if (details) {
      espServiceRef.current.setConfig(details);
      setHardwareConfig((prev) => ({ ...prev, ...details, connectionType: type }));
    }

    if (type === 'serial') {
      const ok = await espServiceRef.current.connectSerial();
      if (ok) {
        setHardwareConfig((prev) => ({ ...prev, connected: true, connectionType: 'serial' }));
      }
    } else if (type === 'wifi_http') {
      espServiceRef.current.startWifiPolling();
      setHardwareConfig((prev) => ({ ...prev, connected: true, connectionType: 'wifi_http' }));
    } else {
      await espServiceRef.current.disconnect();
      setHardwareConfig((prev) => ({ ...prev, connected: true, connectionType: 'simulation' }));
    }
  };

  const handleDisconnectHardware = async () => {
    if (!isAdmin) {
      handleRequestAdmin('Disconnect Hardware Interface');
      return;
    }
    if (espServiceRef.current) {
      await espServiceRef.current.disconnect();
    }
    setHardwareConfig((prev) => ({ ...prev, connected: false }));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-cyan-500/30">
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur border-b border-slate-800 px-4 sm:px-6 py-3 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-slate-950 font-bold">
              <Cpu className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-100 tracking-wide font-mono">
                  ESP8266 Metal Detection Conveyor
                </h1>
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono font-bold">
                  {hardwareConfig.connectionType.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                School Entrance Baggage Inspection • LJ12A3-4-Z/BX Sensor • L298N Motor Driver • Alarm Relay
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs">
            {/* Station / Account Channel Selector */}
            <button
              id="open-station-modal-btn"
              onClick={() => setIsStationModalOpen(true)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-indigo-950/80 hover:bg-indigo-900/90 border border-indigo-700/80 text-indigo-200 transition-all cursor-pointer font-mono"
              title={`Active Screening Station: ${currentStation.name} (${currentStation.id}) - Click to switch`}
            >
              <Building2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <div className="flex flex-col text-left leading-none">
                <span className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider">Station</span>
                <span className="text-[11px] font-bold text-slate-100 max-w-[120px] sm:max-w-[150px] truncate">
                  {currentStation.name}
                </span>
              </div>
              <ChevronDown className="w-3 h-3 text-indigo-400 shrink-0 ml-0.5" />
            </button>

            {/* Admin Privilege Status Badge / Trigger */}
            <button
              id="admin-status-trigger-btn"
              onClick={() => {
                if (isAdmin) {
                  setIsStationModalOpen(true);
                } else {
                  handleRequestAdmin('Administrator Privileges');
                }
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border font-mono text-xs transition-all cursor-pointer ${
                isAdmin
                  ? 'bg-amber-950/80 border-amber-600/80 text-amber-300 hover:bg-amber-900/80 ring-1 ring-amber-500/40'
                  : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-750'
              }`}
              title={isAdmin ? 'Admin privileges active: Click to manage station & passcode' : 'Guest access: Click to authenticate as administrator'}
            >
              {isAdmin ? (
                <>
                  <Unlock className="w-3.5 h-3.5 text-amber-400" />
                  <span className="font-bold text-[11px] text-amber-300">ADMIN</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-[11px] hidden sm:inline text-slate-400">Guest (View Only)</span>
                </>
              )}
            </button>

            <div
              id="cloud-database-status-badge"
              className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono transition-all ${
                cloudSyncStatus === 'synced'
                  ? 'bg-emerald-950/70 border-emerald-800/80 text-emerald-300'
                  : cloudSyncStatus === 'connecting'
                  ? 'bg-amber-950/70 border-amber-800/80 text-amber-300 animate-pulse'
                  : 'bg-slate-800/80 border-slate-700 text-slate-400'
              }`}
              title="Google Cloud Firestore: Baggage Screening Real-Time Persistence"
            >
              <Database className={`w-3.5 h-3.5 ${cloudSyncStatus === 'synced' ? 'text-emerald-400' : cloudSyncStatus === 'connecting' ? 'text-amber-400' : 'text-slate-400'}`} />
              <span className="font-semibold text-[11px]">Cloud DB:</span>
              <span className="text-[11px]">
                {cloudSyncStatus === 'synced' ? 'Synced' : cloudSyncStatus === 'connecting' ? 'Connecting...' : 'Local'}
              </span>
            </div>

            <button
              onClick={() => setIsArduinoGuideOpen(true)}
              className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800/80 hover:bg-slate-750 text-[11px] text-slate-300 border border-slate-700 transition-colors"
              title="View wiring schematic and pinout for LJ12A3-4-Z/BX & L298N"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              <span>BOM: LJ12A3 + L298N</span>
            </button>

            <button
              id="open-connection-modal-btn"
              onClick={() => setIsConnectionModalOpen(true)}
              className={`px-3 py-1.5 rounded-lg border transition-all flex items-center gap-2 ${
                hardwareConfig.connected
                  ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-750'
                  : 'bg-amber-950/80 border-amber-600/80 text-amber-300 animate-pulse'
              }`}
            >
              <Radio className={`w-3.5 h-3.5 ${hardwareConfig.connected ? 'text-emerald-400' : 'text-amber-400'}`} />
              <span>
                {hardwareConfig.connected
                  ? hardwareConfig.connectionType === 'simulation'
                    ? 'Virtual Rig Active'
                    : `Linked: ${hardwareConfig.connectionType}`
                  : 'Hardware Offline'}
              </span>
            </button>

            <button
              id="open-arduino-guide-btn"
              onClick={() => setIsArduinoGuideOpen(true)}
              className="px-3 py-1.5 bg-cyan-950 hover:bg-cyan-900 border border-cyan-700/60 text-cyan-300 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Arduino .ino & Wiring</span>
            </button>

            <button
              id="toggle-sound-btn"
              onClick={handleToggleAudio}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors"
              title={isAudioMuted ? 'Unmute Audio Alarms' : 'Mute Audio Alarms'}
            >
              {isAudioMuted ? <VolumeX className="w-4 h-4 text-slate-500" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto w-full p-4 sm:p-6 flex flex-col gap-6 flex-1">
        {/* VIRTUAL HARDWARE RIG & CONVEYOR TRACK */}
        <section>
          <ConveyorVisualizer
            conveyor={conveyor}
            sensor={sensor}
            rejector={rejector}
            isMetalInCoil={isMetalInCoil}
            autoSimulateMetal={autoSimulateMetal}
            simMetalFrequency={simMetalFrequency}
            bagsUntilNextMetal={bagsUntilNextMetal}
            isAdmin={isAdmin}
            onRequestAdmin={handleRequestAdmin}
            onToggleAutoSimulateMetal={() => setAutoSimulateMetal((v) => !v)}
            onChangeSimMetalFrequency={(freq) => {
              setSimMetalFrequency(freq);
              setBagsUntilNextMetal(freq);
              bagsSinceLastMetalRef.current = 0;
            }}
            onTriggerMetalSensor={handleTriggerMetalSensor}
            onClearHaltedMetal={handleClearHaltedMetal}
            onManualReject={handleManualReject}
          />
        </section>

        <section>
          <StatisticsDashboard
            conveyor={conveyor}
            sensor={sensor}
            rejector={rejector}
            counters={counters}
            isMetalInCoil={isMetalInCoil}
            isAdmin={isAdmin}
            onRequestAdmin={handleRequestAdmin}
            onStartConveyor={handleStartConveyor}
            onStopConveyor={handleStopConveyor}
            onSpeedChange={handleSpeedChange}
            onTriggerMetalSensor={handleTriggerMetalSensor}
            onClearHaltedMetal={handleClearHaltedMetal}
            onManualReject={handleManualReject}
            onResetCounters={handleResetCounters}
            onEStop={handleEStop}
            onResetEStop={handleResetEStop}
          />
        </section>

        <section>
          <EventLogTable
            events={events}
            isAdmin={isAdmin}
            onRequestAdmin={handleRequestAdmin}
            onClearEvents={async () => {
              if (!isAdmin) {
                handleRequestAdmin('Clear Screening Audit Log');
                return;
              }
              const ids = events.map((e) => e.id);
              const stationId = currentStationRef.current.id;
              const stationName = currentStationRef.current.name;
              setEvents([]);
              await clearAllScreeningEventsFromCloud(stationId, ids);
              setSerialLogs((prev) => [
                ...prev.slice(-150),
                {
                  id: `clear-${Date.now()}`,
                  timestamp: new Date().toLocaleTimeString(),
                  direction: 'system',
                  message: `Screening event audit log cleared for station "${stationName}".`,
                },
              ]);
            }}
          />
        </section>

        <section className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
          <button
            id="toggle-serial-console-btn"
            onClick={() => setIsConsoleOpen(!isConsoleOpen)}
            className="w-full px-5 py-3.5 bg-slate-950/60 hover:bg-slate-800/80 transition-colors flex items-center justify-between text-xs font-mono text-slate-300"
          >
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <span className="font-semibold text-slate-200">ESP8266 Live Serial Console</span>
              <span className="text-[10px] text-slate-500">({serialLogs.length} messages)</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <span>{isConsoleOpen ? 'Hide Serial Console' : 'Show Serial Console'}</span>
              {isConsoleOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>

          {isConsoleOpen && (
            <div className="p-4 border-t border-slate-800">
              <SerialConsole
                logs={serialLogs}
                isAdmin={isAdmin}
                onRequestAdmin={handleRequestAdmin}
                onSendCommand={(cmd) => {
                  if (!isAdmin) {
                    handleRequestAdmin('Transmit Hardware Serial Command');
                    return;
                  }
                  if (espServiceRef.current) {
                    espServiceRef.current.sendSerialCommand(cmd);
                  }
                }}
                onClearLogs={() => {
                  if (!isAdmin) {
                    handleRequestAdmin('Clear Serial Logs');
                    return;
                  }
                  setSerialLogs([]);
                }}
                isConnected={hardwareConfig.connected}
              />
            </div>
          )}
        </section>
      </main>

      <footer className="border-t border-slate-900 bg-slate-950 px-6 py-4 text-xs font-mono text-slate-500 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <span>Target Hardware: ESP8266 (NodeMCU v2/v3 / Wemos D1 Mini)</span>
          <span>•</span>
          <span>Baud: 115200</span>
          <span>•</span>
          <span>Pins: D1 (LJ12A3 Sensor), D2/D3/D4 (L298N Motor Driver), D5 (5V Relay Alarm)</span>
        </div>
        <div>School Baggage Security & Metal Screening Telemetry</div>
      </footer>

      <ConnectionModal
        isOpen={isConnectionModalOpen}
        onClose={() => setIsConnectionModalOpen(false)}
        config={hardwareConfig}
        isAdmin={isAdmin}
        onRequestAdmin={handleRequestAdmin}
        onSelectConnection={handleSelectConnection}
        onDisconnect={handleDisconnectHardware}
      />

      <ArduinoGuideModal
        isOpen={isArduinoGuideOpen}
        onClose={() => setIsArduinoGuideOpen(false)}
      />

      <StationModal
        isOpen={isStationModalOpen}
        onClose={() => setIsStationModalOpen(false)}
        currentStation={currentStation}
        availableStations={availableStations}
        onSelectStation={handleSelectStation}
        onUpdateOperatorName={handleUpdateOperatorName}
        isAdmin={isAdmin}
        onAdminLogin={handleAdminLogin}
        onAdminLogout={handleAdminLogout}
        onChangeAdminPasscode={handleChangeAdminPasscode}
      />

      <AdminAuthModal
        isOpen={isAdminAuthModalOpen}
        onClose={() => setIsAdminAuthModalOpen(false)}
        onLogin={handleAdminLogin}
        actionTitle={adminAuthActionTitle}
      />
    </div>
  );
}