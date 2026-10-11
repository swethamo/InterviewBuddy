# Interview Buddy

A full-stack interview preparation app built with **React and Spring Boot**. Save preparation setups, organize past interview questions, and keep track of interview rounds in one place.

The app uses a file-based **H2 database** for local persistence.

<img width="426" alt="Interview Buddy home page" src="https://github.com/user-attachments/assets/dac412fa-6d18-4ae1-9e18-a9234009797a" />

## Features

### Interview preparation

Create and save preparation setups with company, role, interview type, job description, and optional instructions. Revisit saved setups and open the mock interview screen.

> The mock interview screen is a placeholder. An interactive interview engine is not yet connected.

<img width="428" alt="Saved interview preparation setups" src="https://github.com/user-attachments/assets/f67321d4-234b-46f8-9170-bc892336cb44" />

<img width="413" alt="Interview preparation setup form" src="https://github.com/user-attachments/assets/7fd15764-3805-4d86-9c22-d16eec0d80d0" />

### Interview history

Organize past interviews by company and role. Record interview rounds, questions asked, and original answers, with optional resume context.

<img width="422" alt="Interview history with rounds and recorded questions" src="https://github.com/user-attachments/assets/793a595c-cf10-4e06-af17-7dce82b52c64" />

### Resume selection and optional context

Select a resume with shared file validation and add context to your preparation setup.

<img width="406" alt="Resume selection and optional context fields" src="https://github.com/user-attachments/assets/ca2670a8-cbb6-4eb4-9e90-95244ac14ff4" />

### Demo answer guidance

Explore sample recommended answers and suggested keywords through the answer guidance interface.

<img width="425" alt="Demo recommended answer and suggested keywords" src="https://github.com/user-attachments/assets/55e96940-b4c5-4dd2-ad48-befee4a5d1ed" />

<img width="383" alt="Additional demo answer guidance" src="https://github.com/user-attachments/assets/4b4948d4-1616-4c74-9c04-2a6fcaa576ce" />

### Responsive interface

A pastel visual design with layouts adapted for desktop and mobile.

## Tech stack

| Layer | Technology | Purpose |
| --- | --- | --- |
| Frontend | React, TypeScript, Vite | User interface, type checking, and development tooling |
| Backend | Java, Spring Boot | API for preparation setups and interview history |
| Database | H2 | File-based local persistence |
| Code quality | ESLint | Frontend linting |

## How it works

- The React frontend sends `/api` requests to the Spring Boot backend.
- During development, Vite proxies those requests to `localhost:8080`.
- The backend stores saved preparation setups and interview history in a local, file-based H2 database.
- Answer guidance uses a separate demo service that can later be replaced with a real model integration.

## Run locally

Run the backend and frontend in separate terminals. The commands below use **Windows PowerShell**.

### 1. Start the backend

From the project root:

```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

The API runs on port **8080**.

### 2. Start the frontend

Open a second terminal from the project root:

```powershell
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite. Keep both terminals running while using the app.

### Build, lint, and test

From `frontend/`:

```powershell
npm run build
npm run lint
npm test
```

| Command | Purpose |
| --- | --- |
| `npm run build` | Type-check and create the production bundle |
| `npm run lint` | Run ESLint |
| `npm test` | Run focused frontend hook tests |

From `backend/`:

```powershell
.\mvnw.cmd test
```

Backend tests use an isolated, in-memory H2 database.

## Planned improvements

- Connect a real AI provider for answer guidance and keyword suggestions.
- Build interactive mock interview sessions.
- Add resume parsing, job description fetching, and company research.
- Introduce authentication and account-based data sync.
- Add code execution support for coding practice.
