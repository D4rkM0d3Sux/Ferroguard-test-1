import React from 'react';
import { RejectorState, RejectorType } from '../types';
import { Wrench, Sparkles, Timer, Cpu, ArrowRight, ShieldCheck, GraduationCap } from 'lucide-react';

interface RejectorConfigPanelProps {
  rejector: RejectorState;
  conveyorSpeedPwm: number;
  onTypeChange: (type: RejectorType) => void;
  onRelayLogicToggle?: () => void;
  onToggleAutoReject: () => void;
  onDelayChange: (delayMs: number) => void;
  onPulseChange: (pulseMs: number) => void;
  onManualFire: () => void;
}

export const RejectorConfigPanel: React.FC<RejectorConfigPanelProps> = ({
  rejector,
  conveyorSpeedPwm,
  onTypeChange,
  onRelayLogicToggle,
  onToggleAutoReject,
  onDelayChange,
  onPulseChange,
  onManualFire,
}) => {
  // Estimated distance between coil and reaction station is 50 cm
  // At 100% PWM, travel time is ~800ms, at 50% ~1600ms
  const calculatedRecommendedDelay = Math.max(
    400,
    Math.round(2000 * (150 / Math.max(conveyorSpeedPwm, 30)))
  );

  return (
    <div id="rejector-config-panel" className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl text-slate-100 flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <Wrench className="w-4 h-4 text-amber-400" />
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold tracking-wider uppercase text-slate-200">
                Detection Response & Interlock Control
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 flex items-center gap-1">
                <GraduationCap className="w-3 h-3" /> School Project
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              Auto-Halt Inspection • Relay Output (Pin D5) • Optical / Acoustic Alarms
            </p>
          </div>
        </div>

        {/* Actuator Active Status Indicator */}
        <div className="flex items-center gap-2">
          <span
            className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold uppercase transition-all ${
              rejector.isActive
                ? 'bg-amber-500 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.8)] animate-pulse'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            {rejector.isActive ? 'RELAY / ALARM ACTIVE' : 'STANDBY'}
          </span>

          <button
            id="test-fire-reject-btn"
            onClick={onManualFire}
            className="px-3 py-1 bg-amber-600 hover:bg-amber-500 active:scale-95 text-white font-bold rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 shadow-md"
          >
            <Sparkles className="w-3.5 h-3.5" /> TEST D5 RELAY
          </button>
        </div>
      </div>

      {/* School Project Context Callout */}
      <div className="bg-cyan-950/40 border border-cyan-800/60 rounded-lg p-3 flex items-start gap-2.5 text-xs text-cyan-200">
        <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-cyan-300">No Reject Bin Needed for Demonstration:</span>
          <span className="text-slate-300 text-[11px] leading-relaxed">
            In school prototypes, the conveyor automatically cuts motor power via the <strong>L298N driver</strong> when metal is detected, sounding the buzzer and flashing the LED. You can inspect and pull the metallic item off the belt by hand, then resume the conveyor.
          </span>
        </div>
      </div>

      {/* Action Mode Selector */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
          <Cpu className="w-3.5 h-3.5 text-cyan-400" /> Metal Detection Action Mode:
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { id: 'auto_halt_inspect', label: 'Auto-Halt Belt', desc: 'L298N Stops Motor for Manual Pickup' },
            { id: 'relay_alarm_lamp', label: 'Relay Beacon (D5)', desc: '12V Warning Strobe / Siren Light' },
            { id: 'diverter_arm', label: 'Servo Diverter', desc: 'SG90 / MG996R Sweep Arm' },
            { id: 'pneumatic_pusher', label: 'Solenoid Pusher', desc: '12V Solenoid Plunger' },
          ].map((act) => (
            <button
              key={act.id}
              onClick={() => onTypeChange(act.id as RejectorType)}
              className={`p-2.5 rounded-lg border text-left transition-all ${
                rejector.type === act.id
                  ? 'bg-amber-950/60 border-amber-500 text-amber-200 shadow-sm'
                  : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 text-slate-300'
              }`}
            >
              <div className="text-xs font-semibold">{act.label}</div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">{act.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Relay Module Hardware Polarity Settings */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/40 p-3 rounded-lg border border-slate-800/80">
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-slate-200">Relay Module Optocoupler Trigger Logic (Pin D5)</span>
          <span className="text-[11px] text-slate-400">
            Standard Arduino 5V relay modules are Active LOW (LOW pin = Relay energized, contacts closed)
          </span>
        </div>

        {onRelayLogicToggle && (
          <button
            id="toggle-relay-logic-btn"
            onClick={onRelayLogicToggle}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 rounded text-xs font-mono transition-colors"
          >
            Polarity: <span className="text-cyan-400 font-bold">{rejector.relayLogic === 'active_low' ? 'ACTIVE LOW (Standard)' : 'ACTIVE HIGH'}</span>
          </button>
        )}
      </div>

      {/* Timers & Travel Delay Calibration */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950/60 p-4 rounded-lg border border-slate-800">
        {/* Travel Delay */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Timer className="w-3.5 h-3.5 text-amber-400" /> Reaction Delay (Sensor → Action)
            </span>
            <span className="text-amber-400 font-bold">{rejector.delayMs} ms</span>
          </div>

          <input
            id="reject-delay-slider"
            type="range"
            min={100}
            max={3500}
            step={50}
            value={rejector.delayMs}
            onChange={(e) => onDelayChange(Number(e.target.value))}
            className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
          />

          <div className="flex justify-between items-center text-[10px] font-mono text-slate-500">
            <span>Instant (100ms)</span>
            <button
              onClick={() => onDelayChange(calculatedRecommendedDelay)}
              className="text-cyan-400 hover:underline flex items-center gap-1"
              title="Automatically calculate travel time based on current belt speed"
            >
              Auto-Sync: {calculatedRecommendedDelay}ms <ArrowRight className="w-2.5 h-2.5" />
            </button>
            <span>Delayed (3500ms)</span>
          </div>
        </div>

        {/* Pulse Duration */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-slate-400">Relay / Alarm Duration</span>
            <span className="text-amber-400 font-bold">{rejector.pulseDurationMs} ms</span>
          </div>

          <input
            id="reject-pulse-slider"
            type="range"
            min={100}
            max={2000}
            step={50}
            value={rejector.pulseDurationMs}
            onChange={(e) => onPulseChange(Number(e.target.value))}
            className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
          />

          <div className="flex justify-between items-center text-[10px] font-mono text-slate-500">
            <span>Short (100ms)</span>
            <span>Standard (350ms)</span>
            <span>Long (2000ms)</span>
          </div>
        </div>
      </div>

      {/* Auto-Reject / Auto-Action Master Switch */}
      <div className="flex items-center justify-between bg-slate-950/40 p-3 rounded-lg border border-slate-800/80">
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-slate-200">Automatic Trigger Interlock</span>
          <span className="text-[11px] text-slate-400">
            Trigger D5 relay and alarm alerts automatically when LJ12A3 detects metal
          </span>
        </div>

        <button
          id="toggle-auto-reject-btn"
          onClick={onToggleAutoReject}
          className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all border ${
            rejector.autoReject
              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/80'
              : 'bg-slate-800 text-slate-400 border-slate-700'
          }`}
        >
          {rejector.autoReject ? 'AUTO-ACTION ENABLED' : 'MANUAL ONLY'}
        </button>
      </div>
    </div>
  );
};
