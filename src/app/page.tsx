"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import * as faceapi from "face-api.js";
import { ROOMS } from "@/lib/rooms";

const CampusMap = dynamic(
  () => import("../components/CampusMap").then((mod) => mod.default),
  { ssr: false }
);

type Detection = faceapi.WithFaceDescriptor<faceapi.WithFaceLandmarks<faceapi.WithFaceDetection<object>>>;
type DbFace = { id: string; name: string; descriptor: number[] };

const CALIB_STEPS = [
  "Look straight ahead",
  "Slowly turn left",
  "Slowly turn right",
  "Tilt your head up",
  "Tilt your head down",
  "Turn further left",
  "Turn further right",
  "Tilt further up",
  "Tilt further down",
  "Move naturally — any angle",
];
const TOTAL_STEPS = CALIB_STEPS.length;
const HOLD_MS = 1500;      // hold still for 1.5s to capture
const BETWEEN_MS = 1000;   // cooldown between captures so you have to move

export default function Home() {
  const videoRef       = useRef<HTMLVideoElement>(null);
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const detectionsRef  = useRef<Detection[]>([]);
  const labelHistRef   = useRef<string[][]>([]);

  // calibration refs (all mutable, no stale closure issues in the RAF loop)
  const calibRef       = useRef<{ name: string; step: number; descriptors: Float32Array[] } | null>(null);
  const holdStartRef   = useRef<number | null>(null);
  const lastCaptureRef = useRef<number>(0);
  const calibFlashRef  = useRef(false);

  const [mounted, setMounted]         = useState(false);
  const [stream, setStream]           = useState<MediaStream | null>(null);
  const [audioLevel, setAudioLevel]   = useState(0);
  const audioLevelRef                  = useRef(0);
  const [selectedRoom, setSelectedRoom] = useState("");
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isActive, setIsActive]       = useState(false);

  const [faceMatcher, setFaceMatcher] = useState<faceapi.FaceMatcher | null>(null);
  const [dbFaces, setDbFaces]         = useState<DbFace[]>([]);

  // calibration UI state (drives the overlay)
  const [newPersonName, setNewPersonName] = useState("");
  const [calibActive, setCalibActive]   = useState(false);
  const [calibStep, setCalibStep]       = useState(0);
  const [calibFlash, setCalibFlash]     = useState(false);
  const [calibSaving, setCalibSaving]   = useState(false);

  useEffect(() => {
    setMounted(true);
    loadModels();
    loadFacesFromDB();
    const saved = localStorage.getItem("cougpulse_room");
    if (saved) setSelectedRoom(saved);
  }, []);

  // Report audio level to backend every 2s when a room is selected
  useEffect(() => {
    if (!isActive || !selectedRoom) return;
    const id = setInterval(() => {
      fetch(`/api/rooms/${selectedRoom}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: audioLevelRef.current }),
      }).catch(() => {});
    }, 2000);
    return () => clearInterval(id);
  }, [isActive, selectedRoom]);

  async function loadFacesFromDB() {
    try {
      const res = await fetch("/api/faces");
      if (res.ok) setDbFaces(await res.json());
    } catch (e) { console.error("DB load failed", e); }
  }

  async function loadModels() {
    try {
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri("/models"),
        faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
        faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
      ]);
      setModelsLoaded(true);
    } catch (err) { console.error("Model load failed", err); }
  }

  // Rebuild FaceMatcher — group by name so all samples contribute
  useEffect(() => {
    if (dbFaces.length === 0) { setFaceMatcher(null); return; }
    const byName = new Map<string, Float32Array[]>();
    for (const f of dbFaces) {
      const key = f.name.toLowerCase();
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key)!.push(new Float32Array(f.descriptor));
    }
    const labeled = Array.from(byName.entries()).map(
      ([name, descs]) => new faceapi.LabeledFaceDescriptors(name, descs)
    );
    labelHistRef.current = [];
    setFaceMatcher(new faceapi.FaceMatcher(labeled, 0.65));
  }, [dbFaces]);

  useEffect(() => {
    if (stream && videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  // ─── AR + CALIBRATION LOOP ───────────────────────────────────────────────
  useEffect(() => {
    let raf: number;
    let detecting = false;

    const loop = async () => {
      const video  = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && modelsLoaded && isActive && !detecting) {
        if (video.readyState === 4 && !video.paused && !video.ended) {
          detecting = true;

          if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
            canvas.width  = video.videoWidth;
            canvas.height = video.videoHeight;
          }

          try {
            const dets = await faceapi
              .detectAllFaces(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
              .withFaceLandmarks()
              .withFaceDescriptors();

            // Sort left-to-right by visual position so label history indices are stable
            // across frames even when detection order changes
            dets.sort((a, b) => {
              const ax = canvas.width - a.detection.box.x - a.detection.box.width;
              const bx = canvas.width - b.detection.box.x - b.detection.box.width;
              return ax - bx;
            });

            detectionsRef.current = dets;
            const ctx = canvas.getContext("2d")!;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // ── CALIBRATION ──────────────────────────────────────────────
            if (calibRef.current) {
              const calib = calibRef.current;
              const det   = dets[0];
              const now   = Date.now();

              if (det) {
                const { x, y, width, height } = det.detection.box;
                const mx  = canvas.width - x - width;
                const cx  = mx + width / 2;
                const cy  = y  + height / 2;
                const r   = Math.max(width, height) * 0.58 + 12;
                const cooldown = now - lastCaptureRef.current < BETWEEN_MS;

                if (!cooldown) {
                  if (holdStartRef.current === null) holdStartRef.current = now;
                  const held = Math.min(1, (now - holdStartRef.current) / HOLD_MS);

                  // Capture when held long enough
                  if (held >= 1 && !calibFlashRef.current) {
                    calibFlashRef.current = true;
                    lastCaptureRef.current = now;
                    holdStartRef.current   = null;
                    calib.descriptors.push(new Float32Array(det.descriptor));
                    calib.step++;
                    setCalibStep(calib.step);
                    setCalibFlash(true);
                    setTimeout(() => { calibFlashRef.current = false; setCalibFlash(false); }, 450);

                    if (calib.step >= TOTAL_STEPS) {
                      const { name, descriptors } = calib;
                      calibRef.current = null;
                      holdStartRef.current = null;
                      setCalibActive(false);
                      setTimeout(() => saveCalibration(name, descriptors), 500);
                    }
                  }

                  // Draw hold-progress ring
                  const held2 = holdStartRef.current !== null
                    ? Math.min(1, (now - holdStartRef.current) / HOLD_MS)
                    : (calibFlashRef.current ? 1 : 0);

                  ctx.beginPath();
                  ctx.arc(cx, cy, r, 0, Math.PI * 2);
                  ctx.strokeStyle = "rgba(255,255,255,0.12)";
                  ctx.lineWidth = 4;
                  ctx.stroke();

                  if (held2 > 0) {
                    ctx.beginPath();
                    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + held2 * Math.PI * 2);
                    ctx.strokeStyle = calibFlashRef.current ? "#ffffff" : "#10b981";
                    ctx.lineWidth = 4;
                    ctx.lineCap = "round";
                    ctx.stroke();
                  }
                } else {
                  holdStartRef.current = null; // reset hold during cooldown
                  // draw faint ring while cooling down
                  ctx.beginPath();
                  ctx.arc(cx, cy, r, 0, Math.PI * 2);
                  ctx.strokeStyle = "rgba(255,255,255,0.12)";
                  ctx.lineWidth = 4;
                  ctx.stroke();
                }
              } else {
                holdStartRef.current = null;
              }

            // ── RECOGNITION ──────────────────────────────────────────────
            } else {
              labelHistRef.current = labelHistRef.current.slice(0, dets.length);

              dets.forEach((det, i) => {
                const { x, y, width, height } = det.detection.box;
                const mx = canvas.width - x - width;

                let raw = "UNKNOWN";
                if (faceMatcher) {
                  // Compute distance to every enrolled person
                  const ranked = faceMatcher.labeledDescriptors.map(ld => ({
                    label: ld.label,
                    distance: Math.min(...ld.descriptors.map(d => {
                      let s = 0;
                      for (let k = 0; k < d.length; k++) s += (det.descriptor[k] - d[k]) ** 2;
                      return Math.sqrt(s);
                    })),
                  })).sort((a, b) => a.distance - b.distance);

                  const best   = ranked[0];
                  const second = ranked[1];

                  // Accept only if under threshold AND clearly better than runner-up
                  const THRESHOLD   = 0.6;
                  const RATIO_LIMIT = 0.82; // best/second must be < this
                  const ambiguous   = second && (best.distance / second.distance) > RATIO_LIMIT;

                  if (best && best.distance < THRESHOLD && !ambiguous) {
                    raw = best.label.toUpperCase();
                  }
                }

                if (!labelHistRef.current[i]) labelHistRef.current[i] = [];
                const hist = labelHistRef.current[i];
                hist.push(raw);
                if (hist.length > 10) hist.shift();

                const counts: Record<string, number> = {};
                for (const l of hist) counts[l] = (counts[l] || 0) + 1;
                const label = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];

                const color = label === "UNKNOWN" ? "#ef4444" : "#10b981";
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.strokeRect(mx, y, width, height);
                ctx.font = "bold 13px monospace";
                ctx.fillStyle = color;
                ctx.fillText(label, mx + 4, y - 6);
              });
            }
          } catch (e) { console.error(e); }
          detecting = false;
        }
      }
      raf = requestAnimationFrame(loop);
    };

    loop();
    return () => cancelAnimationFrame(raf);
  }, [isActive, modelsLoaded, faceMatcher]);

  // ─── CALIBRATION CONTROLS ────────────────────────────────────────────────
  function startCalibration() {
    if (!newPersonName.trim() || !isActive) return;
    calibRef.current     = { name: newPersonName.trim(), step: 0, descriptors: [] };
    holdStartRef.current = null;
    lastCaptureRef.current = 0;
    setCalibStep(0);
    setCalibFlash(false);
    setNewPersonName("");
    setCalibActive(true);
  }

  function cancelCalibration() {
    calibRef.current     = null;
    holdStartRef.current = null;
    setCalibActive(false);
    setCalibStep(0);
  }

  async function saveCalibration(name: string, descriptors: Float32Array[]) {
    setCalibSaving(true);
    for (const desc of descriptors) {
      await fetch("/api/faces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, descriptor: Array.from(desc) }),
      });
    }
    await loadFacesFromDB();
    setCalibSaving(false);
    setCalibStep(0);
  }

  async function deleteSubject(ids: string[]) {
    await Promise.all(ids.map(id => fetch(`/api/faces/${id}`, { method: "DELETE" })));
    setDbFaces(prev => prev.filter(f => !ids.includes(f.id)));
  }

  async function start() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      setStream(s);
      setIsActive(true);
      const audioCtx  = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source    = audioCtx.createMediaStreamSource(s);
      const analyser  = audioCtx.createAnalyser();
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const level = data.reduce((a, b) => a + b) / data.length;
        audioLevelRef.current = level;
        setAudioLevel(level);
        requestAnimationFrame(tick);
      };
      tick();
    } catch (e: any) { alert("Camera error: " + e.message); }
  }

  const subjectGroups = Array.from(
    dbFaces.reduce((map, f) => {
      const key = f.name.toLowerCase();
      if (!map.has(key)) map.set(key, { name: f.name, ids: [] });
      map.get(key)!.ids.push(f.id);
      return map;
    }, new Map<string, { name: string; ids: string[] }>()).values()
  );

  const pct = Math.round((calibStep / TOTAL_STEPS) * 100);
  const circumference = 2 * Math.PI * 100;

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-4 md:p-8 font-sans selection:bg-emerald-500">
      <div className="max-w-4xl mx-auto space-y-12">

        <header className="text-center space-y-2">
          <h1 className="text-6xl font-black tracking-tighter italic">
            COUG<span className="text-emerald-500 font-black">PULSE</span>
          </h1>
          <p className="text-zinc-600 font-bold uppercase tracking-[0.5em] text-[9px]">Biometric Intelligence Node</p>
        </header>

        <div className="bg-zinc-900/30 border border-emerald-500/10 rounded-[2.5rem] p-8 shadow-2xl backdrop-blur-xl">
          {!isActive ? (
            <div className="text-center py-20 space-y-8">
              <div className="w-24 h-24 bg-emerald-500/5 rounded-full flex items-center justify-center mx-auto border border-emerald-500/10 animate-pulse">
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <button onClick={start} disabled={!modelsLoaded}
                className="px-16 py-6 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 text-white font-black rounded-full transition-all shadow-[0_0_50px_rgba(16,185,129,0.4)] hover:scale-105 active:scale-95 uppercase tracking-widest text-xs">
                {modelsLoaded ? "Initialize Biometric Link" : "Syncing Models..."}
              </button>
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-8 items-start">

              {/* VIDEO */}
              <div className="md:col-span-2 space-y-4">
                <div className="relative bg-black rounded-3xl overflow-hidden border border-white/5 shadow-2xl">
                  <video ref={videoRef} autoPlay playsInline muted className="block w-full h-auto scale-x-[-1]" />
                  <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-10" />

                  {/* CALIBRATION OVERLAY */}
                  {calibActive && (
                    <div className={`absolute inset-0 z-20 flex flex-col items-center justify-center transition-colors duration-200 ${calibFlash ? "bg-white/25" : "bg-black/55"} backdrop-blur-[1px]`}>

                      {/* Progress ring */}
                      <svg width="220" height="220" viewBox="0 0 220 220">
                        {/* Face guide oval */}
                        <ellipse cx="110" cy="110" rx="62" ry="82" fill="none"
                          stroke="white" strokeOpacity="0.12" strokeWidth="1.5" strokeDasharray="5 4" />
                        {/* Track */}
                        <circle cx="110" cy="110" r="100" fill="none"
                          stroke="white" strokeOpacity="0.08" strokeWidth="5" />
                        {/* Progress */}
                        <circle cx="110" cy="110" r="100" fill="none"
                          stroke={calibFlash ? "#ffffff" : "#10b981"} strokeWidth="5"
                          strokeLinecap="round"
                          strokeDasharray={circumference}
                          strokeDashoffset={circumference * (1 - calibStep / TOTAL_STEPS)}
                          transform="rotate(-90 110 110)"
                          style={{ transition: "stroke-dashoffset 0.4s ease, stroke 0.15s ease" }}
                        />
                        {/* Percent */}
                        <text x="110" y="103" textAnchor="middle" fill="white"
                          fontSize="34" fontWeight="900" fontFamily="monospace">{pct}%</text>
                        <text x="110" y="124" textAnchor="middle" fill="rgba(255,255,255,0.35)"
                          fontSize="11" fontFamily="monospace">{calibStep} / {TOTAL_STEPS}</text>
                      </svg>

                      {/* Instruction */}
                      <div className="text-center mt-3 space-y-1 px-6">
                        <p className="text-white font-bold text-sm tracking-wide">
                          {calibStep < TOTAL_STEPS ? CALIB_STEPS[calibStep] : "All done!"}
                        </p>
                        <p className="text-zinc-500 text-[10px] font-mono uppercase tracking-widest">
                          Hold still — captures automatically
                        </p>
                      </div>

                      <button onClick={cancelCalibration}
                        className="mt-8 text-zinc-600 hover:text-zinc-400 text-[10px] uppercase font-bold tracking-widest transition-colors">
                        Cancel
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[9px] font-black text-zinc-500 uppercase tracking-[0.3em]">
                      <span>Acoustic Scan</span>
                      <span className="text-emerald-500">{Math.round((audioLevel / 128) * 100)}%</span>
                    </div>
                    <div className="h-1 w-full bg-zinc-900 rounded-full overflow-hidden border border-white/5">
                      <div className="h-full bg-emerald-500 transition-all duration-75"
                        style={{ width: `${Math.min(100, (audioLevel / 128) * 100)}%` }} />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[9px] font-black text-zinc-500 uppercase tracking-[0.3em]">
                      <span>Device Location</span>
                      {selectedRoom && <span className="text-emerald-500">Reporting</span>}
                    </div>
                    <select
                      value={selectedRoom}
                      onChange={e => {
                        setSelectedRoom(e.target.value);
                        localStorage.setItem("cougpulse_room", e.target.value);
                      }}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-[10px] text-zinc-400 font-mono uppercase focus:outline-none focus:border-emerald-500/50 transition-colors cursor-pointer"
                    >
                      <option value="">— Select Room —</option>
                      {ROOMS.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* PANEL */}
              <div className="bg-zinc-950/50 rounded-2xl p-5 border border-zinc-800 space-y-5">
                <div className="border-b border-zinc-800 pb-2">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Add Person</h3>
                  <p className="text-[9px] text-zinc-700 mt-1">{TOTAL_STEPS}-angle face calibration</p>
                </div>

                <div className="space-y-2">
                  <input
                    type="text"
                    value={newPersonName}
                    onChange={e => setNewPersonName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && startCalibration()}
                    placeholder="Name..."
                    disabled={calibActive}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-emerald-400 focus:outline-none focus:border-emerald-500/50 transition-colors uppercase font-mono disabled:opacity-30"
                  />
                  <button
                    onClick={startCalibration}
                    disabled={!newPersonName.trim() || calibActive || calibSaving}
                    className="w-full py-3 bg-zinc-100 hover:bg-white text-zinc-950 font-black rounded-lg text-[10px] uppercase tracking-widest transition-all active:scale-95 disabled:opacity-20"
                  >
                    {calibSaving ? "Saving..." : calibActive ? `Calibrating... ${pct}%` : "Start Calibration"}
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                    <h4 className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">
                      Enrolled — {subjectGroups.length} {subjectGroups.length === 1 ? "person" : "people"}
                    </h4>
                    {subjectGroups.length > 0 && (
                      <button
                        onClick={() => deleteSubject(dbFaces.map(f => f.id))}
                        className="text-[9px] font-black text-zinc-700 hover:text-red-500 uppercase tracking-widest transition-colors"
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                  <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar">
                    {subjectGroups.map(({ name, ids }) => (
                      <div key={name} className="flex items-center gap-3 bg-zinc-900/50 p-2 rounded-lg border border-zinc-800/50">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_5px_#10b981] shrink-0" />
                        <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-tighter flex-1">{name}</span>
                        <span className="text-[9px] text-zinc-600 font-mono">{ids.length} samples</span>
                        <button onClick={() => deleteSubject(ids)}
                          className="text-zinc-700 hover:text-red-500 transition-colors text-[10px] font-black px-1">
                          ✕
                        </button>
                      </div>
                    ))}
                    {subjectGroups.length === 0 && (
                      <div className="text-[10px] text-zinc-700 italic text-center py-8">No subjects enrolled</div>
                    )}
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>

        <section className="space-y-6">
          <div className="flex items-center justify-between px-4">
            <h2 className="text-xs font-black uppercase tracking-[0.5em] text-zinc-500">Security Map Interface</h2>
            <div className="px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[8px] font-black text-emerald-500 animate-pulse">WSU_SECURE_ENCRYPTED_FEED</div>
          </div>
          <div className="h-125 bg-zinc-900/50 rounded-[2.5rem] overflow-hidden border border-zinc-800 shadow-2xl relative">
            {mounted && <CampusMap />}
          </div>
        </section>

        <footer className="pt-8 flex justify-between text-[8px] font-black text-zinc-800 uppercase tracking-[0.5em] border-t border-zinc-900">
          <span>© 2026 COUGPULSE DEFENSE SYSTEMS // BIOMETRIC V4.0</span>
          <div className="flex gap-8">
            <Link href="/map" className="hover:text-emerald-500 transition-colors">ACOUSTIC_MAP</Link>
            <span className="text-emerald-500/20">|</span>
            <a href="/api/docs" className="hover:text-emerald-500 transition-colors">DATABASE_API</a>
            <span className="text-emerald-500/20">|</span>
            <span className="text-emerald-500/50 uppercase">Neural_Auth_Active</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
