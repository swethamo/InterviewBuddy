# Interview Buddy

Interview Buddy is a React frontend with a Spring Boot API for saved prep
setups and interview history. The backend uses a file-based H2 database for
local persistence; answer guidance remains a clearly labeled demo.

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

In a second PowerShell terminal, run `cd ..\frontend; npm run dev` to launch the
Vite app. Its `/api` requests are proxied to `localhost:8080`.

## Implemented features

- Interview preparation flow with saved setups, setup editing, and mock-session
  placeholders
- Backend-persisted interview history with company/role/resume context, rounds,
  questions, and optional original answers
- One-time, explicit import of legacy browser interview history with retry-safe
  progress markers
- Backend-persisted prep setups plus an explicit legacy-setup import flow
- Shared resume-file validation and optional context fields
- Deterministic answer-suggestion sample provider for UI development
- Pastel visual design and responsive layout updates for desktop and mobile

## Demo limitations

- No real AI generation, company research, JD fetching, resume parsing, or code
  execution is connected.
- No authenticated account sync is implemented; local API data is stored in the
  developer's H2 database.
- Files are selected temporarily in-browser and are not uploaded or processed.
- No real mock-interview session engine is implemented.

## Future backend integration points

Remaining integrations can be connected through the service layer without disturbing
the current history CRUD:

- `src/services/answerGuidance.ts` – swap the sample provider for a real model
  client and structured answer-generation contract
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
