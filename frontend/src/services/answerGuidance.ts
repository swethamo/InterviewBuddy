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

export const requestAnswerGuidance: AnswerGuidanceProvider = async (
  _request,
) => {
  void _request;
  throw new GuidanceUnavailableError();
};
