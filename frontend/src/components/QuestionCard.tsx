// Question card: renders a recorded question and the local guidance workflow for sample answers.
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type {
  AnswerSuggestion,
  AnswerGuidanceProvider,
} from "../services/answerGuidance";
import {
  requestAnswerGuidance,
  sampleAnswerGuidanceProvider,
} from "../services/answerGuidance";
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
  isBusy?: boolean;
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
  isBusy = false,
  children,
  guidanceProvider = sampleAnswerGuidanceProvider,
}: QuestionCardProps) {
  const [isSuggestionOpen, setIsSuggestionOpen] = useState(false);
  const [suggestionState, setSuggestionState] = useState<SuggestionState>({
    status: "idle",
  });
  const requestIdRef = useRef(0);
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
  const currentSuggestion =
    suggestionState.status === "success" && suggestionState.contextKey === contextKey
      ? suggestionState.suggestion
      : null;

  useEffect(() => {
    return () => {
      requestIdRef.current += 1;
    };
  }, []);

  // Request handling avoids duplicate work and ensures older responses cannot overwrite newer context.
  async function generateAnswer() {
    if (suggestionState.status === "loading") return;

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setIsSuggestionOpen(true);
    setSuggestionState({ status: "loading" });

    try {
      const suggestion = await guidanceProvider(request);
      if (requestId !== requestIdRef.current) return;
      setSuggestionState({ status: "success", suggestion, contextKey });
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      setSuggestionState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "An answer suggestion could not be generated. Please try again.",
      });
    }
  }

  const isCurrentSuggestionVisible =
    suggestionState.status === "success" && suggestionState.contextKey === contextKey;

  return (
    <article className="question-card">
      {children ?? (
        <>
          <h3 className="question-title">
            {index + 1}. {item.question}
          </h3>
          <div className="card-actions">
            <button className="secondary-button" type="button" onClick={onEdit} disabled={isBusy}>
              Edit question
            </button>
            <button className="danger-button" type="button" onClick={onDelete} disabled={isBusy}>
              Delete question
            </button>
          </div>
          {item.originalAnswer && (
            <details className="optional-answer">
              <summary>Original answer</summary>
              <p className="history-original-answer">{item.originalAnswer}</p>
            </details>
          )}
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
              if (isSuggestionOpen && isCurrentSuggestionVisible) {
                setIsSuggestionOpen(false);
                return;
              }

              if (isCurrentSuggestionVisible) {
                setIsSuggestionOpen(true);
                return;
              }

              void generateAnswer();
            }}
          >
            {isSuggestionOpen && isCurrentSuggestionVisible
              ? "Hide suggestion"
              : isCurrentSuggestionVisible
                ? "Open suggestion"
                : suggestionState.status === "loading"
                  ? "Generating…"
                  : guidanceProvider === requestAnswerGuidance
                    ? "Generate AI answer"
                    : "Generate sample answer"}
          </button>

          <section
            id={panelId}
            className="answer-guidance"
            aria-label={`${guidanceProvider === requestAnswerGuidance ? "AI" : "Sample"} answer suggestion for question ${index + 1}`}
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
            {isCurrentSuggestionVisible && currentSuggestion && (
              <>
                <h4>{guidanceProvider === requestAnswerGuidance ? "Short answer suggestion" : "Sample answer suggestion"}</h4>
                <p className="suggested-answer">
                  {renderHighlightedAnswer(
                    currentSuggestion.suggestedAnswer,
                    currentSuggestion.emphasizedKeywords,
                  )}
                </p>
                {currentSuggestion.missingContext.length > 0 && (
                  <p>
                    To make this specific to you, add: {" "}
                    {currentSuggestion.missingContext.join(", ")}.
                  </p>
                )}
                <div className="card-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => void generateAnswer()}
                  >
                    Regenerate
                  </button>
                </div>
              </>
            )}
            {suggestionState.status === "idle" && (
              <p role="status">No answer suggestion has been generated yet.</p>
            )}
          </section>
        </>
      )}
    </article>
  );
}

export default QuestionCard;
