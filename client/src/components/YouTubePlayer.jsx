import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, Music, Maximize2, Sparkles, Shield, Zap } from 'lucide-react';

const YoutubeIcon = ({ className = "w-5 h-5 text-red-600" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

export default function YouTubePlayer({
  youtubeId,
  media,
  playback,
  clockSync,
  userLatencyOffset,
  isHost,
  videoQuality = 'medium',
  onSeek,
  onToggleMode
}) {
  const playerRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const scheduledTimerRef = useRef(null);
  const driftIntervalRef = useRef(null);

  // Load YouTube IFrame API
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }

    const checkYT = () => {
      if (window.YT && window.YT.Player) {
        initPlayer();
      } else {
        setTimeout(checkYT, 100);
      }
    };

    const initPlayer = () => {
      if (playerRef.current) return;
      playerRef.current = new window.YT.Player('yt-iframe-container', {
        videoId: youtubeId,
        playerVars: {
          autoplay: 0,
          controls: isHost ? 1 : 0, // Listeners follow host strictly
          disablekb: isHost ? 0 : 1,
          fs: 1,
          modestbranding: 1,
          playsinline: 1,
          rel: 0
        },
        events: {
          onReady: () => {
            setIsReady(true);
            try {
              if (videoQuality && playerRef.current.setPlaybackQuality) {
                playerRef.current.setPlaybackQuality(videoQuality);
              }
            } catch (e) {}
          }
        }
      });
    };

    checkYT();

    return () => {
      if (driftIntervalRef.current) clearInterval(driftIntervalRef.current);
      if (scheduledTimerRef.current) clearTimeout(scheduledTimerRef.current);
      if (playerRef.current && playerRef.current.destroy) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          // ignore
        }
        playerRef.current = null;
      }
    };
  }, [youtubeId]);

  // Apply Quality Updates (Admin managed)
  useEffect(() => {
    if (isReady && playerRef.current && playerRef.current.setPlaybackQuality) {
      try {
        playerRef.current.setPlaybackQuality(videoQuality);
      } catch (e) {}
    }
  }, [videoQuality, isReady]);

  // Background audio & MediaSession API registration
  useEffect(() => {
    if ('mediaSession' in navigator && media) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: media.title || 'SyncRoom Audio',
          artist: media.channel || 'SyncRoom Live Broadcast',
          artwork: [
            {
              src: media.thumbnail || (youtubeId ? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg` : ''),
              sizes: '512x512',
              type: 'image/jpeg'
            }
          ]
        });

        if (isHost && onSeek) {
          navigator.mediaSession.setActionHandler('seekto', (details) => {
            if (details.seekTime !== undefined) {
              onSeek(details.seekTime);
            }
          });
        }
      } catch (err) {
        console.warn('MediaSession error:', err);
      }
    }
  }, [media, youtubeId, isHost, onSeek]);

  // Handle Play/Pause/Seek sync
  useEffect(() => {
    if (!isReady || !playerRef.current) return;

    if (scheduledTimerRef.current) {
      clearTimeout(scheduledTimerRef.current);
      scheduledTimerRef.current = null;
    }
    if (driftIntervalRef.current) {
      clearInterval(driftIntervalRef.current);
      driftIntervalRef.current = null;
    }

    const { isPlaying, position, scheduledStartTime } = playback;

    if (!isPlaying) {
      try {
        playerRef.current.pauseVideo();
        if (typeof position === 'number') {
          playerRef.current.seekTo(position, true);
        }
      } catch (err) {
        console.warn('YT pause err:', err);
      }
      return;
    }

    // Is playing: handle scheduled timing
    const localStartMoment = clockSync.serverToLocal(scheduledStartTime) - userLatencyOffset;
    const now = Date.now();
    const delayMs = localStartMoment - now;

    const startPlayback = (targetPos) => {
      try {
        if (videoQuality && playerRef.current.setPlaybackQuality) {
          playerRef.current.setPlaybackQuality(videoQuality);
        }
        playerRef.current.seekTo(targetPos, true);
        playerRef.current.playVideo();
        startYTDriftCheck(scheduledStartTime, position);
      } catch (err) {
        console.warn('YT play err:', err);
      }
    };

    if (delayMs > 0) {
      try {
        playerRef.current.pauseVideo();
        playerRef.current.seekTo(position, true);
      } catch (e) {}

      scheduledTimerRef.current = setTimeout(() => {
        startPlayback(position);
      }, delayMs);
    } else {
      // Late join or delay elapsed
      const elapsed = (-delayMs) / 1000;
      const targetPos = Math.max(0, position + elapsed);
      startPlayback(targetPos);
    }
  }, [playback, isReady, clockSync, userLatencyOffset, videoQuality]);

  const startYTDriftCheck = (scheduledStartTime, startPosition) => {
    driftIntervalRef.current = setInterval(() => {
      if (!playerRef.current || !playerRef.current.getCurrentTime) return;
      const localStartMoment = clockSync.serverToLocal(scheduledStartTime) - userLatencyOffset;
      const now = Date.now();
      const elapsedSec = (now - localStartMoment) / 1000;
      if (elapsedSec < 0) return;

      const targetPos = Math.max(0, startPosition + elapsedSec);
      const actualPos = playerRef.current.getCurrentTime();
      const skew = Math.abs(actualPos - targetPos);

      // YouTube API seek threshold (if skew > 250ms)
      if (skew > 0.25) {
        playerRef.current.seekTo(targetPos, true);
      }
    }, 1500);
  };

  const getQualityLabel = (q) => {
    switch (q) {
      case 'small': return '144p / 240p (Data Saver)';
      case 'medium': return '360p (Standard)';
      case 'large': return '480p (HQ)';
      case 'hd720': return '720p HD';
      case 'hd1080': return '1080p FHD';
      default: return 'Auto Quality';
    }
  };

  return (
    <div className="glass-panel rounded-2xl overflow-hidden p-4 space-y-3 shadow-md">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <YoutubeIcon className="w-5 h-5 text-red-600" />
          <span className="text-sm font-bold text-slate-900">YouTube Video Stream</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
            {getQualityLabel(videoQuality)}
          </span>
        </div>

        {/* Switch to Namida Audio Mode */}
        {onToggleMode && (
          <button
            onClick={onToggleMode}
            className="px-2.5 py-1 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
            title="Switch to Audio Only (Namida Mode)"
          >
            <Music className="w-3.5 h-3.5 text-purple-600" />
            <span>Audio Mode</span>
          </button>
        )}
      </div>

      <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-950 shadow-inner border border-slate-200">
        <div id="yt-iframe-container" className="w-full h-full" />
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <span className="flex items-center gap-1">
          <Shield className="w-3.5 h-3.5 text-emerald-600" />
          {isHost ? 'Admin controls playback & quality' : 'Synced with Admin'}
        </span>
        <span className="text-[11px] text-slate-400">
          Background Playback Active
        </span>
      </div>
    </div>
  );
}
