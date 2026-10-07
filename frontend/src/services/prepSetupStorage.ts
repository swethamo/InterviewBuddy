// Setup storage: validates older and current saved prep data before returning it to the app.
import { normalizeInterviewType } from "./interviewTypes";
import type { InterviewSetup } from "../types/interviewSetup";

const STORAGE_KEY = "interview-prep-setups-v2";

export type SetupStorageResult =
  | { status: "ready"; setups: InterviewSetup[] }
  | { status: "unavailable"; setups: []; error: string }
  | { status: "malformed"; setups: []; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeSetup(value: unknown): InterviewSetup | null {
  if (!isRecord(value)) return null;

  const id = typeof value.id === "string" ? value.id : "";
  const company = typeof value.company === "string" ? value.company : "";
  const role = typeof value.role === "string" ? value.role : "";
  const interviewType = normalizeInterviewType(
    typeof value.interviewType === "string" ? value.interviewType : undefined,
  );
  const interviewTypeOther =
    typeof value.interviewTypeOther === "string" ? value.interviewTypeOther : "";
  const jobDescription =
    typeof value.jobDescription === "string" ? value.jobDescription : "";
  const jobDescriptionUrl =
    typeof value.jobDescriptionUrl === "string" ? value.jobDescriptionUrl : "";
  const instructions =
    typeof value.instructions === "string" ? value.instructions : "";
  const resumeFileName =
    typeof value.resumeFileName === "string" ? value.resumeFileName : "";
  const resumeText = typeof value.resumeText === "string" ? value.resumeText : "";

  if (!id || !company || !role) return null;

  return {
    id,
    company,
    role,
    interviewType,
    interviewTypeOther: interviewType === "other" ? interviewTypeOther : undefined,
    jobDescription,
    jobDescriptionUrl,
    instructions,
    resumeFileName,
    resumeText,
  };
}

export function loadPrepSetups(): SetupStorageResult {
  let saved: string | null;
  try {
    saved = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return {
      status: "unavailable",
      setups: [],
      error: "Saved prep setups could not be read from this browser.",
    };
  }

  if (saved === null) {
    const legacyKey = "interview-prep-setups-v1";
    try {
      const legacy = window.localStorage.getItem(legacyKey);
      if (!legacy) return { status: "ready", setups: [] };
      const parsed: unknown = JSON.parse(legacy);
      if (!Array.isArray(parsed)) {
        return {
          status: "malformed",
          setups: [],
          error:
            "Saved prep setups have an unexpected format. The saved data has been left untouched.",
        };
      }
      const normalized = parsed
        .map((item) => normalizeSetup(item))
        .filter((item): item is InterviewSetup => item !== null);
      if (normalized.length !== parsed.length) {
        return {
          status: "malformed",
          setups: [],
          error:
            "Saved prep setups include incomplete records and were left untouched.",
        };
      }
      return { status: "ready", setups: normalized };
    } catch {
      return {
        status: "malformed",
        setups: [],
        error:
          "Saved prep setups could not be read. The saved data has been left untouched.",
      };
    }
  }

  try {
    const parsed: unknown = JSON.parse(saved);
    if (!Array.isArray(parsed)) {
      return {
        status: "malformed",
        setups: [],
        error:
          "Saved prep setups have an unexpected format. The saved data has been left untouched.",
      };
    }

    const normalized = parsed
      .map((item) => normalizeSetup(item))
      .filter((item): item is InterviewSetup => item !== null);

    if (normalized.length !== parsed.length) {
      return {
        status: "malformed",
        setups: [],
        error:
          "Saved prep setups include incomplete records and were left untouched.",
      };
    }

    return { status: "ready", setups: normalized };
  } catch {
    return {
      status: "malformed",
      setups: [],
      error:
        "Saved prep setups could not be read. The saved data has been left untouched.",
    };
  }
}

export function savePrepSetups(
  setups: InterviewSetup[],
): { status: "saved" } | { status: "failed"; error: string } {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(setups));
    return { status: "saved" };
  } catch {
    return {
      status: "failed",
      error:
        "The setup is available for this session, but could not be saved in this browser.",
    };
  }
}
