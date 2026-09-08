import React from 'react';
import { ConveyorState } from '../types';
import { Play, Square, AlertOctagon, RotateCw, Gauge, ShieldAlert } from 'lucide-react';

interface ConveyorControlDeckProps {
  conveyor: ConveyorState;
  onStart: () => void;
  onStop: () => void;
  onEStop: () => void;
  onResetEStop: () => void;
  onSpeedChange: (pwm: number) => void;
  onDirectionToggle: () => void;
  onToggleAutoStop: () => void;
}

export const ConveyorControlDeck: React.FC<ConveyorControlDeckProps> = ({
  conveyor,
  onStart,
  onStop,
  onEStop,
  onResetEStop,
  onSpeedChange,
  onDirectionToggle,
  onToggleAutoStop,
}) => {
  const speedPercent = Math.round((conveyor.speedPwm / 255) * 100);

  return (
    <div id="conveyor-control-deck" className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl text-slate-100 flex flex-col gap-4">
      {/* Header with Title and E-Stop button */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <Gauge className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-semibold tracking-wider uppercase text-slate-200">
            Conveyor Drive Controller (L298N / D2 PWM)
          </h3>
        </div>

        {/* E-STOP Button */}
        {conveyor.eStop ? (
          <button
            id="reset-estop-btn"
            onClick={onResetEStop}
            className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold rounded-lg text-xs tracking-wider transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(245,158,11,0.5)] animate-pulse"
          >
            <RotateCw className="w-4 h-4" /> RESET E-STOP LATCH
          </button>
        ) : (
          <button
            id="emergency-stop-btn"
            onClick={onEStop}
            className="px-4 py-1.5 bg-red-600 hover:bg-red-500 active:scale-95 text-white font-bold rounded-lg text-xs tracking-wider transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(239,68,68,0.5)]"
          >
            <AlertOctagon className="w-4 h-4 text-white" /> EMERGENCY STOP
          </button>
        )}
      </div>

      {/* Main Drive Buttons & Direction */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Run / Stop Main Button */}
        {conveyor.running ? (
          <button
            id="conveyor-stop-btn"
            onClick={onStop}
            disabled={conveyor.eStop}
            className="col-span-1 sm:col-span-2 py-3 px-4 bg-amber-600 hover:bg-amber-500 active:scale-98 disabled:opacity-50 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg"
          >
            <Square className="w-5 h-5 fill-current" />
            <span>HALT CONVEYOR BELT</span>
          </button>
        ) : conveyor.haltedByDetection ? (
          <button
            id="conveyor-resume-btn"
            onClick={onStart}
            disabled={conveyor.eStop}
            className="col-span-1 sm:col-span-2 py-3 px-4 bg-amber-500 hover:bg-amber-400 active:scale-98 disabled:opacity-50 text-slate-950 font-bold rounded-lg transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(245,158,11,0.5)] animate-pulse"
            title="Inspection complete, resume conveyor motor"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>RESUME CONVEYOR (INSPECTION COMPLETE)</span>
          </button>
        ) : (
          <button
            id="conveyor-start-btn"
            onClick={onStart}
            disabled={conveyor.eStop}
            className="col-span-1 sm:col-span-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-98 disabled:opacity-50 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>START CONVEYOR MOTOR</span>
          </button>
        )}

        {/* Direction Toggle */}
        <button
          id="conveyor-direction-toggle-btn"
          onClick={onDirectionToggle}
          disabled={conveyor.eStop || conveyor.running}
          className="py-3 px-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 border border-slate-700 rounded-lg text-xs font-mono font-medium transition-all flex items-center justify-center gap-2"
          title="Change motor H-Bridge direction (requires belt stopped)"
        >
          <RotateCw className="w-4 h-4 text-cyan-400" />
          <span>DIR: {conveyor.direction.toUpperCase()}</span>
        </button>
      </div>

      {/* Speed Slider & Telemetry Readouts */}
      <div className="bg-slate-950/60 p-4 rounded-lg border border-slate-800 flex flex-col gap-3">
        <div className="flex justify-between items-center text-xs font-mono">
          <span className="text-slate-400">PWM Speed Duty Cycle (Pin D2)</span>
          <div className="flex items-center gap-3">
            <span className="text-slate-400">
              {conveyor.rpm} <span className="text-[10px] text-slate-500">RPM</span>
            </span>
            <span className="text-slate-400">
              {conveyor.linearSpeedMps.toFixed(2)} <span className="text-[10px] text-slate-500">m/s</span>
            </span>
            <span className="text-emerald-400 font-bold text-sm">{speedPercent}% ({conveyor.speedPwm} PWM)</span>
          </div>
        </div>

        <input
          id="conveyor-speed-slider"
          type="range"
          min={0}
          max={255}
          step={1}
          value={conveyor.speedPwm}
          disabled={conveyor.eStop}
          onChange={(e) => onSpeedChange(Number(e.target.value))}
          className="w-full accent-emerald-500 cursor-pointer h-2 bg-slate-800 rounded-lg appearance-none disabled:opacity-40"
        />

        {/* Speed Quick Presets */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-1.5">
            {[
              { label: 'Low (25%)', val: 64 },
              { label: 'Nominal (60%)', val: 153 },
              { label: 'High (85%)', val: 217 },
              { label: 'Max (100%)', val: 255 },
            ].map((preset) => (
              <button
                key={preset.label}
                disabled={conveyor.eStop}
                onClick={() => onSpeedChange(preset.val)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-all ${
                  conveyor.speedPwm === preset.val
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                    : 'bg-slate-800/80 hover:bg-slate-750 text-slate-400 border-slate-700'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Auto-Stop on Metal Toggle */}
          <button
            id="toggle-auto-stop-btn"
            onClick={onToggleAutoStop}
            className={`px-3 py-1 rounded text-xs font-mono transition-all flex items-center gap-1.5 border ${
              conveyor.autoStopOnMetal
                ? 'bg-red-950/80 text-red-300 border-red-700/80 font-bold'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
            title="When active, detection of metallic object halts the conveyor automatically"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            Auto-Stop on Metal: {conveyor.autoStopOnMetal ? 'ENABLED' : 'DISABLED'}
          </button>
        </div>
      </div>
    </div>
  );
};
