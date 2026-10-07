// Interview types: keeps the UI labels and persisted machine values in sync.
export const INTERVIEW_TYPE_OPTIONS = [
  { value: "recruiter-call", label: "Recruiter call" },
  { value: "hiring-manager", label: "Hiring Manager interview" },
  { value: "technical", label: "Technical interview" },
  { value: "behavioral", label: "HR / Behavioral interview" },
  { value: "live-coding", label: "Live coding" },
  { value: "assessment", label: "Online assessment" },
  { value: "other", label: "Other" },
] as const;

export type InterviewTypeValue =
  (typeof INTERVIEW_TYPE_OPTIONS)[number]["value"];

const LEGACY_INTERVIEW_TYPE_LABELS: Record<string, InterviewTypeValue> = {
  "Recruiter call": "recruiter-call",
  "Hiring Manager interview": "hiring-manager",
  "Technical interview": "technical",
  "HR / Behavioral interview": "behavioral",
  "Live coding": "live-coding",
  "Online assessment": "assessment",
  Other: "other",
};

export function normalizeInterviewType(
  value: string | undefined | null,
  fallback: InterviewTypeValue = "recruiter-call",
): InterviewTypeValue {
  if (!value) return fallback;

  const trimmed = value.trim();
  if (!trimmed) return fallback;

  const knownValue = INTERVIEW_TYPE_OPTIONS.find(
    (option) => option.value === trimmed || option.label === trimmed,
  );
  if (knownValue) return knownValue.value;

  const legacyValue = LEGACY_INTERVIEW_TYPE_LABELS[trimmed];
  if (legacyValue) return legacyValue;

  return trimmed === "Other" ? "other" : fallback;
}

export function getInterviewTypeLabel(value: string | null | undefined) {
  const normalized = normalizeInterviewType(value, "recruiter-call");
  const match = INTERVIEW_TYPE_OPTIONS.find(
    (option) => option.value === normalized,
  );
  return match?.label ?? "Recruiter call";
}
