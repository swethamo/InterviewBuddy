// Legacy history storage: reads pre-backend records and stores only import progress markers.
import {
  parseInterviewRecords,
  type InterviewRecord,
} from "../types/interviewHistory";

const STORAGE_KEY = "interview-history-v1";
const IMPORTED_IDS_KEY = "interview-history-imported-v1";

export type HistoryLoadResult =
  | { status: "ready"; records: InterviewRecord[] }
  | { status: "malformed"; records: []; error: string }
  | { status: "unavailable"; records: []; error: string };

export function loadInterviewHistory(): HistoryLoadResult {
  let storedValue: string | null;
  try {
    storedValue = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return {
      status: "unavailable",
      records: [],
      error: "Browser storage could not be read. Your changes may not survive refresh.",
    };
  }

  if (storedValue === null) {
    return { status: "ready", records: [] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(storedValue);
  } catch {
    return {
      status: "malformed",
      records: [],
      error: "Saved interview history could not be read. It has been left untouched.",
    };
  }

  const records = parseInterviewRecords(parsed);
  if (!records) {
    return {
      status: "malformed",
      records: [],
      error: "Saved interview history has an unexpected format. It has been left untouched.",
    };
  }

  return { status: "ready", records };
}

export function parseImportedHistoryIds(): Set<string> {
  try {
    const parsed: unknown = JSON.parse(
      window.localStorage.getItem(IMPORTED_IDS_KEY) ?? "[]",
    );
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((value): value is string => typeof value === "string")
        : [],
    );
  } catch {
    return new Set();
  }
}

export function saveImportedHistoryIds(ids: Set<string>) {
  try {
    window.localStorage.setItem(IMPORTED_IDS_KEY, JSON.stringify([...ids]));
  } catch {
    // Backend import keys still make a retry idempotent if browser storage is unavailable.
  }
}
