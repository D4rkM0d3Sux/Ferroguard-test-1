import React, { useState } from 'react';
import { ShieldAlert, KeyRound, Eye, EyeOff, AlertCircle, Unlock, X } from 'lucide-react';

interface AdminAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (passcode: string) => boolean;
  actionTitle?: string;
}

export const AdminAuthModal: React.FC<AdminAuthModalProps> = ({
  isOpen,
  onClose,
  onLogin,
  actionTitle,
}) => {
  const [passcode, setPasscode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!passcode.trim()) {
      setErrorMsg('Please enter the admin master passcode.');
      return;
    }

    const success = onLogin(passcode);
    if (success) {
      setPasscode('');
      setErrorMsg('');
      onClose();
    } else {
      setErrorMsg('Incorrect passcode. Please check your admin credentials.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-md w-full overflow-hidden text-slate-100 font-mono">
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-amber-400">
            <div className="p-2 rounded-lg bg-amber-950/80 border border-amber-800/80">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100">
                Admin Authentication Required
              </h3>
              <span className="text-[10px] text-slate-400 font-sans">
                {actionTitle ? `Restricted action: ${actionTitle}` : 'Control panel access restricted'}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4 text-xs">
          <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 text-[11px] font-sans text-slate-300 leading-relaxed">
            Guests have <strong>Observer (Read-Only)</strong> access to live telemetry and inspection logs. Enter the admin master passcode to operate the conveyor, fire diagnostic triggers, or alter system configurations.
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase tracking-wider text-slate-300 font-bold flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
              Master Admin Passcode
            </label>
            <div className="relative">
              <input
                type={showPasscode ? 'text' : 'password'}
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Enter admin passcode"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 pr-9 focus:outline-none focus:border-amber-500 font-mono tracking-wider"
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

          {errorMsg && (
            <div className="p-2.5 rounded bg-rose-950/80 border border-rose-800 text-rose-300 text-[11px] flex items-center gap-2 font-sans">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-mono text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded-lg font-mono text-xs transition-colors flex items-center justify-center gap-1.5 shadow-md"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>Unlock Admin</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
