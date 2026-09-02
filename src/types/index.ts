export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  profilePicture?: string;
}

export interface Question {
  id: string;
  text: string;
  type: "technical" | "behavioral" | "situational";
  difficulty: "easy" | "medium" | "hard";
  timeLimit?: number;
}

export interface Answer {
  questionId: string;
  answer: string;
  timeTaken: number;
}

export interface InterviewReport {
  interviewId: string;
  overallScore: number;
  feedback: string;
  questionResults: {
    questionId: string;
    question: string;
    answer: string;
    score: number;
    feedback: string;
    idealAnswer?: string;
    aiAnswer?: string;
  }[];
  strengths: string[];
  improvements: string[];
  completedAt: string;
  candidate?: { name?: string; email?: string; profilePicture?: string; profilePic?: string; profileImage?: string; avatar?: string; image?: string; photo?: string; cloudinaryUrl?: string };
  jobRole?: string;
  interviewDate?: string;
  performanceLevel?: string;
  summary?: string;
  weaknesses?: string[];
  recommendations?: string[];
  proctoring?: { startedAt?: string; endedAt?: string | null; status?: string };
  reportUrl?: string;
}

export interface DashboardData {
  totalInterviews: number;
  averageScore: number;
  recentInterviews: {
    id: string;
    jobRole: string;
    score: number;
    completedAt: string;
  }[];
}

export interface ResumeUploadResult {
  resumeId: string;
  parsedData: Record<string, unknown>;
}

export interface GeneratedQuestionsResult {
  interviewId: string;
  questions: Question[];
}

export interface LoginResult {
  token: string;
  user: User;
}

export interface ApiErrorShape {
  message: string;
  statusCode: number;
}