"use client";

import { useEffect, useRef, useState } from "react";

export default function MediaFeed() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isActive, setIsActive] = useState(false);

  async function startFeed() {
    console.log("Start button clicked");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
      const audioContext = new AudioContextClass();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateLevel = () => {
        if (analyser) {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          const average = sum / bufferLength;
          setAudioLevel(average);
          requestAnimationFrame(updateLevel);
        }
      };

      updateLevel();
      setIsActive(true);
      setError(null);
    } catch (err: any) {
      console.error("Media error:", err);
      setError(err.message || "Failed to access camera/microphone");
    }
  }

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-zinc-900/50 rounded-2xl border border-zinc-800 shadow-xl">
      <h2 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-4">Media Interface</h2>
      
      {!isActive ? (
        <button
          onClick={startFeed}
          className="w-full py-12 flex flex-col items-center justify-center gap-4 bg-zinc-900 border-2 border-dashed border-zinc-700 rounded-xl hover:border-zinc-500 hover:bg-zinc-800/50 transition-all group"
        >
          <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/><circle cx="9" cy="12" r="3"/></svg>
          </div>
          <div className="text-center">
            <span className="block text-white font-semibold">Initialize Media Feed</span>
            <span className="text-zinc-500 text-xs">Camera and microphone access required</span>
          </div>
        </button>
      ) : (
        <div className="space-y-6">
          <div className="relative aspect-video bg-black rounded-lg overflow-hidden ring-1 ring-white/10">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
            <div className="absolute top-3 left-3 px-2 py-1 bg-red-600 rounded text-[10px] font-bold uppercase tracking-tighter animate-pulse">
              Live
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-end">
              <span className="text-[10px] text-zinc-500 uppercase font-black">Audio Level</span>
              <span className="text-xs font-mono text-zinc-400">{Math.round((audioLevel / 128) * 100)}%</span>
            </div>
            <div className="h-3 w-full bg-black rounded-full p-0.5 border border-zinc-800">
              <div 
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full shadow-[0_0_10px_rgba(6,182,212,0.5)] transition-all duration-75"
                style={{ width: `${Math.min(100, (audioLevel / 128) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-[11px] text-red-400 font-medium">
          CRITICAL: {error}
        </div>
      )}
    </div>
  );
}
