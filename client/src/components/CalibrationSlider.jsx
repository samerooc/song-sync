import React from 'react';
import { Sliders, Volume2, RotateCcw } from 'lucide-react';

export default function CalibrationSlider({ latencyOffset, onOffsetChange, onPlayTestBeep }) {
  const presets = [
    { label: 'Built-in Speaker', value: 0 },
    { label: 'AirPods / TWS', value: 120 },
    { label: 'BT Speaker', value: 240 },
    { label: 'Soundbar', value: 350 },
  ];

  return (
    <div className="glass-panel rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-800">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">Bluetooth Latency Calibration</h4>
            <p className="text-xs text-slate-500">Compensate for hardware delay on your speaker</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-md text-xs font-mono font-bold ${
            latencyOffset === 0 
              ? 'bg-slate-100 text-slate-700 border border-slate-200' 
              : latencyOffset > 0 
                ? 'bg-amber-50 text-amber-800 border border-amber-200' 
                : 'bg-blue-50 text-blue-800 border border-blue-200'
          }`}>
            {latencyOffset > 0 ? `+${latencyOffset}` : latencyOffset} ms
          </span>
          <button
            onClick={() => onOffsetChange(0)}
            title="Reset to 0ms"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Slider */}
      <div className="space-y-2">
        <input
          type="range"
          min="-500"
          max="500"
          step="10"
          value={latencyOffset}
          onChange={(e) => onOffsetChange(parseInt(e.target.value, 10))}
          className="w-full cursor-pointer"
        />
        <div className="flex justify-between text-[11px] text-slate-500 font-mono">
          <span>-500ms (Plays Later)</span>
          <span>0ms (Direct)</span>
          <span>+500ms (Plays Earlier)</span>
        </div>
      </div>

      {/* Quick Presets & Test Beep */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200">
        <div className="flex flex-wrap gap-1.5">
          {presets.map((preset) => (
            <button
              key={preset.label}
              onClick={() => onOffsetChange(preset.value)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                latencyOffset === preset.value
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <button
          onClick={onPlayTestBeep}
          className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
        >
          <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>Test Click</span>
        </button>
      </div>
    </div>
  );
}
