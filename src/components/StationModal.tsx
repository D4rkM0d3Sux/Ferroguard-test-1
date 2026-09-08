import React, { useState } from 'react';
import { CheckpointStation } from '../types';
import { DEFAULT_STATIONS, sanitizeStationId, deleteStationProfileFromCloud } from '../services/firebase';
import {
  Building2,
  UserCheck,
  ShieldCheck,
  Check,
  Plus,
  Radio,
  Laptop,
  X,
  Lock,
  Unlock,
  KeyRound,
  Trash2,
  ShieldAlert,
  AlertCircle,
  Eye,
  EyeOff,
  Settings,
} from 'lucide-react';

interface StationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStation: CheckpointStation;
  availableStations: CheckpointStation[];
  onSelectStation: (station: CheckpointStation) => void;
  onUpdateOperatorName: (name: string) => void;
  isAdmin: boolean;
  onAdminLogin: (passcode: string) => boolean;
  onAdminLogout: () => void;
  onChangeAdminPasscode: (newPass: string) => void;
}

export const StationModal: React.FC<StationModalProps> = ({
  isOpen,
  onClose,
  currentStation,
  availableStations,
  onSelectStation,
  onUpdateOperatorName,
  isAdmin,
  onAdminLogin,
  onAdminLogout,
  onChangeAdminPasscode,
}) => {
  const [customStationName, setCustomStationName] = useState('');
  const [customStationType, setCustomStationType] = useState<'physical' | 'virtual' | 'custom'>('physical');
  const [customStationDesc, setCustomStationDesc] = useState('');
  const [operatorInput, setOperatorInput] = useState(currentStation.operatorName);
  const [activeTab, setActiveTab] = useState<'presets' | 'create' | 'settings'>('presets');

  // Admin authentication state
  const [passcodeInput, setPasscodeInput] = useState('');
  const [passcodeError, setPasscodeError] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);

  // Change passcode state
  const [newPasscodeInput, setNewPasscodeInput] = useState('');
  const [passcodeSuccessMsg, setPasscodeSuccessMsg] = useState('');

  // Station deletion confirmation
  const [deletingStationId, setDeletingStationId] = useState<string | null>(null);

  if (!isOpen) return null;

  // Merge default presets with any stations loaded from Firestore
  const allStationsMap = new Map<string, CheckpointStation>();
  DEFAULT_STATIONS.forEach((s) => allStationsMap.set(s.id, s));
  availableStations.forEach((s) => allStationsMap.set(s.id, { ...allStationsMap.get(s.id), ...s }));
  const stationsList = Array.from(allStationsMap.values());

  const handleCreateCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setPasscodeError('Admin access is required to provision channels.');
      return;
    }

    if (!customStationName.trim()) return;

    const id = sanitizeStationId(customStationName);
    const newStation: CheckpointStation = {
      id,
      name: customStationName.trim(),
      stationType: customStationType,
      operatorName: operatorInput.trim() || 'Operator',
      description: customStationDesc.trim() || `Channel [${id}] - ${customStationType} screening station`,
    };

    onSelectStation(newStation);
    setCustomStationName('');
    setCustomStationDesc('');
    setActiveTab('presets');
    onClose();
  };

  const handleSaveOperator = () => {
    if (operatorInput.trim() && operatorInput !== currentStation.operatorName) {
      onUpdateOperatorName(operatorInput.trim());
    }
  };

  const handleAdminVerify = (e: React.FormEvent) => {
    e.preventDefault();
    setPasscodeError('');
    if (!passcodeInput.trim()) {
      setPasscodeError('Please enter the admin master passcode.');
      return;
    }

    const success = onAdminLogin(passcodeInput);
    if (success) {
      setPasscodeInput('');
      setPasscodeError('');
      setActiveTab('create');
    } else {
      setPasscodeError('Incorrect passcode. Please check your admin credentials.');
    }
  };

  const handleChangePasscodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPasscodeInput.trim() || newPasscodeInput.length < 4) {
      setPasscodeError('New passcode must be at least 4 characters long.');
      return;
    }
    onChangeAdminPasscode(newPasscodeInput.trim());
    setNewPasscodeInput('');
    setPasscodeSuccessMsg('Admin passcode updated successfully!');
    setTimeout(() => setPasscodeSuccessMsg(''), 4000);
  };

  const handleDeleteCustomStation = async (stationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAdmin) return;

    await deleteStationProfileFromCloud(stationId);
    setDeletingStationId(null);

    // If active station was deleted, switch back to main_gate
    if (currentStation.id === stationId) {
      onSelectStation(DEFAULT_STATIONS[0]);
    }
  };

  const isDefaultPreset = (id: string) => DEFAULT_STATIONS.some((d) => d.id === id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden text-slate-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-950 border border-indigo-700/60 text-indigo-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-wider uppercase font-mono text-slate-100">
                  Screening Stations & Channels
                </h2>
                {isAdmin ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-700/80 font-mono">
                    <Unlock className="w-2.5 h-2.5" /> ADMIN
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-mono">
                    <Lock className="w-2.5 h-2.5" /> GUEST
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-mono">
                {isAdmin
                  ? 'Admin Mode Active: Channel provisioning and station management enabled'
                  : 'Select an authorized checkpoint station to monitor or run tests'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex flex-col gap-4 text-xs font-mono">
          {/* Operator Name Input */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3 flex flex-col gap-2">
            <label className="text-[11px] font-semibold text-slate-300 flex items-center justify-between uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
                Active Operator Call-sign
              </span>
              <span className="text-[10px] text-slate-500 font-normal">Stamped on audit logs</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={operatorInput}
                onChange={(e) => {
                  if (isAdmin) setOperatorInput(e.target.value);
                }}
                onBlur={isAdmin ? handleSaveOperator : undefined}
                readOnly={!isAdmin}
                placeholder="e.g. Officer Cruz / Tech Lead"
                className={`flex-1 bg-slate-900 border rounded px-3 py-1.5 text-xs text-slate-100 focus:outline-none font-mono ${
                  !isAdmin
                    ? 'border-slate-800 opacity-75 cursor-not-allowed text-slate-400'
                    : 'border-slate-700 focus:border-indigo-500'
                }`}
                title={!isAdmin ? "Observer Mode: Admin access required to change operator call-sign" : undefined}
              />
              {isAdmin ? (
                <button
                  type="button"
                  onClick={handleSaveOperator}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded text-slate-200 transition-colors text-xs"
                >
                  Save
                </button>
              ) : (
                <div
                  className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] text-slate-400 font-mono bg-slate-950 border border-slate-800 rounded select-none"
                  title="Admin credentials required to modify station operator call-sign"
                >
                  <Lock className="w-3 h-3 text-amber-400 shrink-0" />
                  <span>View Only</span>
                </div>
              )}
            </div>
          </div>

          {/* Current Active Station Banner */}
          <div className="bg-indigo-950/40 border border-indigo-800/60 rounded-lg p-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-pulse" />
              <div>
                <span className="text-[10px] uppercase tracking-wider text-indigo-300 font-semibold block">
                  Active Database Channel
                </span>
                <span className="text-xs font-bold text-white">{currentStation.name}</span>
                <span className="text-[10px] text-slate-400 block">ID: {currentStation.id}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-indigo-900/80 border border-indigo-700 text-indigo-200">
                {currentStation.stationType}
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-800 text-xs">
            <button
              onClick={() => setActiveTab('presets')}
              className={`pb-2 px-3 border-b-2 font-semibold transition-colors flex items-center gap-1.5 ${
                activeTab === 'presets'
                  ? 'border-indigo-400 text-indigo-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Channels ({stationsList.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('create')}
              className={`pb-2 px-3 border-b-2 font-semibold transition-colors flex items-center gap-1.5 ${
                activeTab === 'create'
                  ? 'border-indigo-400 text-indigo-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {isAdmin ? <Plus className="w-3.5 h-3.5 text-amber-400" /> : <Lock className="w-3.5 h-3.5 text-amber-400" />}
              <span>+ Provision Channel</span>
              {!isAdmin && <span className="text-[9px] px-1 bg-amber-950/80 border border-amber-800 text-amber-300 rounded">Admin</span>}
            </button>

            {isAdmin && (
              <button
                onClick={() => setActiveTab('settings')}
                className={`pb-2 px-3 border-b-2 font-semibold transition-colors flex items-center gap-1.5 ${
                  activeTab === 'settings'
                    ? 'border-indigo-400 text-indigo-300'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Admin Settings</span>
              </button>
            )}
          </div>

          {/* TAB 1: PRESETS / CHANNELS LIST */}
          {activeTab === 'presets' && (
            <div className="flex flex-col gap-2.5">
              {stationsList.map((station) => {
                const isSelected = station.id === currentStation.id;
                const isPreset = isDefaultPreset(station.id);

                return (
                  <div
                    key={station.id}
                    onClick={() => {
                      onSelectStation({ ...station, operatorName: operatorInput || station.operatorName });
                      onClose();
                    }}
                    className={`w-full text-left p-3 rounded-lg border transition-all flex items-start justify-between gap-3 cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-950/70 border-indigo-500 shadow-md ring-1 ring-indigo-500/50'
                        : 'bg-slate-950/60 border-slate-800 hover:bg-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                      <div className="mt-0.5 p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-400 shrink-0">
                        {station.stationType === 'physical' ? (
                          <Radio className="w-3.5 h-3.5 text-emerald-400" />
                        ) : station.stationType === 'virtual' ? (
                          <Laptop className="w-3.5 h-3.5 text-cyan-400" />
                        ) : (
                          <Building2 className="w-3.5 h-3.5 text-amber-400" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-200 text-xs truncate">{station.name}</span>
                          <span className="text-[10px] text-slate-500">[{station.id}]</span>
                          {isPreset ? (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 border border-slate-700 text-slate-400 font-mono">
                              System Preset
                            </span>
                          ) : (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-950 border border-indigo-800 text-indigo-300 font-mono">
                              Custom Channel
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 font-sans mt-0.5 leading-snug line-clamp-2">
                          {station.description || 'Dedicated screening channel'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                      {isSelected && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                          <Check className="w-3 h-3" /> ACTIVE
                        </span>
                      )}

                      {/* Admin Deletion of Custom Channels */}
                      {isAdmin && !isPreset && (
                        <div>
                          {deletingStationId === station.id ? (
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={(e) => handleDeleteCustomStation(station.id, e)}
                                className="px-1.5 py-0.5 bg-rose-950 hover:bg-rose-900 border border-rose-700 text-rose-300 text-[10px] rounded font-bold transition-colors"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeletingStationId(null);
                                }}
                                className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-400 text-[10px] rounded"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingStationId(station.id);
                              }}
                              className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded transition-colors"
                              title="Delete this custom channel (Admin only)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 2: PROVISION CHANNEL (LOCKED FOR GUESTS, UNLOCKED FOR ADMIN) */}
          {activeTab === 'create' && (
            <div>
              {!isAdmin ? (
                /* ADMIN LOGIN CHALLENGE */
                <form onSubmit={handleAdminVerify} className="flex flex-col gap-3.5">
                  <div className="bg-slate-950/80 border border-amber-900/60 rounded-xl p-4 flex flex-col gap-3">
                    <div className="flex items-center gap-2.5 text-amber-300">
                      <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider font-mono">
                          Administrator Access Required
                        </h3>
                        <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                          Only verified administrators can provision new screening channels to prevent database bloat and ensure channel isolation.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 mt-1">
                      <label className="text-[10px] uppercase tracking-wider text-slate-300 font-bold flex items-center gap-1.5">
                        <KeyRound className="w-3 h-3 text-amber-400" />
                        Admin Master Passcode
                      </label>
                      <div className="relative">
                        <input
                          type={showPasscode ? 'text' : 'password'}
                          value={passcodeInput}
                          onChange={(e) => setPasscodeInput(e.target.value)}
                          placeholder="Enter admin passcode"
                          className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs text-slate-100 pr-9 focus:outline-none focus:border-amber-500 font-mono"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasscode(!showPasscode)}
                          className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-200"
                        >
                          {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {passcodeError && (
                      <div className="p-2.5 rounded bg-rose-950/80 border border-rose-800 text-rose-300 text-[11px] flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        <span>{passcodeError}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded-lg transition-colors flex items-center justify-center gap-2 text-xs"
                    >
                      <Unlock className="w-3.5 h-3.5" />
                      <span>Authenticate & Unlock Admin Mode</span>
                    </button>
                  </div>
                </form>
              ) : (
                /* PROVISION CHANNEL FORM FOR ADMIN */
                <form onSubmit={handleCreateCustom} className="flex flex-col gap-3">
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="text-[11px] text-amber-300 font-bold uppercase flex items-center gap-1.5">
                        <Unlock className="w-3.5 h-3.5 text-amber-400" />
                        Provision New Screening Channel
                      </span>
                      <span className="text-[10px] text-slate-400">Admin Mode Verified</span>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] uppercase text-slate-400 font-bold">Station / Gate Name</label>
                      <input
                        type="text"
                        value={customStationName}
                        onChange={(e) => setCustomStationName(e.target.value)}
                        placeholder="e.g. Science Wing Entrance 2 / Arena Gate B"
                        className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                        autoFocus
                      />
                      {customStationName && (
                        <span className="text-[10px] text-slate-500">
                          Channel ID: <code className="text-indigo-300">{sanitizeStationId(customStationName)}</code>
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] uppercase text-slate-400 font-bold">Station Type</label>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setCustomStationType('physical')}
                          className={`p-2 rounded border text-left transition-all ${
                            customStationType === 'physical'
                              ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
                              : 'bg-slate-900 border-slate-800 text-slate-400'
                          }`}
                        >
                          <span className="font-bold block text-[11px]">Physical</span>
                          <span className="text-[9px] text-slate-500">Real ESP8266 Rig</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setCustomStationType('virtual')}
                          className={`p-2 rounded border text-left transition-all ${
                            customStationType === 'virtual'
                              ? 'bg-cyan-950/80 border-cyan-500 text-cyan-300'
                              : 'bg-slate-900 border-slate-800 text-slate-400'
                          }`}
                        >
                          <span className="font-bold block text-[11px]">Virtual</span>
                          <span className="text-[9px] text-slate-500">Simulations</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setCustomStationType('custom')}
                          className={`p-2 rounded border text-left transition-all ${
                            customStationType === 'custom'
                              ? 'bg-amber-950/80 border-amber-500 text-amber-300'
                              : 'bg-slate-900 border-slate-800 text-slate-400'
                          }`}
                        >
                          <span className="font-bold block text-[11px]">Custom</span>
                          <span className="text-[9px] text-slate-500">Hybrid / Lab</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] uppercase text-slate-400 font-bold">Description / Purpose</label>
                      <input
                        type="text"
                        value={customStationDesc}
                        onChange={(e) => setCustomStationDesc(e.target.value)}
                        placeholder="e.g. Dedicated screening lane for high school auditorium entrance"
                        className="bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={!customStationName.trim()}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 mt-1"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Create Channel & Switch Active</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 3: ADMIN SETTINGS & SECURITY */}
          {activeTab === 'settings' && isAdmin && (
            <div className="flex flex-col gap-3">
              <form onSubmit={handleChangePasscodeSubmit} className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-slate-200">
                  <KeyRound className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold uppercase font-mono">Change Master Admin Passcode</span>
                </div>
                <p className="text-[11px] text-slate-400 font-sans">
                  Set a custom master passcode for this browser session to safeguard channel provisioning.
                </p>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase text-slate-400 font-bold">New Admin Passcode</label>
                  <input
                    type="password"
                    value={newPasscodeInput}
                    onChange={(e) => setNewPasscodeInput(e.target.value)}
                    placeholder="Enter new 4+ character passcode"
                    className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                {passcodeSuccessMsg && (
                  <div className="p-2.5 rounded bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-[11px]">
                    {passcodeSuccessMsg}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!newPasscodeInput.trim()}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 disabled:opacity-40 text-slate-200 font-bold rounded-lg transition-colors text-xs"
                >
                  Update Admin Passcode
                </button>
              </form>

              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-200 block">Lock Administrator Session</span>
                  <span className="text-[10px] text-slate-400 block font-sans mt-0.5">
                    Return to guest mode so non-admins cannot provision channels.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onAdminLogout();
                    setActiveTab('presets');
                  }}
                  className="px-3 py-1.5 bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-300 font-bold rounded-lg text-xs transition-colors flex items-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Lock Admin</span>
                </button>
              </div>
            </div>
          )}

          {/* Database isolation explanation */}
          <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-3 text-[11px] font-sans text-slate-400 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-300">Clean Database Architecture:</span>
              <p className="mt-0.5 leading-relaxed text-slate-400">
                Admins have exclusive authority to add or archive checkpoint channels. Regular visitors can freely select and inspect existing channels without polluting Firestore.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <div>
            {isAdmin ? (
              <button
                onClick={() => {
                  onAdminLogout();
                  setActiveTab('presets');
                }}
                className="text-[11px] text-amber-400/80 hover:text-amber-300 underline font-mono flex items-center gap-1"
              >
                <Lock className="w-3 h-3" /> Log out of Admin Mode
              </button>
            ) : (
              <button
                onClick={() => setActiveTab('create')}
                className="text-[11px] text-slate-400 hover:text-slate-200 underline font-mono flex items-center gap-1"
              >
                <KeyRound className="w-3 h-3 text-amber-400" /> Admin Login
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-mono transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
