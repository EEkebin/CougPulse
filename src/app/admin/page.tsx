"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as faceapi from "face-api.js";
import { toast } from "sonner";
import { adminFetch, clearAdminToken } from "@/lib/admin-client";
import LoadingSpinner from "@/components/LoadingSpinner";
import { isDeviceOnline } from "@/lib/devices";
import type { LayoutFloor } from "@/lib/layout-types";

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

type AdminOfficer = {
  id: string;
  username: string;
  createdAt: string;
  updatedAt: string;
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

export default function AdminPage() {
  const router = useRouter();
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
  const [floors, setFloors] = useState<LayoutFloor[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminOfficer[]>([]);
  const [currentAdminId, setCurrentAdminId] = useState<string | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);

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
  const [deviceDraftDirty, setDeviceDraftDirty] = useState(false);
  const [newOfficerUsername, setNewOfficerUsername] = useState("");
  const [newOfficerPassword, setNewOfficerPassword] = useState("");
  const [newOfficerPasswordConfirm, setNewOfficerPasswordConfirm] = useState("");
  const [savingDevice, setSavingDevice] = useState(false);
  const [clearingAlerts, setClearingAlerts] = useState(false);
  const [creatingOfficer, setCreatingOfficer] = useState(false);
  const lastDraftDeviceIdRef = useRef<string | null>(null);

  const roomOptions = useMemo(
    () =>
      floors.flatMap((floor) =>
        floor.rooms.map((room) => ({
          id: room.id,
          label: `${room.name} (${floor.name})`,
        }))
      ),
    [floors]
  );

  const roomLabelMap = useMemo(() => new Map(roomOptions.map((room) => [room.id, room.label])), [roomOptions]);

  useEffect(() => {
    let active = true;
    let interval = 0;

    async function boot() {
      const me = await adminFetch("/api/auth/me", { cache: "no-store" });
      if (!active) return;

      if (!me.ok) {
        clearAdminToken();
        router.replace("/login?next=/admin");
        return;
      }

      setAuthReady(true);
      loadModels();
      await Promise.all([refreshAll(), loadAdminUsers(), loadCurrentAdmin()]);
      interval = window.setInterval(refreshAll, SECURITY_REFRESH_MS);
    }

    void boot();
    return () => {
      active = false;
      if (interval) window.clearInterval(interval);
    };
  }, [router]);

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    const device = devices.find((item) => item.id === selectedDeviceId) ?? null;
    const selectedChanged = lastDraftDeviceIdRef.current !== selectedDeviceId;

    if (device && (selectedChanged || !deviceDraftDirty)) {
      setDeviceNameDraft(device.name);
      setDeviceRoomDraft(device.assignedRoomId ?? "");
      setDeviceDraftDirty(false);
      lastDraftDeviceIdRef.current = selectedDeviceId;
    } else if (!selectedDeviceId && devices[0]) {
      setSelectedDeviceId(devices[0].id);
    } else if (!device) {
      lastDraftDeviceIdRef.current = selectedDeviceId;
    }
  }, [devices, selectedDeviceId, deviceDraftDirty]);

  useEffect(() => {
    const nextIds = new Set(alerts.map((alert) => alert.id));

    if (!alertBootstrappedRef.current) {
      seenAlertIdsRef.current = nextIds;
      alertBootstrappedRef.current = true;
      return;
    }

    for (const alert of alerts) {
      if (seenAlertIdsRef.current.has(alert.id)) continue;

      const roomLabel = alert.roomId ? roomLabelMap.get(alert.roomId) ?? alert.roomId : "Unknown location";

      toast.error(`Troublemaker detected: ${alert.subjectName}`, {
        description: `${alert.deviceName ?? "Unknown device"} · ${roomLabel}`,
        duration: 12000,
      });
    }

    seenAlertIdsRef.current = nextIds;
  }, [alerts, roomLabelMap]);

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
    await Promise.all([loadSubjects(), loadDevices(), loadAlerts(), loadFloors()]);
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
    const res = await adminFetch("/api/faces", { cache: "no-store" });
    if (res.ok) setSubjects(await res.json());
  }

  async function loadDevices() {
    const res = await adminFetch("/api/devices", { cache: "no-store" });
    if (res.ok) setDevices(await res.json());
  }

  async function loadAlerts() {
    const res = await adminFetch("/api/alerts", { cache: "no-store" });
    if (res.ok) setAlerts(await res.json());
  }

  async function loadFloors() {
    const res = await fetch("/api/floors", { cache: "no-store" });
    if (res.ok) setFloors(await res.json());
  }

  async function loadAdminUsers() {
    const res = await adminFetch("/api/admin/users", { cache: "no-store" });
    if (res.ok) setAdminUsers(await res.json());
  }

  async function loadCurrentAdmin() {
    const res = await adminFetch("/api/auth/me", { cache: "no-store" });
    if (!res.ok) return;
    const payload = await res.json();
    setCurrentAdminId(payload.id);
  }

  async function clearAllAlerts() {
    setClearingAlerts(true);
    const res = await adminFetch("/api/alerts", { method: "PATCH" });
    if (!res.ok) {
      setClearingAlerts(false);
      toast.error("Could not clear alerts");
      return;
    }
    setAlerts([]);
    seenAlertIdsRef.current = new Set();
    setClearingAlerts(false);
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
      await adminFetch("/api/faces", {
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
    toast.success("Face samples saved");
  }

  async function updateSubject(subject: Subject, changes: { isTroublemaker?: boolean; notes?: string | null }) {
    await adminFetch(`/api/faces/${subject.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    });
    await loadSubjects();
  }

  async function deleteSubject(id: string) {
    await adminFetch(`/api/faces/${id}`, { method: "DELETE" });
    await loadSubjects();
  }

  async function saveSelectedDevice() {
    if (!selectedDeviceId) return;
    setSavingDevice(true);
    const res = await adminFetch(`/api/devices/${selectedDeviceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: deviceNameDraft,
        assignedRoomId: deviceRoomDraft || null,
      }),
    });

    if (!res.ok) {
      setSavingDevice(false);
      toast.error("Could not save device changes");
      return;
    }

    setDeviceDraftDirty(false);
    await loadDevices();
    setSavingDevice(false);
    toast.success("Device updated");
  }

  async function clearAlert(id: string) {
    await adminFetch(`/api/alerts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clear: true }),
    });
    await loadAlerts();
  }

  async function createSecurityOfficer() {
    if (newOfficerPassword !== newOfficerPasswordConfirm) {
      toast.error("New officer passwords do not match");
      return;
    }

    setCreatingOfficer(true);
    const res = await adminFetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: newOfficerUsername,
        password: newOfficerPassword,
      }),
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => ({ error: "Could not create security officer" }));
      setCreatingOfficer(false);
      toast.error(payload.error || "Could not create security officer");
      return;
    }

    setNewOfficerUsername("");
    setNewOfficerPassword("");
    setNewOfficerPasswordConfirm("");
    await loadAdminUsers();
    setCreatingOfficer(false);
    toast.success("Security officer added");
  }

  const selectedDevice = useMemo(() => devices.find((device) => device.id === selectedDeviceId) ?? null, [devices, selectedDeviceId]);

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

  async function logout() {
    await adminFetch("/api/auth/logout", { method: "POST" });
    clearAdminToken();
    router.replace("/login");
    router.refresh();
  }

  if (!authReady) {
    return (
      <main className="ross-shell ross-login-shell">
        <section className="ross-login-card ross-card">
          <div className="ross-loading-state">
            <LoadingSpinner />
            <h1>Checking Admin Access</h1>
            <p className="ross-hint">Validating your security officer token.</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="ross-shell">
      <header className="ross-top-bar">
        <div>
          <h1>CougPulse Security Console</h1>
          <p>Manage devices, enroll faces, review alerts, and build the room layout for the student heatmap.</p>
        </div>
        <div className="ross-top-actions">
          <span className="ross-status-pill">{devices.length} device{devices.length === 1 ? "" : "s"}</span>
          <span className="ross-status-pill">{alerts.length} active alert{alerts.length === 1 ? "" : "s"}</span>
          <Link href="/admin/layout" className="ross-link-btn">
            Layout Planner
          </Link>
          <Link href="/" className="ross-link-btn">
            Student Heatmap
          </Link>
          <button className="ross-btn" type="button" onClick={logout}>
            Log Out
          </button>
          <Link href="/device" className="ross-btn ross-btn-primary">
            Open Device Client
          </Link>
        </div>
      </header>

      <section className="ross-admin-shell ross-admin-shell-compact">
        <aside className="ross-panel">
          <section className="ross-card">
            <div className="ross-card-head">
              <div>
                <h2>Enrollment Station</h2>
                <p className="ross-hint">Use the local camera to enroll people and mark troublemakers.</p>
              </div>
              {!cameraActive && (
                <button className="ross-btn ross-btn-primary" disabled={!modelsLoaded} onClick={startCamera}>
                  <span className="ross-btn-content">
                    {!modelsLoaded ? (
                      <>
                        <LoadingSpinner className="ross-spinner-sm" />
                        Loading Models
                      </>
                    ) : (
                      "Start Local Camera"
                    )}
                  </span>
                </button>
              )}
            </div>

            <div className="ross-stack">
              <div className="ross-video-shell">
                <video ref={videoRef} autoPlay playsInline muted className="ross-video-feed" />
                <canvas ref={canvasRef} className="ross-video-overlay" />
                {!cameraActive && <div className="ross-video-empty">Start the local camera to enroll faces.</div>}
                {calibActive && (
                  <div className="ross-video-banner">
                    {CALIB_STEPS[Math.min(calibStep, CALIB_STEPS.length - 1)]} · hold steady for capture
                  </div>
                )}
              </div>

              <div className="ross-stack ross-tight-stack">
                <div className="ross-meter-row">
                  <span>Local Audio</span>
                  <span>{Math.round((audioLevel / 128) * 100)}%</span>
                </div>
                <div className="ross-meter-track">
                  <div className="ross-meter-fill" style={{ width: `${Math.min(100, (audioLevel / 128) * 100)}%` }} />
                </div>
              </div>

              <div className="ross-stack">
                <input
                  value={newPersonName}
                  onChange={(event) => setNewPersonName(event.target.value)}
                  placeholder="Full name"
                  className="ross-text-input"
                />
                <textarea
                  value={newPersonNotes}
                  onChange={(event) => setNewPersonNotes(event.target.value)}
                  placeholder="Security notes"
                  rows={4}
                  className="ross-text-input ross-textarea"
                />
                <label className="ross-check-item">
                  <input
                    type="checkbox"
                    checked={newPersonTroublemaker}
                    onChange={(event) => setNewPersonTroublemaker(event.target.checked)}
                  />
                  <span>Mark as troublemaker</span>
                </label>
                <button
                  className="ross-btn ross-btn-primary"
                  onClick={beginCalibration}
                  disabled={!cameraActive || !newPersonName.trim() || calibActive || calibSaving}
                >
                  <span className="ross-btn-content">
                    {calibSaving ? (
                      <>
                        <LoadingSpinner className="ross-spinner-sm" />
                        Saving Samples...
                      </>
                    ) : calibActive ? (
                      `Capturing ${calibStep}/${CALIB_STEPS.length}`
                    ) : (
                      "Start Calibration"
                    )}
                  </span>
                </button>
              </div>
            </div>
          </section>

          <section className="ross-card">
            <div className="ross-card-head">
              <div>
                <h2>Devices</h2>
                <p className="ross-hint">Approve, rename, and assign connected clients one at a time.</p>
              </div>
            </div>

            <div className="ross-device-manager">
              <div className="ross-list">
                {devices.length === 0 && <div className="ross-empty">No devices connected yet.</div>}
                {devices.map((device) => (
                  <button
                    key={device.id}
                    className={`ross-item ross-item-button${selectedDeviceId === device.id ? " ross-item-active" : ""}`}
                    onClick={() => setSelectedDeviceId(device.id)}
                  >
                    <div className="ross-item-head">
                      <strong>{device.name}</strong>
                      <span className={`ross-status-chip ${isDeviceOnline(device.lastSeenAt) ? "online" : "offline"}`}>
                        {isDeviceOnline(device.lastSeenAt) ? "Online" : "Offline"}
                      </span>
                    </div>
                    <div className="ross-item-subtle">
                      {device.assignedRoomId ? roomLabelMap.get(device.assignedRoomId) ?? device.assignedRoomId : "Unassigned room"}
                    </div>
                  </button>
                ))}
              </div>

              <div className="ross-inspector">
                {selectedDevice ? (
                  <>
                    <div>
                      <h2>Device Details</h2>
                      <p className="ross-hint">Assign a room before this device contributes alerts or heatmap audio.</p>
                    </div>
                    <input
                      value={deviceNameDraft}
                      onChange={(event) => {
                        setDeviceNameDraft(event.target.value);
                        setDeviceDraftDirty(true);
                      }}
                      className="ross-text-input"
                    />
                    <select
                      value={deviceRoomDraft}
                      onChange={(event) => {
                        setDeviceRoomDraft(event.target.value);
                        setDeviceDraftDirty(true);
                      }}
                      className="ross-text-input"
                    >
                      <option value="">No room assigned</option>
                      {roomOptions.map((room) => (
                        <option key={room.id} value={room.id}>
                          {room.label}
                        </option>
                      ))}
                    </select>
                    <div className="ross-data-grid">
                      <div>Last seen</div>
                      <div>{selectedDevice.lastSeenAt ? new Date(selectedDevice.lastSeenAt).toLocaleString() : "Never"}</div>
                      <div>Live audio</div>
                      <div>{selectedDevice.lastAudioLevel != null ? `${Math.round((selectedDevice.lastAudioLevel / 128) * 100)}%` : "No reading yet"}</div>
                      <div>Device id</div>
                      <div>{selectedDevice.id}</div>
                    </div>
                    <button className="ross-btn ross-btn-primary" onClick={saveSelectedDevice} disabled={savingDevice || !deviceDraftDirty}>
                      <span className="ross-btn-content">
                        {savingDevice ? (
                          <>
                            <LoadingSpinner className="ross-spinner-sm" />
                            Saving Device...
                          </>
                        ) : (
                          "Save Device"
                        )}
                      </span>
                    </button>
                  </>
                ) : (
                  <div className="ross-empty">No devices have connected yet.</div>
                )}
              </div>
            </div>
          </section>

          <section className="ross-card">
            <div className="ross-card-head">
              <div>
                <h2>Campus Layout Planner</h2>
                <p className="ross-hint">Build floors, upload floor plans, and draw rooms on a dedicated screen with more room to work.</p>
              </div>
              <span className="ross-tool-pill">{floors.length} floor{floors.length === 1 ? "" : "s"}</span>
            </div>
            <div className="ross-stack">
              <div className="ross-data-grid">
                <div>Configured floors</div>
                <div>{floors.length}</div>
                <div>Configured rooms</div>
                <div>{floors.reduce((count, floor) => count + floor.rooms.length, 0)}</div>
                <div>Assigned rooms</div>
                <div>{devices.filter((device) => device.assignedRoomId).length}</div>
              </div>
              <Link href="/admin/layout" className="ross-btn ross-btn-primary">
                Open Layout Planner
              </Link>
            </div>
          </section>
        </aside>

        <aside className="ross-panel">
          <section className="ross-card">
            <div className="ross-card-head">
              <div>
                <h2>Active Alerts</h2>
                <p className="ross-hint">Troublemaker detections stay here until security clears them.</p>
              </div>
              <div className="ross-actions">
                {alerts.length > 0 && (
                  <button className="ross-btn" onClick={clearAllAlerts} disabled={clearingAlerts}>
                    <span className="ross-btn-content">
                      {clearingAlerts ? (
                        <>
                          <LoadingSpinner className="ross-spinner-sm" />
                          Clearing...
                        </>
                      ) : (
                        "Clear All"
                      )}
                    </span>
                  </button>
                )}
                <span className="ross-status-chip alert">{alerts.length}</span>
              </div>
            </div>
            <div className="ross-list ross-alert-list">
              {alerts.length === 0 && <div className="ross-empty">No active alerts right now.</div>}
              {alerts.map((alert) => (
                <div key={alert.id} className="ross-item ross-alert-card">
                  <div className="ross-alert-head">
                    <div>
                      <div className="ross-alert-name">{alert.subjectName}</div>
                      <div className="ross-item-subtle">
                        {alert.roomId ? `Seen in ${roomLabelMap.get(alert.roomId) ?? alert.roomId}` : "No room assigned yet"}
                      </div>
                      <div className="ross-item-subtle">
                        {alert.deviceName ?? "Unknown device"} · {new Date(alert.createdAt).toLocaleString()}
                      </div>
                    </div>
                    {alert.faceImage && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={alert.faceImage} alt={`${alert.subjectName} alert snapshot`} className="ross-alert-face" />
                    )}
                  </div>
                  {alert.note && <div className="ross-alert-note">{alert.note}</div>}
                  <button className="ross-btn" onClick={() => clearAlert(alert.id)}>
                    Clear
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="ross-card">
            <div className="ross-card-head">
              <div>
                <h2>Camera Overview</h2>
                <p className="ross-hint">Recent device snapshots for quick security scanning.</p>
              </div>
              <span className="ross-tool-pill">{devices.length}</span>
            </div>
            <div className="ross-camera-grid ross-panel-scroll">
              {devices.length === 0 && <div className="ross-empty">No devices connected yet.</div>}
              {devices.map((device) => {
                const roomLabel = device.assignedRoomId
                  ? roomLabelMap.get(device.assignedRoomId) ?? device.assignedRoomId
                  : "Unassigned room";

                return (
                  <button
                    key={device.id}
                    type="button"
                    className={`ross-item ross-item-button ross-camera-card${selectedDeviceId === device.id ? " ross-item-active" : ""}`}
                    onClick={() => setSelectedDeviceId(device.id)}
                  >
                    <div className="ross-camera-frame">
                      {device.previewImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={device.previewImage} alt={device.name} className="ross-camera-image" />
                      ) : (
                        <div className="ross-video-empty">No preview yet</div>
                      )}
                    </div>
                    <div className="ross-stack ross-tight-stack">
                      <div className="ross-item-head">
                        <strong>{device.name}</strong>
                        <span className={`ross-status-chip ${isDeviceOnline(device.lastSeenAt) ? "online" : "offline"}`}>
                          {isDeviceOnline(device.lastSeenAt) ? "Online" : "Offline"}
                        </span>
                      </div>
                      <div className="ross-item-subtle">{roomLabel}</div>
                      <div className="ross-item-subtle">
                        {device.previewTakenAt ? `Preview ${new Date(device.previewTakenAt).toLocaleTimeString()}` : "Awaiting camera snapshot"}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="ross-card">
            <div className="ross-card-head">
              <div>
                <h2>Enrolled People</h2>
                <p className="ross-hint">Edit the troublemaker flag later without re-enrolling face samples.</p>
              </div>
              <span className="ross-tool-pill">{groupedSubjects.length}</span>
            </div>
            <div className="ross-subject-grid ross-panel-scroll">
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

          <section className="ross-card">
            <div className="ross-card-head">
              <div>
                <h2>Security Officers</h2>
                <p className="ross-hint">Manage admin usernames and passwords for the protected security tools.</p>
              </div>
              <span className="ross-tool-pill">{adminUsers.length}</span>
            </div>

            <div className="ross-stack">
              <div className="ross-officer-form">
                <input
                  value={newOfficerUsername}
                  onChange={(event) => setNewOfficerUsername(event.target.value)}
                  className="ross-text-input"
                  placeholder="New officer username"
                />
                <input
                  value={newOfficerPassword}
                  onChange={(event) => setNewOfficerPassword(event.target.value)}
                  type="password"
                  className="ross-text-input"
                  placeholder="Temporary password"
                />
                <input
                  value={newOfficerPasswordConfirm}
                  onChange={(event) => setNewOfficerPasswordConfirm(event.target.value)}
                  type="password"
                  className="ross-text-input"
                  placeholder="Confirm temporary password"
                />
                <button
                  className="ross-btn ross-btn-primary"
                  type="button"
                  onClick={createSecurityOfficer}
                  disabled={creatingOfficer || !newOfficerUsername.trim() || newOfficerPassword.length < 4 || newOfficerPasswordConfirm.length < 4}
                >
                  <span className="ross-btn-content">
                    {creatingOfficer ? (
                      <>
                        <LoadingSpinner className="ross-spinner-sm" />
                        Adding Officer...
                      </>
                    ) : (
                      "Add Officer"
                    )}
                  </span>
                </button>
              </div>

              <div className="ross-subject-grid ross-panel-scroll">
                {adminUsers.map((user) => (
                  <SecurityOfficerCard key={user.id} user={user} currentAdminId={currentAdminId} onSaved={loadAdminUsers} />
                ))}
              </div>
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}

function SecurityOfficerCard({
  user,
  currentAdminId,
  onSaved,
}: {
  user: AdminOfficer;
  currentAdminId: string | null;
  onSaved: () => Promise<void>;
}) {
  const router = useRouter();
  const [username, setUsername] = useState(user.username);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const lastUserIdRef = useRef<string | null>(null);
  const isCurrentOfficer = currentAdminId === user.id;

  useEffect(() => {
    const changedUser = lastUserIdRef.current !== user.id;
    if (changedUser || !dirty) {
      setUsername(user.username);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setDirty(false);
      lastUserIdRef.current = user.id;
    }
  }, [user, dirty]);

  return (
    <div className="ross-item ross-subject-card">
      <div className="ross-item-head">
        <div>
          <div className="font-semibold">{user.username}</div>
          <div className="ross-item-subtle">Created {new Date(user.createdAt).toLocaleDateString()}</div>
        </div>
      </div>

      <input
        value={username}
        onChange={(event) => {
          setUsername(event.target.value);
          setDirty(true);
        }}
        className="ross-text-input"
        placeholder="Username"
      />
      <input
        value={currentPassword}
        onChange={(event) => {
          setCurrentPassword(event.target.value);
          setDirty(true);
        }}
        type="password"
        className="ross-text-input"
        placeholder={isCurrentOfficer ? "Current password" : "Password changes only available for the signed-in officer"}
        disabled={!isCurrentOfficer}
      />
      <input
        value={newPassword}
        onChange={(event) => {
          setNewPassword(event.target.value);
          setDirty(true);
        }}
        type="password"
        className="ross-text-input"
        placeholder="New password"
        disabled={!isCurrentOfficer}
      />
      <input
        value={confirmPassword}
        onChange={(event) => {
          setConfirmPassword(event.target.value);
          setDirty(true);
        }}
        type="password"
        className="ross-text-input"
        placeholder="Confirm new password"
        disabled={!isCurrentOfficer}
      />
      <button
        className="ross-btn ross-btn-primary"
        type="button"
        disabled={saving || !dirty || !username.trim() || (isCurrentOfficer && ((newPassword.length > 0 && newPassword.length < 4) || (confirmPassword.length > 0 && confirmPassword.length < 4)))}
        onClick={async () => {
          if (isCurrentOfficer && newPassword !== confirmPassword) {
            toast.error("New passwords do not match");
            return;
          }

          setSaving(true);
          const res = await adminFetch(`/api/admin/users/${user.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              username,
              ...(isCurrentOfficer && newPassword ? { currentPassword, newPassword } : {}),
            }),
          });

          if (!res.ok) {
            const payload = await res.json().catch(() => ({ error: "Could not update security officer" }));
            setSaving(false);
            toast.error(payload.error || "Could not update security officer");
            return;
          }

          const changedOwnPassword = isCurrentOfficer && Boolean(newPassword);
          setDirty(false);
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");

          if (changedOwnPassword) {
            clearAdminToken();
            toast.success("Password changed", {
              description: "Sign in again with the new password to continue.",
              duration: 2200,
            });
            window.setTimeout(() => {
              router.replace("/login");
              router.refresh();
            }, 500);
            return;
          }

          await onSaved();
          setSaving(false);
          toast.success("Security officer updated");
        }}
      >
        <span className="ross-btn-content">
          {saving ? (
            <>
              <LoadingSpinner className="ross-spinner-sm" />
              Saving Officer...
            </>
          ) : (
            "Save Officer"
          )}
        </span>
      </button>
    </div>
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
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const lastRepresentativeIdRef = useRef<string | null>(null);

  useEffect(() => {
    const representativeChanged = lastRepresentativeIdRef.current !== representative.id;
    if (representativeChanged || !dirty) {
      setIsTroublemaker(representative.isTroublemaker);
      setNotes(representative.notes ?? "");
      setDirty(false);
      lastRepresentativeIdRef.current = representative.id;
    }
  }, [representative]);

  return (
    <div className="ross-item ross-subject-card">
      <div className="ross-item-head">
        <div>
          <div className="font-semibold">{representative.name}</div>
          <div className="ross-item-subtle">{sampleCount} saved sample{sampleCount === 1 ? "" : "s"}</div>
        </div>
        <button className="ross-btn" onClick={onDelete}>
          Delete
        </button>
      </div>
      <label className="ross-check-item">
        <input
          type="checkbox"
          checked={isTroublemaker}
          onChange={(event) => {
            setIsTroublemaker(event.target.checked);
            setDirty(true);
          }}
        />
        Flag as troublemaker
      </label>
      <textarea
        value={notes}
        onChange={(event) => {
          setNotes(event.target.value);
          setDirty(true);
        }}
        rows={3}
        className="ross-text-input ross-textarea"
        placeholder="Security notes"
      />
      <button
        className="ross-btn ross-btn-primary"
        onClick={async () => {
          setSaving(true);
          await onSave(representative, { isTroublemaker, notes });
          setDirty(false);
          setSaving(false);
        }}
        disabled={saving || !dirty}
      >
        <span className="ross-btn-content">
          {saving ? (
            <>
              <LoadingSpinner className="ross-spinner-sm" />
              Saving...
            </>
          ) : (
            "Save Changes"
          )}
        </span>
      </button>
    </div>
  );
}
