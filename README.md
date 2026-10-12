# Interview Buddy

Interview Buddy is a React frontend with a Spring Boot API for saved prep
setups, timed AI mock interviews, interview history, and on-demand AI answer
guidance. The backend uses a file-based H2 database for local persistence.

## Folder structure

- `frontend/` – Vite + React app
  - `src/App.tsx` – route-driven root shell for home, prep, and history flows
  - `src/App.css` – shared design tokens, layout primitives, and feature styling
  - `src/components/` – render-only screens and focused UI sections
  - `src/hooks/` – setup/history state and persistence hooks
  - `src/services/` – typed API clients, navigation helpers, and resume extraction
  - `src/types/` – shared domain models for persisted records and setup data
  - `src/index.css` – base resets and global typography rules
- `backend/` – Spring Boot 4.1.1 / Java 21 API and JPA persistence
  - `src/main/java/com/swetha/backend/prep/` – saved preparation setup API
  - `src/main/java/com/swetha/backend/history/` – interview, round, and question API
  - `src/main/resources/application.properties` – file-backed H2 configuration
- `README.md` – repo overview and local development notes

## Data flow

1. The app reads the current hash route and decides which screen to display.
2. Prep and history hooks request the backend through typed service modules.
3. The API validates and normalizes requests, then persists records through JPA
   to the file-based H2 database. Nested history belongs to its interview and
   round, including cascade deletion and persisted ordering.
4. Hash routes identify selected interviews and rounds. The frontend loads the
   record list before resolving deep links, so refresh and Back/Forward remain
   consistent.
5. Existing local interview history remains untouched until the user explicitly
   imports it. Stable legacy IDs make a partially retried import idempotent.
6. Mock interviews snapshot a saved setup and persist the internal topic plan,
   question/answer turns, deadline, topic coverage, and final answer-grounded
   review in the backend. The UI restores the latest session or opens a saved
   review for that setup.
7. Mock-interview planning, adaptive question generation, and review use the
   backend-only OpenAI Responses API. Only the current question is returned
   while a session is active; planned future questions are never generated or
   displayed in advance.
8. Recorded questions request answer guidance from the Spring API. Generated
   answer guidance remains in frontend state and is not saved to history.

## Local commands

From `frontend/`:

- `npm install`
- `npm run dev` – start the Vite dev server
- `npm run build` – type-check and bundle the production build
- `npm run lint` – run ESLint
- `npm test` – run frontend hook and mock-interview component tests

From `backend/`:

- `.\mvnw.cmd spring-boot:run` – start the API on port 8080
- `.\mvnw.cmd test` – run backend tests using an isolated in-memory H2 database

## AI answer generation

Answer generation uses the official OpenAI Responses API from the backend. Set
the provider and API key in the backend process environment before starting
Spring Boot. For example, in PowerShell from `backend/`:

```powershell
$env:ANSWER_GENERATION_PROVIDER = "openai"
$env:OPENAI_API_KEY = "<your OpenAI API key>"
$env:ANSWER_GENERATION_MODEL = "gpt-4.1-mini"
$env:ANSWER_GENERATION_TIMEOUT = "25s"
.\mvnw.cmd spring-boot:run
```

Configuration variables:

- `ANSWER_GENERATION_PROVIDER` – set to `openai`; when unset, generation
  responds with “Answer generation is not configured.”
- `OPENAI_API_KEY` – required backend-only API key. Never put it in frontend
  code, a `VITE_*` variable, or a committed file.
- `ANSWER_GENERATION_MODEL` – OpenAI model name; defaults to `gpt-4.1-mini`.
- `OPENAI_BASE_URL` – optional API base URL; defaults to
  `https://api.openai.com/v1`.
- `ANSWER_GENERATION_TIMEOUT` – optional provider request timeout; defaults to
  `25s`.

The frontend does not need provider settings or a provider key. To manually test,
start the backend with the environment above, start the frontend as described in
Local commands, open Interview History, record/select a question with an
original answer, and choose **Generate Answer**. Confirm the generated answer,
relevant keywords, and explanation are shown; try again after clearing the
backend provider configuration to see the actionable configuration error.

The history feature has no linkage to saved preparation setups. Therefore the
first version sends the history question, company, role, round, and optional
original answer; it does not infer interview type, job description, or extra
instructions from a separately saved setup. Generated guidance is not
persisted, and users should review and personalize every suggestion.

In a second PowerShell terminal, run `cd ..\frontend; npm run dev` to launch the
Vite app. Its `/api` requests are proxied to `localhost:8080`.

## Mock interviews

Open a saved setup and choose **Start mock interview**. Select 15, 30, 45, or
60 minutes (30 minutes is the default), then explicitly start the session. The
countdown begins only after the backend has created the session and its opening
question. The server deadline is persisted, so refreshing or returning to the
setup does not reset the timer. Submitted answers survive AI errors; use
**Retry next question** to continue after a temporary provider failure.

The backend plans role- and round-specific topics, asks one question at a time,
limits adaptive follow-ups, and saves a review after an early finish or expiry.
Earlier reviews remain available under **Past mock interviews** for the saved
setup. The review distinguishes submitted answers from unanswered/skipped
questions and includes relevance, clarity, completeness, technical-accuracy,
and improvement feedback for each submitted answer.

PDF and DOCX resumes are parsed in the browser when selected in the saved
setup. Extracted text is editable and is saved as setup context; the resume file
itself is not uploaded. Scanned/image-only PDFs need text pasted manually.
Job-description links are not fetched, so paste the job-description text into
the setup to include its contents in interview context.

Voice input uses the browser's native `SpeechRecognition`/`webkitSpeechRecognition`
API. Browser support and microphone permissions vary. Recognition is not
available in every browser; typed answers remain available as a fallback.
Stopping recognition does not submit the answer. Review and edit the transcript
in the answer field, then submit it explicitly. The app does not store audio.
Speech recognition may use browser-provided services; consult the browser
vendor's privacy terms.

AI setup is shared with answer guidance:

- `ANSWER_GENERATION_PROVIDER=openai`
- `OPENAI_API_KEY=<backend-only key>`
- `ANSWER_GENERATION_MODEL=gpt-4.1-mini` (or another Responses API model that
  supports strict structured output)
- optional `OPENAI_BASE_URL` and `ANSWER_GENERATION_TIMEOUT`

If provider configuration is missing or unsupported, the mock-interview screen
explains that before allowing a session to start. Do not put credentials in
frontend environment variables or committed files.

## Implemented features

- Interview preparation flow with saved setups, setup editing, and persistent,
  timed, adaptive mock interviews
- Backend-persisted interview history with company/role/resume context, rounds,
  questions, and optional original answers
- On-demand OpenAI answer guidance with relevant keywords and optional original
  answer feedback
- One-time, explicit import of legacy browser interview history with retry-safe
  progress markers
- Backend-persisted prep setups plus an explicit legacy-setup import flow
- Browser-side PDF/DOCX resume text extraction and editable saved context
- Pastel visual design and responsive layout updates for desktop and mobile

## Demo limitations

- No company research, JD URL fetching, or code execution is connected.
- No authenticated account sync is implemented; local API data is stored in the
  developer's H2 database.
- Resume files are selected temporarily and parsed in-browser; only extracted
  text and the filename are saved in the setup.
- Mock interview voice input depends on browser speech-recognition support and
  permissions; typed answers work without a microphone.

## Future integration points

Remaining integrations can be connected through the service layer without
disturbing the current history CRUD:

- `src/services/prepSetupApi.ts` and `src/services/interviewHistoryApi.ts` –
  add authenticated sync or adapt the API transport if deployment requires it
- `src/services/historyNavigation.ts` – keep the URL and in-app navigation state
  aligned for app-level routing and deep links
- `src/services/interviewTypes.ts` – extend the shared interview-type values if
  new workflow options are added

## Notes on maintaining this repo

The frontend is intentionally built to separate domain data from UI-only state.
Persisted models and service contracts live in shared modules, while form drafts and
component-specific state stay local. This keeps the codebase easier to extend as
backend services and richer state management are added later.
