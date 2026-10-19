import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import { X, Copy, Check, Smartphone } from 'lucide-react';

export default function QRCodeModal({ roomCode, onClose }) {
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef(null);
  const joinUrl = `${window.location.origin}/?room=${roomCode}`;

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, joinUrl, {
        width: 240,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      }, (error) => {
        if (error) console.error(error);
      });
    }
  }, [joinUrl]);

  const handleCopy = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="glass-panel-glow max-w-sm w-full rounded-2xl p-6 relative space-y-5 animate-fade-in">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-bold uppercase tracking-wider mb-2 border border-slate-200">
            <Smartphone className="w-3.5 h-3.5" />
            Scan to Join
          </div>
          <h3 className="text-xl font-bold font-heading text-slate-900">Join Room #{roomCode}</h3>
          <p className="text-xs text-slate-500">Point phone camera or share link with friends on WiFi</p>
        </div>

        {/* QR Code Canvas */}
        <div className="flex justify-center p-3 bg-white border border-slate-200 rounded-xl shadow-sm mx-auto w-fit">
          <canvas ref={canvasRef} className="rounded-lg" />
        </div>

        {/* Direct Link Copy */}
        <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-300">
          <span className="text-xs font-mono text-slate-700 truncate flex-1 pl-2">
            {joinUrl}
          </span>
          <button
            onClick={handleCopy}
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white transition-colors flex items-center gap-1.5 text-xs font-medium cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
