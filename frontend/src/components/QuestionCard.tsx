// Question card: displays a recorded question and its on-demand AI guidance.
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type {
  AnswerGuidanceProvider,
  AnswerGuidanceRequest,
  AnswerSuggestion,
} from "../services/answerGuidance";
import { requestAnswerGuidance } from "../services/answerGuidance";
import type { InterviewQuestion } from "../types/interviewHistory";

type QuestionCardProps = {
  item: InterviewQuestion;
  index: number;
  company: string;
  role: string;
  round: string;
  onEdit: () => void;
  onDelete: () => void;
  isBusy?: boolean;
  children?: ReactNode;
  guidanceProvider?: AnswerGuidanceProvider;
};

type SuggestionState =
  | { status: "idle" }
  | { status: "loading"; contextKey: string }
  | { status: "error"; message: string; contextKey: string }
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
  onEdit,
  onDelete,
  isBusy = false,
  children,
  guidanceProvider = requestAnswerGuidance,
}: QuestionCardProps) {
  const [isSuggestionOpen, setIsSuggestionOpen] = useState(false);
  const [suggestionState, setSuggestionState] = useState<SuggestionState>({
    status: "idle",
  });
  const requestIdRef = useRef(0);
  const activeContextRef = useRef<string | null>(null);
  const panelId = `answer-suggestion-${item.id}`;
  const request: AnswerGuidanceRequest = {
    company,
    role,
    round,
    question: item.question,
    ...(item.originalAnswer?.trim()
      ? { originalAnswer: item.originalAnswer }
      : {}),
  };
  const contextKey = JSON.stringify(request);
  const currentSuggestion =
    suggestionState.status === "success" && suggestionState.contextKey === contextKey
      ? suggestionState.suggestion
      : null;
  const isCurrentRequestLoading =
    suggestionState.status === "loading" &&
    suggestionState.contextKey === contextKey;
  const currentError =
    suggestionState.status === "error" && suggestionState.contextKey === contextKey
      ? suggestionState.message
      : null;
  const isCurrentSuggestionVisible = currentSuggestion !== null;

  useEffect(() => {
    return () => {
      requestIdRef.current += 1;
      activeContextRef.current = null;
    };
  }, []);

  async function generateAnswer() {
    if (activeContextRef.current === contextKey) return;

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    activeContextRef.current = contextKey;
    setIsSuggestionOpen(true);
    setSuggestionState({ status: "loading", contextKey });

    try {
      const suggestion = await guidanceProvider(request);
      if (requestId !== requestIdRef.current) return;
      activeContextRef.current = null;
      setSuggestionState({ status: "success", suggestion, contextKey });
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      activeContextRef.current = null;
      setSuggestionState({
        status: "error",
        contextKey,
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
            disabled={isCurrentRequestLoading}
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
                : isCurrentRequestLoading
                  ? "Generating…"
                  : "Generate Answer"}
          </button>

          <section
            id={panelId}
            className="answer-guidance"
            aria-label={`AI answer guidance for question ${index + 1}`}
            aria-live="polite"
            hidden={!isSuggestionOpen}
          >
            {isCurrentRequestLoading && (
              <p role="status">Generating an answer suggestion…</p>
            )}
            {currentError && (
              <div role="status">
                <p>{currentError}</p>
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
                <h4>AI-generated suggestion</h4>
                <p>Review and personalize this suggestion before using it.</p>
                <p className="suggested-answer">
                  {renderHighlightedAnswer(
                    currentSuggestion.suggestedAnswer,
                    currentSuggestion.emphasizedKeywords,
                  )}
                </p>
                {currentSuggestion.emphasizedKeywords.length > 0 && (
                  <div>
                    <h5>Relevant keywords</h5>
                    <ul aria-label="Relevant keywords">
                      {currentSuggestion.emphasizedKeywords.map((keyword, keywordIndex) => (
                        <li key={`${keywordIndex}-${keyword}`}>{keyword}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {currentSuggestion.strengtheningExplanation && (
                  <p>
                    <strong>How to strengthen your original answer:</strong>{" "}
                    {currentSuggestion.strengtheningExplanation}
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
