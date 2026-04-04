"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CameraFeed } from "@/components/camera-feed";
import { DbMeter } from "@/components/db-meter";
import { AddFaceDialog } from "@/components/add-face-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FLOOR_ROOMS } from "@/lib/rooms";

type PermissionState = "idle" | "requesting" | "granted" | "denied";

export default function Home() {
  const [permission, setPermission] = useState<PermissionState>("idle");
  const [modelsReady, setModelsReady] = useState(false);
  const [faceCount, setFaceCount] = useState(0);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [addFaceOpen, setAddFaceOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<string>("");

  // Live values from camera/mic — used when pushing room readings
  const currentDb = useRef<number>(-60);
  const currentFaces = useRef<string[]>([]);
  const pushInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const requestPermissions = useCallback(async () => {
    setPermission("requesting");
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      setPermission("granted");
    } catch {
      setPermission("denied");
      toast.error("Camera and microphone access required");
    }
  }, []);

  // Start mic after permissions granted
  useEffect(() => {
    if (permission !== "granted") return;
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then(setAudioStream)
      .catch(() => toast.error("Microphone access denied"));
  }, [permission]);

  // Load face-api.js models
  useEffect(() => {
    if (permission !== "granted") return;
    (async () => {
      const faceapiModule = await import("face-api.js");
      const faceapi = faceapiModule.default ?? faceapiModule;
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri("/models"),
        faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
        faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
      ]);
      setModelsReady(true);
    })().catch((e) => toast.error(`Model load failed: ${e.message}`));
  }, [permission]);

  const loadFaces = useCallback(async () => {
    const res = await fetch("/api/faces");
    if (res.ok) {
      const faces = await res.json();
      setFaceCount(faces.length);
    }
  }, []);

  useEffect(() => {
    loadFaces();
  }, [loadFaces]);

  // Push room readings every 3s when a room is selected
  useEffect(() => {
    if (pushInterval.current) clearInterval(pushInterval.current);
    if (!selectedRoom) return;

    const push = async () => {
      await fetch(`/api/rooms/${selectedRoom}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dbLevel: currentDb.current,
          occupants: currentFaces.current,
        }),
      });
    };

    pushInterval.current = setInterval(push, 3000);
    return () => {
      if (pushInterval.current) clearInterval(pushInterval.current);
    };
  }, [selectedRoom]);

  // Permission screen
  if (permission === "idle" || permission === "requesting") {
    return (
      <main className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="text-center space-y-6 max-w-sm px-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-white">CougPulse</h1>
            <p className="text-neutral-400 text-sm">
              This app needs access to your camera and microphone to detect faces and measure noise levels.
            </p>
          </div>
          <Button
            onClick={requestPermissions}
            disabled={permission === "requesting"}
            className="w-full bg-white text-black hover:bg-neutral-200 rounded-full"
          >
            {permission === "requesting" ? "Requesting…" : "Allow Camera & Microphone"}
          </Button>
        </div>
      </main>
    );
  }

  if (permission === "denied") {
    return (
      <main className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="text-center space-y-4 max-w-sm px-6">
          <h1 className="text-2xl font-semibold text-white">Access Denied</h1>
          <p className="text-neutral-400 text-sm">
            Camera and microphone permissions were denied. Please allow them in your browser settings and reload.
          </p>
          <Button onClick={() => window.location.reload()} className="rounded-full bg-white text-black hover:bg-neutral-200">
            Reload
          </Button>
        </div>
      </main>
    );
  }

  const trackableRooms = FLOOR_ROOMS.filter((r) => r.trackable);

  return (
    <main className="min-h-screen bg-neutral-950 text-white flex flex-col">
      {/* Header */}
      <header className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold tracking-tight">CougPulse</span>
          <Badge
            variant="outline"
            className={`text-xs border-0 ${
              modelsReady ? "bg-green-500/10 text-green-400" : "bg-yellow-500/10 text-yellow-400"
            }`}
          >
            {modelsReady ? "Models ready" : "Loading models…"}
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          <DbMeter
            stream={audioStream}
            onDbChange={(db) => { currentDb.current = db; }}
          />
          <Button
            onClick={() => setAddFaceOpen(true)}
            size="sm"
            className="bg-white text-black hover:bg-neutral-200 rounded-full px-4"
          >
            + Add Face
          </Button>
        </div>
      </header>

      {/* Camera */}
      <div className="flex-1 relative">
        <CameraFeed
          modelsReady={modelsReady}
          onFacesDetected={(names) => { currentFaces.current = names; }}
        />

        <div className="absolute bottom-16 left-4 z-10">
          <span className="text-xs text-neutral-500 font-mono">
            {faceCount} face{faceCount !== 1 ? "s" : ""} in database
          </span>
        </div>

        <div className="absolute bottom-16 right-4 z-10 flex gap-3">
          <Link
            href="/map"
            className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors font-mono"
          >
            Map →
          </Link>
          <a
            href="/api/docs"
            target="_blank"
            className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors font-mono"
          >
            API docs →
          </a>
        </div>
      </div>

      {/* Room selector bar */}
      <div className="bg-neutral-900 border-t border-neutral-800 px-6 py-3 flex items-center gap-3">
        <span className="text-xs text-neutral-400 whitespace-nowrap">Camera room:</span>
        <select
          value={selectedRoom}
          onChange={(e) => setSelectedRoom(e.target.value)}
          className="flex-1 bg-neutral-800 border border-neutral-700 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-500"
        >
          <option value="">— Not assigned —</option>
          {trackableRooms.map((room) => (
            <option key={room.number} value={room.number}>
              {room.name}
            </option>
          ))}
        </select>
        {selectedRoom && (
          <span className="text-xs text-green-400 font-mono whitespace-nowrap">● Live</span>
        )}
      </div>

      <AddFaceDialog
        open={addFaceOpen}
        onOpenChange={setAddFaceOpen}
        onFaceAdded={loadFaces}
      />
    </main>
  );
}
