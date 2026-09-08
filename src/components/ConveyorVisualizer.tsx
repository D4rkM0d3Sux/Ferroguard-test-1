import React, { useEffect, useRef, useState } from 'react';
import { ConveyorState, RejectorState, MetalSensorState } from '../types';
import {
  RotateCw,
  Play,
  AlertTriangle,
  Bell,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Sliders,
  Package,
  Zap,
  Lock,
} from 'lucide-react';

interface ConveyorVisualizerProps {
  conveyor: ConveyorState;
  sensor?: MetalSensorState;
  rejector: RejectorState;
  isMetalInCoil: boolean;
  autoSimulateMetal?: boolean;
  simMetalFrequency?: number;
  bagsUntilNextMetal?: number;
  onToggleAutoSimulateMetal?: () => void;
  onChangeSimMetalFrequency?: (freq: number) => void;
  onTriggerMetalSensor: () => void;
  onClearHaltedMetal?: () => void;
  onManualReject: () => void;
  isAdmin?: boolean;
  onRequestAdmin?: (actionTitle?: string) => void;
}

export const ConveyorVisualizer: React.FC<ConveyorVisualizerProps> = ({
  conveyor,
  rejector,
  isMetalInCoil,
  autoSimulateMetal = true,
  simMetalFrequency = 8,
  bagsUntilNextMetal = 8,
  onToggleAutoSimulateMetal,
  onChangeSimMetalFrequency,
  onTriggerMetalSensor,
  onClearHaltedMetal,
  onManualReject,
  isAdmin = false,
  onRequestAdmin,
}) => {
  const [beltOffset, setBeltOffset] = useState<number>(0);
  const [beltProgress, setBeltProgress] = useState<number>(0);
  const animFrameRef = useRef<number>(0);

  // Continuous belt animation loop
  useEffect(() => {
    let lastTime = performance.now();
    const animate = (currentTime: number) => {
      const dt = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      if (conveyor.running && !conveyor.eStop && !conveyor.haltedByDetection) {
        const directionMultiplier = conveyor.direction === 'forward' ? 1 : -1;
        const speedFactor = (conveyor.speedPwm / 255) * 80; // px/sec
        setBeltOffset((prev) => (prev + directionMultiplier * speedFactor * dt) % 32);

        // Progress 0-100% across belt
        const progressSpeed = (conveyor.speedPwm / 255) * 22; // percent/sec
        setBeltProgress((prev) => (prev + directionMultiplier * progressSpeed * dt) % 100);
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [conveyor.running, conveyor.eStop, conveyor.haltedByDetection, conveyor.direction, conveyor.speedPwm]);

  // Derive visual bags on belt
  // When halted on detection, a bag is halted directly at the inspection position (38%)
  const isHaltedOnMetal = conveyor.haltedByDetection || isMetalInCoil;

  return (
    <div
      id="conveyor-visualizer-container"
      className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-xl text-slate-100 flex flex-col gap-3.5"
    >
      {/* Top Header & Machine Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <span
              className={`block w-3 h-3 rounded-full ${
                conveyor.eStop
                  ? 'bg-red-500 animate-ping'
                  : isHaltedOnMetal
                  ? 'bg-amber-400 animate-pulse ring-4 ring-amber-400/20'
                  : conveyor.running
                  ? 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]'
                  : 'bg-slate-600'
              }`}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold tracking-wider uppercase text-slate-200">
                Virtual Hardware Rig & Conveyor Track
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                ESP8266 Live Emulation
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              STATUS:{' '}
              {conveyor.eStop ? (
                <span className="text-red-400 font-bold">EMERGENCY STOPPED</span>
              ) : isHaltedOnMetal ? (
                <span className="text-amber-300 font-bold">HALTED ON METAL (INSPECTION INTERLOCK)</span>
              ) : conveyor.running ? (
                <span className="text-emerald-400 font-bold">
                  BELT ACTIVE ({conveyor.rpm} RPM • {conveyor.direction.toUpperCase()} • PWM: {conveyor.speedPwm})
                </span>
              ) : (
                <span className="text-slate-400">BELT IDLE (STANDBY)</span>
              )}
            </p>
          </div>
        </div>

        {/* Diagnostic Actions */}
        <div className="flex items-center gap-2">
          <button
            id="simulate-metal-trigger-btn"
            onClick={() => {
              if (!isAdmin) {
                onRequestAdmin?.('Simulate Metal Detection Trigger');
                return;
              }
              onTriggerMetalSensor();
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all flex items-center gap-1.5 active:scale-95 border ${
              !isAdmin
                ? 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-amber-300 hover:border-amber-700'
                : isMetalInCoil
                ? 'bg-red-600 text-white border-red-500 shadow-[0_0_16px_rgba(239,68,68,0.7)]'
                : 'bg-red-950/80 hover:bg-red-900 text-red-200 border-red-800/80 shadow-sm'
            }`}
            title={isAdmin ? "Simulate a metal specimen passing the LJ12A3 inductive sensor (triggers Pin D1)" : "Admin access required to trigger sensor test"}
          >
            {!isAdmin ? (
              <Lock className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <AlertTriangle className={`w-3.5 h-3.5 ${isMetalInCoil ? 'animate-bounce' : 'text-red-400'}`} />
            )}
            <span>Simulate Metal Trigger (Pin D1)</span>
            {!isAdmin && <span className="text-[9px] px-1 bg-amber-950/80 text-amber-400 rounded border border-amber-800/60">Admin</span>}
          </button>

          <button
            id="manual-reject-stroke-btn"
            onClick={() => {
              if (!isAdmin) {
                onRequestAdmin?.('Test 5V Relay Alarm');
                return;
              }
              onManualReject();
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 active:scale-95 border ${
              !isAdmin
                ? 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-amber-300 hover:border-amber-700'
                : 'bg-amber-950/80 hover:bg-amber-900 border-amber-700/60 text-amber-200'
            }`}
            title={isAdmin ? "Energize 5V Relay on Pin D5 (turns on alarm beacon/buzzer)" : "Admin access required to test alarm relay"}
          >
            {!isAdmin ? (
              <Lock className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span>Test Relay (D5)</span>
            {!isAdmin && <span className="text-[9px] px-1 bg-amber-950/80 text-amber-400 rounded border border-amber-800/60">Admin</span>}
          </button>
        </div>
      </div>

      {/* Virtual Rig Simulation Control Deck */}
      <div
        id="virtual-rig-simulation-deck"
        className="bg-slate-950/80 border border-slate-800 rounded-lg p-2.5 sm:p-3 flex flex-wrap items-center justify-between gap-3 text-xs font-mono"
      >
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-blue-950/80 border border-blue-800 text-blue-300">
            <Sliders className="w-3.5 h-3.5 text-blue-400" />
            <span className="font-bold">VIRTUAL RIG AUTOMATION:</span>
          </div>

          {!isAdmin && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800/80 text-amber-300 text-[11px]">
              <Lock className="w-3 h-3 text-amber-400" />
              <span>Observer Mode (Controls Locked)</span>
            </div>
          )}

          {/* Auto-flag toggle */}
          {onToggleAutoSimulateMetal && (
            <button
              id="toggle-auto-simulate-metal-btn"
              onClick={() => {
                if (!isAdmin) {
                  onRequestAdmin?.('Toggle Virtual Rig Auto-Simulation');
                  return;
                }
                onToggleAutoSimulateMetal();
              }}
              className={`px-3 py-1 rounded transition-colors flex items-center gap-1.5 border font-semibold ${
                !isAdmin
                  ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  : autoSimulateMetal
                  ? 'bg-emerald-950/80 border-emerald-600 text-emerald-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
              title={isAdmin ? "Automatically flags metal in bags during virtual rig conveyor simulation" : "Admin access required"}
            >
              {!isAdmin && <Lock className="w-3 h-3 text-amber-400" />}
              <span className={`w-2 h-2 rounded-full ${autoSimulateMetal ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
              <span>Auto-Flag Metal in Virtual Rig: {autoSimulateMetal ? 'ON' : 'OFF'}</span>
            </button>
          )}

          {/* Frequency Selector */}
          {autoSimulateMetal && onChangeSimMetalFrequency && (
            <div className="flex items-center gap-1 text-[11px] text-slate-400">
              <span className="text-slate-500">Alert Frequency:</span>
              {[
                { label: 'Frequent (~25% / 1 in 4)', value: 4 },
                { label: 'Realistic (~12% / 1 in 8)', value: 8 },
                { label: 'Sparse (~6% / 1 in 16)', value: 16 },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    if (!isAdmin) {
                      onRequestAdmin?.('Change Simulation Alert Frequency');
                      return;
                    }
                    onChangeSimMetalFrequency(opt.value);
                  }}
                  className={`px-2 py-0.5 rounded transition-all ${
                    simMetalFrequency === opt.value
                      ? 'bg-cyan-900 border border-cyan-500 text-cyan-200 font-bold'
                      : 'bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          {autoSimulateMetal ? (
            <span>
              Next simulated test bag with metal in:{' '}
              <strong className="text-amber-300 font-mono text-xs">{bagsUntilNextMetal}</strong> bags
            </span>
          ) : (
            <span className="text-slate-500 italic">
              Pure clean baggage mode (manual triggers only)
            </span>
          )}
        </div>
      </div>

      {/* Conveyor Auto-Halted Alert Banner */}
      {conveyor.haltedByDetection && (
        <div
          id="conveyor-halted-interlock-box"
          className="bg-amber-950/90 border border-amber-500/80 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 shadow-md"
        >
          <div className="flex items-center gap-2.5 text-amber-200 font-mono text-xs">
            <AlertTriangle className="w-5 h-5 text-amber-400 animate-bounce shrink-0" />
            <div>
              <span className="font-bold text-amber-100 uppercase tracking-wide">
                Metal Detected by LJ12A3 Sensor — Conveyor Auto-Halted
              </span>
              <p className="text-[11px] text-amber-300/80 font-sans mt-0.5">
                L298N motor driver stopped (ENA=0). Remove the contraband specimen from the baggage and click resume.
              </p>
            </div>
          </div>
          {onClearHaltedMetal && (
            <button
              id="conveyor-resume-interlock-btn"
              onClick={() => {
                if (!isAdmin) {
                  onRequestAdmin?.('Resume Conveyor after Metal Detection');
                  return;
                }
                onClearHaltedMetal();
              }}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 shadow-md active:scale-95"
              title={isAdmin ? "Clear halted metal and resume conveyor" : "Admin access required to resume conveyor"}
            >
              {!isAdmin ? <Lock className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              <span>Bag Inspected — Resume Conveyor</span>
              {!isAdmin && <span className="text-[9px] px-1 bg-amber-900 text-amber-200 rounded">Admin</span>}
            </button>
          )}
        </div>
      )}

      {/* Machine Schematic Stage with Moving Bags */}
      <div className="relative w-full bg-slate-950/95 rounded-lg border border-slate-800 p-4 flex flex-col gap-2">
        {/* Track Diagram */}
        <div className="relative flex items-center justify-between gap-2 py-4">
          {/* STATION 1: L298N Motor Driver */}
          <div className="flex flex-col items-center gap-1 shrink-0 z-10">
            <div className="bg-slate-900 border border-slate-700 px-2.5 py-1.5 rounded-lg flex flex-col items-center shadow">
              <div className="flex items-center gap-1.5">
                <RotateCw
                  className={`w-4 h-4 ${
                    conveyor.running && !conveyor.eStop && !conveyor.haltedByDetection
                      ? 'text-cyan-400 animate-spin'
                      : 'text-slate-500'
                  }`}
                />
                <span className="text-xs font-bold font-mono text-slate-200">L298N Motor</span>
              </div>
              <span className="text-[9px] font-mono text-slate-400 mt-0.5">
                Pin D2 (ENA: {conveyor.running && !conveyor.haltedByDetection ? conveyor.speedPwm : 0})
              </span>
            </div>
            <span className="text-[10px] font-mono text-cyan-400">
              {conveyor.direction === 'forward' ? 'FWD' : 'REV'}
            </span>
          </div>

          {/* STATION 2: Conveyor Belt Span with Simulated Bags */}
          <div className="relative flex-1 h-20 bg-slate-800 rounded-md border-y-2 border-slate-700 flex items-center overflow-hidden mx-2 shadow-inner">
            {/* Belt moving surface texture */}
            <div
              className="absolute inset-0 opacity-25"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(90deg, #090d16 0px, #090d16 10px, #334155 10px, #334155 20px)',
                backgroundPosition: `${beltOffset}px 0`,
              }}
            />

            {/* Direction Arrows on belt surface */}
            <div className="w-full flex justify-around text-slate-500/50 pointer-events-none z-0">
              {conveyor.direction === 'forward' ? (
                <>
                  <ArrowRight className={`w-4 h-4 ${conveyor.running && !isHaltedOnMetal ? 'text-cyan-400/60' : ''}`} />
                  <ArrowRight className={`w-4 h-4 ${conveyor.running && !isHaltedOnMetal ? 'text-cyan-400/60' : ''}`} />
                  <ArrowRight className={`w-4 h-4 ${conveyor.running && !isHaltedOnMetal ? 'text-cyan-400/60' : ''}`} />
                  <ArrowRight className={`w-4 h-4 ${conveyor.running && !isHaltedOnMetal ? 'text-cyan-400/60' : ''}`} />
                </>
              ) : (
                <>
                  <ArrowLeft className={`w-4 h-4 ${conveyor.running && !isHaltedOnMetal ? 'text-amber-400/60' : ''}`} />
                  <ArrowLeft className={`w-4 h-4 ${conveyor.running && !isHaltedOnMetal ? 'text-amber-400/60' : ''}`} />
                </>
              )}
            </div>

            {/* Inspection Zone Marker (Positioned right at 38% under the sensor) */}
            <div className="absolute left-[38%] -translate-x-1/2 top-0 bottom-0 w-20 border-x border-dashed border-cyan-500/40 bg-cyan-500/5 flex items-center justify-center pointer-events-none">
              <span className="text-[8px] font-mono text-cyan-400/80 uppercase font-semibold">Inspect</span>
            </div>

            {/* SIMULATED BAGS ON BELT */}
            {isHaltedOnMetal ? (
              // Halted Bag right under the sensor coil
              <div
                className="absolute left-[38%] -translate-x-1/2 flex flex-col items-center z-30 animate-pulse"
                style={{ top: '10%' }}
              >
                <div className="bg-red-600 text-white px-2 py-1 rounded-md shadow-[0_0_20px_rgba(239,68,68,0.9)] border border-red-400 flex items-center gap-1">
                  <Package className="w-4 h-4" />
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider">Metal Alert</span>
                </div>
                <div className="text-[9px] font-mono bg-red-950/90 text-red-200 px-1.5 py-0.2 rounded border border-red-800 mt-0.5">
                  Bag Halted
                </div>
              </div>
            ) : (
              // Moving bags when belt is advancing or idle
              [
                { offset: 0, label: 'Baggage #A' },
                { offset: 33.3, label: 'Baggage #B' },
                { offset: 66.6, label: 'Baggage #C' },
              ].map((item, idx) => {
                const pos = (beltProgress + item.offset) % 100;
                // Check if this bag is currently near the sensor (~35% to 41%)
                const isNearSensor = Math.abs(pos - 38) < 6;

                return (
                  <div
                    key={idx}
                    className="absolute -translate-x-1/2 flex flex-col items-center z-10 transition-transform"
                    style={{ left: `${pos}%`, top: '15%' }}
                  >
                    <div
                      className={`px-2 py-1 rounded-md shadow flex items-center gap-1 border transition-all ${
                        isNearSensor
                          ? 'bg-cyan-900 border-cyan-400 text-cyan-100 shadow-[0_0_12px_rgba(6,182,212,0.6)]'
                          : 'bg-slate-900/95 border-slate-700 text-slate-300'
                      }`}
                    >
                      <Package className={`w-3.5 h-3.5 ${isNearSensor ? 'text-cyan-300' : 'text-slate-400'}`} />
                      <span className="text-[9px] font-mono font-semibold">
                        {isNearSensor ? 'Scanning...' : item.label}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* STATION 3: LJ12A3-4-Z/BX Inductive Sensor Head */}
          <div className="absolute left-[38%] -top-1 -translate-x-1/2 flex flex-col items-center z-40 pointer-events-none">
            {/* Sensor Probe Head */}
            <div
              className={`px-2.5 py-1 rounded border text-center transition-all duration-200 shadow-lg ${
                isHaltedOnMetal
                  ? 'bg-red-950 border-red-500 shadow-[0_0_24px_rgba(239,68,68,0.9)] scale-105'
                  : 'bg-slate-900 border-cyan-600/70 shadow-sm'
              }`}
            >
              <div className="flex items-center gap-1.5 justify-center">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isHaltedOnMetal
                      ? 'bg-red-500 animate-ping'
                      : 'bg-cyan-400'
                  }`}
                />
                <span className="text-[10px] font-mono font-bold text-slate-100">
                  LJ12A3 (Pin D1)
                </span>
              </div>
              <div
                className={`text-[8px] font-mono font-bold mt-0.5 ${
                  isHaltedOnMetal ? 'text-red-300 animate-pulse' : 'text-slate-400'
                }`}
              >
                {isHaltedOnMetal ? '⚠ METAL DETECTED (LOW)' : 'CLEAR (HIGH)'}
              </div>
            </div>
            {/* Sensor inductive beam down to the belt */}
            <div
              className={`w-1 h-3.5 transition-colors ${
                isHaltedOnMetal
                  ? 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,1)]'
                  : 'bg-cyan-500/60'
              }`}
            />
          </div>

          {/* STATION 4: 5V Relay & Warning Alarm Light */}
          <div className="flex flex-col items-center gap-1 shrink-0 z-10">
            <div
              className={`px-2.5 py-1.5 rounded-lg border flex flex-col items-center transition-all shadow ${
                rejector.isActive || isHaltedOnMetal
                  ? 'bg-amber-950/90 border-amber-500 text-amber-200 shadow-[0_0_16px_rgba(245,158,11,0.6)]'
                  : 'bg-slate-900 border-slate-700 text-slate-300'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Bell
                  className={`w-4 h-4 ${
                    rejector.isActive || isHaltedOnMetal
                      ? 'text-amber-400 animate-bounce'
                      : 'text-slate-500'
                  }`}
                />
                <span className="text-xs font-bold font-mono">Relay D5</span>
              </div>
              <span className="text-[9px] font-mono text-slate-400 mt-0.5">
                {rejector.isActive || isHaltedOnMetal ? 'ALARM ON' : 'IDLE'}
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-400">Alarm Beacon</span>
          </div>

          {/* STATION 5: Outfeed Idler */}
          <div className="flex flex-col items-center gap-1 shrink-0 z-10">
            <div className="bg-slate-900 border border-slate-700 px-2.5 py-1.5 rounded-lg flex flex-col items-center shadow">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-[9px] font-mono text-slate-300 font-bold mt-0.5">Outfeed</span>
            </div>
            <span className="text-[10px] font-mono text-slate-500">Cleared Exit</span>
          </div>
        </div>

        {/* Linear Measurement Baseline */}
        <div className="flex justify-between text-[9px] font-mono text-slate-500 px-2 pt-1 border-t border-slate-800/80">
          <span>0 cm (Infeed / Motor)</span>
          <span className="text-cyan-400 font-semibold">45 cm (LJ12A3 Sensor)</span>
          <span className="text-amber-400 font-semibold">80 cm (Relay Alarm / Halt)</span>
          <span>120 cm (Cleared Discharge)</span>
        </div>
      </div>

      {/* Hardware Pin Mapping Ribbon */}
      <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 font-mono gap-2 pt-1 border-t border-slate-800/60">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1 text-slate-300">
            <span className="w-2 h-2 rounded-full bg-cyan-400" /> Sensor: <strong>Pin D1</strong> (GPIO5)
          </span>
          <span className="flex items-center gap-1 text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400" /> Speed: <strong>Pin D2</strong> (ENA PWM)
          </span>
          <span className="flex items-center gap-1 text-slate-300">
            <span className="w-2 h-2 rounded-full bg-blue-400" /> Direction: <strong>D3 / D4</strong> (IN1/IN2)
          </span>
          <span className="flex items-center gap-1 text-slate-300">
            <span className="w-2 h-2 rounded-full bg-amber-400" /> Relay: <strong>Pin D5</strong> (GPIO14)
          </span>
          <span className="flex items-center gap-1 text-slate-300">
            <span className="w-2 h-2 rounded-full bg-purple-400" /> Buzzer: <strong>Pin D8</strong> (GPIO15)
          </span>
        </div>
      </div>
    </div>
  );
};
