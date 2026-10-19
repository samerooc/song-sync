// Audio Engine with Web Audio API, Scheduled Playback, Drift Nudging, and Calibration

export class AudioSyncEngine {
  constructor(clockSync) {
    this.clockSync = clockSync;
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.secondaryAudio = null;
    this.isDualOutputActive = false;
    this.audioContext = null;
    this.isUnlocked = false;

    // Latency offset (-500ms to +500ms) from localStorage
    const savedOffset = localStorage.getItem('syncroom_latency_offset');
    this.userLatencyOffset = savedOffset ? parseInt(savedOffset, 10) : 0;

    // Sync state
    this.scheduledTimer = null;
    this.driftCheckInterval = null;
    this.lastSyncState = null;
    this.listeners = new Set();
    this.lastSkew = 0; // in milliseconds

    this.initAudioEvents();
  }

  // Subscribe to playback updates
  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emitState() {
    for (const fn of this.listeners) {
      fn({
        currentTime: this.audio.currentTime,
        duration: this.audio.duration || 0,
        paused: this.audio.paused,
        playbackRate: this.audio.playbackRate,
        skewMs: Math.round(this.lastSkew),
        userLatencyOffset: this.userLatencyOffset,
        isUnlocked: this.isUnlocked
      });
    }
  }

  // Unlock AudioContext and Audio Element on user gesture (crucial for iOS Safari)
  async unlock() {
    try {
      if (!this.audioContext) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.audioContext = new AudioCtx();
      }
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Play silent buffer to prime mobile audio pipeline
      const buffer = this.audioContext.createBuffer(1, 1, 22050);
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.audioContext.destination);
      source.start(0);

      // Prime HTML5 audio element
      this.audio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
      await this.audio.play();
      this.audio.pause();

      this.isUnlocked = true;
      this.emitState();
      return true;
    } catch (e) {
      console.warn('Audio unlock pending user interaction:', e);
      return false;
    }
  }

  initAudioEvents() {
    this.audio.addEventListener('timeupdate', () => this.emitState());
    this.audio.addEventListener('play', () => this.emitState());
    this.audio.addEventListener('pause', () => this.emitState());
    this.audio.addEventListener('ended', () => this.emitState());
  }

  setLatencyOffset(offsetMs) {
    this.userLatencyOffset = offsetMs;
    localStorage.setItem('syncroom_latency_offset', offsetMs.toString());
    this.emitState();
  }

  async enableSecondaryOutput(deviceId, volume = 1.0) {
    try {
      if (!this.secondaryAudio) {
        this.secondaryAudio = new Audio();
        this.secondaryAudio.preload = 'auto';
      }
      this.secondaryAudio.src = this.audio.src;
      this.secondaryAudio.currentTime = this.audio.currentTime;
      this.secondaryAudio.volume = volume;
      if (this.secondaryAudio.setSinkId && deviceId) {
        await this.secondaryAudio.setSinkId(deviceId);
      }
      if (!this.audio.paused) {
        await this.secondaryAudio.play();
      }
      this.isDualOutputActive = true;
      return true;
    } catch (e) {
      console.warn('Failed to enable secondary audio output:', e);
      return false;
    }
  }

  disableSecondaryOutput() {
    if (this.secondaryAudio) {
      this.secondaryAudio.pause();
      this.secondaryAudio.src = '';
      this.secondaryAudio = null;
    }
    this.isDualOutputActive = false;
  }

  loadSource(srcUrl) {
    if (this.audio.src !== srcUrl) {
      this.clearTimers();
      this.audio.src = srcUrl;
      this.audio.load();
      if (this.secondaryAudio) {
        this.secondaryAudio.src = srcUrl;
        this.secondaryAudio.load();
      }
      this.emitState();
    }
  }

  clearTimers() {
    if (this.scheduledTimer) {
      clearTimeout(this.scheduledTimer);
      this.scheduledTimer = null;
    }
    if (this.driftCheckInterval) {
      clearInterval(this.driftCheckInterval);
      this.driftCheckInterval = null;
    }
  }

  // Scheduled Start / Play
  handleScheduledPlay(scheduledStartTime, startPosition) {
    this.clearTimers();
    this.lastSyncState = { scheduledStartTime, startPosition };

    // Calculate when this should start in local wall-clock time
    // Account for server clock offset and per-device Bluetooth latency offset
    // userLatencyOffset: positive means Bluetooth speaker is slow, so we start audio earlier
    const localStartMoment = this.clockSync.serverToLocal(scheduledStartTime) - this.userLatencyOffset;
    const now = Date.now();
    const delayMs = localStartMoment - now;

    if (delayMs > 0) {
      // Future scheduled start
      this.audio.currentTime = Math.max(0, startPosition);
      if (this.secondaryAudio) {
        this.secondaryAudio.currentTime = Math.max(0, startPosition);
      }
      this.scheduledTimer = setTimeout(async () => {
        try {
          await this.audio.play();
          if (this.secondaryAudio) {
            await this.secondaryAudio.play().catch(() => {});
          }
          this.startDriftCorrectionLoop();
        } catch (err) {
          console.error('Failed to trigger scheduled playback:', err);
        }
      }, delayMs);
    } else {
      // Late join or packet delayed: calculate exact elapsed time
      const elapsedSeconds = (-delayMs) / 1000;
      const targetPos = Math.max(0, startPosition + elapsedSeconds);
      this.audio.currentTime = targetPos;
      this.audio.play().catch(e => console.warn('Late join play prevented:', e));
      if (this.secondaryAudio) {
        this.secondaryAudio.currentTime = targetPos;
        this.secondaryAudio.play().catch(() => {});
      }
      this.startDriftCorrectionLoop();
    }
    this.emitState();
  }

  handlePause(position) {
    this.clearTimers();
    this.audio.pause();
    if (this.secondaryAudio) {
      this.secondaryAudio.pause();
    }
    if (typeof position === 'number') {
      this.audio.currentTime = Math.max(0, position);
      if (this.secondaryAudio) {
        this.secondaryAudio.currentTime = Math.max(0, position);
      }
    }
    this.audio.playbackRate = 1.0;
    if (this.secondaryAudio) {
      this.secondaryAudio.playbackRate = 1.0;
    }
    this.emitState();
  }

  handleSeek(position, isPlaying, scheduledStartTime) {
    this.clearTimers();
    if (!isPlaying || !scheduledStartTime) {
      this.audio.currentTime = Math.max(0, position);
      if (this.secondaryAudio) {
        this.secondaryAudio.currentTime = Math.max(0, position);
      }
      this.emitState();
      return;
    }
    // If playing, follow scheduled seek start
    this.handleScheduledPlay(scheduledStartTime, position);
  }

  // Drift Correction Loop (FR-6)
  startDriftCorrectionLoop() {
    if (this.driftCheckInterval) clearInterval(this.driftCheckInterval);

    this.driftCheckInterval = setInterval(() => {
      if (!this.lastSyncState || this.audio.paused) return;

      const { scheduledStartTime, startPosition } = this.lastSyncState;
      const localStartMoment = this.clockSync.serverToLocal(scheduledStartTime) - this.userLatencyOffset;
      const now = Date.now();
      const elapsedSec = (now - localStartMoment) / 1000;

      if (elapsedSec < 0) return; // Haven't reached scheduled start yet

      const targetPos = Math.max(0, startPosition + elapsedSec);
      const actualPos = this.audio.currentTime;
      const skew = (actualPos - targetPos) * 1000; // in milliseconds
      this.lastSkew = skew;

      // Drift correction policy:
      // 1. Within +- 35ms: In sync. Normal rate (1.0)
      // 2. Between 35ms and 250ms: Soft rate nudge (pitch preserving micro-adjustment)
      // 3. Beyond 250ms: Hard seek
      const absSkew = Math.abs(skew);

      if (absSkew < 35) {
        if (this.audio.playbackRate !== 1.0) {
          this.audio.playbackRate = 1.0;
        }
      } else if (absSkew <= 250) {
        if (skew > 0) {
          // Actual is ahead of target: gently slow down
          this.audio.playbackRate = 0.96;
        } else {
          // Actual is behind target: gently speed up
          this.audio.playbackRate = 1.04;
        }
      } else {
        // Skew is too large: hard snap to target position
        this.audio.currentTime = targetPos;
        this.audio.playbackRate = 1.0;
      }

      this.emitState();
    }, 1000);
  }

  // Play test beep / metronome click for manual Bluetooth calibration
  playTestBeep() {
    if (!this.audioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioCtx();
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, this.audioContext.currentTime); // A5 note

    gain.gain.setValueAtTime(0.3, this.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(this.audioContext.destination);

    osc.start();
    osc.stop(this.audioContext.currentTime + 0.12);
  }

  destroy() {
    this.clearTimers();
    this.audio.pause();
    this.audio.src = '';
    if (this.secondaryAudio) {
      this.secondaryAudio.pause();
      this.secondaryAudio.src = '';
      this.secondaryAudio = null;
    }
    this.listeners.clear();
  }
}
