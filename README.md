# Interview Buddy

Interview Buddy is a React frontend with a Spring Boot API for saved prep
setups, interview history, and on-demand AI answer guidance. The backend uses a
file-based H2 database for local persistence.

## Folder structure

- `frontend/` – Vite + React app
  - `src/App.tsx` – route-driven root shell for home, prep, and history flows
  - `src/App.css` – shared design tokens, layout primitives, and feature styling
  - `src/components/` – render-only screens and focused UI sections
  - `src/hooks/` – setup/history state and persistence hooks
  - `src/services/` – storage adapters, navigation helpers, and future API contracts
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
6. Recorded questions request answer guidance from the Spring API. The backend
   calls the configured OpenAI Responses API and returns structured suggestions;
   generated content remains in frontend state and is not saved to history.

## Local commands

From `frontend/`:

- `npm install`
- `npm run dev` – start the Vite dev server
- `npm run build` – type-check and bundle the production build
- `npm run lint` – run ESLint
- `npm test` – run focused frontend hook tests

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
instructions from a separately saved setup. Resume files remain unuploaded and
unparsed. Generated guidance is not persisted, and users should review and
personalize every suggestion.

In a second PowerShell terminal, run `cd ..\frontend; npm run dev` to launch the
Vite app. Its `/api` requests are proxied to `localhost:8080`.

## Implemented features

- Interview preparation flow with saved setups, setup editing, and mock-session
  placeholders
- Backend-persisted interview history with company/role/resume context, rounds,
  questions, and optional original answers
- On-demand OpenAI answer guidance with relevant keywords and optional original
  answer feedback
- One-time, explicit import of legacy browser interview history with retry-safe
  progress markers
- Backend-persisted prep setups plus an explicit legacy-setup import flow
- Shared resume-file validation and optional context fields
- Pastel visual design and responsive layout updates for desktop and mobile

## Demo limitations

- No company research, JD URL fetching, resume parsing, or code execution is
  connected.
- No authenticated account sync is implemented; local API data is stored in the
  developer's H2 database.
- Files are selected temporarily in-browser and are not uploaded or processed.
- No real mock-interview session engine is implemented.

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
