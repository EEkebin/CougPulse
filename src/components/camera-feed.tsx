"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { toast } from "sonner";

interface Props {
  modelsReady: boolean;
  onFacesDetected?: (names: string[]) => void;
}

export function CameraFeed({ modelsReady, onFacesDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const [ready, setReady] = useState(false);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setReady(true);
      }
    } catch {
      toast.error("Camera access denied");
    }
  }, []);

  useEffect(() => {
    startCamera();
  }, [startCamera]);

  useEffect(() => {
    if (!ready || !modelsReady) return;

    let running = true;
    // Cache of descriptor → name to avoid hammering the server every frame
    const nameCache = new Map<string, string>();

    const identify = async (descriptor: Float32Array): Promise<string> => {
      const key = Array.from(descriptor).slice(0, 8).join(",");
      if (nameCache.has(key)) return nameCache.get(key)!;

      try {
        const res = await fetch("/api/identify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ descriptor: Array.from(descriptor) }),
        });
        const { name } = await res.json();
        const label = name ?? "Unknown";
        nameCache.set(key, label);
        return label;
      } catch {
        return "Unknown";
      }
    };

    const detect = async () => {
      if (!running || !videoRef.current || !canvasRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video.readyState < 2) {
        rafRef.current = requestAnimationFrame(detect);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d")!;

      try {
        const faceapiModule = await import("face-api.js");
        const faceapi = faceapiModule.default ?? faceapiModule;

        const detections = await faceapi
          .detectAllFaces(video)
          .withFaceLandmarks()
          .withFaceDescriptors();

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const names: string[] = [];
        await Promise.all(
          detections.map(async (det) => {
            const { x, y, width, height } = det.detection.box;
            const name = await identify(det.descriptor);

            if (name !== "Unknown") names.push(name);
            ctx.strokeStyle = name === "Unknown" ? "#ef4444" : "#22c55e";
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, width, height);

            ctx.fillStyle = name === "Unknown" ? "#ef4444" : "#22c55e";
            const fontSize = Math.max(14, height * 0.1);
            ctx.font = `600 ${fontSize}px Inter, sans-serif`;
            const textW = ctx.measureText(name).width;
            ctx.fillRect(x, y + height + 2, textW + 12, fontSize + 8);
            ctx.fillStyle = "#fff";
            ctx.fillText(name, x + 6, y + height + fontSize + 4);
          })
        );
        onFacesDetected?.(names);
      } catch {
        // transient detection error, skip frame
      }

      if (running) rafRef.current = requestAnimationFrame(detect);
    };

    rafRef.current = requestAnimationFrame(detect);

    return () => {
      running = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [ready, modelsReady]);

  return (
    <div className="relative w-full h-full">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="w-full h-full object-cover"
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ objectFit: "cover" }}
      />
    </div>
  );
}
