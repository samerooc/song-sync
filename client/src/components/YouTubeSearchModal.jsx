import React, { useState, useEffect } from 'react';
import { Search, X, Music, Play, Clock, Sparkles, Loader2, AlertCircle } from 'lucide-react';

const SUGGESTIONS = [
  'Arijit Singh Hits',
  'Bollywood Lo-Fi',
  'Punjabi Top 50',
  'Coke Studio Hits',
  'English Pop Hits',
  'Night Drive Beats',
  'Bass Boosted Car Mix'
];

export default function YouTubeSearchModal({ isOpen, onClose, onSelectVideo }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSearch = async (searchQuery) => {
    const q = searchQuery || query;
    if (!q || !q.trim()) return;
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/yt-search?q=${encodeURIComponent(q.trim())}`);
      const data = await res.json();
      if (data.results) {
        setResults(data.results);
      } else {
        setError(data.error || 'No results found. Try another search.');
      }
    } catch (err) {
      setError('Failed to connect to search service.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = (video) => {
    onSelectVideo(video.id, `https://www.youtube.com/watch?v=${video.id}`, video.title, video.thumbnail, video.channel);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl relative flex flex-col max-h-[90vh] text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-red-600 to-rose-500 flex items-center justify-center shadow-lg shadow-red-500/20 text-white">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold font-heading text-white flex items-center gap-2">
                YouTube Song Search
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 font-semibold">
                  Zero Ads
                </span>
              </h3>
              <p className="text-xs text-slate-400">Search any track to broadcast across all synced devices</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input Box */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
          className="mt-4 flex gap-2"
        >
          <div className="relative flex-1">
            <input
              type="text"
              autoFocus
              placeholder="Search song, artist, album (e.g. Arijit Singh, Sidhu Moosewala)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full py-2.5 sm:py-3 pl-10 pr-4 rounded-xl bg-slate-800/90 border border-slate-700 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all font-medium"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          </div>
          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="px-5 py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs sm:text-sm font-semibold transition-all shadow-md shadow-red-600/20 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span>Search</span>
          </button>
        </form>

        {/* Quick Suggestion Tags */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-2.5 no-scrollbar">
          <span className="text-[11px] text-slate-500 font-medium shrink-0 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" /> Quick:
          </span>
          {SUGGESTIONS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => {
                setQuery(tag);
                handleSearch(tag);
              }}
              className="shrink-0 px-2.5 py-1 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700/60 text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Results Area */}
        <div className="flex-1 overflow-y-auto mt-2 space-y-2 pr-1 min-h-[220px]">
          {isLoading && (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-red-500" />
              <p className="text-xs">Searching YouTube database...</p>
            </div>
          )}

          {!isLoading && error && (
            <div className="p-4 rounded-xl bg-red-950/40 border border-red-800 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!isLoading && results.length === 0 && !error && (
            <div className="py-12 flex flex-col items-center justify-center text-slate-500 gap-2">
              <Music className="w-10 h-10 opacity-30 text-slate-400" />
              <p className="text-xs">Type a track name or artist to find and sync playback instantly</p>
            </div>
          )}

          {!isLoading && results.map((video) => (
            <div
              key={video.id}
              className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-slate-600 transition-all group"
            >
              <div className="flex items-center gap-3 min-w-0 pr-3">
                {/* Thumbnail */}
                <div className="relative w-20 h-12 sm:w-24 sm:h-14 rounded-lg overflow-hidden shrink-0 bg-slate-950 border border-slate-700">
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  {video.duration && (
                    <span className="absolute bottom-1 right-1 px-1 py-0.2 rounded bg-black/80 text-[10px] font-mono font-medium text-white flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      {video.duration}
                    </span>
                  )}
                </div>

                {/* Details */}
                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-semibold text-white truncate group-hover:text-red-400 transition-colors">
                    {video.title}
                  </h4>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                    {video.channel}
                  </p>
                </div>
              </div>

              {/* Play Button */}
              <button
                onClick={() => handleSelect(video)}
                className="shrink-0 px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-red-600/30 hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span className="hidden sm:inline">Play In Room</span>
              </button>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
