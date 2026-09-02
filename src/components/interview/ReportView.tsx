"use client";

import { Check, ChevronDown, Download, MoveUpRight } from "lucide-react";
import { useState } from "react";
import type { InterviewReport } from "@/types";
import { downloadReport } from "@/lib/api";

export default function ReportView({ report, partial = false, onRefresh }: { report: InterviewReport; partial?: boolean; onRefresh?: () => void }) {
  const [open, setOpen] = useState("");
  const circumference = 2 * Math.PI * 52;
  const strengths = Array.isArray(report.strengths) ? report.strengths : [];
  const improvements = Array.isArray(report.improvements) ? report.improvements : [];
  const questionResults = Array.isArray(report.questionResults) ? report.questionResults : [];
  async function download() {
    try {
      const blob = await downloadReport(report.interviewId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "interview-report.pdf";
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      return;
    }
  }
  return <div className="report-view"><div className="report-header"><div><div className="eyebrow">03 / {partial ? "Session so far" : "Completed session"}</div><h1>{partial ? "Your progress, captured." : "Your signal, decoded."}</h1><p className="muted">{report.feedback}</p></div><div style={{ display: "flex", gap: 8 }}>{partial && onRefresh && <button className="button secondary" onClick={onRefresh}>Refresh report</button>}{!partial && <button className="button secondary" onClick={download}><Download size={16} />Download PDF</button>}</div></div><div className="report-grid"><div className="score-panel"><svg viewBox="0 0 120 120"><circle className="ring-bg" cx="60" cy="60" r="52" /><circle className="ring-value" cx="60" cy="60" r="52" strokeDasharray={`${circumference}`} strokeDashoffset={`${circumference * (1 - report.overallScore / 100)}`} /></svg><strong>{report.overallScore}</strong><span>{partial ? "current score" : "overall score"}</span></div><div className="insight-column"><Insight title="Strengths" items={strengths} icon={<Check size={15} />} /><Insight title="Opportunities" items={improvements} icon={<MoveUpRight size={15} />} /></div></div><div className="breakdown"><div className="eyebrow">Question breakdown</div>{questionResults.length ? questionResults.map((item) => <div className="breakdown-row" key={item.questionId}><button onClick={() => setOpen(open === item.questionId ? "" : item.questionId)}><span><b>{item.score}</b>{item.question}</span><ChevronDown className={open === item.questionId ? "rotate" : ""} size={18} /></button>{open === item.questionId && <div className="breakdown-detail"><strong>Your answer</strong><p>{item.answer || "No answer submitted."}</p><strong>AI feedback</strong><p>{item.feedback}</p>{item.idealAnswer && <><strong>Ideal answer</strong><p>{item.idealAnswer}</p></>}</div>}</div>) : <p className="muted">No answers were submitted in this session.</p>}</div></div>;
}
function Insight({ title, items, icon }: { title: string; items: string[]; icon: React.ReactNode }) { return <div className="insight"><h3>{title}</h3>{items.length ? items.map((item) => <p key={item}><i>{icon}</i>{item}</p>) : <p className="muted">Nothing to show yet.</p>}</div>; }
