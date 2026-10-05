# Interview Buddy

Interview Buddy is an early frontend prototype for organizing interview
preparation and learning from past interviews.

## What it does

- Provides a focused interview-preparation setup for a company, role, and
  interview type, with optional supporting context.
- Lets you keep a history of companies, roles, interview rounds, and questions.
- Lets you add multiple questions at once and review them by interview round.
- Supports selecting a resume file for the current session.

## Current limitations

- Interview history is saved in the browser's local storage. It remains
  available after a refresh in the same browser, but it is not uploaded,
  shared between browsers, or included when this repository is pushed.
- Selected resume files are temporary. They are not uploaded or processed.
- AI answer guidance is not connected yet; the app does not generate answers
  until a backend service is added.
- Interview-preparation setup is currently a session preview, not a saved
  server-side record.

This repository currently contains the frontend prototype only. Backend
services and shared account-based storage can be added in a future version.
