// History models: persisted API records shared by the history UI, hook, and import adapter.
export type InterviewQuestion = {
  id: string;
  question: string;
  originalAnswer?: string;
};

export type InterviewRound = {
  id: string;
  name: string;
  date: string;
  questions: InterviewQuestion[];
};

export type InterviewRecord = {
  id: string;
  company: string;
  role: string;
  resumeText: string;
  rounds: InterviewRound[];
};

// Legacy localStorage parsing remains isolated for the explicit import flow.
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isQuestion(value: unknown): value is InterviewQuestion {
  if (!isObject(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.question === "string" &&
    (value.originalAnswer === undefined ||
      typeof value.originalAnswer === "string")
  );
}

function isRound(value: unknown): value is InterviewRound {
  if (!isObject(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    (value.date === undefined || typeof value.date === "string") &&
    Array.isArray(value.questions) &&
    value.questions.every(isQuestion)
  );
}

function isRecord(value: unknown): value is InterviewRecord {
  if (!isObject(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.company === "string" &&
    typeof value.role === "string" &&
    (value.resumeText === undefined || typeof value.resumeText === "string") &&
    Array.isArray(value.rounds) &&
    value.rounds.every(isRound)
  );
}

export function parseInterviewRecords(value: unknown): InterviewRecord[] | null {
  if (!Array.isArray(value) || !value.every(isRecord)) return null;

  return value.map((record) => ({
    ...record,
    resumeText: record.resumeText ?? "",
    rounds: record.rounds.map((round) => ({
      ...round,
      date: round.date ?? "",
      questions: round.questions.map((question) => ({
        ...question,
        originalAnswer: question.originalAnswer ?? "",
      })),
    })),
  }));
}
