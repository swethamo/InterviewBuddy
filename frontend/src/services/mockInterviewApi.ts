export type MockInterviewTurn = {
  id: string;
  sequence: number;
  topic: string;
  question: string;
  kind: "MAIN" | "FOLLOW_UP";
  answer: string | null;
  draftAnswer: string | null;
  answeredAt: string | null;
  skipped: boolean;
  feedback: {
    relevance: string;
    clarity: string;
    completeness: string;
    technicalAccuracy: string;
    improvement: string;
  } | null;
};

export type MockInterviewReview = {
  summary: string;
  strengths: string[];
  areasToPractice: string[];
  topicsCovered: string[];
  topicsNotReached: string[];
  turns: MockInterviewTurn[];
};

export type MockInterviewSession = {
  id: string;
  setupId: string;
  status: "IN_PROGRESS" | "COMPLETED" | "EXPIRED";
  durationMinutes: number;
  startedAt: string;
  deadline: string;
  endedAt: string | null;
  company: string;
  role: string;
  interviewType: string;
  interviewTypeOther: string | null;
  jobDescription: string | null;
  jobDescriptionUrl: string | null;
  instructions: string | null;
  resumeContextAvailable: boolean;
  currentQuestionId: string | null;
  currentQuestion: string | null;
  currentTopic: string | null;
  currentQuestionKind: "MAIN" | "FOLLOW_UP" | null;
  conversation: MockInterviewTurn[];
  coveredTopics: string[];
  totalTopics: number;
  followUpsUsed: number;
  review: MockInterviewReview | null;
};

export type MockInterviewAvailability = {
  available: boolean;
  message: string;
};

export type MockInterviewHistorySummary = {
  id: string;
  status: "IN_PROGRESS" | "COMPLETED" | "EXPIRED";
  durationMinutes: number;
  startedAt: string;
  endedAt: string | null;
  company: string;
  role: string;
  answersSubmitted: number;
  reviewAvailable: boolean;
};

const API_URL = "/api/mock-interviews";

async function readApiError(response: Response): Promise<string> {
  try {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = (await response.json()) as { message?: string };
      if (body.message) return body.message;
    }
  } catch {
    // Fall through to a status-based message when an error response is not JSON.
  }
  if (response.status === 404) return "The interview session or setup was not found.";
  if (response.status === 409) return "The interview changed. Refresh the session and try again.";
  if (response.status === 429 || response.status === 503) {
    return "The AI service is busy or unavailable. Please try again shortly.";
  }
  if (response.status === 504) {
    return "The AI service took too long to respond. Your submitted answer is preserved; retry to continue.";
  }
  if (response.status >= 500) {
    return "The interview service could not complete that step. Your submitted answer is preserved; retry to continue.";
  }
  return `The request failed with status ${response.status}.`;
}

async function request<T>(
  url: string,
  init?: RequestInit,
): Promise<T>;
async function request<T>(
  url: string,
  init: RequestInit | undefined,
  allowNoContent: true,
): Promise<T | null>;
async function request<T>(
  url: string,
  init?: RequestInit,
  allowNoContent = false,
): Promise<T | null> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) throw new Error(await readApiError(response));
  if (response.status === 204 && allowNoContent) return null;
  return (await response.json()) as T;
}

export function getMockInterviewAvailability() {
  return request<MockInterviewAvailability>(`${API_URL}/availability`);
}

export function getLatestMockInterview(setupId: string) {
  return request<MockInterviewSession>(
    `${API_URL}/latest?setupId=${encodeURIComponent(setupId)}`,
    undefined,
    true,
  );
}

export function getMockInterviewHistory(setupId: string) {
  return request<MockInterviewHistorySummary[]>(
    `${API_URL}/sessions?setupId=${encodeURIComponent(setupId)}`,
  );
}

export function getMockInterview(sessionId: string) {
  return request<MockInterviewSession>(`${API_URL}/${sessionId}`);
}

export function startMockInterview(setupId: string, durationMinutes: number) {
  return request<MockInterviewSession>(API_URL, {
    method: "POST",
    body: JSON.stringify({ setupId, durationMinutes }),
  });
}

export function saveMockInterviewDraft(
  sessionId: string,
  questionId: string,
  answer: string,
) {
  return request<MockInterviewSession>(`${API_URL}/${sessionId}/draft`, {
    method: "PUT",
    body: JSON.stringify({ questionId, answer }),
  });
}

export function submitMockInterviewAnswer(
  sessionId: string,
  questionId: string,
  answer: string,
) {
  return request<MockInterviewSession>(`${API_URL}/${sessionId}/answers`, {
    method: "POST",
    body: JSON.stringify({ questionId, answer }),
  });
}

export function skipMockInterviewQuestion(
  sessionId: string,
  questionId: string,
) {
  return request<MockInterviewSession>(`${API_URL}/${sessionId}/skip`, {
    method: "POST",
    body: JSON.stringify({ questionId }),
  });
}

export function continueMockInterview(sessionId: string) {
  return request<MockInterviewSession>(`${API_URL}/${sessionId}/continue`, {
    method: "POST",
  });
}

export function endMockInterview(sessionId: string) {
  return request<MockInterviewSession>(`${API_URL}/${sessionId}/end`, {
    method: "POST",
  });
}

export function generateMockInterviewReview(sessionId: string) {
  return request<MockInterviewSession>(`${API_URL}/${sessionId}/review`, {
    method: "POST",
  });
}
