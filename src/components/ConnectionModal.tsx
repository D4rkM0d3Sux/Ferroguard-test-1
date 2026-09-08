import React, { useState } from 'react';
import { HardwareConfig, ConnectionType } from '../types';
import { X, Usb, Wifi, Monitor, CheckCircle, AlertCircle, RefreshCw, Radio, Lock } from 'lucide-react';

interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: HardwareConfig;
  onSelectConnection: (type: ConnectionType, details?: Partial<HardwareConfig>) => Promise<void>;
  onDisconnect: () => Promise<void>;
  isAdmin?: boolean;
  onRequestAdmin?: (actionTitle?: string) => void;
}

export const ConnectionModal: React.FC<ConnectionModalProps> = ({
  isOpen,
  onClose,
  config,
  onSelectConnection,
  onDisconnect,
  isAdmin = false,
  onRequestAdmin,
}) => {
  const [selectedType, setSelectedType] = useState<ConnectionType>(config.connectionType);
  const [ipAddress, setIpAddress] = useState(config.ipAddress);
  const [port, setPort] = useState(config.port);
  const [baudRate, setBaudRate] = useState(config.baudRate || 115200);
  const [connecting, setConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConnect = async () => {
    if (!isAdmin) {
      onRequestAdmin?.('Configure Hardware Connection');
      return;
    }
    setConnecting(true);
    setErrorMsg(null);
    try {
      await onSelectConnection(selectedType, {
        ipAddress,
        port,
        baudRate,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Connection failed');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!isAdmin) {
      onRequestAdmin?.('Disconnect Hardware Interface');
      return;
    }
    setConnecting(true);
    try {
      await onDisconnect();
    } finally {
      setConnecting(false);
    }
  };

  const hasWebSerial = typeof navigator !== 'undefined' && 'serial' in navigator;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl flex flex-col gap-5 text-slate-100 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold tracking-wider text-slate-100 uppercase font-mono">
              Hardware Link: ESP8266
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Status Pill */}
        <div className="flex items-center justify-between bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${config.connected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span className="text-slate-300">
              {config.connected ? `LINKED: ${config.connectionType.toUpperCase()}` : 'STATUS: DISCONNECTED'}
            </span>
          </div>

          {config.connected && (
            <button
              onClick={handleDisconnect}
              disabled={connecting}
              className="text-red-400 hover:text-red-300 bg-red-950/80 border border-red-800 px-2 py-1 rounded transition-colors text-[11px]"
            >
              Disconnect
            </button>
          )}
        </div>

        {/* Connection Type Options */}
        <div className="flex flex-col gap-3">
          <label className="text-xs font-mono text-slate-400 uppercase">Select Interface Mode:</label>

          {/* Option 1: Virtual Rig / Simulation */}
          <div
            onClick={() => setSelectedType('simulation')}
            className={`p-3.5 rounded-lg border cursor-pointer transition-all flex items-start gap-3 ${
              selectedType === 'simulation'
                ? 'bg-blue-950/60 border-blue-500 text-white'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300'
            }`}
          >
            <Monitor className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
            <div className="flex flex-col">
              <div className="text-xs font-bold flex items-center gap-2">
                Virtual Hardware Rig & Simulator
                <span className="text-[10px] px-1.5 py-0.2 bg-blue-900/80 text-blue-300 rounded font-mono">Recommended</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Full physical simulation of moving belt, inductive metal sensor coil, servo rejector, and live ADC graphs. Instant testing without physical wiring.
              </p>
            </div>
          </div>

          {/* Option 2: Web Serial USB */}
          <div
            onClick={() => setSelectedType('serial')}
            className={`p-3.5 rounded-lg border cursor-pointer transition-all flex items-start gap-3 ${
              selectedType === 'serial'
                ? 'bg-emerald-950/60 border-emerald-500 text-white'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300'
            }`}
          >
            <Usb className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
            <div className="flex flex-col w-full">
              <div className="text-xs font-bold flex items-center justify-between">
                <span>Web Serial (Direct USB Cable)</span>
                {hasWebSerial ? (
                  <span className="text-[10px] text-emerald-400 font-mono">Supported in Browser</span>
                ) : (
                  <span className="text-[10px] text-amber-400 font-mono">Requires Chrome/Edge</span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Connect your ESP8266 NodeMCU/Wemos via micro-USB. Communicates at 115200 baud directly with 0 network latency.
              </p>

              {selectedType === 'serial' && (
                <div className="mt-3 flex items-center gap-3 font-mono text-xs text-slate-300">
                  <span>Baud Rate:</span>
                  <select
                    value={baudRate}
                    onChange={(e) => setBaudRate(Number(e.target.value))}
                    className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200"
                  >
                    <option value={115200}>115200 (Default)</option>
                    <option value={9600}>9600</option>
                    <option value={57600}>57600</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Option 3: WiFi HTTP */}
          <div
            onClick={() => setSelectedType('wifi_http')}
            className={`p-3.5 rounded-lg border cursor-pointer transition-all flex items-start gap-3 ${
              selectedType === 'wifi_http'
                ? 'bg-amber-950/60 border-amber-500 text-white'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300'
            }`}
          >
            <Wifi className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
            <div className="flex flex-col w-full">
              <div className="text-xs font-bold">WiFi HTTP / REST Client</div>
              <p className="text-[11px] text-slate-400 mt-1">
                Polls the ESP8266 web server over local WiFi (AP mode or local subnet IP).
              </p>

              {selectedType === 'wifi_http' && (
                <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-xs">
                  <div className="col-span-2 flex flex-col gap-1">
                    <label className="text-[10px] text-slate-400">ESP8266 IP / Hostname:</label>
                    <input
                      type="text"
                      value={ipAddress}
                      onChange={(e) => setIpAddress(e.target.value)}
                      placeholder="192.168.4.1 or 192.168.1.150"
                      className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200"
                    />
                  </div>
                  <div className="col-span-1 flex flex-col gap-1">
                    <label className="text-[10px] text-slate-400">Port:</label>
                    <input
                      type="number"
                      value={port}
                      onChange={(e) => setPort(Number(e.target.value))}
                      className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-slate-200"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-950/80 border border-red-800 text-red-300 rounded-lg text-xs font-mono flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Observer Mode Notice */}
        {!isAdmin && (
          <div className="p-2.5 rounded-lg bg-amber-950/60 border border-amber-800/80 text-amber-300 text-[11px] font-mono flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Observer Mode: Linking or switching hardware interfaces requires Admin credentials.</span>
            </div>
            <button
              type="button"
              onClick={() => onRequestAdmin?.('Configure Hardware Connection')}
              className="px-2 py-0.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded text-[10px] shrink-0 transition-colors"
            >
              Unlock
            </button>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-mono transition-colors"
          >
            Cancel
          </button>

          <button
            id="modal-connect-btn"
            onClick={handleConnect}
            disabled={connecting}
            className={`px-5 py-2 font-bold rounded-lg text-xs font-mono transition-all flex items-center gap-2 shadow-lg disabled:opacity-50 ${
              !isAdmin
                ? 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-amber-300 hover:border-amber-700'
                : 'bg-cyan-600 hover:bg-cyan-500 text-slate-950'
            }`}
          >
            {!isAdmin && <Lock className="w-3.5 h-3.5 text-amber-400" />}
            {connecting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Connecting...
              </>
            ) : !isAdmin ? (
              <span>Establish Link (Admin Required)</span>
            ) : (
              <>
                <CheckCircle className="w-3.5 h-3.5" />
                Establish Link
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
