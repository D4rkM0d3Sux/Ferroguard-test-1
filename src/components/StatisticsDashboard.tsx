import React from 'react';
import {
  ConveyorState,
  MetalSensorState,
  RejectorState,
  ProductionCounters,
} from '../types';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Cpu,
  Gauge,
  Power,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Zap,
  Lock,
} from 'lucide-react';

interface StatisticsDashboardProps {
  conveyor: ConveyorState;
  sensor: MetalSensorState;
  rejector: RejectorState;
  counters: ProductionCounters;
  isMetalInCoil: boolean;
  onStartConveyor: () => void;
  onStopConveyor: () => void;
  onSpeedChange: (pwm: number) => void;
  onTriggerMetalSensor: () => void;
  onClearHaltedMetal: () => void;
  onManualReject: () => void;
  onResetCounters: () => void;
  onEStop: () => void;
  onResetEStop: () => void;
  isAdmin?: boolean;
  onRequestAdmin?: (actionTitle?: string) => void;
}

export const StatisticsDashboard: React.FC<StatisticsDashboardProps> = ({
  conveyor,
  sensor,
  rejector,
  counters,
  isMetalInCoil,
  onStartConveyor,
  onStopConveyor,
  onSpeedChange,
  onTriggerMetalSensor,
  onClearHaltedMetal,
  onManualReject,
  onResetCounters,
  onEStop,
  onResetEStop,
  isAdmin = false,
  onRequestAdmin,
}) => {
  // Total bags screened is the sum of clean bags passed and metal alerts flagged
  const totalScreened = Math.max(
    counters.totalPassed,
    counters.cleanPassed + counters.metalDetected
  );

  const defectRateNum =
    totalScreened > 0
      ? (counters.metalDetected / totalScreened) * 100
      : 0;
  const defectRate = defectRateNum.toFixed(1);

  // Exact complementary percentage: Cleared% + Alert% always equals 100.0%
  const cleanRate =
    totalScreened > 0
      ? (100 - parseFloat(defectRate)).toFixed(1)
      : '100.0';

  const speedPercentage = Math.round((conveyor.speedPwm / 255) * 100);
  const sensorRatio = Math.min(100, Math.round((sensor.currentSignal / 1023) * 100));
  const thresholdRatio = Math.min(100, Math.round((sensor.threshold / 1023) * 100));

  return (
    <div id="statistics-dashboard" className="flex flex-col gap-5">
      {/* 1. AUTO-HALT / EMERGENCY STOP ACTIVE BANNER */}
      {conveyor.eStop ? (
        <div
          id="estop-active-banner"
          className="bg-red-950/90 border-2 border-red-500 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xl shadow-red-950/50"
        >
          <div className="flex items-center gap-3 text-red-100">
            <div className="w-10 h-10 rounded-lg bg-red-600 flex items-center justify-center font-bold text-white shrink-0 animate-pulse">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold font-mono tracking-wide text-white uppercase">
                EMERGENCY STOP ACTIVE
              </h2>
              <p className="text-xs text-red-200 mt-0.5">
                L298N drive cut. All hardware outputs disabled. Clear the line and reset when safe.
              </p>
            </div>
          </div>
          <button
            id="reset-estop-btn"
            onClick={() => {
              if (!isAdmin) {
                onRequestAdmin?.('Reset Emergency Stop');
                return;
              }
              onResetEStop();
            }}
            className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 font-bold font-mono text-xs rounded-lg transition-all shadow-lg flex items-center gap-1.5"
            title={isAdmin ? "Reset Emergency Stop" : "Admin access required"}
          >
            {!isAdmin && <Lock className="w-3.5 h-3.5" />}
            <span>Reset Emergency Stop</span>
            {!isAdmin && <span className="text-[10px] px-1 bg-amber-900 text-amber-200 rounded">Admin</span>}
          </button>
        </div>
      ) : conveyor.haltedByDetection ? (
        <div
          id="metal-halted-banner"
          className="bg-amber-950/90 border-2 border-amber-500 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xl shadow-amber-950/40"
        >
          <div className="flex items-center gap-3 text-amber-100">
            <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center font-bold text-slate-950 shrink-0 animate-bounce">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold font-mono tracking-wide text-amber-100 uppercase">
                METAL DETECTED IN BAGGAGE — CONVEYOR AUTO-HALTED
              </h2>
              <p className="text-xs text-amber-200 mt-0.5">
                LJ12A3 inductive sensor detected metallic object in baggage. Alarm relay active on Pin D5. Conduct physical bag inspection, then click Resume.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              id="resume-clear-metal-btn"
              onClick={() => {
                if (!isAdmin) {
                  onRequestAdmin?.('Resume Conveyor');
                  return;
                }
                onClearHaltedMetal();
              }}
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-bold font-mono text-xs rounded-lg transition-all shadow-lg flex items-center gap-1.5"
              title={isAdmin ? "Resume Conveyor" : "Admin access required"}
            >
              {!isAdmin ? <Lock className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>Bag Inspected — Resume Conveyor</span>
              {!isAdmin && <span className="text-[10px] px-1 bg-amber-900 text-amber-200 rounded">Admin</span>}
            </button>
          </div>
        </div>
      ) : null}

      {/* 2. PRIMARY PRODUCTION STATISTICS CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Screened */}
        <div
          id="stat-total-inspected"
          className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span>TOTAL BAGS SCREENED</span>
            <BarChart3 className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-3">
            <div className="text-3xl font-bold font-mono text-slate-50 tracking-tight">
              {totalScreened.toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-400 font-mono mt-1">
              Throughput: {counters.itemsPerMin} bags/min
            </p>
          </div>
        </div>

        {/* Cleared Bags */}
        <div
          id="stat-clean-passed"
          className="bg-slate-900 border border-emerald-900/60 rounded-xl p-4 shadow-lg flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-xs font-mono text-emerald-400">
            <span>CLEARED BAGS</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3">
            <div className="text-3xl font-bold font-mono text-emerald-300 tracking-tight">
              {counters.cleanPassed.toLocaleString()}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                {cleanRate}% Cleared
              </span>
              <span className="text-[11px] text-slate-400 font-mono">Passed checkpoint</span>
            </div>
          </div>
        </div>

        {/* Metal Alerts Detected */}
        <div
          id="stat-metal-detected"
          className="bg-slate-900 border border-red-900/60 rounded-xl p-4 shadow-lg flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-xs font-mono text-red-400">
            <span>METAL ALERTS (FLAGGED)</span>
            <AlertTriangle className="w-4 h-4 text-red-400" />
          </div>
          <div className="mt-3">
            <div className="text-3xl font-bold font-mono text-red-400 tracking-tight">
              {counters.metalDetected.toLocaleString()}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-950 text-red-300 border border-red-800">
                {defectRate}% alert rate
              </span>
              <span className="text-[11px] text-slate-400 font-mono">Flagged for search</span>
            </div>
          </div>
        </div>

        {/* Batch Progress */}
        <div
          id="stat-batch-progress"
          className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span>SCREENING BATCH</span>
            <TrendingUp className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-3">
            <div className="text-3xl font-bold font-mono text-amber-300 tracking-tight">
              {counters.batchTarget > 0
                ? `${Math.min(100, Math.round((counters.currentBatch / counters.batchTarget) * 100))}%`
                : '100%'}
            </div>
            <p className="text-[11px] text-slate-400 font-mono mt-1">
              {counters.currentBatch} / {counters.batchTarget} target bags
            </p>
          </div>
        </div>
      </div>

      {/* 2b. CHECKPOINT CLEARANCE RATIO DUAL-COLOR BREAKDOWN BAR */}
      <div
        id="checkpoint-clearance-ratio-bar"
        className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col gap-2.5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-slate-300 font-bold uppercase tracking-wider">
              Screening Ratio Distribution:
            </span>
            <span className="text-slate-400">
              Total Screened: <strong className="text-slate-200">{totalScreened.toLocaleString()}</strong> bags
            </span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span className="text-emerald-300 font-bold">{cleanRate}% Cleared</span>
              <span className="text-slate-400">({counters.cleanPassed.toLocaleString()} bags)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-red-400 font-bold">{defectRate}% Metal Alert</span>
              <span className="text-slate-400">({counters.metalDetected.toLocaleString()} flagged)</span>
            </div>
          </div>
        </div>

        {/* Dual Segment Split Progress Bar */}
        <div className="w-full h-3.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800 flex shadow-inner">
          <div
            className="h-full bg-gradient-to-r from-emerald-600 to-emerald-500 transition-all duration-300 flex items-center justify-center text-[9px] font-mono text-slate-950 font-bold"
            style={{ width: `${totalScreened > 0 ? cleanRate : 100}%` }}
            title={`Cleared: ${cleanRate}% (${counters.cleanPassed} bags)`}
          >
            {parseFloat(cleanRate) >= 15 ? `${cleanRate}%` : ''}
          </div>
          <div
            className="h-full bg-gradient-to-r from-red-600 to-red-500 transition-all duration-300 flex items-center justify-center text-[9px] font-mono text-white font-bold"
            style={{ width: `${totalScreened > 0 ? defectRate : 0}%` }}
            title={`Metal Alerts: ${defectRate}% (${counters.metalDetected} bags)`}
          >
            {parseFloat(defectRate) >= 10 ? `${defectRate}%` : ''}
          </div>
        </div>
      </div>

      {/* 3. HARDWARE LIVE TELEMETRY TILES (MOTOR, SENSOR, RELAY) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Hardware Tile 1: L298N Motor Driver */}
        <div
          id="telemetry-l298n-motor"
          className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col gap-3"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <Gauge className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                Conveyor Drive (L298N)
              </span>
            </div>
            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                conveyor.eStop
                  ? 'bg-red-950 text-red-400 border border-red-800'
                  : conveyor.haltedByDetection
                  ? 'bg-amber-950 text-amber-400 border border-amber-800'
                  : conveyor.running
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {conveyor.eStop
                ? 'E-STOP'
                : conveyor.haltedByDetection
                ? 'HALTED'
                : conveyor.running
                ? 'RUNNING'
                : 'STOPPED'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center py-1">
            <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
              <div className="text-[10px] text-slate-500 font-mono">PWM (ENA)</div>
              <div className="text-lg font-bold font-mono text-cyan-300 mt-0.5">
                {conveyor.speedPwm}
              </div>
              <div className="text-[9px] text-slate-400 font-mono">{speedPercentage}%</div>
            </div>

            <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
              <div className="text-[10px] text-slate-500 font-mono">SPEED</div>
              <div className="text-lg font-bold font-mono text-slate-100 mt-0.5">
                {conveyor.rpm}
              </div>
              <div className="text-[9px] text-slate-400 font-mono">RPM</div>
            </div>

            <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
              <div className="text-[10px] text-slate-500 font-mono">VELOCITY</div>
              <div className="text-lg font-bold font-mono text-slate-100 mt-0.5">
                {conveyor.linearSpeedMps}
              </div>
              <div className="text-[9px] text-slate-400 font-mono">m/s</div>
            </div>
          </div>

          <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/60">
            <span>Direction: <strong className="text-slate-200">{conveyor.direction.toUpperCase()}</strong></span>
            <span>Pin D2 (PWM) • D3/D4 (DIR)</span>
          </div>
        </div>

        {/* Hardware Tile 2: LJ12A3 Inductive Proximity Sensor */}
        <div
          id="telemetry-lj12a3-sensor"
          className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col gap-3"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                Proximity Sensor (LJ12A3)
              </span>
            </div>
            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                isMetalInCoil || sensor.isMetalDetected
                  ? 'bg-red-950 text-red-300 border border-red-800 animate-pulse'
                  : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
              }`}
            >
              {isMetalInCoil || sensor.isMetalDetected ? 'METAL IN BAG' : 'CLEAR (NO METAL)'}
            </span>
          </div>

          <div>
            <div className="flex justify-between items-center text-xs font-mono mb-1.5">
              <span className="text-slate-400">Signal Level</span>
              <span className="text-slate-200 font-bold">
                {sensor.currentSignal} <span className="text-slate-500">/ 1023</span>
              </span>
            </div>
            {/* Visual Level Bar */}
            <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800 relative">
              <div
                className={`h-full transition-all duration-150 ${
                  sensor.isMetalDetected || isMetalInCoil
                    ? 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.8)]'
                    : 'bg-cyan-500'
                }`}
                style={{ width: `${sensorRatio}%` }}
              />
              {/* Threshold Marker */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.9)] z-10"
                style={{ left: `${thresholdRatio}%` }}
                title={`Detection Threshold: ${sensor.threshold}`}
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
              <span>Baseline: {sensor.baseline}</span>
              <span className="text-amber-400">Threshold: {sensor.threshold}</span>
              <span>Peak: {sensor.peakSignal}</span>
            </div>
          </div>

          <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/60">
            <span>Logic: <strong className="text-slate-200">{isMetalInCoil || sensor.isMetalDetected ? 'LOW (0V)' : 'HIGH (3.3V)'}</strong></span>
            <span>Pin D1 (GPIO5)</span>
          </div>
        </div>

        {/* Hardware Tile 3: 5V Relay Alarm Module */}
        <div
          id="telemetry-relay-module"
          className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col gap-3"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                Alarm Relay Module (5V)
              </span>
            </div>
            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                rejector.isActive || conveyor.haltedByDetection
                  ? 'bg-amber-950 text-amber-300 border border-amber-600 animate-pulse'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {rejector.isActive || conveyor.haltedByDetection ? 'ENERGIZED (ON)' : 'DE-ENERGIZED (OFF)'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-center py-1">
            <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
              <div className="text-[10px] text-slate-500 font-mono">SECURITY ALARMS</div>
              <div className="text-lg font-bold font-mono text-amber-300 mt-0.5">
                {rejector.rejectCount}
              </div>
              <div className="text-[9px] text-slate-400 font-mono">Flagged bags</div>
            </div>

            <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
              <div className="text-[10px] text-slate-500 font-mono">AUTO-HALT</div>
              <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5">
                ACTIVE
              </div>
              <div className="text-[9px] text-slate-400 font-mono">School Security Mode</div>
            </div>
          </div>

          <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/60">
            <span>Relay Logic: <strong className="text-slate-200">Active LOW</strong></span>
            <span>Pin D5 (GPIO14)</span>
          </div>
        </div>
      </div>

      {/* 4. STREAMLINED CONTROL & TESTING BAR */}
      <div className="flex flex-col gap-2">
        {!isAdmin && (
          <div className="flex items-center justify-between px-4 py-2.5 bg-amber-950/70 border border-amber-800/80 rounded-xl text-amber-300 text-xs font-mono">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>Guest Observer Mode (Read-Only):</strong> Conveyor drives, E-Stop, test triggers, and stats resets are locked.
              </span>
            </div>
            <button
              onClick={() => onRequestAdmin?.('Conveyor & Machine Controls')}
              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded text-[11px] transition-colors flex items-center gap-1 shrink-0"
            >
              <Lock className="w-3 h-3" />
              <span>Unlock Admin</span>
            </button>
          </div>
        )}

        <div
          id="quick-controls-bar"
          className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4"
        >
          {/* Drive Control Group */}
          <div className="flex flex-wrap items-center gap-3">
            {conveyor.running ? (
              <button
                id="conveyor-stop-btn"
                onClick={() => {
                  if (!isAdmin) {
                    onRequestAdmin?.('Stop Conveyor Motor');
                    return;
                  }
                  onStopConveyor();
                }}
                className={`px-4 py-2 font-mono font-bold text-xs rounded-lg transition-all flex items-center gap-2 shadow-md ${
                  !isAdmin
                    ? 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-amber-300'
                    : 'bg-red-600 hover:bg-red-500 active:scale-95 text-white shadow-red-950'
                }`}
                title={isAdmin ? "Stop conveyor motor" : "Admin access required to stop conveyor"}
              >
                {!isAdmin ? <Lock className="w-3.5 h-3.5 text-amber-400" /> : <Power className="w-4 h-4" />}
                <span>STOP CONVEYOR</span>
                {!isAdmin && <span className="text-[9px] px-1 bg-amber-950 text-amber-300 rounded border border-amber-800">Admin</span>}
              </button>
            ) : (
              <button
                id="conveyor-start-btn"
                onClick={() => {
                  if (!isAdmin) {
                    onRequestAdmin?.('Start Conveyor Motor');
                    return;
                  }
                  onStartConveyor();
                }}
                disabled={conveyor.eStop}
                className={`px-4 py-2 disabled:opacity-40 font-mono font-bold text-xs rounded-lg transition-all flex items-center gap-2 shadow-md ${
                  !isAdmin
                    ? 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-amber-300'
                    : 'bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white shadow-emerald-950'
                }`}
                title={isAdmin ? "Start conveyor motor" : "Admin access required to start conveyor"}
              >
                {!isAdmin ? <Lock className="w-3.5 h-3.5 text-amber-400" /> : <Power className="w-4 h-4" />}
                <span>START CONVEYOR</span>
                {!isAdmin && <span className="text-[9px] px-1 bg-amber-950 text-amber-300 rounded border border-amber-800">Admin</span>}
              </button>
            )}

            {/* Speed Presets */}
            <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
              <span className="text-xs font-mono text-slate-400">PWM Speed:</span>
              <input
                id="conveyor-speed-range"
                type="range"
                min="0"
                max="255"
                step="5"
                value={conveyor.speedPwm}
                onChange={(e) => {
                  if (!isAdmin) {
                    onRequestAdmin?.('Adjust Conveyor Speed');
                    return;
                  }
                  onSpeedChange(Number(e.target.value));
                }}
                className="w-24 accent-cyan-500 cursor-pointer"
                disabled={!isAdmin}
                title={isAdmin ? "Adjust PWM speed" : "Admin access required to adjust speed"}
              />
              <span className="text-xs font-mono font-bold text-cyan-400 w-10 text-right">
                {conveyor.speedPwm}
              </span>
            </div>

            <div className="flex items-center gap-1">
              {[
                { label: 'Slow', pwm: 100 },
                { label: 'Lab (68%)', pwm: 175 },
                { label: 'Max', pwm: 255 },
              ].map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => {
                    if (!isAdmin) {
                      onRequestAdmin?.(`Set Speed Preset (${preset.label})`);
                      return;
                    }
                    onSpeedChange(preset.pwm);
                  }}
                  className={`px-2 py-1 text-[11px] font-mono rounded transition-colors ${
                    !isAdmin
                      ? 'bg-slate-900 text-slate-500 border border-slate-800 hover:text-slate-300'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  }`}
                  title={isAdmin ? `Set ${preset.label} speed` : "Admin access required"}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* School Testing & Safety Group */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Simulate Detection Button */}
            <button
              id="simulate-metal-trigger-btn"
              onClick={() => {
                if (!isAdmin) {
                  onRequestAdmin?.('Simulate Metal Detection Trigger');
                  return;
                }
                onTriggerMetalSensor();
              }}
              className={`px-3.5 py-2 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 active:scale-95 border ${
                !isAdmin
                  ? 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-amber-300'
                  : isMetalInCoil || sensor.isMetalDetected
                  ? 'bg-red-600 text-white border-red-500 shadow-lg shadow-red-950 animate-pulse'
                  : 'bg-red-950/90 hover:bg-red-900 text-red-200 border-red-800'
              }`}
              title={isAdmin ? "Simulate metallic object detected inside student bag (Pin D1)" : "Admin access required"}
            >
              {!isAdmin ? <Lock className="w-3.5 h-3.5 text-amber-400" /> : <AlertTriangle className="w-4 h-4 text-red-400" />}
              <span>Test Bag Metal Alert (D1)</span>
              {!isAdmin && <span className="text-[9px] px-1 bg-amber-950 text-amber-300 rounded border border-amber-800">Admin</span>}
            </button>

            {/* Test Relay Beacon */}
            <button
              id="test-relay-btn"
              onClick={() => {
                if (!isAdmin) {
                  onRequestAdmin?.('Test Siren / Relay');
                  return;
                }
                onManualReject();
              }}
              className={`px-3 py-2 border rounded-lg text-xs font-mono font-semibold transition-all flex items-center gap-1.5 active:scale-95 ${
                !isAdmin
                  ? 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-amber-300'
                  : 'bg-amber-950/80 hover:bg-amber-900 border-amber-800 text-amber-200'
              }`}
              title={isAdmin ? "Fire 5V Relay module (Pin D5) to test security buzzer/siren" : "Admin access required"}
            >
              {!isAdmin ? <Lock className="w-3.5 h-3.5 text-amber-400" /> : <Sparkles className="w-3.5 h-3.5 text-amber-400" />}
              <span>Test Siren / Relay (D5)</span>
              {!isAdmin && <span className="text-[9px] px-1 bg-amber-950 text-amber-300 rounded border border-amber-800">Admin</span>}
            </button>

            {/* Reset Counters */}
            <button
              id="reset-counters-btn"
              onClick={() => {
                if (!isAdmin) {
                  onRequestAdmin?.('Reset Screening Statistics');
                  return;
                }
                onResetCounters();
              }}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 active:scale-95"
              title={isAdmin ? "Reset total screened, cleared, and metal alert counters" : "Admin access required to reset stats"}
            >
              {!isAdmin ? <Lock className="w-3.5 h-3.5 text-amber-400" /> : <RotateCcw className="w-3.5 h-3.5" />}
              <span>Reset Stats</span>
              {!isAdmin && <span className="text-[9px] px-1 bg-amber-950 text-amber-300 rounded border border-amber-800">Admin</span>}
            </button>

            {/* Emergency Stop */}
            <button
              id="estop-toggle-btn"
              onClick={() => {
                if (!isAdmin) {
                  onRequestAdmin?.('Emergency Stop');
                  return;
                }
                if (conveyor.eStop) {
                  onResetEStop();
                } else {
                  onEStop();
                }
              }}
              className={`px-3.5 py-2 font-mono font-bold text-xs rounded-lg transition-all flex items-center gap-1.5 active:scale-95 ${
                !isAdmin
                  ? 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-amber-300'
                  : conveyor.eStop
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                  : 'bg-red-700 hover:bg-red-600 text-white shadow-lg shadow-red-950'
              }`}
              title={isAdmin ? "Toggle Emergency Stop" : "Admin access required for E-Stop"}
            >
              {!isAdmin ? <Lock className="w-3.5 h-3.5 text-amber-400" /> : <ShieldAlert className="w-4 h-4" />}
              <span>{conveyor.eStop ? 'Reset E-Stop' : 'E-STOP'}</span>
              {!isAdmin && <span className="text-[9px] px-1 bg-amber-950 text-amber-300 rounded border border-amber-800">Admin</span>}
            </button>
          </div>
        </div>
      </div>

      {/* 5. HARDWARE PINOUT QUICK REFERENCE */}
      <div
        id="hardware-pinout-reference"
        className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-4 text-xs font-mono flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-slate-300"
      >
        <div className="flex items-center gap-2 text-cyan-300 font-semibold">
          <Cpu className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>NodeMCU ESP8266 Lab Pinout:</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full md:w-auto">
          <div className="bg-slate-950/80 px-2.5 py-1 rounded border border-slate-800">
            <span className="text-cyan-400 font-bold">D1 (GPIO5):</span> LJ12A3 Sensor
          </div>
          <div className="bg-slate-950/80 px-2.5 py-1 rounded border border-slate-800">
            <span className="text-cyan-400 font-bold">D2 (GPIO4):</span> L298N ENA (PWM)
          </div>
          <div className="bg-slate-950/80 px-2.5 py-1 rounded border border-slate-800">
            <span className="text-cyan-400 font-bold">D3/D4:</span> Motor IN1 & IN2
          </div>
          <div className="bg-slate-950/80 px-2.5 py-1 rounded border border-slate-800">
            <span className="text-cyan-400 font-bold">D5 (GPIO14):</span> 5V Relay Module
          </div>
        </div>
      </div>
    </div>
  );
};
