"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import QuestionCard from "@/components/interview/QuestionCard";
import AnswerRecorder from "@/components/interview/AnswerRecorder";
import ProctorCamera from "@/components/interview/ProctorCamera";
import ReportView from "@/components/interview/ReportView";
import { getProfile, getReport, submitAnswer } from "@/lib/api";
import type { InterviewReport, Question } from "@/types";

interface SavedInterview { questions?: Question[]; }

function readSavedInterview(): SavedInterview | null {
  const value = localStorage.getItem("interview");
  if (!value) return null;
  try { return JSON.parse(value) as SavedInterview; } catch { localStorage.removeItem("interview"); return null; }
}

export function QuestionsPage({ interviewId }: { interviewId: string }) {
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraPermission, setCameraPermission] = useState(false);
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [integrityWarning, setIntegrityWarning] = useState("");
  const [integrityEvents, setIntegrityEvents] = useState(0);
  useEffect(() => { const saved = readSavedInterview(); if (saved) queueMicrotask(() => setQuestions(Array.isArray(saved.questions) ? saved.questions : [])); }, []);
  useEffect(() => {
    function flagActivity(message: string) { setIntegrityEvents((count) => count + 1); setIntegrityWarning(message); }
    function handleVisibility() { if (document.hidden) flagActivity("You left the interview tab. Please return and keep this window focused."); }
    function handleBlur() { flagActivity("The interview window lost focus. Please keep the interview window active."); }
    function handleFullscreen() { if (!document.fullscreenElement) flagActivity("Fullscreen was exited. Please keep the interview window visible."); }
    function handleClipboard() { flagActivity("Copy or paste activity was detected during the interview."); }
    document.addEventListener("visibilitychange", handleVisibility); window.addEventListener("blur", handleBlur); document.addEventListener("fullscreenchange", handleFullscreen); document.addEventListener("copy", handleClipboard); document.addEventListener("paste", handleClipboard);
    return () => { document.removeEventListener("visibilitychange", handleVisibility); window.removeEventListener("blur", handleBlur); document.removeEventListener("fullscreenchange", handleFullscreen); document.removeEventListener("copy", handleClipboard); document.removeEventListener("paste", handleClipboard); };
  }, []);
  const question = questions[index];
  async function next(answer: string, timeTaken: number) {
    setBusy(true); setError("");
    try {
      await submitAnswer(interviewId, { questionId: question.id, answer, timeTaken });
      if (index === questions.length - 1) router.push(`/interview/${interviewId}/report`); else setIndex(index + 1);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not submit your answer. Please try again."); }
    finally { setBusy(false); }
  }
  return <div className="interview-layout"><section><div className="section-heading"><div><div className="eyebrow">02 / Live interview</div><h2>{cameraActive ? "Stay present. Stay specific." : "Camera access required."}</h2></div></div>{!cameraPermission && !error && <div className="notice error">Enable camera access before starting the interview.</div>}{integrityWarning && <div role="alert" style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "13px 15px", marginBottom: 16, border: "1px solid #fecdca", borderRadius: 9, background: "#fff6ed", color: "#b54708", fontSize: 13 }}><AlertTriangle size={19} /><div><strong style={{ display: "block" }}>Interview integrity warning</strong><span style={{ display: "block", marginTop: 3 }}>{integrityWarning} Event {integrityEvents} recorded.</span></div><button style={{ marginLeft: "auto", border: 0, background: "none", color: "#b54708", fontSize: 12, fontWeight: 700 }} onClick={() => setIntegrityWarning("")}>Dismiss</button></div>}{error && <div className="notice error">{error}</div>}{question && interviewStarted && cameraActive ? <><QuestionCard question={question} index={index} total={questions.length} /><AnswerRecorder key={question.id} onSubmit={next} busy={busy} /></> : <div className="panel">{!cameraPermission ? "Camera permission is required before the interview can begin." : !interviewStarted ? <button className="button primary" onClick={() => setInterviewStarted(true)}>Start interview</button> : !cameraActive ? "Starting interview and proctoring..." : <>No questions found. <a href="/interview/new">Start a new interview</a></>}</div>}</section><ProctorCamera interviewId={interviewId} startRequested={interviewStarted} onStatus={setCameraActive} onPermission={setCameraPermission} /></div>;
}

export function ReportPage({ interviewId }: { interviewId: string }) {
  const [report, setReport] = useState<InterviewReport | null>(null);
  const [error, setError] = useState("");
  async function loadReport() {
    setError("");
    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        const latest = await getReport(interviewId);
          if (latest.questionResults.length || latest.overallScore > 0 || latest.strengths.length || latest.improvements.length) { const profile = await getProfile().catch(() => null); setReport(profile ? { ...latest, candidate: { ...latest.candidate, name: latest.candidate?.name || profile.name, email: latest.candidate?.email || profile.email, profilePicture: latest.candidate?.profilePicture || profile.profilePicture } } : latest); return; }
      } catch { }
      if (attempt < 5) await new Promise((resolve) => window.setTimeout(resolve, 2000));
    }
    setError("The interview report is not available until the interview is completed.");
  }
  useEffect(() => { queueMicrotask(() => void loadReport()); }, [interviewId]);
  if (error) return <div className="notice error">{error}</div>;
  return report ? <ReportView report={report} /> : <div className="loading">Preparing your completed report...</div>;
}
