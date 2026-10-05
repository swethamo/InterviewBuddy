import {
  parseInterviewRecords,
  type InterviewRecord,
} from "../types/interviewHistory";

const STORAGE_KEY = "interview-history-v1";

export type HistoryLoadResult =
  | { status: "ready"; records: InterviewRecord[] }
  | { status: "malformed"; records: []; error: string }
  | { status: "unavailable"; records: []; error: string };

export type HistorySaveResult =
  | { status: "saved" }
  | { status: "failed"; error: string };

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

export function saveInterviewHistory(
  records: InterviewRecord[],
): HistorySaveResult {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    return { status: "saved" };
  } catch {
    return {
      status: "failed",
      error: "Browser storage could not save your history. Check available storage and try again.",
    };
  }
}
