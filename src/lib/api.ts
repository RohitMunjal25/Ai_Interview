import type {
  DashboardData,
  GeneratedQuestionsResult,
  InterviewReport,
  LoginResult,
  ResumeUploadResult,
  User,
} from "@/types";
import { getStoredUser } from "@/lib/auth";

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://anytime-leone-calendars-respond.trycloudflare.com";

export class ApiError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
  }
}

function storedToken() {
  return typeof window === "undefined" ? "" : localStorage.getItem("token") || "";
}

function apiMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback;
  const value = body as Record<string, unknown>;
  for (const key of ["message", "error", "detail", "msg"]) if (typeof value[key] === "string" && value[key]) return value[key] as string;
  if (value.data && typeof value.data === "object") return apiMessage(value.data, fallback);
  if (Array.isArray(value.errors) && value.errors.length) return value.errors.map((item) => typeof item === "string" ? item : apiMessage(item, "")).filter(Boolean).join("; ");
  return fallback;
}

export async function apiClient<T>(path: string, options: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), 90000);
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      cache: "no-store",
      signal: options.signal || controller.signal,
      headers: {
        ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...(storedToken() ? { Authorization: `Bearer ${storedToken()}` } : {}),
        ...options.headers,
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw new ApiError("The request timed out. Please try again.", 408);
    throw error;
  } finally {
    globalThis.clearTimeout(timeout);
  }
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text().then((text) => {
    try { return JSON.parse(text); } catch { return text; }
  });
  const authRequest = path.startsWith("/api/auth/");
  if (response.status === 401 && !authRequest && typeof window !== "undefined") {
    localStorage.removeItem("token");
    document.cookie = "token=; Max-Age=0; path=/";
    window.location.replace(new URL("/login", window.location.origin).toString());
  }
  const logicalFailure = typeof body === "object" && body !== null && (body as { success?: unknown }).success === false;
  if (!response.ok || logicalFailure) {
    throw new ApiError(apiMessage(body, `Request failed (${response.status})`), response.status);
  }
  return body as T;
}

const json = (body: unknown) => JSON.stringify(body);

function findResumeId(value: unknown): string {
  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = findResumeId(item);
      if (nested) return nested;
    }
    return "";
  }
  if (!value || typeof value !== "object") return "";
  const object = value as Record<string, unknown>;
  const directKeys = ["resumeId", "resumeID", "resume_id", "resumeFileId", "resumeUuid", "resumeUUID", "resume_uuid", "fileId", "fileID", "file_id", "documentId", "document_id", "uploadId", "upload_id", "id", "_id"];
  for (const key of directKeys) {
    const candidate = object[key];
    if ((typeof candidate === "string" || typeof candidate === "number") && String(candidate).trim() && candidate !== "undefined" && candidate !== "null") return String(candidate).trim();
    if (candidate && typeof candidate === "object") {
      const objectId = (candidate as Record<string, unknown>).$oid;
      if (typeof objectId === "string" && objectId.trim()) return objectId.trim();
    }
  }
  for (const [key, child] of Object.entries(object)) {
    if (["resume", "resumeData", "parsedData", "file", "document", "upload", "data", "result", "metadata", "documentData"].includes(key) || /resume|file|document|upload/i.test(key)) {
      if ((typeof child === "string" || typeof child === "number") && String(child).trim()) return String(child).trim();
      const nested = findResumeId(child);
      if (nested) return nested;
    }
  }
  return "";
}
const requireInterviewId = (interviewId: string) => {
  if (!interviewId || interviewId === "undefined" || interviewId === "null") throw new ApiError("Interview ID is missing.", 400);
  return encodeURIComponent(interviewId);
};

export const signup = (data: { name: string; email: string; password: string }) => apiClient<void>("/api/auth/signup", { method: "POST", body: json(data) });
export const verifyEmail = (data: { email: string; otp: string }) => apiClient<void>("/api/auth/verify-email", { method: "POST", body: json(data) });
type LoginApiResponse = Partial<LoginResult> & {
  accessToken?: string;
  access_token?: string;
  data?: Partial<LoginResult> & { accessToken?: string; access_token?: string };
};

export async function login(data: { email: string; password: string }) {
  const response = await apiClient<LoginApiResponse>("/api/auth/login", { method: "POST", body: json(data) });
  const payload = response.data || response;
  const token = payload.token || payload.accessToken || payload.access_token;
  if (!token) throw new ApiError("Login succeeded but the server did not return a token.", 502);
  return { token, user: payload.user as LoginResult["user"] };
}
export const forgotPassword = (data: { email: string }) => apiClient<void>("/api/auth/forgot-password", { method: "POST", body: json(data) });
export const resetPassword = (data: { email: string; otp: string; newPassword: string; token?: string }) => apiClient<void>("/api/auth/reset-password", { method: "POST", body: json(data) });
function toNumber(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
}
export async function getDashboard() {
  const response = await apiClient<Record<string, unknown>>("/api/user/dashboard");
  const data = (response.data as Record<string, unknown> | undefined) || response;
  const dashboard = (data.dashboard as Record<string, unknown> | undefined) || data;
  const rawInterviews = (dashboard.recentInterviews || dashboard.interviews || dashboard.recent || dashboard.history || []) as unknown[];
  const interviews = Array.isArray(rawInterviews) ? rawInterviews.map((value, index) => {
    const item = value as Record<string, unknown>;
    return { id: String(item.id || item._id || index), jobRole: String(item.jobRole || item.job_role || item.role || "Interview"), score: toNumber(item.score || item.overallScore || item.overall_score), completedAt: String(item.completedAt || item.completed_at || item.createdAt || item.created_at || "") };
  }) : [];
  const total = toNumber(dashboard.totalInterviews || dashboard.total_interviews || dashboard.interviewCount || dashboard.interview_count);
  const average = toNumber(dashboard.averageScore || dashboard.average_score || dashboard.avgScore || dashboard.avg_score);
  return { totalInterviews: total || interviews.length, averageScore: average, recentInterviews: interviews } satisfies DashboardData;
}
export async function getProfile() {
  try {
    const response = await apiClient<Record<string, unknown>>("/api/user/profile");
    const payload = (response.data as Record<string, unknown> | undefined) || response;
    const user = (payload.user as Record<string, unknown> | undefined) || payload;
    return { id: String(user.id || user._id || ""), name: String(user.name || ""), email: String(user.email || ""), createdAt: String(user.createdAt || user.created_at || "") } satisfies User;
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 304) {
      const user = getStoredUser();
      if (user) return user as User;
    }
    throw error;
  }
}

export async function uploadResume(file: File, jobRole?: string) {
  const form = new FormData();
  form.append("resume", file);
  if (jobRole?.trim()) {
    form.append("jobRole", jobRole.trim());
    form.append("role", jobRole.trim());
  }
  const response = await apiClient<Record<string, unknown>>("/api/interview/upload-resume", { method: "POST", body: form });
  const payload = (response.data as Record<string, unknown> | undefined) || response;
  return {
    resumeId: findResumeId(response),
    parsedData: (payload.parsedData || {}) as Record<string, unknown>,
  } satisfies ResumeUploadResult;
}

export async function generateQuestions(data: { resumeId: string; jobRole: string; difficulty: string; questionCount: number }) {
  const response = await apiClient<Record<string, unknown>>("/api/interview/generate-questions", { method: "POST", body: json({ ...data, jobRole: data.jobRole.trim(), role: data.jobRole.trim() }) });
  const payload = (response.data as Record<string, unknown> | undefined) || response;
  const interview = (payload.interview as Record<string, unknown> | undefined) || payload;
  const rawQuestions = (payload.questions || interview.questions || []) as Record<string, unknown>[];
  return {
    interviewId: String(payload.interviewId || interview.interviewId || interview._id || interview.id || ""),
    questions: rawQuestions.map((question, index) => ({
      id: String(question.id || question._id || index),
      text: String(question.text || question.question || ""),
      type: question.type === "behavioral" || question.type === "situational" ? question.type : "technical",
      difficulty: question.difficulty === "easy" || question.difficulty === "hard" ? question.difficulty : "medium",
      timeLimit: typeof question.timeLimit === "number" ? question.timeLimit : undefined,
    })),
  } satisfies GeneratedQuestionsResult;
}
export const submitAnswer = (interviewId: string, data: { questionId: string; answer: string; timeTaken: number }) => apiClient<void>(`/api/interview/${requireInterviewId(interviewId)}/answer`, { method: "POST", body: json(data) });
export async function startProctor(interviewId: string, image?: Blob) {
  const safeInterviewId = requireInterviewId(interviewId);
  const body = image ? (() => { const form = new FormData(); form.append("image", image, "proctor.jpg"); return form; })() : undefined;
  return apiClient<void>(`/api/interview/${safeInterviewId}/proctor/start`, { method: "POST", body });
}
export const terminateProctor = (interviewId: string) => apiClient<void>(`/api/interview/${requireInterviewId(interviewId)}/proctor/terminate`, { method: "POST", body: json({ reason: "Interview ended by candidate" }) });
export async function getReport(interviewId: string) {
  const response = await apiClient<Record<string, unknown>>(`/api/interview/${requireInterviewId(interviewId)}/report`);
  const data = (response.data as Record<string, unknown> | undefined) || response;
  const report = (data.report as Record<string, unknown> | undefined) || data;
  const rawResults = Array.isArray(report.questionResults) ? report.questionResults : Array.isArray(report.results) ? report.results : [];
  return {
    interviewId: String(report.interviewId || report.interview_id || interviewId),
    overallScore: typeof report.overallScore === "number" ? report.overallScore : Number(report.score || 0),
    feedback: String(report.feedback || "Your interview report is ready."),
    questionResults: rawResults.map((result) => { const item = result as Record<string, unknown>; return { questionId: String(item.questionId || item.question_id || item.id || item._id || ""), question: String(item.question || item.text || "Question"), answer: String(item.answer || ""), score: typeof item.score === "number" ? item.score : 0, feedback: String(item.feedback || "No feedback provided."), idealAnswer: item.idealAnswer ? String(item.idealAnswer) : undefined }; }),
    strengths: Array.isArray(report.strengths) ? report.strengths.map(String) : [],
    improvements: Array.isArray(report.improvements) ? report.improvements.map(String) : [],
    completedAt: String(report.completedAt || report.completed_at || new Date().toISOString()),
  } satisfies InterviewReport;
}
export async function downloadReport(interviewId: string) {
  const response = await fetch(`${API_BASE}/api/interview/${interviewId}/report/download`, { headers: { Authorization: `Bearer ${storedToken()}` } });
  if (!response.ok) throw new ApiError("Could not download report", response.status);
  return response.blob();
}
