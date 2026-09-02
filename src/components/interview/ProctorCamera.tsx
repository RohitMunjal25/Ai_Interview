"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, RefreshCw } from "lucide-react";
import { startProctor } from "@/lib/api";

export default function ProctorCamera({
  interviewId,
  startRequested = false,
  onStatus,
  onPermission,
}: {
  interviewId: string;
  startRequested?: boolean;
  onStatus?: (active: boolean) => void;
  onPermission?: (allowed: boolean) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const snapshotRef = useRef<number | null>(null);
  const stoppedRef = useRef(false);
  const [active, setActive] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [error, setError] = useState(false);

  function stopCamera() {
    stoppedRef.current = true;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (video.current) video.current.srcObject = null;
    if (snapshotRef.current !== null) window.clearInterval(snapshotRef.current);
    snapshotRef.current = null;
    setActive(false);
    setPermissionGranted(false);
    onStatus?.(false);
    onPermission?.(false);
  }

  useEffect(() => {
    stoppedRef.current = false;
    async function requestCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (stoppedRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (video.current) video.current.srcObject = stream;
        setPermissionGranted(true);
        onPermission?.(true);
      } catch {
        if (!stoppedRef.current) {
          setError(true);
          onPermission?.(false);
        }
      }
    }
    void requestCamera();
    return () => stopCamera();
  }, [interviewId]);

  useEffect(() => {
    if (!startRequested || !permissionGranted || active || stoppedRef.current) return;

    async function beginProctor() {
      try {
        const element = video.current;
        if (!element) throw new Error("Camera video is unavailable.");

        await new Promise<void>((resolve, reject) => {
          const check = () => {
            if (stoppedRef.current) return reject(new Error("Stopped"));
            if (
              element.readyState >= 2 &&
              element.videoWidth > 0 &&
              element.videoHeight > 0
            ) {
              resolve();
            } else {
              requestAnimationFrame(check);
            }
          };
          check();
        });

        if (stoppedRef.current) return;

        const canvas = document.createElement("canvas");
        canvas.width = element.videoWidth;
        canvas.height = element.videoHeight;
        canvas.getContext("2d")?.drawImage(element, 0, 0);

        const image = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/jpeg", 0.65)
        );

        if (stoppedRef.current) return;
        await startProctor(interviewId, image || undefined);
        if (stoppedRef.current) return;

        setActive(true);
        onStatus?.(true);

        snapshotRef.current = window.setInterval(() => {
          const current = video.current;
          if (
            current &&
            current.readyState >= 2 &&
            current.videoWidth > 0 &&
            current.videoHeight > 0
          ) {
            canvas.width = current.videoWidth;
            canvas.height = current.videoHeight;
            canvas.getContext("2d")?.drawImage(current, 0, 0);
          }
        }, 30000);
      } catch {
        if (!stoppedRef.current) {
          setError(true);
          onStatus?.(false);
        }
      }
    }

    void beginProctor();
  }, [active, interviewId, onStatus, permissionGranted, startRequested]);

  return (
    <div className="camera-panel">
      <div className="camera-heading">
        <span>
          <Camera size={16} /> Proctor view
        </span>
        <b className={active ? "camera-status active" : "camera-status"}>
          {active ? "Camera active" : permissionGranted ? "Camera ready" : "Camera off"}
        </b>
      </div>
      {error ? (
        <div className="camera-fallback">
          <Camera size={30} />
          <strong>
            {permissionGranted ? "Could not start proctoring" : "Camera access required"}
          </strong>
          <small>
            {permissionGranted
              ? "Try starting the interview again."
              : "Allow camera permissions to start the interview."}
          </small>
          <button className="button secondary" onClick={() => window.location.reload()}>
            <RefreshCw size={15} />
            Retry
          </button>
        </div>
      ) : (
        <video ref={video} autoPlay muted playsInline />
      )}
    </div>
  );
}