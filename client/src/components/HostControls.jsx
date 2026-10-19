import React, { useState, useRef } from 'react';
import { 
  Play, Pause, RotateCcw, FastForward, Upload, 
  Music, Radio, Link as LinkIcon, Search, Crown, 
  Video, Sliders, Layers, Sparkles, AlertCircle, Zap
} from 'lucide-react';

const YoutubeIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

export default function HostControls({
  media,
  playback,
  currentTime,
  duration,
  streamMode = 'audio',
  videoQuality = 'medium',
  onPlay,
  onPause,
  onSeek,
  onUploadAudio,
  onSetYouTubeMedia,
  onChangeStreamMode,
  onChangeVideoQuality,
  onOpenYTSearch,
  onOpenMultiSpeaker,
  isUploading
}) {
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [ytError, setYtError] = useState('');
  const [activeTab, setActiveTab] = useState('search'); // 'search' | 'url' | 'file'
  const [dragVal, setDragVal] = useState(null);
  const fileInputRef = useRef(null);

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleSliderChange = (e) => {
    setDragVal(parseFloat(e.target.value));
  };

  const handleSliderCommit = (e) => {
    const val = parseFloat(e.target.value);
    setDragVal(null);
    if (onSeek) onSeek(val);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      onUploadAudio(file);
    }
  };

  const handleYouTubeSubmit = (e) => {
    e.preventDefault();
    setYtError('');
    if (!youtubeUrl.trim()) return;

    // Extract video ID from youtube link
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = youtubeUrl.match(regExp);

    if (match && match[2].length === 11) {
      const videoId = match[2];
      onSetYouTubeMedia(videoId, youtubeUrl, 'YouTube Video');
      setYoutubeUrl('');
    } else {
      setYtError('Please enter a valid YouTube video URL');
    }
  };

  const effectiveDuration = duration || (media?.duration || 180);

  return (
    <div className="glass-panel rounded-2xl p-5 sm:p-6 space-y-6 shadow-lg border border-slate-200">
      
      {/* Top Header with Admin Badge & Quick Tools */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 text-white shadow-md shadow-amber-500/20">
            <Crown className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold font-heading text-slate-900">Admin Control Console</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-800 border border-amber-300 font-bold">
                Admin
              </span>
            </div>
            <p className="text-xs text-slate-500">Controls sync, playback mode, and quality for all devices</p>
          </div>
        </div>

        {/* Dual Audio & Stream Settings buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Dual PC + Bluetooth Speaker Button */}
          {onOpenMultiSpeaker && (
            <button
              onClick={onOpenMultiSpeaker}
              className="px-3 py-1.5 rounded-xl bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 text-cyan-800 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              title="Play on PC Speakers + Bluetooth Simultaneously"
            >
              <Layers className="w-3.5 h-3.5 text-cyan-600" />
              <span>PC + Bluetooth Output</span>
            </button>
          )}

          {/* Mode Switcher: Audio (Namida) vs Video */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => onChangeStreamMode && onChangeStreamMode('audio')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                streamMode === 'audio'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Music className="w-3.5 h-3.5" />
              <span>Namida Audio</span>
            </button>
            <button
              onClick={() => onChangeStreamMode && onChangeStreamMode('video')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                streamMode === 'video'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              <span>Video</span>
            </button>
          </div>
        </div>
      </div>

      {/* Admin Stream Quality Selector (for Video mode & low speed internet) */}
      <div className="flex flex-wrap items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 gap-3">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-500" />
          <span className="text-xs font-bold text-slate-800">Admin Video Quality (All Devices):</span>
        </div>
        <div className="flex items-center gap-1.5">
          {[
            { id: 'small', label: '144p (Data Saver)' },
            { id: 'medium', label: '360p' },
            { id: 'large', label: '480p' },
            { id: 'hd720', label: '720p HD' },
            { id: 'auto', label: 'Auto' }
          ].map((q) => (
            <button
              key={q.id}
              onClick={() => onChangeVideoQuality && onChangeVideoQuality(q.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                videoQuality === q.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
              }`}
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs for Media Selection */}
      <div className="space-y-3">
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 max-w-md">
          <button
            onClick={() => setActiveTab('search')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'search'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Search className="w-3.5 h-3.5 text-red-600" />
            <span>Search YouTube</span>
          </button>
          <button
            onClick={() => setActiveTab('url')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'url'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5 text-slate-700" />
            <span>Paste URL</span>
          </button>
          <button
            onClick={() => setActiveTab('file')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'file'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload className="w-3.5 h-3.5 text-slate-700" />
            <span>Audio File</span>
          </button>
        </div>

        {/* Tab 1: Instant In-App YouTube Search Trigger */}
        {activeTab === 'search' && (
          <div className="p-4 rounded-xl bg-gradient-to-r from-red-50 to-rose-50 border border-red-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Search className="w-4 h-4 text-red-600" />
                Search & Stream Songs from YouTube
              </h4>
              <p className="text-xs text-slate-600 mt-0.5">
                Search millions of songs directly inside this web app with Zero Ads &amp; sync to all devices
              </p>
            </div>
            <button
              onClick={onOpenYTSearch}
              className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md shadow-red-600/20 flex items-center gap-2 cursor-pointer transition-all hover:scale-105 active:scale-95 shrink-0"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Open Song Search</span>
            </button>
          </div>
        )}

        {/* Tab 2: Paste YouTube URL */}
        {activeTab === 'url' && (
          <form onSubmit={handleYouTubeSubmit} className="space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Paste YouTube Video URL (e.g. https://youtu.be/...)"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  className="w-full py-2.5 px-3.5 pl-9 rounded-xl glass-input text-xs text-slate-900 placeholder-slate-400 font-medium"
                />
                <LinkIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <YoutubeIcon className="w-4 h-4" />
                <span>Load Video</span>
              </button>
            </div>
            {ytError && (
              <p className="text-xs text-rose-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {ytError}
              </p>
            )}
          </form>
        )}

        {/* Tab 3: Upload Audio File */}
        {activeTab === 'file' && (
          <div className="p-5 rounded-xl bg-slate-50 border-2 border-dashed border-slate-300 text-center space-y-3">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac"
              className="hidden"
            />
            <div className="mx-auto w-10 h-10 rounded-full bg-slate-200 text-slate-800 flex items-center justify-center">
              <Upload className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-900">
                {isUploading ? 'Uploading audio track...' : 'Select audio track for the room'}
              </p>
              <p className="text-xs text-slate-500">MP3, WAV, M4A, FLAC (Up to 50MB)</p>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-xs font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {isUploading ? 'Uploading...' : 'Choose Audio File'}
            </button>
          </div>
        )}
      </div>

      {/* Scrub & Master Playback Controls (if media is active) */}
      {media && (
        <div className="space-y-4 pt-2 border-t border-slate-200">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 truncate max-w-[70%]">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-bold text-slate-900 truncate">{media.title}</span>
            </div>
            <span className="font-mono text-slate-600 font-medium">
              {formatTime(dragVal !== null ? dragVal : currentTime)} / {formatTime(effectiveDuration)}
            </span>
          </div>

          {/* Scrubber / Progress Bar */}
          <div className="space-y-1">
            <input
              type="range"
              min="0"
              max={effectiveDuration || 100}
              step="0.5"
              value={dragVal !== null ? dragVal : currentTime}
              onChange={handleSliderChange}
              onMouseUp={handleSliderCommit}
              onTouchEnd={handleSliderCommit}
              onKeyUp={handleSliderCommit}
              className="w-full cursor-pointer accent-slate-900"
            />
          </div>

          {/* Master Playback Controls */}
          <div className="flex items-center justify-center gap-4 pt-2">
            <button
              onClick={() => onSeek(Math.max(0, currentTime - 10))}
              className="p-3 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200 transition-all cursor-pointer"
              title="Rewind 10s"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {playback.isPlaying ? (
              <button
                onClick={onPause}
                className="w-14 h-14 rounded-full bg-amber-500 hover:bg-amber-600 text-white font-bold flex items-center justify-center shadow-lg shadow-amber-500/20 transform active:scale-95 transition-all cursor-pointer"
              >
                <Pause className="w-7 h-7 fill-current" />
              </button>
            ) : (
              <button
                onClick={onPlay}
                className="w-14 h-14 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-bold flex items-center justify-center shadow-lg shadow-slate-900/25 transform active:scale-95 transition-all cursor-pointer pl-0.5"
              >
                <Play className="w-7 h-7 fill-current" />
              </button>
            )}

            <button
              onClick={() => onSeek(Math.min(effectiveDuration, currentTime + 10))}
              className="p-3 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200 transition-all cursor-pointer"
              title="Fast Forward 10s"
            >
              <FastForward className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
