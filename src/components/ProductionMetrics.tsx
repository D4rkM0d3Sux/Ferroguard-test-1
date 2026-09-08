import React from 'react';
import { ProductionCounters } from '../types';
import { BarChart3, CheckCircle2, AlertTriangle, RotateCcw, Box, TrendingUp } from 'lucide-react';

interface ProductionMetricsProps {
  counters: ProductionCounters;
  onResetCounters: () => void;
  onBatchTargetChange: (newTarget: number) => void;
}

export const ProductionMetrics: React.FC<ProductionMetricsProps> = ({
  counters,
  onResetCounters,
  onBatchTargetChange,
}) => {
  const totalScreened = Math.max(
    counters.totalPassed,
    counters.cleanPassed + counters.metalDetected
  );

  const defectRateNum = totalScreened > 0
    ? (counters.metalDetected / totalScreened) * 100
    : 0;
  const defectRate = defectRateNum.toFixed(1);
  const cleanRate = totalScreened > 0
    ? (100 - parseFloat(defectRate)).toFixed(1)
    : '100.0';

  const batchProgress = counters.batchTarget > 0
    ? Math.min(100, Math.round((counters.currentBatch / counters.batchTarget) * 100))
    : 0;

  return (
    <div id="production-metrics-container" className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl text-slate-100 flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <BarChart3 className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-semibold tracking-wider uppercase text-slate-200">
            Inspection Telemetry & Batch Statistics
          </h3>
        </div>

        <button
          id="reset-counters-btn"
          onClick={onResetCounters}
          className="text-xs font-mono text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded transition-colors flex items-center gap-1.5"
          title="Reset total counts and defect rates"
        >
          <RotateCcw className="w-3 h-3 text-cyan-400" /> Reset Counters
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Inspected */}
        <div className="bg-slate-950/70 border border-slate-800 p-3.5 rounded-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>TOTAL INSPECTED</span>
            <Box className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-100 mt-2">
            {totalScreened.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-1">Conveyor throughput</div>
        </div>

        {/* Clean Passed */}
        <div className="bg-slate-950/70 border border-emerald-950 p-3.5 rounded-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-emerald-400 font-mono">
            <span>CLEAN PASSED</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-300 mt-2">
            {counters.cleanPassed.toLocaleString()}
          </div>
          <div className="text-[10px] text-emerald-600 font-mono mt-1">{cleanRate}% qualified</div>
        </div>

        {/* Metal Contaminants / Detections */}
        <div className="bg-slate-950/70 border border-red-950 p-3.5 rounded-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-red-400 font-mono">
            <span>METAL DETECTIONS</span>
            <AlertTriangle className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-red-400 mt-2">
            {counters.metalDetected.toLocaleString()}
          </div>
          <div className="text-[10px] text-red-500/80 font-mono mt-1">{defectRate}% flagged alert</div>
        </div>

        {/* Defect Rate % */}
        <div className="bg-slate-950/70 border border-amber-950 p-3.5 rounded-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-amber-400 font-mono">
            <span>CONTAMINATION %</span>
            <TrendingUp className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-300 mt-2">
            {defectRate}%
          </div>
          <div className="text-[10px] text-amber-500/80 font-mono mt-1">
            Throughput: {counters.itemsPerMin} items/min
          </div>
        </div>
      </div>

      {/* Batch Progress Bar */}
      <div className="bg-slate-950/50 p-3.5 rounded-lg border border-slate-800 flex flex-col gap-2">
        <div className="flex justify-between items-center text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Current Production Batch:</span>
            <span className="text-cyan-300 font-bold">
              {counters.currentBatch} / {counters.batchTarget} units
            </span>
          </div>
          <span className="text-cyan-400 font-bold">{batchProgress}%</span>
        </div>

        <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden flex">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300 rounded-full"
            style={{ width: `${batchProgress}%` }}
          />
        </div>

        <div className="flex justify-between items-center pt-1 text-[11px] font-mono text-slate-500">
          <span>Batch Target:</span>
          <div className="flex items-center gap-1.5">
            {[100, 250, 500, 1000].map((tgt) => (
              <button
                key={tgt}
                onClick={() => onBatchTargetChange(tgt)}
                className={`px-2 py-0.5 rounded text-[10px] ${
                  counters.batchTarget === tgt
                    ? 'bg-cyan-900 text-cyan-200 font-bold border border-cyan-700'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {tgt}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
