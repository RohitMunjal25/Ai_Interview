"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, RefreshCw } from "lucide-react";
import { startProctor, terminateProctor } from "@/lib/api";

export default function ProctorCamera({ interviewId, stopRequested = false, onStatus }: { interviewId: string; stopRequested?: boolean; onStatus?: (active: boolean) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const snapshotRef = useRef<number | null>(null);
  const proctorStartedRef = useRef(false);
  const stoppedRef = useRef(false);
  const [active, setActive] = useState(false);
  const [error, setError] = useState(false);

  function stopCamera() {
    stoppedRef.current = true;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (video.current) video.current.srcObject = null;
    if (snapshotRef.current !== null) window.clearInterval(snapshotRef.current);
    snapshotRef.current = null;
    proctorStartedRef.current = false;
    setActive(false);
    onStatus?.(false);
  }

  useEffect(() => {
    if (stopRequested) queueMicrotask(stopCamera);
  }, [stopRequested]);

  useEffect(() => {
    stoppedRef.current = false;
    async function init() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (stoppedRef.current) { stream.getTracks().forEach((track) => track.stop()); return; }
        streamRef.current = stream;
        if (video.current) video.current.srcObject = stream;
        const element = video.current;
        if (!element) throw new Error("Camera video is unavailable.");
        await new Promise<void>((resolve) => { element.onloadedmetadata = () => resolve(); });
        if (stoppedRef.current) return;
        const canvas = document.createElement("canvas");
        canvas.width = element.videoWidth;
        canvas.height = element.videoHeight;
        canvas.getContext("2d")?.drawImage(element, 0, 0);
        const image = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.65));
        if (stoppedRef.current) return;
        await startProctor(interviewId, image || undefined);
        if (stoppedRef.current) return;
        proctorStartedRef.current = true;
        setActive(true);
        onStatus?.(true);
        snapshotRef.current = window.setInterval(() => {
          const current = video.current;
          if (current?.videoWidth && current.videoHeight) {
            canvas.width = current.videoWidth;
            canvas.height = current.videoHeight;
            canvas.getContext("2d")?.drawImage(current, 0, 0);
            canvas.toDataURL("image/jpeg", 0.65);
          }
        }, 30000);
      } catch {
        if (!stoppedRef.current) { setError(true); onStatus?.(false); }
      }
    }
    void init();
    return () => {
      const shouldTerminate = proctorStartedRef.current;
      stopCamera();
      if (shouldTerminate) void terminateProctor(interviewId).catch(() => undefined);
    };
  }, [interviewId]);

  return <div className="camera-panel"><div className="camera-heading"><span><Camera size={16} /> Proctor view</span><b className={active ? "camera-status active" : "camera-status"}>{active ? "Camera active" : "Camera off"}</b></div>{error ? <div className="camera-fallback"><Camera size={30} /><strong>Camera access required</strong><small>Allow camera permissions to start the interview.</small><button className="button secondary" onClick={() => window.location.reload()}><RefreshCw size={15} />Enable camera</button></div> : <video ref={video} autoPlay muted playsInline />}</div>;
}
