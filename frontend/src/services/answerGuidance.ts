// Guidance contract: defines the question context and the backend-ready answer response shape.
export type AnswerGuidanceRequest = {
  company: string;
  role: string;
  round: string;
  question: string;
  answerStyle: "very-short";
  resumeText?: string;
};

export type AnswerSuggestion = {
  suggestedAnswer: string;
  emphasizedKeywords: string[];
  missingContext: string[];
};

export type AnswerGuidanceProvider = (
  request: AnswerGuidanceRequest,
) => Promise<AnswerSuggestion>;

export class GuidanceUnavailableError extends Error {
  constructor() {
    super("AI answer generation is not connected yet.");
    this.name = "GuidanceUnavailableError";
  }
}

export const sampleAnswerGuidanceProvider: AnswerGuidanceProvider = async (
  request,
) => {
  const normalizedQuestion = request.question.trim();
  const keywords = [
    request.role,
    request.company,
    request.round,
    ...normalizedQuestion
      .split(/\s+/)
      .filter((word) => word.length > 4)
      .slice(0, 5),
  ].filter(Boolean);

  const answer = `For ${request.role} at ${request.company}, I would start by stating the goal, then explain the trade-offs with a clear example from my relevant experience. I would keep the answer structured, concise, and focused on what mattered most for this ${request.round.toLowerCase()} conversation.`;

  return {
    suggestedAnswer: answer,
    emphasizedKeywords: [...new Set(keywords)].slice(0, 6),
    missingContext: request.resumeText ? [] : ["relevant project examples"],
  };
};

export const requestAnswerGuidance: AnswerGuidanceProvider = async (
  _request,
) => {
  void _request;
  throw new GuidanceUnavailableError();
};
