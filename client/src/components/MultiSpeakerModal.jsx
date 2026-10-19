import React, { useState, useEffect } from 'react';
import { 
  X, Speaker, Bluetooth, Sliders, CheckCircle2, 
  AlertCircle, Volume2, HelpCircle, Layers, Sparkles 
} from 'lucide-react';

export default function MultiSpeakerModal({ isOpen, onClose, audioEngine }) {
  const [devices, setDevices] = useState([]);
  const [isSupported, setIsSupported] = useState(true);
  const [primaryDeviceId, setPrimaryDeviceId] = useState('');
  const [secondaryDeviceId, setSecondaryDeviceId] = useState('');
  const [enableDualOutput, setEnableDualOutput] = useState(false);
  const [primaryVolume, setPrimaryVolume] = useState(100);
  const [secondaryVolume, setSecondaryVolume] = useState(100);
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    if (!('setSinkId' in HTMLMediaElement.prototype)) {
      setIsSupported(false);
      return;
    }

    const loadDevices = async () => {
      try {
        // Request temporary mic permission if devices are not labeled yet
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(t => t.stop());
        } catch (e) {
          // Ignore if permission denied; we'll still enumerate
        }

        const devList = await navigator.mediaDevices.enumerateDevices();
        const audioOutputs = devList.filter(d => d.kind === 'audiooutput');
        setDevices(audioOutputs);

        if (audioOutputs.length > 0 && !primaryDeviceId) {
          setPrimaryDeviceId(audioOutputs[0].deviceId);
        }
        if (audioOutputs.length > 1 && !secondaryDeviceId) {
          setSecondaryDeviceId(audioOutputs[1].deviceId);
        }
      } catch (err) {
        console.warn('Error loading audio devices:', err);
      }
    };

    loadDevices();
  }, [isOpen]);

  const handleApplyDualOutput = async () => {
    if (!audioEngine) return;
    setStatusMsg('');

    try {
      if (enableDualOutput && secondaryDeviceId) {
        // Set primary sink
        if (audioEngine.audio && audioEngine.audio.setSinkId && primaryDeviceId) {
          await audioEngine.audio.setSinkId(primaryDeviceId);
          audioEngine.audio.volume = primaryVolume / 100;
        }

        // Enable secondary output on secondary device
        if (audioEngine.enableSecondaryOutput) {
          await audioEngine.enableSecondaryOutput(secondaryDeviceId, secondaryVolume / 100);
        }

        setStatusMsg('Dual Output Active! PC Speakers & Bluetooth are playing simultaneously.');
      } else {
        // Disable secondary output
        if (audioEngine.disableSecondaryOutput) {
          audioEngine.disableSecondaryOutput();
        }
        if (audioEngine.audio && audioEngine.audio.setSinkId && primaryDeviceId) {
          await audioEngine.audio.setSinkId(primaryDeviceId);
        }
        setStatusMsg('Standard single output restored.');
      }
    } catch (err) {
      console.error('Failed to configure audio outputs:', err);
      setStatusMsg('Note: Windows/Browser restricted direct sink routing. Ensure device is connected.');
    }
  };

  const handlePrimaryVolumeChange = (val) => {
    setPrimaryVolume(val);
    if (audioEngine?.audio) {
      audioEngine.audio.volume = val / 100;
    }
  };

  const handleSecondaryVolumeChange = (val) => {
    setSecondaryVolume(val);
    if (audioEngine?.secondaryAudio) {
      audioEngine.secondaryAudio.volume = val / 100;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl relative space-y-5 text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-white">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold font-heading text-white flex items-center gap-2">
                Dual Audio Output Matrix
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-semibold">
                  PC + Bluetooth
                </span>
              </h3>
              <p className="text-xs text-slate-400">Play sound simultaneously on PC Speakers AND Bluetooth</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!isSupported ? (
          <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-800 text-amber-200 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span>Browser Audio Device Routing Not Supported</span>
            </div>
            <p className="text-slate-300">
              Your browser does not support direct hardware sink switching. For Windows, you can enable 
              <strong> "Stereo Mix"</strong> in Windows Sound Settings &gt; Recording &gt; Listen to this device &gt; choose Bluetooth to play on both simultaneously!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Toggle Dual Output Switch */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-800/80 border border-slate-700">
              <div className="space-y-0.5">
                <span className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  Enable Dual Device Simultaneous Playback
                </span>
                <p className="text-xs text-slate-400">
                  Splits Web Audio stream across two hardware devices
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableDualOutput}
                  onChange={(e) => setEnableDualOutput(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
              </label>
            </div>

            {/* Device 1 (PC Internal Speakers) */}
            <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Speaker className="w-4 h-4 text-slate-400" />
                  Device 1 (e.g. PC Speakers)
                </span>
                <span className="text-xs font-mono text-cyan-400">{primaryVolume}%</span>
              </div>
              <select
                value={primaryDeviceId}
                onChange={(e) => setPrimaryDeviceId(e.target.value)}
                className="w-full py-2 px-3 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                {devices.map((d, idx) => (
                  <option key={d.deviceId || idx} value={d.deviceId}>
                    {d.label || `Audio Output ${idx + 1}`}
                  </option>
                ))}
              </select>
              <input
                type="range"
                min="0"
                max="100"
                value={primaryVolume}
                onChange={(e) => handlePrimaryVolumeChange(parseInt(e.target.value, 10))}
                className="w-full h-1 bg-slate-700 rounded-lg accent-cyan-400 cursor-pointer"
              />
            </div>

            {/* Device 2 (Bluetooth / External Output) */}
            <div className={`p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/60 space-y-2 transition-opacity ${!enableDualOutput ? 'opacity-40 pointer-events-none' : ''}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Bluetooth className="w-4 h-4 text-blue-400" />
                  Device 2 (e.g. Bluetooth Headphones / Speakers)
                </span>
                <span className="text-xs font-mono text-blue-400">{secondaryVolume}%</span>
              </div>
              <select
                value={secondaryDeviceId}
                onChange={(e) => setSecondaryDeviceId(e.target.value)}
                className="w-full py-2 px-3 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                {devices.map((d, idx) => (
                  <option key={d.deviceId || idx} value={d.deviceId}>
                    {d.label || `Audio Output ${idx + 1}`}
                  </option>
                ))}
              </select>
              <input
                type="range"
                min="0"
                max="100"
                value={secondaryVolume}
                onChange={(e) => handleSecondaryVolumeChange(parseInt(e.target.value, 10))}
                className="w-full h-1 bg-slate-700 rounded-lg accent-blue-400 cursor-pointer"
              />
            </div>

            {statusMsg && (
              <p className="text-xs text-emerald-400 flex items-center gap-1.5 pt-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {statusMsg}
              </p>
            )}

            <button
              onClick={handleApplyDualOutput}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-600/20 transition-all cursor-pointer"
            >
              Apply Audio Output Matrix
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
