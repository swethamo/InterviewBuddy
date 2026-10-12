# Interview Buddy

A full-stack interview preparation app built with **React and Spring Boot**.
Save preparation setups, organize past interview questions, practice timed AI
mock interviews, and keep track of interview rounds in one place.

The app uses a file-based **H2 database** for local persistence.

<img width="426" alt="Interview Buddy home page" src="https://github.com/user-attachments/assets/dac412fa-6d18-4ae1-9e18-a9234009797a" />

## Features

### Interview preparation

Create and save preparation setups with company, role, interview type, job
description, resume context, and optional instructions. Revisit saved setups to
edit them or start a mock interview.

<img width="428" alt="Saved interview preparation setups" src="https://github.com/user-attachments/assets/f67321d4-234b-46f8-9170-bc892336cb44" />

<img width="413" alt="Interview preparation setup form" src="https://github.com/user-attachments/assets/7fd15764-3805-4d86-9c22-d16eec0d80d0" />

### Adaptive mock interviews

Choose a 15, 30, 45, or 60-minute session and explicitly start when ready. The
backend uses the saved role, interview round, job description, extracted resume
text, and instructions to plan topics and generate one question at a time.
Adaptive follow-ups respond to submitted answers and are limited so the session
can progress across topics.

Sessions, answers, topic coverage, deadline, and review are persisted. The
countdown is deadline-based and resumes accurately after refresh. Type an answer
or use browser speech recognition to create an editable transcript; recording
never submits automatically. Reviews summarize covered and unreached topics,
strengths, practice areas, and answer-grounded feedback.

### Interview history

Organize past interviews by company and role. Record interview rounds, questions
asked, and original answers, with optional resume context.

<img width="422" alt="Interview history with rounds and recorded questions" src="https://github.com/user-attachments/assets/793a595c-cf10-4e06-af17-7dce82b52c64" />

### Resume context

Select a PDF or DOCX resume to extract editable text in the browser, or paste
resume context directly into a setup. The file itself is not uploaded; extracted
text and the filename are saved as preparation context. Scanned/image-only PDFs
may need text pasted manually.

<img width="406" alt="Resume selection and optional context fields" src="https://github.com/user-attachments/assets/ca2670a8-cbb6-4eb4-9e90-95244ac14ff4" />

### AI answer guidance

Generate suggested answers and relevant keywords for recorded interview
questions, with optional feedback on an original answer.

<img width="425" alt="Recommended answer and suggested keywords" src="https://github.com/user-attachments/assets/55e96940-b4c5-4dd2-ad48-befee4a5d1ed" />

<img width="383" alt="Additional answer guidance" src="https://github.com/user-attachments/assets/4b4948d4-1616-4c74-9c04-2a6fcaa576ce" />

### Responsive interface

A pastel visual design with layouts adapted for desktop and mobile.

## Tech stack

| Layer | Technology | Purpose |
| --- | --- | --- |
| Frontend | React, TypeScript, Vite | User interface, type checking, and development tooling |
| Backend | Java, Spring Boot | API for preparation setups, history, and mock interviews |
| Database | H2 | File-based local persistence |
| AI | OpenAI Responses API | Backend-only question, review, and answer generation |
| Code quality | ESLint | Frontend linting |

## Run locally

Run the backend and frontend in separate PowerShell terminals from the project
root.

### 1. Configure AI

Mock interviews and answer guidance require a backend OpenAI API key:

```powershell
$env:ANSWER_GENERATION_PROVIDER = "openai"
$env:OPENAI_API_KEY = "<your OpenAI API key>"
$env:ANSWER_GENERATION_MODEL = "gpt-4.1-mini"
```

The key is backend-only. Do not put it in frontend environment variables or
commit it to the repository. The model must support strict structured output.
Optionally set `OPENAI_BASE_URL` or `ANSWER_GENERATION_TIMEOUT`.

### 2. Start the backend

```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

The API runs on port **8080**.

### 3. Start the frontend

Open a second terminal from the project root:

```powershell
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite. Keep both terminals running while using the
app. If AI configuration is missing, the mock-interview screen explains what is
needed before enabling session start.

## Mock interview details

Select **Start mock interview** from a saved setup. The timer begins only after
the backend creates the session and opening question. The persisted deadline
prevents refresh from resetting or extending the selected duration. If question
generation fails after an answer was saved, use **Retry next question**; the
answer remains part of the interview.

The interview plan is internal: only the current question is returned during
an active session. Early finish or expiry ends questioning and saves a review.
Past reviews are available from the saved setup.

Voice input uses the browser's native
`SpeechRecognition`/`webkitSpeechRecognition` API. Browser support and
microphone permissions vary; typed answers remain available as a fallback.
Review and edit the transcript before submitting. The app does not store audio;
speech recognition may use browser-provided services, subject to the browser
vendor's privacy terms.

Job-description links are not fetched. Paste the job description text into the
setup to include it in interview context.

## Build, lint, and test

From `frontend/`:

```powershell
npm run build
npm run lint
npm test
```

From `backend/`:

```powershell
.\mvnw.cmd test
```

Backend tests use an isolated, in-memory H2 database.

## Current limitations

- Company research, job-description URL fetching, code execution, and
  authenticated account sync are not connected.
- Speech recognition depends on browser support and microphone permissions.
- Local API data is stored in the developer's H2 database.
