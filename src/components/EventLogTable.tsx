import React from 'react';
import { DetectionEvent } from '../types';
import { FileSpreadsheet, Trash2, History, Lock, ShieldAlert } from 'lucide-react';

interface EventLogTableProps {
  events: DetectionEvent[];
  onClearEvents: () => void;
  isAdmin?: boolean;
  onRequestAdmin?: (actionTitle?: string) => void;
}

export const EventLogTable: React.FC<EventLogTableProps> = ({
  events,
  onClearEvents,
  isAdmin = false,
  onRequestAdmin,
}) => {
  const exportCsv = () => {
    if (events.length === 0) return;
    const headers = ['Event ID', 'Timestamp', 'Signal Strength (ADC)', 'Threshold', 'Belt Speed (PWM)', 'Auto-Halted', 'Screened Item Status'];
    const rows = events.map(e => [
      e.id,
      `"${e.timestamp}"`,
      e.signalStrength,
      e.threshold,
      e.conveyorSpeedPwm,
      e.rejected ? 'YES' : 'NO',
      `"${e.materialClassification}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `school_baggage_security_log_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="event-log-card" className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl text-slate-100 flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <History className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-semibold tracking-wider uppercase text-slate-200">
            Baggage Security Screening Log ({events.length} Flagged Bags)
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="export-csv-btn"
            onClick={exportCsv}
            disabled={events.length === 0}
            className="text-xs font-mono text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 disabled:opacity-40 px-2.5 py-1 rounded transition-colors flex items-center gap-1.5 border border-slate-700"
            title="Download baggage security screening history as CSV spreadsheet"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" /> Export CSV
          </button>

          <button
            id="clear-log-btn"
            onClick={() => {
              if (!isAdmin) {
                onRequestAdmin?.('Clear Audit Screening Log');
                return;
              }
              onClearEvents();
            }}
            disabled={events.length === 0}
            className={`text-xs font-mono px-2.5 py-1 rounded transition-colors flex items-center gap-1.5 ${
              !isAdmin
                ? 'bg-slate-800 text-slate-400 hover:text-amber-300'
                : 'text-slate-400 hover:text-red-300 bg-slate-800 hover:bg-slate-700 disabled:opacity-40'
            }`}
            title={isAdmin ? "Clear screening event history" : "Admin access required to clear logs"}
          >
            {!isAdmin ? <Lock className="w-3.5 h-3.5 text-amber-400" /> : <Trash2 className="w-3.5 h-3.5" />}
            <span>Clear Log</span>
            {!isAdmin && <span className="text-[9px] px-1 bg-amber-950 text-amber-300 rounded border border-amber-800">Admin</span>}
          </button>
        </div>
      </div>

      {/* Table Content */}
      <div className="w-full overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-left text-xs font-mono border-collapse">
          <thead>
            <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
              <th className="py-2.5 px-3">TIME</th>
              <th className="py-2.5 px-3">SENSOR SIGNAL</th>
              <th className="py-2.5 px-3">THRESHOLD</th>
              <th className="py-2.5 px-3">BELT SPEED</th>
              <th className="py-2.5 px-3">ACTION</th>
              <th className="py-2.5 px-3">DETECTED ITEM / NOTE</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
            {events.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-6 text-center text-slate-500 font-sans">
                  No metallic objects detected in bags yet. Conveyor inspection checkpoint clear.
                </td>
              </tr>
            ) : (
              events.slice(0, 8).map((evt) => (
                <tr key={evt.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-2.5 px-3 text-slate-300 font-mono">{evt.timestamp}</td>
                  <td className="py-2.5 px-3">
                    <span className="text-red-400 font-bold">{evt.signalStrength} ADC</span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-400">{evt.threshold} ADC</td>
                  <td className="py-2.5 px-3 text-slate-300">{evt.conveyorSpeedPwm} PWM</td>
                  <td className="py-2.5 px-3">
                    {evt.rejected ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-800 text-[10px] font-bold">
                        HALTED & ALARMED
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold">
                        CLEARED
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="flex items-center gap-1 text-slate-300">
                      <ShieldAlert className="w-3 h-3 text-red-400" />
                      {evt.materialClassification}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
