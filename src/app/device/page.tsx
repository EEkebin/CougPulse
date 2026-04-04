"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import * as faceapi from "face-api.js";
import { defaultDeviceName } from "@/lib/devices";
import type { LayoutFloor } from "@/lib/layout-types";

type Device = {
  id: string;
  name: string;
  assignedRoomId: string | null;
  lastSeenAt: string | null;
  lastAudioLevel: number | null;
  previewImage: string | null;
  previewTakenAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type MatchResult = {
  match: string | null;
  label: string;
  distance?: number;
  isTroublemaker?: boolean;
  notes?: string | null;
  roomId?: string | null;
  alertCreated?: boolean;
  blocked?: string;
};

type DetectionLabel = {
  key: string;
  label: string;
  isTroublemaker: boolean;
};

const STORAGE_KEY = "cougpulse_device_id";
const CLIENT_KEY_STORAGE = "cougpulse_device_client_key";
const DEVICE_NAME_STORAGE = "cougpulse_device_name";
const DEVICE_RECORD_STORAGE = "cougpulse_device_record";
const HEARTBEAT_MS = 2000;
const DEVICE_REFRESH_MS = 3000;
const RECOGNITION_COOLDOWN_MS = 650;
const DEVICE_DETECTOR_OPTIONS = new faceapi.TinyFaceDetectorOptions({
  inputSize: 224,
  scoreThreshold: 0.45,
});

function readStoredDeviceRecord() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(DEVICE_RECORD_STORAGE);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as { id?: string; name?: string; clientKey?: string };
  } catch {
    window.localStorage.removeItem(DEVICE_RECORD_STORAGE);
    return null;
  }
}

export default function DevicePage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const faceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioLevelRef = useRef(0);
  const lastRecognitionRef = useRef(0);

  const [device, setDevice] = useState<Device | null>(null);
  const [floors, setFloors] = useState<LayoutFloor[]>([]);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [streamActive, setStreamActive] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [recognized, setRecognized] = useState<DetectionLabel[]>([]);
  const [alertBanner, setAlertBanner] = useState<string | null>(null);
  const [reportingEnabled, setReportingEnabled] = useState(false);

  useEffect(() => {
    ensureDevice();
    loadModels();
    void loadFloors();
  }, []);

  useEffect(() => {
    if (!device || typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, device.id);
    window.localStorage.setItem(DEVICE_NAME_STORAGE, device.name);
    window.localStorage.setItem(DEVICE_RECORD_STORAGE, JSON.stringify({
      id: device.id,
      name: device.name,
      clientKey: window.localStorage.getItem(CLIENT_KEY_STORAGE),
    }));
  }, [device]);

  useEffect(() => {
    if (!streamActive || !device?.id) return;

    const heartbeat = window.setInterval(() => {
      const previewImage = capturePreview();
      fetch(`/api/devices/${device.id}/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioLevel: audioLevelRef.current, previewImage }),
      })
        .then((res) => res.ok ? res.json() : null)
        .then((payload) => {
          if (payload?.device) setDevice(payload.device);
                  setReportingEnabled(Boolean(payload?.reportingEnabled));
        })
        .catch(() => {});
    }, HEARTBEAT_MS);

    const refresh = window.setInterval(() => {
      fetch(`/api/devices/${device.id}`, { cache: "no-store" })
        .then((res) => res.ok ? res.json() : null)
        .then((payload) => {
          if (payload) setDevice(payload);
        })
        .catch(() => {});
      void loadFloors();
    }, DEVICE_REFRESH_MS);

    return () => {
      window.clearInterval(heartbeat);
      window.clearInterval(refresh);
    };
  }, [device?.id, streamActive]);

  useEffect(() => {
    let raf = 0;
    let busy = false;

    const loop = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && device?.id && device.assignedRoomId && streamActive && modelsLoaded && !busy && Date.now() - lastRecognitionRef.current > RECOGNITION_COOLDOWN_MS) {
        if (video.readyState === 4 && !video.paused && !video.ended) {
          busy = true;
          lastRecognitionRef.current = Date.now();

          if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
          }

          try {
            const detections = await faceapi
              .detectAllFaces(video, DEVICE_DETECTOR_OPTIONS)
              .withFaceLandmarks()
              .withFaceDescriptors();

            const results = await Promise.all(
              detections.map(async (detection, index) => {
                const faceImage = captureFaceImage(detection.detection.box);
                const res = await fetch("/api/identify", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    descriptor: Array.from(detection.descriptor),
                    deviceId: device.id,
                    faceImage,
                  }),
                });
                const payload = (await res.json()) as MatchResult;
                return { detection, payload, index };
              })
            );

            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              const nextLabels: DetectionLabel[] = [];

              for (const { detection, payload, index } of results) {
                const { x, y, width, height } = detection.detection.box;
                const mx = canvas.width - x - width;
                const label = payload.label || "UNKNOWN";
                const flagged = Boolean(payload.isTroublemaker);
                const color = flagged ? "#ef4444" : label === "UNKNOWN" ? "#f59e0b" : "#10b981";

                ctx.strokeStyle = color;
                ctx.lineWidth = 3;
                ctx.strokeRect(mx, y, width, height);
                ctx.fillStyle = color;
                ctx.font = "bold 13px monospace";
                ctx.fillText(label, mx + 4, Math.max(16, y - 6));

                nextLabels.push({
                  key: `${label}-${index}`,
                  label,
                  isTroublemaker: flagged,
                });

                if (flagged) {
                  setAlertBanner(`${label} flagged on ${device.name}${payload.roomId ? ` in ${roomLabelMap.get(payload.roomId) ?? payload.roomId}` : ""}`);
                }
              }

              setRecognized(nextLabels);
            }
          } catch (error) {
            console.error(error);
          }

          busy = false;
        }
      }

      raf = window.requestAnimationFrame(loop);
    };

    raf = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(raf);
  }, [device, modelsLoaded, streamActive]);

  useEffect(() => {
    setReportingEnabled(Boolean(device?.assignedRoomId));
  }, [device?.assignedRoomId]);

  async function ensureDevice() {
    const parsedRecord = readStoredDeviceRecord();
    const storedName = typeof window !== "undefined" ? window.localStorage.getItem(DEVICE_NAME_STORAGE) ?? parsedRecord?.name ?? null : null;
    const storedClientKey = typeof window !== "undefined" ? window.localStorage.getItem(CLIENT_KEY_STORAGE) ?? parsedRecord?.clientKey ?? null : null;
    const storedId = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) ?? parsedRecord?.id ?? null : null;
    if (storedId) {
      const existing = await fetch(`/api/devices/${storedId}`, { cache: "no-store" });
      if (existing.ok) {
        const payload = await existing.json();
        window.localStorage.setItem(STORAGE_KEY, payload.id);
        window.localStorage.setItem(DEVICE_NAME_STORAGE, payload.name);
        window.localStorage.setItem(DEVICE_RECORD_STORAGE, JSON.stringify({
          id: payload.id,
          name: payload.name,
          clientKey: storedClientKey,
        }));
        setDevice(payload);
        return;
      }
    }

    const clientKey = storedClientKey || crypto.randomUUID();
    const deviceName = storedName || defaultDeviceName();

    const created = await fetch("/api/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: deviceName, clientKey }),
    });

    if (!created.ok) return;
    const payload = await created.json();
    window.localStorage.setItem(CLIENT_KEY_STORAGE, clientKey);
    window.localStorage.setItem(STORAGE_KEY, payload.id);
    window.localStorage.setItem(DEVICE_NAME_STORAGE, payload.name);
    window.localStorage.setItem(DEVICE_RECORD_STORAGE, JSON.stringify({
      id: payload.id,
      name: payload.name,
      clientKey,
    }));
    setDevice(payload);
  }

  async function loadModels() {
    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
        faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
        faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
      ]);
      setModelsLoaded(true);
    } catch (error) {
      console.error(error);
    }
  }

  async function loadFloors() {
    const res = await fetch("/api/floors", { cache: "no-store" });
    if (res.ok) setFloors(await res.json());
  }

  async function startStreaming() {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 960 }, height: { ideal: 540 } },
        audio: true,
      });

      if (videoRef.current) videoRef.current.srcObject = mediaStream;
      setStreamActive(true);

      const AudioContextClass = window.AudioContext || (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      const audioContext = new AudioContextClass();
      const source = audioContext.createMediaStreamSource(mediaStream);
      const analyser = audioContext.createAnalyser();
      source.connect(analyser);
      const buffer = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteFrequencyData(buffer);
        const nextLevel = buffer.reduce((sum, value) => sum + value, 0) / buffer.length;
        audioLevelRef.current = nextLevel;
        setAudioLevel(nextLevel);
        window.requestAnimationFrame(tick);
      };

      tick();
    } catch (error) {
      console.error(error);
      alert("This device could not access its camera and microphone.");
    }
  }

  function capturePreview() {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return null;

    const canvas = previewCanvasRef.current ?? document.createElement("canvas");
    previewCanvasRef.current = canvas;
    canvas.width = 320;
    canvas.height = 180;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
    ctx.restore();

    return canvas.toDataURL("image/jpeg", 0.58);
  }

  function captureFaceImage(box: faceapi.Box) {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return null;

    const canvas = faceCanvasRef.current ?? document.createElement("canvas");
    faceCanvasRef.current = canvas;

    const padding = 24;
    const sourceX = Math.max(0, box.x - padding);
    const sourceY = Math.max(0, box.y - padding);
    const sourceW = Math.min(video.videoWidth - sourceX, box.width + padding * 2);
    const sourceH = Math.min(video.videoHeight - sourceY, box.height + padding * 2);

    canvas.width = 160;
    canvas.height = 160;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, sourceX, sourceY, sourceW, sourceH, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL("image/jpeg", 0.72);
  }

  const roomLabelMap = useMemo(
    () =>
      new Map(
        floors.flatMap((floor) =>
          floor.rooms.map((room) => [room.id, `${room.name} (${floor.name})`] as const)
        )
      ),
    [floors]
  );

  const assignedRoomLabel = useMemo(() => {
    if (!device?.assignedRoomId) return "Waiting for security assignment";
    return roomLabelMap.get(device.assignedRoomId) ?? device.assignedRoomId;
  }, [device?.assignedRoomId, roomLabelMap]);

  return (
    <main className="cp-shell">
      <div className="cp-bg-shape cp-shape-a" aria-hidden="true" />
      <div className="cp-bg-shape cp-shape-b" aria-hidden="true" />

      <div className="cp-app-shell">
        <section className="cp-dashboard">
          <header className="cp-card cp-topbar">
            <div>
              <h1>CougPulse Device Client</h1>
              <p>This phone or laptop joins the system as a camera and microphone device.</p>
            </div>
            <div className="cp-topbar-actions">
              <Link href="/admin" className="cp-btn cp-btn-ghost">
                Security Console
              </Link>
              <Link href="/" className="cp-btn cp-btn-primary">
                Student Heatmap
              </Link>
            </div>
          </header>

          {alertBanner && (
            <section className="cp-card border border-[#eb5757] bg-[#fff1f1] p-4 text-[#7d1c1c]">
              <strong>Flagged Person Detected:</strong> {alertBanner}
            </section>
          )}

          <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="cp-card p-4">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h3 className="m-0 font-semibold">Live Camera Feed</h3>
                  <p className="mt-1 text-sm text-[#686d75]">Recognition runs here and alerts the security dashboard when a troublemaker is matched.</p>
                </div>
                {!streamActive && (
                  <button className="cp-btn cp-btn-primary" disabled={!modelsLoaded || !device} onClick={startStreaming}>
                    {modelsLoaded ? "Start Device Stream" : "Loading Models"}
                  </button>
                )}
              </div>

              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black">
                <video ref={videoRef} autoPlay playsInline muted className="block w-full scale-x-[-1]" />
                <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
                {!streamActive && (
                  <div className="absolute inset-0 grid place-items-center bg-[#121316] text-sm text-zinc-400">
                    Start the device stream after security has the client open.
                  </div>
                )}
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-xs uppercase tracking-[0.25em] text-[#686d75]">
                  <span>{reportingEnabled ? "Audio Feed" : "Audio Waiting"}</span>
                  <span>{Math.round((audioLevel / 128) * 100)}%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full border border-white/10 bg-black/30">
                  <div className="h-full bg-emerald-500 transition-all" style={{ width: `${Math.min(100, (audioLevel / 128) * 100)}%` }} />
                </div>
                {!reportingEnabled && (
                  <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                    This device is connected, but it will not report noise levels or trigger security alerts until security assigns it to a room.
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <section className="cp-card p-4">
                <h3 className="m-0 font-semibold">Device Status</h3>
                <div className="mt-3 grid gap-3 rounded-2xl bg-white/60 p-4 text-sm text-[#2a2d32]">
                  <div>
                    <span className="block text-xs uppercase tracking-[0.2em] text-[#686d75]">Device Name</span>
                    <strong>{device?.name ?? "Connecting..."}</strong>
                  </div>
                  <div>
                    <span className="block text-xs uppercase tracking-[0.2em] text-[#686d75]">Assigned Room</span>
                    <strong>{assignedRoomLabel}</strong>
                  </div>
                  <div>
                    <span className="block text-xs uppercase tracking-[0.2em] text-[#686d75]">Reporting Status</span>
                    <strong>{reportingEnabled ? "Reporting enabled" : "Waiting for room assignment"}</strong>
                  </div>
                  <div>
                    <span className="block text-xs uppercase tracking-[0.2em] text-[#686d75]">Last Heartbeat</span>
                    <strong>{device?.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString() : "Waiting for first heartbeat"}</strong>
                  </div>
                </div>
              </section>

              <section className="cp-card p-4">
                <h3 className="m-0 font-semibold">Recognized Faces</h3>
                <div className="mt-3 space-y-2">
                  {recognized.length === 0 && (
                    <div className="rounded-xl bg-white/60 p-4 text-sm text-[#686d75]">
                      {reportingEnabled ? "No faces detected yet." : "Recognition is paused until this device is assigned to a room."}
                    </div>
                  )}
                  {recognized.map((item) => (
                    <div key={item.key} className="flex items-center justify-between rounded-xl border border-[#d6dbe0] bg-white/70 p-3">
                      <strong>{item.label}</strong>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.isTroublemaker ? "bg-[#9e1b32] text-white" : "bg-emerald-100 text-emerald-700"}`}>
                        {item.isTroublemaker ? "Troublemaker" : "Recognized"}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
