import React, { useEffect, useRef, useState } from 'react';
import { 
  Music, Disc, Sparkles, Volume2, Radio, Video, Zap, 
  RotateCcw, FastForward, Play, Pause 
} from 'lucide-react';

export default function NamidaPlayer({
  media,
  playback,
  currentTime,
  duration,
  isHost,
  streamMode,
  onToggleMode,
  onPlay,
  onPause,
  onSeek
}) {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);

  // Equalizer animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    const barCount = 36;
    const heights = new Array(barCount).fill(10);
    const targets = new Array(barCount).fill(10);

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      const isPlaying = playback?.isPlaying;
      const barWidth = width / barCount - 3;

      for (let i = 0; i < barCount; i++) {
        if (isPlaying) {
          // Dynamic sound-wave simulation matching beat
          if (Math.random() > 0.6) {
            // Emphasize center and bass bars
            const centerWeight = 1 - Math.abs(i - barCount / 2) / (barCount / 2);
            targets[i] = Math.random() * (height * 0.75 * centerWeight) + 6;
          }
        } else {
          targets[i] = 4;
        }

        // Smooth spring easing
        heights[i] += (targets[i] - heights[i]) * 0.22;

        const x = i * (barWidth + 3);
        const y = height - heights[i];

        // Gradient for frequency bars
        const grad = ctx.createLinearGradient(0, height, 0, 0);
        grad.addColorStop(0, '#ec4899'); // Pink
        grad.addColorStop(0.5, '#8b5cf6'); // Purple
        grad.addColorStop(1, '#38bdf8'); // Cyan

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, heights[i], [3, 3, 0, 0]);
        ctx.fill();
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [playback?.isPlaying]);

  const formatTime = (secs) => {
    if (!secs || isNaN(secs)) return '0:00';
    const mins = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  const effectiveDuration = duration || media?.duration || 180;
  const progressPercent = effectiveDuration > 0 ? (currentTime / effectiveDuration) * 100 : 0;
  const isPlaying = playback?.isPlaying;

  return (
    <div className="relative rounded-3xl overflow-hidden bg-gradient-to-b from-slate-900 via-slate-950 to-black border border-slate-800 p-5 sm:p-7 shadow-2xl text-white space-y-6">
      {/* Background Ambient Glow */}
      <div className="absolute -top-24 -left-24 w-72 h-72 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-cyan-600/20 rounded-full blur-3xl pointer-events-none" />

      {/* Top Bar / Mode Indicator */}
      <div className="relative z-10 flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Music className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold font-heading text-white tracking-wide">
                Namida Audio Mode
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <Zap className="w-2.5 h-2.5" /> Data Saver • 0 Ads
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Low-latency high-fidelity synchronized audio</p>
          </div>
        </div>

        {/* Video Mode Switcher */}
        {onToggleMode && (
          <button
            onClick={onToggleMode}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
            title="Switch to Video Stream"
          >
            <Video className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Switch to Video</span>
          </button>
        )}
      </div>

      {/* Central Vinyl Player & Artwork */}
      <div className="relative z-10 flex flex-col sm:flex-row items-center gap-6 sm:gap-8 justify-center py-2">
        {/* Rotating Vinyl Disc */}
        <div className="relative w-40 h-40 sm:w-48 sm:h-48 shrink-0 flex items-center justify-center">
          {/* Vinyl Grooves */}
          <div
            className={`w-full h-full rounded-full bg-slate-950 border-4 border-slate-800 shadow-2xl flex items-center justify-center relative overflow-hidden transition-all ${
              isPlaying ? 'animate-spin' : ''
            }`}
            style={{ animationDuration: '6s', animationTimingFunction: 'linear' }}
          >
            {/* Concentric rings */}
            <div className="absolute inset-4 rounded-full border border-slate-800/80" />
            <div className="absolute inset-8 rounded-full border border-slate-800/60" />
            <div className="absolute inset-12 rounded-full border border-slate-800/40" />

            {/* Center Label / Thumbnail */}
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-2 border-purple-500/80 shadow-lg relative bg-slate-900">
              {media?.thumbnail ? (
                <img
                  src={media.thumbnail}
                  alt={media.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-purple-800 to-indigo-900">
                  <Disc className="w-8 h-8 text-purple-300" />
                </div>
              )}
              {/* Spindle hole */}
              <div className="absolute inset-0 m-auto w-3.5 h-3.5 rounded-full bg-slate-950 border border-slate-700" />
            </div>
          </div>
        </div>

        {/* Track Metadata & Visualizer */}
        <div className="flex-1 w-full space-y-4 text-center sm:text-left">
          <div className="space-y-1">
            <span className="text-[11px] font-mono uppercase tracking-widest text-purple-400 font-semibold flex items-center justify-center sm:justify-start gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`} />
              {isPlaying ? 'Now Playing Across Room' : 'Paused'}
            </span>
            <h3 className="text-lg sm:text-2xl font-black text-white font-heading truncate max-w-full">
              {media?.title || 'No Track Selected'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 truncate">
              {media?.channel || (media?.type === 'file' ? 'Local Audio Track' : 'Select a song via Search')}
            </p>
          </div>

          {/* Equalizer Waveform Canvas */}
          <div className="w-full h-14 bg-slate-950/60 rounded-xl p-2 border border-slate-800/80 overflow-hidden">
            <canvas ref={canvasRef} className="w-full h-full" />
          </div>

          {/* Scrub Bar & Timers */}
          <div className="space-y-1.5 pt-1">
            <div className="relative w-full">
              <input
                type="range"
                min="0"
                max={effectiveDuration || 100}
                step="0.5"
                value={currentTime}
                disabled={!isHost}
                onChange={(e) => isHost && onSeek(parseFloat(e.target.value))}
                className={`w-full h-1.5 rounded-lg accent-purple-500 bg-slate-800 cursor-pointer ${
                  !isHost ? 'cursor-default opacity-80' : ''
                }`}
              />
            </div>
            <div className="flex items-center justify-between text-xs font-mono text-slate-400">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(effectiveDuration)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Playback Action Controls */}
      {isHost && (
        <div className="relative z-10 flex items-center justify-center gap-4 pt-2 border-t border-slate-800/80">
          <button
            onClick={() => onSeek(Math.max(0, currentTime - 10))}
            className="p-3 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition-all cursor-pointer shadow-md"
            title="Rewind 10s"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {isPlaying ? (
            <button
              onClick={onPause}
              className="w-14 h-14 rounded-full bg-gradient-to-tr from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white font-bold flex items-center justify-center shadow-lg shadow-amber-500/30 transform active:scale-95 transition-all cursor-pointer"
            >
              <Pause className="w-6 h-6 fill-current" />
            </button>
          ) : (
            <button
              onClick={onPlay}
              className="w-14 h-14 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold flex items-center justify-center shadow-lg shadow-purple-600/30 transform active:scale-95 transition-all cursor-pointer pl-0.5"
            >
              <Play className="w-6 h-6 fill-current" />
            </button>
          )}

          <button
            onClick={() => onSeek(Math.min(effectiveDuration, currentTime + 10))}
            className="p-3 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition-all cursor-pointer shadow-md"
            title="Fast Forward 10s"
          >
            <FastForward className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
