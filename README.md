# AI Interview Analyzer

AI Interview Analyzer is a Next.js application for resume-based interview practice. Candidates can upload their resumes, select a target job role and difficulty level, complete AI-powered interviews with camera-based proctoring, and review detailed performance reports.

## Features

### Authentication
- Email-based signup and verification
- Secure login and authenticated sessions
- OTP-based password recovery and reset
- Protected dashboard and interview routes

### Resume and Interview Preparation
- Resume upload with backend validation and parsing
- AI-powered job role suggestions based on uploaded resumes
- AI-generated technical, behavioral, and situational interview questions
- Configurable target role and interview difficulty

### Interview Experience
- Live text-based answers with per-question timing
- AI-generated question audio playback
- Microphone-based audio recording
- Speech-to-text transcription of recorded answers
- Editable transcripts before answer submission
- Direct audio answer submission without manual transcript review
- Recording and microphone cleanup between interview sessions

### Proctoring and Integrity
- Camera-based proctoring with permission handling
- Proctoring session start and termination
- Tab-switch and window-blur detection
- Fullscreen exit warnings
- Copy and paste activity monitoring
- Camera and media stream cleanup when the interview ends or the page changes

### Reports and Dashboard
- Partial progress reports for unfinished interviews
- Completed interview reports with scores and feedback
- Strengths and improvement recommendations
- Detailed interview performance summaries
- PDF report download
- Responsive dashboard and user profile

## Tech Stack

- **Framework:** Next.js App Router
- **Frontend:** React, TypeScript, Tailwind CSS
- **Forms and Validation:** React Hook Form, Zod
- **Icons:** Lucide React
- **Notifications:** react-hot-toast
- **AI Integration:** Backend Gemini integration through API services
- **Audio:** Browser MediaRecorder and microphone APIs
- **Authentication:** Bearer-token-based authenticated API requests
- **Deployment:** Vercel

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_API_BASE_URL=https://your-api-host.example.com
NEXT_PUBLIC_PROFILE_UPDATE_URL=/api/user/profile
```

`NEXT_PUBLIC_API_BASE_URL` should point to your backend API host.

`NEXT_PUBLIC_PROFILE_UPDATE_URL` is optional and should only be configured if the backend supports profile updates.

### 3. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Application Flow

1. Create an account and verify the email address.
2. Sign in and access the dashboard.
3. Start a new interview.
4. Upload a resume and select a target job role and difficulty.
5. The backend validates and parses the resume and generates interview questions.
6. Start the interview with camera-based proctoring.
7. Listen to questions using audio playback when required.
8. Submit answers using text input or microphone recording.
9. For audio answers, either review and edit the generated transcript or submit the recording directly.
10. Complete the interview and review the performance report.
11. Download the report as a PDF when available.

## API Configuration

All API requests are centralized in `src/lib/api.ts`.

The API service handles authenticated requests and attaches the bearer token stored in the browser. Expired sessions are handled by the frontend authentication flow.

### Authentication APIs

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/signup` | Create a new account |
| POST | `/api/auth/verify-email` | Verify email address |
| POST | `/api/auth/login` | Authenticate user |
| POST | `/api/auth/forgot-password` | Request password reset |
| POST | `/api/auth/reset-password` | Reset password |

### User APIs

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/user/dashboard` | Get dashboard data |
| GET | `/api/user/profile` | Get user profile |

### Interview APIs

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/interview/upload-resume` | Upload and validate resume |
| GET | `/api/interview/suggest-job-roles` | Suggest roles based on resume |
| POST | `/api/interview/generate-questions` | Generate interview questions |
| POST | `/api/interview/:interviewId/answer` | Submit a text answer |
| GET | `/api/interview/:interviewId/questions/:questionId/audio` | Retrieve question audio |
| POST | `/api/interview/:interviewId/answer/audio` | Transcribe and submit an audio answer |
| POST | `/api/interview/:interviewId/answer/audio/transcribe` | Transcribe audio into editable text |
| POST | `/api/interview/:interviewId/proctor/start` | Start proctoring |
| POST | `/api/interview/:interviewId/proctor/terminate` | Terminate proctoring |
| GET | `/api/interview/:interviewId/report` | Retrieve interview report |
| GET | `/api/interview/:interviewId/report/download` | Download interview report |

### Audio Answer Workflows

The application supports two audio submission workflows.

**1. Transcribe and review**

- Record an answer using the microphone.
- Upload the recording as `multipart/form-data`.
- Send `questionId` and `audio` to the transcription endpoint.
- Display the returned transcript for editing.
- Submit the reviewed answer through the text answer endpoint.

**2. Direct audio submission**

- Record an answer using the microphone.
- Send `questionId` and `audio` to the direct audio submission endpoint.
- The backend transcribes and submits the answer in one request.

The transcription endpoint accepts:

- `questionId`: string
- `audio`: binary audio recording

The frontend uses `FormData` for these requests. The browser should generate the multipart `Content-Type` boundary automatically.

## AI Integration

AI question generation, resume processing, and audio-related backend processing are handled through backend APIs.

No Gemini API key is required in the frontend.

## Deploying to Vercel

1. Import the repository into Vercel.
2. Configure the production environment variables:

```env
NEXT_PUBLIC_API_BASE_URL=https://your-production-backend.example.com
NEXT_PUBLIC_PROFILE_UPDATE_URL=/api/user/profile
```

3. Deploy using the Vercel dashboard or CLI:

```bash
npx vercel
npx vercel --prod
```

### Deployment Requirements

- The backend must allow requests from the deployed Vercel domain through CORS.
- Camera and microphone access require a secure context, such as HTTPS or localhost.
- The backend must expose the documented API endpoints.
- Audio transcription and question audio generation depend on backend and upstream AI/TTS service availability.
- Profile-photo updates require a backend endpoint that supports profile updates; profile reads alone do not provide this capability.

## Available Commands

```bash
npm run dev
npm run lint
npm run build
npm run start
```

## Project Structure

```text
src/
├── app/
│   ├── (auth)/
│   ├── (dashboard)/
│   ├── auth-enhancements.css
│   ├── globals.css
│   └── ui-enhancements.css
├── components/
│   ├── auth/
│   ├── interview/
│   ├── layout/
│   └── ui/
├── hooks/
├── lib/
└── types/
middleware.ts
```

## Important Notes

- Protected dashboard and interview routes require authentication.
- The application uses a `token` cookie for protected routes.
- The browser also stores authentication and current interview session information in localStorage.
- Camera access is required for active proctoring.
- Microphone access is required for audio recording.
- Media streams should be stopped when recording or proctoring ends.
- Audio playback and transcription depend on backend service availability.
- Partial reports may be available for interviews that are not completed.
- Gemini processing and resume verification are performed by the backend.
