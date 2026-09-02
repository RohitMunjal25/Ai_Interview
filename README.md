# AI Interview Analyzer

AI Interview Analyzer is a Next.js application for resume-based interview practice. Candidates upload a resume, choose a target role and difficulty, complete a proctored interview, and review their performance report.

## Features

- Email-based signup, verification, login, and OTP password recovery
- Resume upload with backend resume validation and parsing
- AI-generated technical, behavioral, and situational questions
- Live text answers with per-question timing
- Camera-based proctoring with permission handling and cleanup
- Interview integrity warnings for tab switches, window blur, fullscreen exit, copy, and paste activity
- Partial progress reports for unfinished interviews
- Completed reports with scoring, feedback, strengths, improvements, and PDF download
- Responsive dashboard, profile, and interview workspace

## Tech Stack

- Next.js App Router
- React and TypeScript
- Tailwind CSS
- React Hook Form and Zod
- Lucide React
- react-hot-toast
- Backend Gemini integration through the API service

## Getting Started

Install dependencies:

```bash
npm install
```

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_API_BASE_URL=https://your-api-host.example.com
```

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploying to Vercel

Import this repository into Vercel. Vercel detects the Next.js framework automatically and uses the existing build settings.

Add this production environment variable in **Project Settings > Environment Variables**:

```env
NEXT_PUBLIC_API_BASE_URL=https://your-production-backend.example.com
```

Deploy with the Vercel dashboard or the Vercel CLI:

```bash
npx vercel
npx vercel --prod
```

The backend must allow requests from the deployed Vercel domain through CORS. Camera proctoring also requires HTTPS, which Vercel provides automatically.

## Available Commands

```bash
npm run dev
npm run lint
npm run build
npm run start
```

## Application Flow

1. Create an account and verify the email OTP.
2. Sign in and open **New interview**.
3. Upload a resume and provide the target job role.
4. The backend verifies and parses the resume, then generates questions.
5. Answer each question while camera proctoring is active.
6. End the interview or finish the final question.
7. Review the completed or partial report.

## API Configuration

All requests are centralized in `src/lib/api.ts`. Authenticated requests automatically attach the bearer token stored in the browser and handle expired sessions.

The frontend expects these backend endpoints:

- `/api/auth/signup`
- `/api/auth/verify-email`
- `/api/auth/login`
- `/api/auth/forgot-password`
- `/api/auth/reset-password`
- `/api/user/dashboard`
- `/api/user/profile`
- `/api/interview/upload-resume`
- `/api/interview/generate-questions`
- `/api/interview/:interviewId/answer`
- `/api/interview/:interviewId/proctor/start`
- `/api/interview/:interviewId/proctor/terminate`
- `/api/interview/:interviewId/report`
- `/api/interview/:interviewId/report/download`

Resume verification and Gemini processing are performed by the backend upload and interview APIs. No Gemini API key is required in the frontend.

## Project Structure

```text
src/
  app/
    (auth)/
    (dashboard)/
    auth-enhancements.css
    globals.css
    ui-enhancements.css
  components/
    auth/
    interview/
    layout/
    ui/
  hooks/
  lib/
  types/
middleware.ts
```

## Notes

- Protected dashboard and interview routes require the `token` cookie.
- The browser also stores the auth token and current interview session in localStorage.
- Camera access is required for active proctoring, but camera cleanup is handled when the interview ends or the page changes.
