"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import * as faceapi from "face-api.js";
import LoadingSpinner from "@/components/LoadingSpinner";
import { defaultDeviceName } from "@/lib/devices";
import { clearDeviceAuthToken, deviceFetch, setDeviceAuthToken } from "@/lib/device-client";
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

type DeviceAccount = {
  id: string;
  username: string;
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

const HEARTBEAT_MS = 2000;
const DEVICE_REFRESH_MS = 3000;
const RECOGNITION_COOLDOWN_MS = 650;
const DEVICE_DETECTOR_OPTIONS = new faceapi.SsdMobilenetv1Options({
  minConfidence: 0.45,
});

export default function DevicePage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const faceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioLevelRef = useRef(0);
  const lastRecognitionRef = useRef(0);

  const [device, setDevice] = useState<Device | null>(null);
  const [deviceAccount, setDeviceAccount] = useState<DeviceAccount | null>(null);
  const [floors, setFloors] = useState<LayoutFloor[]>([]);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [streamActive, setStreamActive] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [recognized, setRecognized] = useState<DetectionLabel[]>([]);
  const [alertBanner, setAlertBanner] = useState<string | null>(null);
  const [reportingEnabled, setReportingEnabled] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [deviceAuthenticated, setDeviceAuthenticated] = useState(false);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [loginError, setLoginError] = useState("");

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

  useEffect(() => {
    let active = true;

    async function boot() {
      const me = await deviceFetch("/api/device-auth/me", { cache: "no-store" });
      if (!active) return;

      if (!me.ok) {
        clearDeviceAuthToken();
        setAuthChecked(true);
        setDeviceAuthenticated(false);
        return;
      }

      const payload = await me.json();
      if (!active) return;

      setDeviceAccount({
        id: payload.id,
        username: payload.username,
      });
      setDevice(payload.device);
      setDeviceAuthenticated(true);
      setAuthChecked(true);
      void loadModels();
      void loadFloors();
    }

    void boot();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!streamActive || !device?.id) return;

    const heartbeat = window.setInterval(() => {
      const previewImage = capturePreview();
      deviceFetch(`/api/devices/${device.id}/heartbeat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ audioLevel: audioLevelRef.current, previewImage }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((payload) => {
          if (payload?.device) setDevice(payload.device);
          setReportingEnabled(Boolean(payload?.reportingEnabled));
        })
        .catch(() => {});
    }, HEARTBEAT_MS);

    const refresh = window.setInterval(() => {
      deviceFetch(`/api/devices/${device.id}`, {
        cache: "no-store",
      })
        .then((res) => (res.ok ? res.json() : null))
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
                const res = await deviceFetch("/api/identify", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
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
  }, [device, modelsLoaded, streamActive, roomLabelMap]);

  useEffect(() => {
    setReportingEnabled(Boolean(device?.assignedRoomId));
  }, [device?.assignedRoomId]);

  async function loadModels() {
    try {
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri("/models"),
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

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginSubmitting(true);
    setLoginError("");

    const res = await fetch("/api/device-auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: loginUsername, password: loginPassword }),
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => ({ error: "Device login failed" }));
      setLoginError(payload.error || "Device login failed");
      setLoginSubmitting(false);
      return;
    }

    const payload = await res.json();
    setDeviceAuthToken(payload.token);
    setDeviceAccount(payload.account);
    setDevice(payload.device);
    setDeviceAuthenticated(true);
    setLoginPassword("");
    setLoginSubmitting(false);
    void loadModels();
    void loadFloors();
  }

  async function logoutDevice() {
    const stream = videoRef.current?.srcObject;
    if (stream instanceof MediaStream) {
      stream.getTracks().forEach((track) => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    }

    await deviceFetch("/api/device-auth/logout", { method: "POST" });
    clearDeviceAuthToken();
    setDeviceAuthenticated(false);
    setDeviceAccount(null);
    setDevice(null);
    setStreamActive(false);
    setRecognized([]);
    setAlertBanner(null);
    setLoginPassword("");
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

  if (!authChecked) {
    return (
      <main className="ross-shell ross-login-shell">
        <section className="ross-login-card ross-card">
          <div className="ross-loading-state">
            <LoadingSpinner />
            <h1>Checking Device Access</h1>
            <p className="ross-hint">Validating the paired device login.</p>
          </div>
        </section>
      </main>
    );
  }

  if (!deviceAuthenticated) {
    return (
      <main className="ross-shell ross-login-shell">
        <section className="ross-login-card ross-card">
          <div className="ross-top-back-row">
            <Link href="/" className="ross-link-btn ross-top-back-btn">
              {"<- Back To Home Page"}
            </Link>
          </div>

          <div>
            <h1>Device Login</h1>
            <p className="ross-hint">Sign in with a device account created by security. This pairing stays logged in until the device is logged out directly.</p>
          </div>

          <form className="ross-stack" onSubmit={handleLogin}>
            <div className="ross-field-group">
              <label htmlFor="device-username">Device username</label>
              <input
                id="device-username"
                value={loginUsername}
                onChange={(event) => setLoginUsername(event.target.value)}
                className="ross-text-input"
                autoComplete="username"
                placeholder={defaultDeviceName()}
              />
            </div>

            <div className="ross-field-group">
              <label htmlFor="device-password">Password</label>
              <input
                id="device-password"
                type="password"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                className="ross-text-input"
                autoComplete="current-password"
              />
            </div>

            {loginError ? <div className="ross-login-error">{loginError}</div> : null}

            <button className="ross-btn ross-btn-primary" type="submit" disabled={loginSubmitting || !loginUsername.trim() || loginPassword.length < 4}>
              <span className="ross-btn-content">
                {loginSubmitting ? (
                  <>
                    <LoadingSpinner className="ross-spinner-sm" />
                    Signing In...
                  </>
                ) : (
                  "Sign In Device"
                )}
              </span>
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="ross-shell">
      <header className="ross-top-bar">
        <div className="ross-top-bar-left">
          <div className="ross-top-back-row">
            <Link href="/" className="ross-link-btn ross-top-back-btn">
              {"<- Back To Home Page"}
            </Link>
          </div>
          <h1>CougPulse Device Client</h1>
          <p>This phone or laptop joins the system as a camera and microphone device.</p>
        </div>
        <div className="ross-top-actions">
          <span className="ross-status-pill">{deviceAccount?.username ?? device?.name ?? "Device"}</span>
          <button className="ross-btn" type="button" onClick={logoutDevice}>
            Log Out Device
          </button>
          <Link href="/" className="ross-btn ross-btn-primary">
            Student Heatmap
          </Link>
        </div>
      </header>

      <section className="ross-device-shell">
        <section className="ross-card ross-device-main">
          <div className="ross-card-head">
            <div>
              <h2>Live Camera Feed</h2>
              <p className="ross-hint">Recognition runs here and sends room-aware alerts back to the security console.</p>
            </div>
            {!streamActive && (
              <button className="ross-btn ross-btn-primary" disabled={!modelsLoaded || !device} onClick={startStreaming}>
                <span className="ross-btn-content">
                  {!modelsLoaded ? (
                    <>
                      <LoadingSpinner className="ross-spinner-sm" />
                      Loading Models
                    </>
                  ) : (
                    "Start Device Stream"
                  )}
                </span>
              </button>
            )}
          </div>

          <div className="ross-video-shell ross-device-video">
            <video ref={videoRef} autoPlay playsInline muted className="ross-video-feed" />
            <canvas ref={canvasRef} className="ross-video-overlay" />
            {!streamActive && <div className="ross-video-empty">Start the device stream after security opens and assigns this client.</div>}
          </div>

          <div className="ross-stack">
            <div className="ross-meter-row">
              <span>{reportingEnabled ? "Audio Feed" : "Audio Waiting"}</span>
              <span>{Math.round((audioLevel / 128) * 100)}%</span>
            </div>
            <div className="ross-meter-track">
              <div className="ross-meter-fill" style={{ width: `${Math.min(100, (audioLevel / 128) * 100)}%` }} />
            </div>
            {!reportingEnabled && (
              <div className="ross-device-warning">
                This device is connected, but it will not report noise levels or trigger alerts until security assigns it to a room.
              </div>
            )}
            {alertBanner && (
              <div className="ross-device-alert">
                <strong>Flagged Person Detected:</strong> {alertBanner}
              </div>
            )}
          </div>
        </section>

        <aside className="ross-panel">
          <section className="ross-card">
            <div className="ross-card-head">
              <div>
                <h2>Device Status</h2>
                <p className="ross-hint">This browser acts as one camera and microphone client.</p>
              </div>
            </div>
            <div className="ross-data-grid">
              <div>Device Name</div>
              <div>{device?.name ?? "Connecting..."}</div>
              <div>Device Account</div>
              <div>{deviceAccount?.username ?? "Unpaired"}</div>
              <div>Assigned Room</div>
              <div>{assignedRoomLabel}</div>
              <div>Reporting Status</div>
              <div>{reportingEnabled ? "Reporting enabled" : "Waiting for room assignment"}</div>
              <div>Last Heartbeat</div>
              <div>{device?.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString() : "Waiting for first heartbeat"}</div>
            </div>
          </section>

          <section className="ross-card">
            <div className="ross-card-head">
              <div>
                <h2>Recognized Faces</h2>
                <p className="ross-hint">Current detections from this device feed.</p>
              </div>
            </div>
            <div className="ross-list ross-device-recognition-list">
              {recognized.length === 0 ? (
                <div className="ross-empty">
                  {reportingEnabled ? "No faces detected yet." : "Recognition is paused until this device is assigned to a room."}
                </div>
              ) : (
                recognized.map((item) => (
                  <div key={item.key} className="ross-item ross-device-recognition-item">
                    <strong>{item.label}</strong>
                    <span className={`ross-status-chip ${item.isTroublemaker ? "alert" : "online"}`}>
                      {item.isTroublemaker ? "Troublemaker" : "Recognized"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}
