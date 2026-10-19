import React from 'react';
import { X, Crown, Wifi, Smartphone, UserMinus, Shield } from 'lucide-react';

export default function DeviceListModal({ devices, currentClientId, isHost, onKickClient, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="glass-panel-glow max-w-md w-full rounded-2xl p-6 relative space-y-5 animate-fade-in shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-slate-900 text-white">
            <Wifi className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold font-heading text-slate-900">Connected Devices</h3>
              {isHost && (
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-800 border border-amber-300 font-bold flex items-center gap-1">
                  <Shield className="w-3 h-3" /> Admin View
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">{devices.length} active in this synchronized room</p>
          </div>
        </div>

        {/* Device List */}
        <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
          {devices.map((device) => {
            const isMe = device.id === currentClientId;
            const rtt = device.rtt || 0;
            const pingColor = rtt <= 40 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : rtt <= 90 ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-rose-700 bg-rose-50 border-rose-200';

            return (
              <div
                key={device.id}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                  isMe
                    ? 'bg-slate-100 border-slate-300'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${device.isHost ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-800'}`}>
                    {device.isHost ? <Crown className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">
                        {device.name}
                      </span>
                      {isMe && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-900 text-white font-medium">
                          You
                        </span>
                      )}
                      {device.isHost && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 border border-amber-300 font-semibold">
                          Admin
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>Offset: {device.userLatencyOffset > 0 ? `+${device.userLatencyOffset}` : device.userLatencyOffset}ms</span>
                    </div>
                  </div>
                </div>

                {/* Right controls: Ping + Admin Kick Button */}
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold border ${pingColor}`}>
                    {rtt}ms RTT
                  </span>

                  {isHost && !isMe && onKickClient && (
                    <button
                      onClick={() => onKickClient(device.id)}
                      className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 transition-colors cursor-pointer"
                      title="Kick device from room"
                    >
                      <UserMinus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-2 text-center border-t border-slate-200">
          <p className="text-xs text-slate-500">
            Median skew across WiFi: <span className="text-emerald-600 font-bold">&lt; 40ms</span>
          </p>
        </div>
      </div>
    </div>
  );
}
