import React, { useState, useRef, useEffect } from 'react';
import { SerialLogEntry } from '../types';
import { Terminal, Send, Trash2, ChevronDown, ChevronUp, Lock } from 'lucide-react';

interface SerialConsoleProps {
  logs: SerialLogEntry[];
  onSendCommand: (cmd: string) => void;
  onClearLogs: () => void;
  isConnected: boolean;
  isAdmin?: boolean;
  onRequestAdmin?: (actionTitle?: string) => void;
}

export const SerialConsole: React.FC<SerialConsoleProps> = ({
  logs,
  onSendCommand,
  onClearLogs,
  isConnected,
  isAdmin = false,
  onRequestAdmin,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const logContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      onRequestAdmin?.('Transmit Hardware Serial Command');
      return;
    }
    if (!inputVal.trim()) return;
    onSendCommand(inputVal.trim());
    setInputVal('');
  };

  const quickCommands = ['START', 'STOP', 'REJECT', 'SPEED:150', 'SPEED:220', 'ESTOP', 'STATUS'];

  return (
    <div id="serial-console-card" className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl text-slate-100 flex flex-col">
      {/* Header bar */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="p-3 bg-slate-950/80 hover:bg-slate-950 cursor-pointer flex items-center justify-between border-b border-slate-800 transition-colors select-none"
      >
        <div className="flex items-center gap-2 text-xs font-mono">
          <Terminal className="w-4 h-4 text-cyan-400" />
          <span className="font-bold uppercase tracking-wider text-slate-200">
            Hardware Serial Terminal & Telemetry Stream
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">
            {logs.length} entries
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono text-slate-500">
            {isOpen ? 'Click to collapse' : 'Click to expand'}
          </span>
          {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </div>

      {/* Terminal Body */}
      {isOpen && (
        <div className="flex flex-col p-3 gap-3 bg-slate-950">
          {/* Controls Bar */}
          <div className="flex items-center justify-between text-xs font-mono">
            {/* Quick action chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-slate-500 text-[10px]">Quick:</span>
              {quickCommands.map((cmd) => (
                <button
                  key={cmd}
                  onClick={() => {
                    if (!isAdmin) {
                      onRequestAdmin?.(`Send Quick Command (${cmd})`);
                      return;
                    }
                    onSendCommand(cmd);
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] border transition-colors flex items-center gap-1 ${
                    !isAdmin
                      ? 'bg-slate-900 border-slate-800 text-slate-500 hover:text-amber-300'
                      : 'bg-slate-800 hover:bg-slate-700 text-cyan-300 border-slate-700'
                  }`}
                  title={isAdmin ? `Transmit ${cmd}` : "Admin access required"}
                >
                  {!isAdmin && <Lock className="w-2.5 h-2.5 text-amber-400" />}
                  <span>{cmd}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-slate-400 text-[11px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                  className="accent-cyan-500"
                />
                Autoscroll
              </label>

              <button
                onClick={() => {
                  if (!isAdmin) {
                    onRequestAdmin?.('Clear Serial Logs');
                    return;
                  }
                  onClearLogs();
                }}
                className="p-1 text-slate-400 hover:text-red-400 transition-colors rounded hover:bg-slate-800"
                title={isAdmin ? "Clear console output" : "Admin access required to clear terminal"}
              >
                {!isAdmin ? <Lock className="w-3.5 h-3.5 text-amber-400" /> : <Trash2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Log Stream Box */}
          <div
            ref={logContainerRef}
            className="w-full h-44 overflow-y-auto bg-slate-950 font-mono text-xs rounded border border-slate-800/80 p-2.5 space-y-1"
          >
            {logs.length === 0 ? (
              <div className="text-slate-600 italic">No serial messages received yet...</div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="flex items-start gap-2 leading-tight">
                  <span className="text-slate-600 text-[10px] shrink-0">{log.timestamp}</span>
                  <span
                    className={`font-bold text-[10px] shrink-0 ${
                      log.direction === 'in'
                        ? 'text-cyan-400'
                        : log.direction === 'out'
                        ? 'text-amber-400'
                        : 'text-slate-500'
                    }`}
                  >
                    [{log.direction.toUpperCase()}]
                  </span>
                  <span
                    className={`break-all ${
                      log.direction === 'in'
                        ? 'text-slate-200'
                        : log.direction === 'out'
                        ? 'text-amber-200'
                        : 'text-slate-400 italic'
                    }`}
                  >
                    {log.message}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Send Command Input Form */}
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder={
                isAdmin
                  ? "Send command to ESP8266 (e.g. START, STOP, SPEED:200, REJECT)..."
                  : "Observer Mode: Admin authentication required to transmit serial commands."
              }
              disabled={!isAdmin}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500 disabled:opacity-50 disabled:bg-slate-950"
            />
            <button
              type="submit"
              disabled={!isAdmin || !inputVal.trim()}
              className={`px-4 py-1.5 font-bold rounded-lg text-xs font-mono flex items-center gap-1.5 transition-colors ${
                !isAdmin
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-slate-950'
              }`}
            >
              {!isAdmin ? <Lock className="w-3.5 h-3.5 text-amber-400" /> : <Send className="w-3.5 h-3.5" />}
              <span>Send</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
