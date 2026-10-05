import { useState } from "react";
import type { ReactNode } from "react";
import type {
  AnswerSuggestion,
  AnswerGuidanceProvider,
} from "../services/answerGuidance";
import { requestAnswerGuidance } from "../services/answerGuidance";
import type { InterviewQuestion } from "../types/interviewHistory";

type QuestionCardProps = {
  item: InterviewQuestion;
  index: number;
  company: string;
  role: string;
  round: string;
  resumeText: string;
  onEdit: () => void;
  onDelete: () => void;
  children?: ReactNode;
  guidanceProvider?: AnswerGuidanceProvider;
};

type SuggestionState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "success";
      suggestion: AnswerSuggestion;
      contextKey: string;
    };

function renderHighlightedAnswer(answer: string, keywords: string[]) {
  const terms = [...new Set(keywords.map((keyword) => keyword.trim()).filter(Boolean))];
  if (terms.length === 0) return answer;

  const escapedTerms = terms
    .sort((first, second) => second.length - first.length)
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts = answer.split(new RegExp(`(${escapedTerms.join("|")})`, "gi"));
  const keywordSet = new Set(terms.map((term) => term.toLocaleLowerCase()));

  return parts.map((part, partIndex) =>
    keywordSet.has(part.toLocaleLowerCase()) ? (
      <strong key={`${partIndex}-${part}`}>{part}</strong>
    ) : (
      part
    ),
  );
}

function QuestionCard({
  item,
  index,
  company,
  role,
  round,
  resumeText,
  onEdit,
  onDelete,
  children,
  guidanceProvider = requestAnswerGuidance,
}: QuestionCardProps) {
  const [isSuggestionOpen, setIsSuggestionOpen] = useState(false);
  const [suggestionState, setSuggestionState] = useState<SuggestionState>({
    status: "idle",
  });
  const panelId = `answer-suggestion-${item.id}`;
  const request = {
    company,
    role,
    round,
    question: item.question,
    answerStyle: "very-short" as const,
    ...(resumeText.trim() ? { resumeText } : {}),
  };
  const contextKey = JSON.stringify(request);

  async function generateAnswer() {
    setIsSuggestionOpen(true);
    setSuggestionState({ status: "loading" });

    try {
      const suggestion = await guidanceProvider(request);
      setSuggestionState({ status: "success", suggestion, contextKey });
    } catch (error) {
      setSuggestionState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "An answer suggestion could not be generated. Please try again.",
      });
    }
  }

  return (
    <article className="question-card">
      {children ?? (
        <>
          <h3 className="question-title">
            {index + 1}. {item.question}
          </h3>
          <div className="card-actions">
            <button className="secondary-button" type="button" onClick={onEdit}>
              Edit question
            </button>
            <button className="danger-button" type="button" onClick={onDelete}>
              Delete question
            </button>
          </div>
        </>
      )}

      {!children && (
        <>
          <button
            className="guidance-button"
            type="button"
            aria-expanded={isSuggestionOpen}
            aria-controls={panelId}
            onClick={() => {
              if (isSuggestionOpen) {
                setIsSuggestionOpen(false);
              } else {
                void generateAnswer();
              }
            }}
          >
            {isSuggestionOpen ? "Hide AI answer" : "Generate AI answer"}
          </button>

          <section
            id={panelId}
            className="answer-guidance"
            aria-label={`AI answer suggestion for question ${index + 1}`}
            aria-live="polite"
            hidden={!isSuggestionOpen}
          >
        {suggestionState.status === "loading" && (
          <p role="status">Generating a short answer suggestion…</p>
        )}
        {suggestionState.status === "error" && (
          <div role="status">
            <p>{suggestionState.message}</p>
            <button
              className="secondary-button"
              type="button"
              onClick={() => void generateAnswer()}
            >
              Retry
            </button>
          </div>
        )}
        {suggestionState.status === "success" &&
          suggestionState.contextKey === contextKey && (
            <>
              <h4>Short answer suggestion</h4>
              <p className="suggested-answer">
                {renderHighlightedAnswer(
                  suggestionState.suggestion.suggestedAnswer,
                  suggestionState.suggestion.emphasizedKeywords,
                )}
              </p>
              {suggestionState.suggestion.missingContext.length > 0 && (
                <p>
                  To make this specific to you, add:{" "}
                  {suggestionState.suggestion.missingContext.join(", ")}.
                </p>
              )}
            </>
          )}
        {suggestionState.status === "success" &&
          suggestionState.contextKey !== contextKey && (
            <div role="status">
              <p>The interview context changed. Generate a fresh suggestion.</p>
              <button
                className="secondary-button"
                type="button"
                onClick={() => void generateAnswer()}
              >
                Refresh suggestion
              </button>
            </div>
          )}
        {suggestionState.status === "idle" && (
          <p role="status">AI answer generation is not connected yet.</p>
        )}
          </section>
        </>
      )}
    </article>
  );
}

export default QuestionCard;
