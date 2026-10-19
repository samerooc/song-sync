import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { 
  Radio, Play, Pause, Volume2, Wifi, Users, QrCode, 
  Sparkles, CheckCircle2, AlertTriangle, ArrowRight, Music2,
  Sliders, ShieldCheck, Zap, Headphones, LogOut, Share2,
  Crown, Search, Layers, KeyRound, Video, Music
} from 'lucide-react';

import { ClockSyncEngine } from './utils/clockSync';
import { AudioSyncEngine } from './utils/audioEngine';
import AudioUnlockModal from './components/AudioUnlockModal';
import QRCodeModal from './components/QRCodeModal';
import CalibrationSlider from './components/CalibrationSlider';
import DeviceListModal from './components/DeviceListModal';
import HostControls from './components/HostControls';
import YouTubePlayer from './components/YouTubePlayer';
import NamidaPlayer from './components/NamidaPlayer';
import YouTubeSearchModal from './components/YouTubeSearchModal';
import MultiSpeakerModal from './components/MultiSpeakerModal';

export default function App() {
  // Navigation / Room State
  const [inRoom, setInRoom] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [deviceName, setDeviceName] = useState(() => {
    return localStorage.getItem('syncroom_device_name') || `Device-${Math.floor(100 + Math.random() * 900)}`;
  });
  const [isHost, setIsHost] = useState(false);
  const [hostToken, setHostToken] = useState(null);
  const [clientId, setClientId] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  // Admin Custom 6-digit Room Creation
  const [useCustomPin, setUseCustomPin] = useState(false);
  const [customPinInput, setCustomPinInput] = useState('');

  // Stream Mode & Quality (Admin managed)
  const [streamMode, setStreamMode] = useState('audio'); // 'audio' (Namida Player) or 'video'
  const [videoQuality, setVideoQuality] = useState('medium'); // 'small' (144p), 'medium' (360p), etc.

  // Sync & Audio State
  const [media, setMedia] = useState(null);
  const [playback, setPlayback] = useState({ isPlaying: false, position: 0, scheduledStartTime: 0 });
  const [audioState, setAudioState] = useState({
    currentTime: 0,
    duration: 0,
    paused: true,
    playbackRate: 1.0,
    skewMs: 0,
    userLatencyOffset: 0,
    isUnlocked: false
  });
  const [clockStats, setClockStats] = useState({ offset: 0, rtt: 0, isCalibrating: false });
  const [deviceList, setDeviceList] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  // Modals
  const [showQRModal, setShowQRModal] = useState(false);
  const [showDevicesModal, setShowDevicesModal] = useState(false);
  const [showYTSearchModal, setShowYTSearchModal] = useState(false);
  const [showMultiSpeakerModal, setShowMultiSpeakerModal] = useState(false);

  // References
  const wsRef = useRef(null);
  const clockSyncRef = useRef(null);
  const audioEngineRef = useRef(null);
  const keepAliveAudioRef = useRef(null);

  // Initialize clock sync and audio engine once
  useEffect(() => {
    const sendWs = (msg) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(msg));
      }
    };

    clockSyncRef.current = new ClockSyncEngine(sendWs);
    audioEngineRef.current = new AudioSyncEngine(clockSyncRef.current);

    const unsubClock = clockSyncRef.current.subscribe(stats => {
      setClockStats(stats);
    });

    const unsubAudio = audioEngineRef.current.subscribe(state => {
      setAudioState(state);
    });

    // Check URL parameters for direct room join
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      setJoinCodeInput(roomParam.trim());
    }

    return () => {
      unsubClock();
      unsubAudio();
      audioEngineRef.current?.destroy();
      clockSyncRef.current?.destroy();
      if (wsRef.current) wsRef.current.close();
      if (keepAliveAudioRef.current) {
        keepAliveAudioRef.current.pause();
        keepAliveAudioRef.current = null;
      }
    };
  }, []);

  // Mobile background audio keepalive
  const enableBackgroundAudioKeepAlive = () => {
    try {
      if (!keepAliveAudioRef.current) {
        // Silent 1-second WAV loop to keep mobile browser audio session alive in background
        const audio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
        audio.loop = true;
        audio.volume = 0.001; // virtually silent
        keepAliveAudioRef.current = audio;
      }
      keepAliveAudioRef.current.play().catch(() => {});
    } catch (e) {}
  };

  // Register MediaSession API for lock-screen controls & metadata
  useEffect(() => {
    if ('mediaSession' in navigator && media) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: media.title || 'SyncRoom Track',
          artist: media.channel || (isHost ? 'Admin Broadcast' : 'SyncRoom Live Session'),
          album: 'SyncRoom High-Fidelity Audio',
          artwork: [
            {
              src: media.thumbnail || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60',
              sizes: '512x512',
              type: 'image/jpeg'
            }
          ]
        });

        navigator.mediaSession.setActionHandler('play', () => {
          if (isHost) handleHostPlay();
        });
        navigator.mediaSession.setActionHandler('pause', () => {
          if (isHost) handleHostPause();
        });
        navigator.mediaSession.setActionHandler('seekto', (details) => {
          if (isHost && details.seekTime !== undefined) {
            handleHostSeek(details.seekTime);
          }
        });
      } catch (e) {
        console.warn('MediaSession configuration warning:', e);
      }
    }
  }, [media, isHost]);

  // Update device name in localStorage
  const handleNameChange = (newName) => {
    setDeviceName(newName);
    localStorage.setItem('syncroom_device_name', newName);
  };

  // Connect WebSocket and Join Room
  const connectToRoom = (code, token = null) => {
    setIsConnecting(true);
    setErrorMsg('');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const isDevVite = window.location.port === '3000';
    const wsHost = isDevVite ? `${window.location.hostname}:4000` : window.location.host;
    const wsUrl = `${protocol}//${wsHost}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      // Begin NTP clock sync burst
      clockSyncRef.current.startSyncBurst();

      // Send join room payload
      ws.send(JSON.stringify({
        type: 'join_room',
        roomCode: code,
        hostToken: token,
        deviceName,
        userLatencyOffset: audioEngineRef.current.userLatencyOffset
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        // Handle NTP Pong
        if (msg.type === 'sync_pong') {
          clockSyncRef.current.handlePong(msg);
          return;
        }

        // Room Joined Confirmation
        if (msg.type === 'room_joined') {
          setIsConnecting(false);
          setInRoom(true);
          setRoomCode(msg.roomCode);
          setIsHost(msg.isHost);
          setClientId(msg.clientId);
          if (msg.streamMode) setStreamMode(msg.streamMode);
          if (msg.videoQuality) setVideoQuality(msg.videoQuality);

          if (msg.media) {
            setMedia(msg.media);
            if (msg.media.type === 'file') {
              audioEngineRef.current.loadSource(msg.media.url);
            }
          }

          if (msg.playback) {
            setPlayback(msg.playback);
            if (msg.media?.type === 'file') {
              if (msg.playback.isPlaying) {
                audioEngineRef.current.handleScheduledPlay(msg.playback.scheduledStartTime, msg.playback.position);
              } else {
                audioEngineRef.current.handlePause(msg.playback.position);
              }
            }
          }

          // Confetti celebration
          confetti({
            particleCount: 40,
            spread: 50,
            origin: { y: 0.8 },
            colors: ['#0f172a', '#334155', '#64748b']
          });

          // Sync URL with room code
          const newUrl = `${window.location.pathname}?room=${msg.roomCode}`;
          window.history.pushState({ path: newUrl }, '', newUrl);
          return;
        }

        // Stream Settings Updated (Mode or Quality changed by Admin)
        if (msg.type === 'stream_settings_updated') {
          if (msg.streamMode) setStreamMode(msg.streamMode);
          if (msg.videoQuality) setVideoQuality(msg.videoQuality);
          return;
        }

        // Kicked by Admin
        if (msg.type === 'kicked') {
          alert(msg.message || 'You were removed from the room by the Admin.');
          handleLeaveRoom();
          return;
        }

        // Media Updated Broadcast
        if (msg.type === 'media_updated') {
          setMedia(msg.media);
          setPlayback(msg.playback);
          if (msg.media.type === 'file') {
            audioEngineRef.current.loadSource(msg.media.url);
          }
          return;
        }

        // Playback Sync Event (Play, Pause, Seek)
        if (msg.type === 'playback_sync') {
          setPlayback(prev => ({
            ...prev,
            isPlaying: msg.action === 'play' || (msg.action === 'seek' && msg.isPlaying),
            position: msg.position,
            scheduledStartTime: msg.scheduledStartTime || 0
          }));

          if (media?.type === 'file') {
            if (msg.action === 'play') {
              audioEngineRef.current.handleScheduledPlay(msg.scheduledStartTime, msg.position);
            } else if (msg.action === 'pause') {
              audioEngineRef.current.handlePause(msg.position);
            } else if (msg.action === 'seek') {
              audioEngineRef.current.handleSeek(msg.position, msg.isPlaying, msg.scheduledStartTime);
            }
          }
          return;
        }

        // Device List Updated
        if (msg.type === 'device_list') {
          setDeviceList(msg.devices);
          return;
        }

        // Errors
        if (msg.type === 'error') {
          setErrorMsg(msg.message);
          setIsConnecting(false);
        }

      } catch (err) {
        console.error('WS parse error:', err);
      }
    };

    ws.onerror = () => {
      setErrorMsg('Failed to connect to SyncRoom server.');
      setIsConnecting(false);
    };

    ws.onclose = () => {
      if (inRoom) {
        setTimeout(() => {
          if (inRoom && roomCode) {
            connectToRoom(roomCode, hostToken);
          }
        }, 2000);
      }
    };
  };

  // Create Room Flow (Admin / Host)
  const handleCreateRoom = async () => {
    setIsConnecting(true);
    setErrorMsg('');

    let payload = {};
    if (useCustomPin) {
      const pin = customPinInput.trim();
      if (!/^\d{6}$/.test(pin)) {
        setErrorMsg('Custom Room PIN must be exactly 6 digits (e.g. 123456)');
        setIsConnecting(false);
        return;
      }
      payload.customCode = pin;
    }

    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to create room');
        setIsConnecting(false);
        return;
      }

      setHostToken(data.hostToken);
      sessionStorage.setItem(`syncroom_token_${data.code}`, data.hostToken);
      connectToRoom(data.code, data.hostToken);
    } catch (err) {
      setErrorMsg('Could not connect to SyncRoom backend server');
      setIsConnecting(false);
    }
  };

  // Join Room Flow (Listener)
  const handleJoinRoom = (e) => {
    e.preventDefault();
    const cleanCode = joinCodeInput.trim();
    if (cleanCode.length !== 6) {
      setErrorMsg('Please enter a valid 6-digit room PIN (numbers only)');
      return;
    }
    const savedToken = sessionStorage.getItem(`syncroom_token_${cleanCode}`);
    connectToRoom(cleanCode, savedToken);
  };

  // Leave Room
  const handleLeaveRoom = () => {
    if (wsRef.current) wsRef.current.close();
    audioEngineRef.current?.destroy();
    setInRoom(false);
    setMedia(null);
    setPlayback({ isPlaying: false, position: 0, scheduledStartTime: 0 });
    window.history.replaceState({}, document.title, window.location.pathname);
  };

  // Admin Controls: Stream Settings (Audio vs Video, Quality)
  const handleChangeStreamMode = (newMode) => {
    setStreamMode(newMode);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && isHost) {
      wsRef.current.send(JSON.stringify({
        type: 'set_stream_settings',
        streamMode: newMode
      }));
    }
  };

  const handleChangeVideoQuality = (newQuality) => {
    setVideoQuality(newQuality);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && isHost) {
      wsRef.current.send(JSON.stringify({
        type: 'set_stream_settings',
        videoQuality: newQuality
      }));
    }
  };

  // Admin Kicks Participant
  const handleKickClient = (targetClientId) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && isHost) {
      wsRef.current.send(JSON.stringify({
        type: 'kick_client',
        targetClientId
      }));
    }
  };

  // Master Playback Actions
  const handleHostPlay = () => {
    if (!wsRef.current || !isHost) return;
    enableBackgroundAudioKeepAlive();
    wsRef.current.send(JSON.stringify({
      type: 'play',
      position: audioState.currentTime,
      scheduledDelay: 1200 // 1.2s future timestamp
    }));
  };

  const handleHostPause = () => {
    if (!wsRef.current || !isHost) return;
    wsRef.current.send(JSON.stringify({
      type: 'pause',
      position: audioState.currentTime
    }));
  };

  const handleHostSeek = (targetPos) => {
    if (!wsRef.current || !isHost) return;
    wsRef.current.send(JSON.stringify({
      type: 'seek',
      position: targetPos,
      scheduledDelay: 1200
    }));
  };

  // Upload Audio
  const handleUploadAudio = async (file) => {
    setIsUploading(true);
    const formData = new FormData();
    formData.append('audio', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.url) {
        wsRef.current.send(JSON.stringify({
          type: 'set_media',
          mediaType: 'file',
          url: data.url,
          title: file.name.replace(/\.[^/.]+$/, ""),
          duration: 0
        }));
      }
    } catch (err) {
      alert('Upload failed: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  // Set YouTube Media (from Search or URL paste)
  const handleSetYouTubeMedia = (youtubeId, originalUrl, title = 'YouTube Song', thumbnail = '', channel = '') => {
    if (!wsRef.current || !isHost) return;
    enableBackgroundAudioKeepAlive();
    wsRef.current.send(JSON.stringify({
      type: 'set_media',
      mediaType: 'youtube',
      url: originalUrl,
      title: title || 'YouTube Song',
      youtubeId,
      thumbnail: thumbnail || `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`,
      channel: channel || ''
    }));
  };

  // Audio Unlock on user gesture
  const handleUnlockAudio = async () => {
    await audioEngineRef.current.unlock();
    enableBackgroundAudioKeepAlive();
  };

  // Calibration offset change
  const handleOffsetChange = (offsetMs) => {
    audioEngineRef.current.setLatencyOffset(offsetMs);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'heartbeat',
        rtt: clockStats.rtt,
        userLatencyOffset: offsetMs
      }));
    }
  };

  return (
    <div className="min-h-screen relative flex flex-col justify-between overflow-x-hidden bg-[#f8fafc]">
      {/* Subtle Ambient Background Lighting */}
      <div className="ambient-glow bg-slate-300/40 top-[-100px] left-[-100px]" />
      <div className="ambient-glow bg-zinc-300/40 bottom-[-100px] right-[-100px]" />

      {/* Tap-To-Enable Audio Overlay (Mobile Autoplay compliance) */}
      {!audioState.isUnlocked && inRoom && (
        <AudioUnlockModal onUnlock={handleUnlockAudio} />
      )}

      {/* QR Code Share Modal */}
      {showQRModal && (
        <QRCodeModal roomCode={roomCode} onClose={() => setShowQRModal(false)} />
      )}

      {/* Connected Devices Modal */}
      {showDevicesModal && (
        <DeviceListModal 
          devices={deviceList} 
          currentClientId={clientId} 
          isHost={isHost}
          onKickClient={handleKickClient}
          onClose={() => setShowDevicesModal(false)} 
        />
      )}

      {/* YouTube In-App Song Search Modal */}
      <YouTubeSearchModal
        isOpen={showYTSearchModal}
        onClose={() => setShowYTSearchModal(false)}
        onSelectVideo={handleSetYouTubeMedia}
      />

      {/* Multi-Speaker PC + Bluetooth Output Modal */}
      <MultiSpeakerModal
        isOpen={showMultiSpeakerModal}
        onClose={() => setShowMultiSpeakerModal(false)}
        audioEngine={audioEngineRef.current}
      />

      {/* Top Navbar */}
      <header className="relative z-10 w-full max-w-4xl mx-auto px-4 py-4 sm:py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center shadow-md shadow-slate-900/10 text-white">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-heading tracking-tight text-slate-900 flex items-center gap-2">
              SyncRoom
              <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded-full bg-slate-900 text-white">
                PRO
              </span>
            </h1>
            <p className="text-[11px] text-slate-500 font-medium">Synced Audio &amp; Video Array</p>
          </div>
        </div>

        {inRoom ? (
          <div className="flex items-center gap-2">
            {/* Multi-Speaker trigger */}
            <button
              onClick={() => setShowMultiSpeakerModal(true)}
              className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 text-cyan-800 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              title="Dual Audio Output: PC + Bluetooth"
            >
              <Layers className="w-4 h-4 text-cyan-700" />
              <span className="hidden sm:inline">PC + BT Output</span>
            </button>

            {/* QR Code */}
            <button
              onClick={() => setShowQRModal(true)}
              className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              title="Share Room PIN / QR Code"
            >
              <QrCode className="w-4 h-4 text-slate-800" />
              <span className="hidden sm:inline">PIN / QR</span>
            </button>

            {/* Connected Devices */}
            <button
              onClick={() => setShowDevicesModal(true)}
              className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              title="View Connected Devices"
            >
              <Users className="w-4 h-4 text-emerald-600" />
              <span className="hidden sm:inline">Devices ({deviceList.length || 1})</span>
            </button>

            {/* Leave Room */}
            <button
              onClick={handleLeaveRoom}
              className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 shadow-sm transition-colors cursor-pointer"
              title="Leave Room"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="text-xs text-slate-500 flex items-center gap-1.5 font-medium px-2.5 py-1 rounded-full bg-white border border-slate-200 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>6-Digit PIN · Zero Ads</span>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 w-full max-w-4xl mx-auto px-4 py-2 flex-1 flex flex-col justify-center">
        {!inRoom ? (
          /* ================= LANDING / JOIN SCREEN ================= */
          <div className="grid md:grid-cols-12 gap-8 items-center py-6">
            <div className="md:col-span-7 space-y-6 text-center md:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-slate-200 text-slate-700 text-xs font-medium shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                <span>Namida Audio Engine · PC + Bluetooth Output · Zero Ads</span>
              </div>

              <h2 className="text-4xl sm:text-5xl font-extrabold font-heading text-slate-900 tracking-tight leading-[1.15]">
                Turn all your devices into a <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-700 via-indigo-600 to-slate-900">massive synchronized sound system</span>.
              </h2>

              <p className="text-slate-600 text-base sm:text-lg leading-relaxed max-w-lg">
                Search &amp; stream YouTube songs directly, play audio on PC Speakers + Bluetooth simultaneously, and sync phones with zero lag even on low-speed internet.
              </p>

              {/* Feature Highlights */}
              <div className="grid grid-cols-2 gap-3 pt-2 text-xs text-slate-700">
                <div className="flex items-center gap-2 p-3 rounded-xl bg-white border border-slate-200 shadow-sm">
                  <KeyRound className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="font-medium">6-Digit Custom Room PIN</span>
                </div>
                <div className="flex items-center gap-2 p-3 rounded-xl bg-white border border-slate-200 shadow-sm">
                  <Search className="w-4 h-4 text-red-600 shrink-0" />
                  <span className="font-medium">In-App YouTube Search</span>
                </div>
                <div className="flex items-center gap-2 p-3 rounded-xl bg-white border border-slate-200 shadow-sm">
                  <Layers className="w-4 h-4 text-cyan-600 shrink-0" />
                  <span className="font-medium">PC + Bluetooth Dual Output</span>
                </div>
                <div className="flex items-center gap-2 p-3 rounded-xl bg-white border border-slate-200 shadow-sm">
                  <Zap className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-medium">Namida Audio (Low Data Saver)</span>
                </div>
              </div>
            </div>

            {/* Room Creation & Join Card */}
            <div className="md:col-span-5">
              <div className="glass-panel-glow rounded-3xl p-6 sm:p-7 space-y-6 shadow-xl border border-slate-200">
                {/* Device Name input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Your Device Name</label>
                  <input
                    type="text"
                    value={deviceName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="e.g. Rana's PC"
                    className="w-full py-2.5 px-3.5 rounded-xl glass-input text-sm text-slate-900 font-medium"
                  />
                </div>

                {/* Admin Room Creation Section */}
                <div className="space-y-3 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Crown className="w-4 h-4 text-amber-500" />
                      Create Room as Admin
                    </span>
                    <button
                      type="button"
                      onClick={() => setUseCustomPin(!useCustomPin)}
                      className="text-[11px] text-purple-600 hover:text-purple-800 font-semibold cursor-pointer underline"
                    >
                      {useCustomPin ? 'Use Auto PIN' : 'Set My Own 6-Digit PIN'}
                    </button>
                  </div>

                  {useCustomPin && (
                    <div className="space-y-1">
                      <input
                        type="text"
                        maxLength={6}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={customPinInput}
                        onChange={(e) => setCustomPinInput(e.target.value.replace(/\D/g, ''))}
                        placeholder="Choose 6-Digit PIN (e.g. 123456)"
                        className="w-full py-2 px-3 rounded-xl bg-white border border-purple-300 text-center font-mono font-bold tracking-widest text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  )}

                  <button
                    onClick={handleCreateRoom}
                    disabled={isConnecting}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700 text-white font-semibold text-xs shadow-md shadow-slate-900/10 transform active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Crown className="w-4 h-4 text-amber-400" />
                    <span>{isConnecting ? 'Starting Admin Room...' : 'Create Admin Room'}</span>
                  </button>
                </div>

                <div className="relative flex items-center justify-center">
                  <div className="border-t border-slate-200 w-full" />
                  <span className="bg-white px-3 text-xs text-slate-400 uppercase tracking-widest font-mono">
                    OR
                  </span>
                </div>

                {/* Join with 6-digit PIN */}
                <form onSubmit={handleJoinRoom} className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Join Room with 6-Digit PIN</label>
                    <input
                      type="text"
                      maxLength={6}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={joinCodeInput}
                      onChange={(e) => setJoinCodeInput(e.target.value.replace(/\D/g, ''))}
                      placeholder="ENTER 6-DIGIT PIN"
                      className="w-full py-3 px-4 rounded-xl glass-input text-center text-xl tracking-widest font-mono text-slate-900 placeholder-slate-400 font-bold"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isConnecting}
                    className="w-full py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-900 font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <span>{isConnecting ? 'Joining...' : 'Join with PIN'}</span>
                    <ArrowRight className="w-4 h-4 text-slate-700" />
                  </button>
                </form>

                {errorMsg && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                    <span>{errorMsg}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* ================= ACTIVE ROOM SCREEN ================= */
          <div className="space-y-6 py-2 animate-fade-in">
            {/* Top Room Ribbon */}
            <div className="glass-panel rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Room PIN</span>
                  <span className="text-2xl font-black font-mono tracking-wider text-slate-900">
                    {roomCode}
                  </span>
                </div>
                <div className="h-8 border-r border-slate-200 mx-1" />
                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ${
                  isHost 
                    ? 'bg-amber-100 text-amber-800 border border-amber-300' 
                    : 'bg-slate-100 text-slate-800 border border-slate-200'
                }`}>
                  {isHost && <Crown className="w-3.5 h-3.5" />}
                  {isHost ? 'Room Admin' : 'Listener'}
                </span>
              </div>

              {/* Sync Skew & Network Health */}
              <div className="flex items-center gap-3 text-xs font-mono">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-700">
                  <span className={`w-2 h-2 rounded-full ${
                    Math.abs(audioState.skewMs) <= 40 ? 'bg-emerald-500' : 'bg-amber-500 animate-ping-slow'
                  }`} />
                  <span>Skew: {audioState.skewMs > 0 ? `+${audioState.skewMs}` : audioState.skewMs}ms</span>
                </div>

                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-700">
                  <Wifi className="w-3.5 h-3.5 text-blue-600" />
                  <span>RTT: {clockStats.rtt}ms</span>
                </div>
              </div>
            </div>

            {/* Media Player: Namida Audio Mode vs Video Mode */}
            {streamMode === 'audio' || media?.type === 'file' ? (
              <NamidaPlayer
                media={media}
                playback={playback}
                currentTime={audioState.currentTime}
                duration={audioState.duration}
                isHost={isHost}
                streamMode={streamMode}
                onToggleMode={() => handleChangeStreamMode('video')}
                onPlay={handleHostPlay}
                onPause={handleHostPause}
                onSeek={handleHostSeek}
              />
            ) : (
              <YouTubePlayer
                youtubeId={media?.youtubeId}
                media={media}
                playback={playback}
                clockSync={clockSyncRef.current}
                userLatencyOffset={audioEngineRef.current.userLatencyOffset}
                isHost={isHost}
                videoQuality={videoQuality}
                onSeek={handleHostSeek}
                onToggleMode={() => handleChangeStreamMode('audio')}
              />
            )}

            {/* Admin Controls Console */}
            {isHost && (
              <HostControls
                media={media}
                playback={playback}
                currentTime={audioState.currentTime}
                duration={audioState.duration}
                streamMode={streamMode}
                videoQuality={videoQuality}
                onPlay={handleHostPlay}
                onPause={handleHostPause}
                onSeek={handleHostSeek}
                onUploadAudio={handleUploadAudio}
                onSetYouTubeMedia={handleSetYouTubeMedia}
                onChangeStreamMode={handleChangeStreamMode}
                onChangeVideoQuality={handleChangeVideoQuality}
                onOpenYTSearch={() => setShowYTSearchModal(true)}
                onOpenMultiSpeaker={() => setShowMultiSpeakerModal(true)}
                isUploading={isUploading}
              />
            )}

            {/* Listener View Status (When not Admin) */}
            {!isHost && (
              <div className="glass-panel rounded-2xl p-4 flex items-center justify-between text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${playback.isPlaying ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                  <span className="font-semibold text-slate-900">
                    {playback.isPlaying ? 'Playing in Sync with Admin' : 'Admin has paused playback'}
                  </span>
                </div>
                <button
                  onClick={() => setShowMultiSpeakerModal(true)}
                  className="px-2.5 py-1 rounded-lg bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 text-cyan-800 font-semibold cursor-pointer flex items-center gap-1"
                >
                  <Layers className="w-3.5 h-3.5 text-cyan-700" />
                  <span>PC + Bluetooth Audio</span>
                </button>
              </div>
            )}

            {/* Bluetooth Latency Calibration Slider */}
            <CalibrationSlider
              latencyOffset={audioState.userLatencyOffset}
              onOffsetChange={handleOffsetChange}
              onPlayTestBeep={() => audioEngineRef.current?.playTestBeep()}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-4xl mx-auto px-4 py-4 text-center text-xs text-slate-500 border-t border-slate-200">
        <p>SyncRoom · Namida Audio Engine · PC + Bluetooth Output · 6-Digit PIN Sync</p>
      </footer>
    </div>
  );
}
