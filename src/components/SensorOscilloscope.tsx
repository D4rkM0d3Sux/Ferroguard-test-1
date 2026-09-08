import React, { useEffect, useRef } from 'react';
import { MetalSensorState } from '../types';
import { Activity, Sliders, RefreshCw, Zap } from 'lucide-react';

interface SensorOscilloscopeProps {
  sensor: MetalSensorState;
  onThresholdChange: (newThreshold: number) => void;
  onZeroBaseline: () => void;
  onFilterChange: (mode: MetalSensorState['filterMode']) => void;
}

export const SensorOscilloscope: React.FC<SensorOscilloscopeProps> = ({
  sensor,
  onThresholdChange,
  onZeroBaseline,
  onFilterChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dataHistoryRef = useRef<number[]>(new Array(120).fill(180));

  // Push new signal value into history ring buffer
  useEffect(() => {
    const history = dataHistoryRef.current;
    history.push(sensor.currentSignal);
    if (history.length > 140) {
      history.shift();
    }
  }, [sensor.currentSignal]);

  // Render loop for oscilloscope waveform
  useEffect(() => {
    let animId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;
      const history = dataHistoryRef.current;

      // Clear with dark background
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, width, height);

      // Draw subtle grid
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;

      // Horizontal grid lines
      for (let y = 0; y < height; y += 30) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Vertical time slices
      for (let x = 0; x < width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // Max scale is 1024 ADC
      const maxVal = 1024;

      // Draw Threshold Line
      const thresholdY = height - (sensor.threshold / maxVal) * height;
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, thresholdY);
      ctx.lineTo(width, thresholdY);
      ctx.stroke();
      ctx.setLineDash([]); // Reset dash

      // Threshold label
      ctx.fillStyle = '#ef4444';
      ctx.font = '10px monospace';
      ctx.fillText(`TRIGGER THRESHOLD: ${sensor.threshold}`, width - 170, Math.max(14, thresholdY - 4));

      // Draw Baseline Line
      const baselineY = height - (sensor.baseline / maxVal) * height;
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(0, baselineY);
      ctx.lineTo(width, baselineY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw Signal Waveform
      ctx.beginPath();
      ctx.lineWidth = 2.5;

      const stepX = width / (history.length - 1);

      for (let i = 0; i < history.length; i++) {
        const val = history[i];
        const x = i * stepX;
        const y = height - (val / maxVal) * height;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      // Glow effect if metal is detected
      if (sensor.isMetalDetected) {
        ctx.strokeStyle = '#f87171';
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 10;
      } else {
        ctx.strokeStyle = '#38bdf8';
        ctx.shadowColor = '#0284c7';
        ctx.shadowBlur = 4;
      }
      ctx.stroke();
      ctx.shadowBlur = 0; // reset

      // Draw active cursor dot at latest point
      const lastX = width - 1;
      const lastY = height - (sensor.currentSignal / maxVal) * height;
      ctx.beginPath();
      ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
      ctx.fillStyle = sensor.isMetalDetected ? '#ef4444' : '#38bdf8';
      ctx.fill();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [sensor.threshold, sensor.baseline, sensor.isMetalDetected, sensor.currentSignal]);

  const percentageOfThreshold = Math.min(100, Math.round((sensor.currentSignal / sensor.threshold) * 100));

  return (
    <div id="sensor-oscilloscope-card" className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col gap-4 text-slate-100">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <Activity className="w-4 h-4 text-cyan-400" />
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold tracking-wider uppercase text-slate-200">
                Inductive Proximity Sensor Telemetry
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                LJ12A3-4-Z/BX
              </span>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              M12 NPN NO • 4mm Sensing Field • Pin D1 via 12V→3.3V Divider
            </span>
          </div>
        </div>

        {/* Status Pill */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-xs font-mono">
            <span className="text-slate-400">STATE:</span>
            <span className={`font-bold ${sensor.isMetalDetected ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`}>
              {sensor.isMetalDetected ? 'TRIGGERED (LOW)' : 'OPEN (HIGH)'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-xs font-mono">
            <span className="text-slate-400">SIGNAL:</span>
            <span className={`font-bold ${sensor.isMetalDetected ? 'text-red-400 animate-pulse' : 'text-cyan-300'}`}>
              {sensor.currentSignal} <span className="text-[10px] text-slate-500">ADC</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-xs font-mono">
            <span className="text-slate-400">PEAK:</span>
            <span className="text-amber-400 font-bold">{sensor.peakSignal}</span>
          </div>
        </div>
      </div>

      {/* Live Waveform Canvas */}
      <div className="relative w-full h-44 rounded-lg overflow-hidden border border-slate-800 bg-[#090d16]">
        <canvas
          ref={canvasRef}
          width={640}
          height={176}
          className="w-full h-full block"
        />

        {/* Metal alarm flash overlay */}
        {sensor.isMetalDetected && (
          <div className="absolute inset-0 bg-red-500/15 pointer-events-none animate-pulse flex items-center justify-center">
            <div className="bg-red-950/90 border border-red-500 text-red-200 px-3 py-1 rounded-md text-xs font-mono font-bold tracking-wider flex items-center gap-1.5 shadow-lg">
              <Zap className="w-3.5 h-3.5 text-red-400" /> METALLIC FIELD DISTORTION DETECTED
            </div>
          </div>
        )}
      </div>

      {/* Threshold & Sensitivity Control Sliders */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950/60 p-3.5 rounded-lg border border-slate-800">
        {/* Threshold Adjustment Slider */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-red-400" /> Detection Trigger Threshold
            </span>
            <span className="text-red-400 font-bold">{sensor.threshold} ADC</span>
          </div>
          <input
            id="sensor-threshold-slider"
            type="range"
            min={150}
            max={900}
            step={5}
            value={sensor.threshold}
            onChange={(e) => onThresholdChange(Number(e.target.value))}
            className="w-full accent-red-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>High Sensitivity (150)</span>
            <span>Default (450)</span>
            <span>Low Sensitivity (900)</span>
          </div>
        </div>

        {/* Detection Proximity Bar & Calibration */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-slate-400">Sensor Margin to Trigger</span>
            <span className={`${percentageOfThreshold >= 100 ? 'text-red-400 font-bold' : 'text-slate-300'}`}>
              {percentageOfThreshold}%
            </span>
          </div>

          {/* Meter progress */}
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden flex">
            <div
              className={`h-full transition-all duration-75 ${
                percentageOfThreshold >= 100
                  ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]'
                  : percentageOfThreshold >= 80
                  ? 'bg-amber-500'
                  : 'bg-cyan-500'
              }`}
              style={{ width: `${Math.min(100, percentageOfThreshold)}%` }}
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              id="zero-baseline-btn"
              onClick={onZeroBaseline}
              className="text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded transition-colors flex items-center gap-1.5 font-mono"
              title="Recalibrates zero-point baseline from current coil resting level"
            >
              <RefreshCw className="w-3 h-3 text-cyan-400" /> Zero Sensor Baseline
            </button>

            {/* Filter Toggle */}
            <div className="flex items-center gap-1 text-[11px] font-mono">
              <span className="text-slate-400">Filter:</span>
              {(['raw', 'moving_avg', 'peak_hold'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => onFilterChange(m)}
                  className={`px-1.5 py-0.5 rounded uppercase text-[10px] ${
                    sensor.filterMode === m
                      ? 'bg-cyan-900/80 text-cyan-300 border border-cyan-700 font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {m === 'moving_avg' ? 'AVG' : m === 'peak_hold' ? 'PEAK' : 'RAW'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
