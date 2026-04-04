"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFaceAdded: () => void;
}

export function AddFaceDialog({ open, onOpenChange, onFaceAdded }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [name, setName] = useState("");
  const [captured, setCaptured] = useState<string | null>(null);
  const [capturedDescriptor, setCapturedDescriptor] = useState<number[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) {
      stopStream();
      setCaptured(null);
      setCapturedDescriptor(null);
      setName("");
      return;
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" } })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => toast.error("Camera access denied"));

    return stopStream;
  }, [open, stopStream]);

  const capture = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setDetecting(true);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);

    try {
      const faceapi = (await import("face-api.js")).default ?? await import("face-api.js");
      const detection = await faceapi
        .detectSingleFace(canvas)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        toast.error("No face detected — try again");
        setDetecting(false);
        return;
      }

      setCaptured(canvas.toDataURL("image/jpeg", 0.8));
      setCapturedDescriptor(Array.from(detection.descriptor));
      stopStream();
    } catch {
      toast.error("Detection failed");
    } finally {
      setDetecting(false);
    }
  }, [stopStream]);

  const save = useCallback(async () => {
    if (!name.trim() || !capturedDescriptor) return;
    setLoading(true);
    try {
      const res = await fetch("/api/faces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), descriptor: capturedDescriptor }),
      });
      if (!res.ok) throw new Error();
      toast.success(`"${name.trim()}" added`);
      onFaceAdded();
      onOpenChange(false);
    } catch {
      toast.error("Failed to save face");
    } finally {
      setLoading(false);
    }
  }, [name, capturedDescriptor, onFaceAdded, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-neutral-900 border-neutral-800 text-white max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-white">Add Face</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative aspect-video bg-neutral-950 rounded-lg overflow-hidden">
            {captured ? (
              <img src={captured} alt="captured" className="w-full h-full object-cover" />
            ) : (
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {!captured ? (
            <Button
              onClick={capture}
              disabled={detecting}
              className="w-full bg-white text-black hover:bg-neutral-200"
            >
              {detecting ? "Detecting…" : "Capture Face"}
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => {
                setCaptured(null);
                setCapturedDescriptor(null);
                navigator.mediaDevices
                  .getUserMedia({ video: { facingMode: "user" } })
                  .then((s) => {
                    streamRef.current = s;
                    if (videoRef.current) videoRef.current.srcObject = s;
                  });
              }}
              className="w-full border-neutral-700 text-neutral-300 hover:bg-neutral-800"
            >
              Retake
            </Button>
          )}

          <div className="space-y-1.5">
            <Label className="text-neutral-400 text-sm">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && save()}
              placeholder="Enter name…"
              className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500"
            />
          </div>

          <Button
            onClick={save}
            disabled={!captured || !name.trim() || loading}
            className="w-full bg-white text-black hover:bg-neutral-200 disabled:opacity-40"
          >
            {loading ? "Saving…" : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
