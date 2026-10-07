// History API: provides typed CRUD requests for records, rounds, and questions.
import type {
  InterviewQuestion,
  InterviewRecord,
  InterviewRound,
} from "../types/interviewHistory";

const API_URL = "/api/interviews";

export type InterviewDraft = Pick<
  InterviewRecord,
  "company" | "role" | "resumeText"
>;

export type RoundDraft = Pick<InterviewRound, "name" | "date">;
export type QuestionDraft = Pick<InterviewQuestion, "question" | "originalAnswer">;

type InterviewApiRecord = {
  id: string;
  company: string;
  role: string;
  resumeText?: string | null;
  rounds?: RoundApiRecord[] | null;
};

type RoundApiRecord = {
  id: string;
  name: string;
  date?: string | null;
  questions?: QuestionApiRecord[] | null;
};

type QuestionApiRecord = {
  id: string;
  question: string;
  originalAnswer?: string | null;
};

export type LegacyInterviewImport = InterviewRecord;

function mapQuestion(question: QuestionApiRecord): InterviewQuestion {
  return {
    id: question.id,
    question: question.question,
    originalAnswer: question.originalAnswer ?? "",
  };
}

function mapRound(round: RoundApiRecord): InterviewRound {
  return {
    id: round.id,
    name: round.name,
    date: round.date ?? "",
    questions: (round.questions ?? []).map(mapQuestion),
  };
}

function mapInterview(interview: InterviewApiRecord): InterviewRecord {
  return {
    id: interview.id,
    company: interview.company,
    role: interview.role,
    resumeText: interview.resumeText ?? "",
    rounds: (interview.rounds ?? []).map(mapRound),
  };
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string };
    if (body.message) return body.message;
  } catch {
    // Some proxy and server failures do not return a JSON body.
  }

  if (response.status === 404) return "That interview history item was not found.";
  if (response.status === 400) return "Please check the entered values and try again.";
  return `The history request failed (HTTP ${response.status}).`;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) throw new Error(await errorMessage(response));
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function interviewUrl(id: string) {
  return `${API_URL}/${encodeURIComponent(id)}`;
}

function roundUrl(interviewId: string, roundId: string) {
  return `${interviewUrl(interviewId)}/rounds/${encodeURIComponent(roundId)}`;
}

function questionUrl(interviewId: string, roundId: string, questionId: string) {
  return `${roundUrl(interviewId, roundId)}/questions/${encodeURIComponent(questionId)}`;
}

export async function listInterviews() {
  const data = await request<InterviewApiRecord[]>(API_URL);
  return data.map(mapInterview);
}

export async function getInterview(id: string) {
  return mapInterview(await request<InterviewApiRecord>(interviewUrl(id)));
}

export async function createInterview(draft: InterviewDraft) {
  return mapInterview(
    await request<InterviewApiRecord>(API_URL, {
      method: "POST",
      body: JSON.stringify(draft),
    }),
  );
}

export async function importLegacyInterview(record: LegacyInterviewImport) {
  const body = {
    company: record.company,
    role: record.role,
    resumeText: record.resumeText,
    legacyImportId: record.id,
    rounds: record.rounds.map((round) => ({
      name: round.name,
      date: round.date || null,
      questions: round.questions.map((question) => ({
        question: question.question,
        originalAnswer: question.originalAnswer,
      })),
    })),
  };
  return mapInterview(
    await request<InterviewApiRecord>(API_URL, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
}

export async function updateInterview(id: string, draft: InterviewDraft) {
  return mapInterview(
    await request<InterviewApiRecord>(interviewUrl(id), {
      method: "PUT",
      body: JSON.stringify(draft),
    }),
  );
}

export function deleteInterview(id: string) {
  return request<void>(interviewUrl(id), { method: "DELETE" });
}

export async function createRound(interviewId: string, draft: RoundDraft) {
  return mapRound(
    await request<RoundApiRecord>(`${interviewUrl(interviewId)}/rounds`, {
      method: "POST",
      body: JSON.stringify({ ...draft, date: draft.date || null }),
    }),
  );
}

export async function updateRound(
  interviewId: string,
  roundId: string,
  draft: RoundDraft,
) {
  return mapRound(
    await request<RoundApiRecord>(roundUrl(interviewId, roundId), {
      method: "PUT",
      body: JSON.stringify({ ...draft, date: draft.date || null }),
    }),
  );
}

export function deleteRound(interviewId: string, roundId: string) {
  return request<void>(roundUrl(interviewId, roundId), { method: "DELETE" });
}

export async function createQuestions(
  interviewId: string,
  roundId: string,
  drafts: QuestionDraft[],
) {
  const records = await request<QuestionApiRecord[]>(
    `${roundUrl(interviewId, roundId)}/questions/batch`,
    {
      method: "POST",
      body: JSON.stringify({ questions: drafts }),
    },
  );
  return records.map(mapQuestion);
}

export async function updateQuestion(
  interviewId: string,
  roundId: string,
  questionId: string,
  draft: QuestionDraft,
) {
  return mapQuestion(
    await request<QuestionApiRecord>(
      questionUrl(interviewId, roundId, questionId),
      {
        method: "PUT",
        body: JSON.stringify(draft),
      },
    ),
  );
}

export function deleteQuestion(
  interviewId: string,
  roundId: string,
  questionId: string,
) {
  return request<void>(questionUrl(interviewId, roundId, questionId), {
    method: "DELETE",
  });
}
