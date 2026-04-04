"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import * as faceapi from "face-api.js";
import { toast } from "sonner";
import { isDeviceOnline } from "@/lib/devices";
import { ROOM_OPTIONS } from "@/lib/rooms";

type Detection = faceapi.WithFaceDescriptor<faceapi.WithFaceLandmarks<faceapi.WithFaceDetection<object>>>;
type Subject = {
  id: string;
  name: string;
  descriptor: number[];
  isTroublemaker: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

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

type SecurityAlert = {
  id: string;
  subjectId: string;
  subjectName: string;
  deviceId: string | null;
  deviceName: string | null;
  roomId: string | null;
  note: string | null;
  faceImage: string | null;
  createdAt: string;
  clearedAt: string | null;
};

const CALIB_STEPS = [
  "Look straight ahead",
  "Turn left slowly",
  "Turn right slowly",
  "Tilt up",
  "Tilt down",
  "Look naturally",
];

const HOLD_MS = 1300;
const BETWEEN_MS = 900;
const SECURITY_REFRESH_MS = 2500;
const CALIBRATION_DETECTOR_OPTIONS = new faceapi.TinyFaceDetectorOptions({
  inputSize: 224,
  scoreThreshold: 0.45,
});

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const holdStartRef = useRef<number | null>(null);
  const lastCaptureRef = useRef(0);
  const calibRef = useRef<{ name: string; notes: string; isTroublemaker: boolean; step: number; descriptors: Float32Array[] } | null>(null);
  const seenAlertIdsRef = useRef<Set<string>>(new Set());
  const alertBootstrappedRef = useRef(false);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);

  const [newPersonName, setNewPersonName] = useState("");
  const [newPersonNotes, setNewPersonNotes] = useState("");
  const [newPersonTroublemaker, setNewPersonTroublemaker] = useState(false);
  const [calibActive, setCalibActive] = useState(false);
  const [calibStep, setCalibStep] = useState(0);
  const [calibSaving, setCalibSaving] = useState(false);

  const [deviceNameDraft, setDeviceNameDraft] = useState("");
  const [deviceRoomDraft, setDeviceRoomDraft] = useState("");

  useEffect(() => {
    loadModels();
    refreshAll();
    const interval = window.setInterval(refreshAll, SECURITY_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    const device = devices.find((item) => item.id === selectedDeviceId) ?? null;
    if (device) {
      setDeviceNameDraft(device.name);
      setDeviceRoomDraft(device.assignedRoomId ?? "");
    } else if (!selectedDeviceId && devices[0]) {
      setSelectedDeviceId(devices[0].id);
    }
  }, [devices, selectedDeviceId]);

  useEffect(() => {
    const nextIds = new Set(alerts.map((alert) => alert.id));

    if (!alertBootstrappedRef.current) {
      seenAlertIdsRef.current = nextIds;
      alertBootstrappedRef.current = true;
      return;
    }

    for (const alert of alerts) {
      if (seenAlertIdsRef.current.has(alert.id)) continue;

      const roomLabel = alert.roomId
        ? ROOM_OPTIONS.find((room) => room.id === alert.roomId)?.label ?? alert.roomId
        : "Unknown location";

      toast.error(`Troublemaker detected: ${alert.subjectName}`, {
        description: `${alert.deviceName ?? "Unknown device"} · ${roomLabel}`,
        duration: 12000,
      });
    }

    seenAlertIdsRef.current = nextIds;
  }, [alerts]);

  useEffect(() => {
    let raf = 0;
    let busy = false;

    const loop = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && modelsLoaded && cameraActive && !busy && calibActive) {
        if (video.readyState === 4 && !video.paused && !video.ended) {
          busy = true;
          if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
          }

          try {
            const detection = await faceapi
              .detectSingleFace(video, CALIBRATION_DETECTOR_OPTIONS)
              .withFaceLandmarks()
              .withFaceDescriptor();

            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);

              if (detection && calibRef.current) {
                const now = Date.now();
                const { x, y, width, height } = detection.detection.box;
                const mx = canvas.width - x - width;
                const cx = mx + width / 2;
                const cy = y + height / 2;
                const r = Math.max(width, height) * 0.58 + 12;
                const coolingDown = now - lastCaptureRef.current < BETWEEN_MS;

                ctx.beginPath();
                ctx.arc(cx, cy, r, 0, Math.PI * 2);
                ctx.strokeStyle = "rgba(255,255,255,0.15)";
                ctx.lineWidth = 4;
                ctx.stroke();

                if (!coolingDown) {
                  if (holdStartRef.current === null) holdStartRef.current = now;
                  const held = Math.min(1, (now - holdStartRef.current) / HOLD_MS);

                  ctx.beginPath();
                  ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + held * Math.PI * 2);
                  ctx.strokeStyle = "#10b981";
                  ctx.lineWidth = 4;
                  ctx.lineCap = "round";
                  ctx.stroke();

                  if (held >= 1) {
                    const calibration = calibRef.current;
                    calibration.descriptors.push(new Float32Array(detection.descriptor));
                    calibration.step += 1;
                    setCalibStep(calibration.step);
                    holdStartRef.current = null;
                    lastCaptureRef.current = now;

                    if (calibration.step >= CALIB_STEPS.length) {
                      calibRef.current = null;
                      setCalibActive(false);
                      setTimeout(() => {
                        saveCalibration(calibration.name, calibration.notes, calibration.isTroublemaker, calibration.descriptors);
                      }, 250);
                    }
                  }
                } else {
                  holdStartRef.current = null;
                }
              } else {
                holdStartRef.current = null;
              }
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
  }, [cameraActive, calibActive, modelsLoaded]);

  async function refreshAll() {
    await Promise.all([loadSubjects(), loadDevices(), loadAlerts()]);
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
      console.error("Model load failed", error);
    }
  }

  async function loadSubjects() {
    const res = await fetch("/api/faces", { cache: "no-store" });
    if (res.ok) setSubjects(await res.json());
  }

  async function loadDevices() {
    const res = await fetch("/api/devices", { cache: "no-store" });
    if (res.ok) setDevices(await res.json());
  }

  async function loadAlerts() {
    const res = await fetch("/api/alerts", { cache: "no-store" });
    if (res.ok) setAlerts(await res.json());
  }

  async function clearAllAlerts() {
    const res = await fetch("/api/alerts", {
      method: "PATCH",
    });

    if (!res.ok) return;
    setAlerts([]);
    seenAlertIdsRef.current = new Set();
    toast.success("All alerts cleared");
  }

  async function startCamera() {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      setStream(mediaStream);
      setCameraActive(true);

      const audioContext = new (window.AudioContext || (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(mediaStream);
      const analyser = audioContext.createAnalyser();
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteFrequencyData(data);
        const level = data.reduce((sum, value) => sum + value, 0) / data.length;
        setAudioLevel(level);
        window.requestAnimationFrame(tick);
      };

      tick();
    } catch (error) {
      console.error(error);
      alert("Could not access the local camera and microphone.");
    }
  }

  function beginCalibration() {
    if (!newPersonName.trim() || !cameraActive) return;
    calibRef.current = {
      name: newPersonName.trim(),
      notes: newPersonNotes.trim(),
      isTroublemaker: newPersonTroublemaker,
      step: 0,
      descriptors: [],
    };
    holdStartRef.current = null;
    lastCaptureRef.current = 0;
    setCalibStep(0);
    setCalibActive(true);
  }

  async function saveCalibration(name: string, notes: string, isTroublemaker: boolean, descriptors: Float32Array[]) {
    setCalibSaving(true);
    for (const descriptor of descriptors) {
      await fetch("/api/faces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          notes,
          isTroublemaker,
          descriptor: Array.from(descriptor),
        }),
      });
    }

    setNewPersonName("");
    setNewPersonNotes("");
    setNewPersonTroublemaker(false);
    setCalibStep(0);
    setCalibSaving(false);
    await loadSubjects();
  }

  async function updateSubject(subject: Subject, changes: { isTroublemaker?: boolean; notes?: string | null }) {
    await fetch(`/api/faces/${subject.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    });
    await loadSubjects();
  }

  async function deleteSubject(id: string) {
    await fetch(`/api/faces/${id}`, { method: "DELETE" });
    await loadSubjects();
  }

  async function saveSelectedDevice() {
    if (!selectedDeviceId) return;
    await fetch(`/api/devices/${selectedDeviceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: deviceNameDraft,
        assignedRoomId: deviceRoomDraft || null,
      }),
    });
    await loadDevices();
  }

  async function clearAlert(id: string) {
    await fetch(`/api/alerts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clear: true }),
    });
    await loadAlerts();
  }

  const selectedDevice = useMemo(
    () => devices.find((device) => device.id === selectedDeviceId) ?? null,
    [devices, selectedDeviceId]
  );

  const groupedSubjects = useMemo(() => {
    const groups = new Map<string, Subject[]>();
    for (const subject of subjects) {
      const key = subject.name.toLowerCase();
      const existing = groups.get(key) ?? [];
      existing.push(subject);
      groups.set(key, existing);
    }
    return Array.from(groups.entries()).map(([key, entries]) => ({
      key,
      representative: entries[0],
      sampleCount: entries.length,
    }));
  }, [subjects]);

  return (
    <main className="cp-shell">
      <div className="cp-bg-shape cp-shape-a" aria-hidden="true" />
      <div className="cp-bg-shape cp-shape-b" aria-hidden="true" />

      <div className="cp-app-shell">
        <section className="cp-dashboard">
          <header className="cp-card cp-topbar">
            <div>
              <h1>CougPulse Security Console</h1>
              <p>Manage devices, enroll faces, and respond to troublemaker alerts.</p>
            </div>
            <div className="cp-topbar-actions">
              <Link href="/map" className="cp-btn cp-btn-ghost">
                Student Heatmap
              </Link>
              <Link href="/device" className="cp-btn cp-btn-primary">
                Open Device Client
              </Link>
            </div>
          </header>

          <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="cp-card p-4">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h3 className="m-0 font-semibold">Enrollment Station</h3>
                  <p className="mt-1 text-sm text-[#686d75]">Use the local camera to enroll people and mark troublemakers.</p>
                </div>
                {!cameraActive && (
                  <button className="cp-btn cp-btn-primary" disabled={!modelsLoaded} onClick={startCamera}>
                    {modelsLoaded ? "Start Local Camera" : "Loading Models"}
                  </button>
                )}
              </div>

              <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-4">
                  <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black">
                    <video ref={videoRef} autoPlay playsInline muted className="block w-full scale-x-[-1]" />
                    <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
                    {!cameraActive && (
                      <div className="absolute inset-0 grid place-items-center bg-[#121316] text-sm text-zinc-400">
                        Start the local camera to enroll faces.
                      </div>
                    )}
                    {calibActive && (
                      <div className="absolute inset-x-0 bottom-0 bg-black/70 px-4 py-3 text-sm text-white">
                        {CALIB_STEPS[Math.min(calibStep, CALIB_STEPS.length - 1)]} · hold steady for capture
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs uppercase tracking-[0.25em] text-[#686d75]">
                      <span>Local Audio</span>
                      <span>{Math.round((audioLevel / 128) * 100)}%</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full border border-white/10 bg-black/30">
                      <div className="h-full bg-emerald-500 transition-all" style={{ width: `${Math.min(100, (audioLevel / 128) * 100)}%` }} />
                    </div>
                  </div>
                </div>

                <div className="space-y-3 rounded-2xl border border-black/10 bg-white/60 p-4">
                  <div>
                    <h3 className="m-0 font-semibold">Add Person</h3>
                    <p className="mt-1 text-sm text-[#686d75]">{CALIB_STEPS.length}-step face calibration with optional troublemaker flag.</p>
                  </div>
                  <input
                    value={newPersonName}
                    onChange={(event) => setNewPersonName(event.target.value)}
                    placeholder="Full name"
                    className="w-full rounded-xl border border-[#b8bec7] bg-white px-4 py-3"
                  />
                  <textarea
                    value={newPersonNotes}
                    onChange={(event) => setNewPersonNotes(event.target.value)}
                    placeholder="Security notes"
                    rows={4}
                    className="w-full rounded-xl border border-[#b8bec7] bg-white px-4 py-3"
                  />
                  <label className="flex items-center gap-3 text-sm text-[#2a2d32]">
                    <input
                      type="checkbox"
                      checked={newPersonTroublemaker}
                      onChange={(event) => setNewPersonTroublemaker(event.target.checked)}
                    />
                    Mark as troublemaker
                  </label>
                  <button
                    className="cp-btn cp-btn-primary w-full"
                    onClick={beginCalibration}
                    disabled={!cameraActive || !newPersonName.trim() || calibActive || calibSaving}
                  >
                    {calibSaving ? "Saving Samples..." : calibActive ? `Capturing ${calibStep}/${CALIB_STEPS.length}` : "Start Calibration"}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <section className="cp-card p-4">
                <div className="mb-3 flex items-center justify-between gap-4">
                  <div>
                    <h3 className="m-0 font-semibold">Camera Overview</h3>
                    <p className="mt-1 text-sm text-[#686d75]">Recent device snapshots for quick security scanning.</p>
                  </div>
                  <span className="rounded-full bg-[#dadde2] px-3 py-1 text-xs font-semibold text-[#2a2d32]">{devices.length}</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {devices.length === 0 && (
                    <div className="rounded-xl bg-white/60 p-4 text-sm text-[#686d75]">No devices connected yet.</div>
                  )}
                  {devices.map((device) => {
                    const roomLabel = device.assignedRoomId
                      ? ROOM_OPTIONS.find((room) => room.id === device.assignedRoomId)?.label ?? device.assignedRoomId
                      : "Unassigned room";

                    return (
                      <button
                        key={device.id}
                        type="button"
                        className={`overflow-hidden rounded-2xl border text-left transition-colors ${selectedDeviceId === device.id ? "border-[#9e1b32] bg-[#fff3f6]" : "border-[#d6dbe0] bg-white/70"}`}
                        onClick={() => setSelectedDeviceId(device.id)}
                      >
                        <div className="aspect-video bg-[#1c1f24]">
                          {device.previewImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={device.previewImage} alt={device.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="grid h-full place-items-center text-sm text-zinc-400">No preview yet</div>
                          )}
                        </div>
                        <div className="grid gap-1 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <strong>{device.name}</strong>
                            <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${isDeviceOnline(device.lastSeenAt) ? "bg-emerald-100 text-emerald-700" : "bg-zinc-200 text-zinc-600"}`}>
                              {isDeviceOnline(device.lastSeenAt) ? "Online" : "Offline"}
                            </span>
                          </div>
                          <div className="text-sm text-[#686d75]">{roomLabel}</div>
                          <div className="text-xs text-[#686d75]">
                            {device.previewTakenAt ? `Preview ${new Date(device.previewTakenAt).toLocaleTimeString()}` : "Awaiting camera snapshot"}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="cp-card p-4">
                <div className="mb-3 flex items-center justify-between gap-4">
                  <div>
                    <h3 className="m-0 font-semibold">Active Alerts</h3>
                    <p className="mt-1 text-sm text-[#686d75]">Troublemaker detections stay here until security clears them.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {alerts.length > 0 && (
                      <button className="cp-btn cp-btn-ghost" onClick={clearAllAlerts}>
                        Clear All
                      </button>
                    )}
                    <span className="rounded-full bg-[#9e1b32] px-3 py-1 text-xs font-semibold text-white">{alerts.length}</span>
                  </div>
                </div>
                <div className="max-h-[24rem] space-y-3 overflow-y-auto custom-scrollbar">
                  {alerts.length === 0 && <div className="rounded-xl bg-white/60 p-4 text-sm text-[#686d75]">No active alerts right now.</div>}
                  {alerts.map((alert) => (
                    <div key={alert.id} className="rounded-xl border border-[#d6dbe0] bg-white/70 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-[#9e1b32]">{alert.subjectName}</div>
                          <div className="mt-1 text-sm text-[#686d75]">
                            {alert.roomId ? `Seen in ${ROOM_OPTIONS.find((room) => room.id === alert.roomId)?.label ?? alert.roomId}` : "No room assigned yet"}
                          </div>
                          <div className="mt-1 text-sm text-[#686d75]">
                            {alert.deviceName ?? "Unknown device"} · {new Date(alert.createdAt).toLocaleString()}
                          </div>
                          {alert.note && <div className="mt-2 text-sm text-[#2a2d32]">{alert.note}</div>}
                        </div>
                        {alert.faceImage && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={alert.faceImage}
                            alt={`${alert.subjectName} alert snapshot`}
                            className="h-20 w-20 rounded-xl border border-[#d6dbe0] object-cover"
                          />
                        )}
                        <button className="cp-btn cp-btn-ghost" onClick={() => clearAlert(alert.id)}>
                          Clear
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="cp-card p-4">
                <h3 className="m-0 font-semibold">Devices</h3>
                <p className="mt-1 text-sm text-[#686d75]">Approve, rename, and assign connected clients one at a time.</p>
                <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                  <div className="max-h-[22rem] space-y-2 overflow-y-auto custom-scrollbar">
                    {devices.map((device) => (
                      <button
                        key={device.id}
                        className={`w-full rounded-xl border p-3 text-left transition-colors ${selectedDeviceId === device.id ? "border-[#9e1b32] bg-[#fff3f6]" : "border-[#d6dbe0] bg-white/65"}`}
                        onClick={() => setSelectedDeviceId(device.id)}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <strong>{device.name}</strong>
                          <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${isDeviceOnline(device.lastSeenAt) ? "bg-emerald-100 text-emerald-700" : "bg-zinc-200 text-zinc-600"}`}>
                            {isDeviceOnline(device.lastSeenAt) ? "Online" : "Offline"}
                          </span>
                        </div>
                        <div className="mt-1 text-sm text-[#686d75]">
                          {device.assignedRoomId ? ROOM_OPTIONS.find((room) => room.id === device.assignedRoomId)?.label ?? device.assignedRoomId : "Unassigned room"}
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="rounded-2xl border border-[#d6dbe0] bg-white/70 p-4">
                    {selectedDevice ? (
                      <div className="space-y-3">
                        <div>
                          <h4 className="m-0 font-semibold">Device Details</h4>
                          <p className="mt-1 text-sm text-[#686d75]">Control how this client contributes to alerts and the heatmap.</p>
                        </div>
                        <input
                          value={deviceNameDraft}
                          onChange={(event) => setDeviceNameDraft(event.target.value)}
                          className="w-full rounded-xl border border-[#b8bec7] bg-white px-4 py-3"
                        />
                        <select
                          value={deviceRoomDraft}
                          onChange={(event) => setDeviceRoomDraft(event.target.value)}
                          className="w-full rounded-xl border border-[#b8bec7] bg-white px-4 py-3"
                        >
                          <option value="">No room assigned</option>
                          {ROOM_OPTIONS.map((room) => (
                            <option key={room.id} value={room.id}>
                              {room.label}
                            </option>
                          ))}
                        </select>
                        <div className="grid gap-2 rounded-xl bg-[#f5f6f8] p-3 text-sm text-[#686d75]">
                          <div>Last seen: {selectedDevice.lastSeenAt ? new Date(selectedDevice.lastSeenAt).toLocaleString() : "Never"}</div>
                          <div>Live audio: {selectedDevice.lastAudioLevel != null ? `${Math.round((selectedDevice.lastAudioLevel / 128) * 100)}%` : "No reading yet"}</div>
                          <div>Device id: {selectedDevice.id}</div>
                        </div>
                        <button className="cp-btn cp-btn-primary" onClick={saveSelectedDevice}>
                          Save Device
                        </button>
                      </div>
                    ) : (
                      <div className="text-sm text-[#686d75]">No devices have connected yet.</div>
                    )}
                  </div>
                </div>
              </section>
            </div>
          </section>

          <section className="cp-card p-4">
            <div className="mb-3 flex items-center justify-between gap-4">
              <div>
                <h3 className="m-0 font-semibold">Enrolled People</h3>
                <p className="mt-1 text-sm text-[#686d75]">Edit the troublemaker flag later without re-enrolling the face samples.</p>
              </div>
              <span className="rounded-full bg-[#dadde2] px-3 py-1 text-xs font-semibold text-[#2a2d32]">{groupedSubjects.length}</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {groupedSubjects.map(({ key, representative, sampleCount }) => (
                <SubjectCard
                  key={key}
                  representative={representative}
                  sampleCount={sampleCount}
                  onDelete={() => deleteSubject(representative.id)}
                  onSave={updateSubject}
                />
              ))}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}

function SubjectCard({
  representative,
  sampleCount,
  onSave,
  onDelete,
}: {
  representative: Subject;
  sampleCount: number;
  onSave: (subject: Subject, changes: { isTroublemaker?: boolean; notes?: string | null }) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [isTroublemaker, setIsTroublemaker] = useState(representative.isTroublemaker);
  const [notes, setNotes] = useState(representative.notes ?? "");

  useEffect(() => {
    setIsTroublemaker(representative.isTroublemaker);
    setNotes(representative.notes ?? "");
  }, [representative]);

  return (
    <div className="rounded-2xl border border-[#d6dbe0] bg-white/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">{representative.name}</div>
          <div className="mt-1 text-sm text-[#686d75]">{sampleCount} saved sample{sampleCount === 1 ? "" : "s"}</div>
        </div>
        <button className="cp-btn cp-btn-ghost" onClick={onDelete}>
          Delete
        </button>
      </div>
      <label className="mt-3 flex items-center gap-3 text-sm">
        <input type="checkbox" checked={isTroublemaker} onChange={(event) => setIsTroublemaker(event.target.checked)} />
        Flag as troublemaker
      </label>
      <textarea
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        rows={3}
        className="mt-3 w-full rounded-xl border border-[#b8bec7] bg-white px-4 py-3"
        placeholder="Security notes"
      />
      <button
        className="cp-btn cp-btn-primary mt-3"
        onClick={() => onSave(representative, { isTroublemaker, notes })}
      >
        Save Changes
      </button>
    </div>
  );
}
