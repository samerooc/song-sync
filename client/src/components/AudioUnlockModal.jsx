import React from 'react';
import { Volume2, Sparkles } from 'lucide-react';

export default function AudioUnlockModal({ onUnlock }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="glass-panel-glow max-w-md w-full rounded-2xl p-6 sm:p-8 text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-900 shadow-sm">
          <Volume2 className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold font-heading text-slate-900 tracking-tight">
            Enable Synced Audio
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Mobile and desktop browsers require a single tap to enable high-fidelity synchronized playback.
          </p>
        </div>

        <button
          onClick={onUnlock}
          className="w-full py-4 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-base shadow-lg shadow-slate-900/15 transform active:scale-95 transition-all flex items-center justify-center gap-3 cursor-pointer"
        >
          <Sparkles className="w-5 h-5 text-amber-300" />
          <span>Tap to Join Sound</span>
        </button>

        <p className="text-xs text-slate-500">
          SyncRoom will lock into the room's master clock automatically upon entering.
        </p>
      </div>
    </div>
  );
}
