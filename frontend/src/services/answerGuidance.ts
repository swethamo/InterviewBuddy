// Typed client for backend answer generation; provider credentials remain server-side.
export type AnswerGuidanceRequest = {
  company: string;
  role: string;
  round?: string;
  question: string;
  interviewType?: string;
  jobDescription?: string;
  additionalInstructions?: string;
  originalAnswer?: string;
};

export type AnswerSuggestion = {
  suggestedAnswer: string;
  emphasizedKeywords: string[];
  strengtheningExplanation: string | null;
};

export type AnswerGuidanceProvider = (
  request: AnswerGuidanceRequest,
) => Promise<AnswerSuggestion>;

type AnswerGuidanceApiResponse = {
  suggestedAnswer?: unknown;
  relevantKeywords?: unknown;
  strengtheningExplanation?: unknown;
};

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown };
    if (typeof body.message === "string" && body.message.trim()) {
      return body.message;
    }
  } catch {
    // Proxies may return a non-JSON error body.
  }
  return `Answer generation failed (HTTP ${response.status}).`;
}

export const requestAnswerGuidance: AnswerGuidanceProvider = async (request) => {
  const response = await fetch("/api/answer-guidance", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const result = (await response.json()) as AnswerGuidanceApiResponse;
  if (
    typeof result.suggestedAnswer !== "string" ||
    !result.suggestedAnswer.trim() ||
    !isStringArray(result.relevantKeywords) ||
    !(
      result.strengtheningExplanation === null ||
      typeof result.strengtheningExplanation === "string"
    )
  ) {
    throw new Error("The answer generation service returned an invalid response.");
  }

  return {
    suggestedAnswer: result.suggestedAnswer,
    emphasizedKeywords: result.relevantKeywords,
    strengtheningExplanation: result.strengtheningExplanation,
  };
};
