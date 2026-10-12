import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  continueMockInterview,
  endMockInterview,
  generateMockInterviewReview,
  getLatestMockInterview,
  getMockInterviewHistory,
  getMockInterview,
  getMockInterviewAvailability,
  saveMockInterviewDraft,
  skipMockInterviewQuestion,
  startMockInterview,
  submitMockInterviewAnswer,
} from "../services/mockInterviewApi";
import type {
  MockInterviewAvailability,
  MockInterviewSession,
  MockInterviewHistorySummary,
  MockInterviewTurn,
} from "../services/mockInterviewApi";
import {
  getInterviewTypeLabel,
  normalizeInterviewType,
} from "../services/interviewTypes";
import type { InterviewSetup } from "../types/interviewSetup";

type MockInterviewProps = {
  setup: InterviewSetup;
  onBack: () => void;
};

type SpeechResult = {
  isFinal: boolean;
  0: { transcript: string };
};

type SpeechEvent = {
  resultIndex: number;
  results: ArrayLike<SpeechResult>;
};

type SpeechErrorEvent = {
  error: string;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: ((event: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

type BusyAction =
  | "starting"
  | "submitting"
  | "skipping"
  | "continuing"
  | "ending"
  | "review"
  | null;

const DURATIONS = [15, 30, 45, 60] as const;

function draftStorageKey(sessionId: string, questionId: string) {
  return `interviewbuddy.mock-draft.${sessionId}.${questionId}`;
}

function readSavedDraft(sessionId: string, questionId: string) {
  try {
    return window.localStorage.getItem(draftStorageKey(sessionId, questionId)) ?? "";
  } catch {
    return "";
  }
}

function formatRemaining(seconds: number) {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function interviewTypeName(setup: InterviewSetup) {
  return setup.interviewType === "other"
    ? setup.interviewTypeOther || "Other"
    : getInterviewTypeLabel(setup.interviewType);
}

function getSpeechRecognitionConstructor() {
  const speechWindow = window as SpeechWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
}

function MockInterview({ setup, onBack }: MockInterviewProps) {
  const [durationMinutes, setDurationMinutes] = useState<number>(30);
  const [availability, setAvailability] =
    useState<MockInterviewAvailability | null>(null);
  const [session, setSession] = useState<MockInterviewSession | null>(null);
  const [history, setHistory] = useState<MockInterviewHistorySummary[]>([]);
  const [answerDraft, setAnswerDraft] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [recordingMessage, setRecordingMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const transcriptRef = useRef("");
  const timerEndRef = useRef<(() => void) | null>(null);
  const endRequestRef = useRef(false);
  const reviewAttemptedRef = useRef<string | null>(null);

  const currentQuestionId = session?.currentQuestionId ?? null;
  const currentQuestion = session?.currentQuestion ?? null;
  const sessionIsActive = session?.status === "IN_PROGRESS";
  const displayedContext = session ? contextForSession(setup, session) : setup;
  const speechSupported = Boolean(getSpeechRecognitionConstructor());
  const missingContext: string[] = [];
  if (!setup.company.trim()) missingContext.push("company");
  if (!setup.role.trim()) missingContext.push("role");
  if (!setup.interviewType.trim()) missingContext.push("interview type");
  if (
    setup.interviewType === "other" &&
    !setup.interviewTypeOther?.trim()
  ) {
    missingContext.push("a description of the interview type");
  }
  if (setup.resumeFileName && !setup.resumeText.trim()) {
    missingContext.push(
      `extracted text from "${setup.resumeFileName}" (reselect the file in the setup to extract it)`,
    );
  }

  useEffect(() => {
    let mounted = true;
    void getMockInterviewAvailability()
      .then((result) => {
        if (mounted) setAvailability(result);
      })
      .catch((error: unknown) => {
        if (mounted) {
          setAvailability({
            available: false,
            message:
              error instanceof Error
                ? error.message
                : "The interview AI configuration could not be checked.",
          });
        }
      });
    void getLatestMockInterview(setup.id)
      .then((latest) => {
        if (mounted) {
          setSession(latest);
          if (latest?.status === "IN_PROGRESS" && latest.currentQuestionId) {
            const saved =
              latest.conversation.find(
                (turn) => turn.id === latest.currentQuestionId,
              )?.draftAnswer ??
              readSavedDraft(latest.id, latest.currentQuestionId);
            setAnswerDraft(saved);
          }
        }
      })
      .catch((error: unknown) => {
        if (mounted) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "The saved interview session could not be restored.",
          );
        }
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    void getMockInterviewHistory(setup.id)
      .then((items) => {
        if (mounted) setHistory(items);
      })
      .catch((error: unknown) => {
        if (mounted) {
          setErrorMessage(
            error instanceof Error
              ? `Past interview reviews could not be loaded: ${error.message}`
              : "Past interview reviews could not be loaded.",
          );
        }
      });
    return () => {
      mounted = false;
    };
  }, [setup.id]);

  useEffect(() => {
    if (!sessionIsActive || !session) return;

    function updateTimer() {
      const seconds = Math.max(
        0,
        Math.ceil((Date.parse(session!.deadline) - Date.now()) / 1000),
      );
      setRemainingSeconds(seconds);
      if (seconds === 0) timerEndRef.current?.();
    }

    function refreshOnVisibility() {
      if (document.visibilityState === "visible") updateTimer();
    }

    updateTimer();
    const timer = window.setInterval(updateTimer, 1000);
    document.addEventListener("visibilitychange", refreshOnVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshOnVisibility);
    };
  }, [session, sessionIsActive]);

  useEffect(() => {
    if (!sessionIsActive || !session || !currentQuestionId) return;
    const timer = window.setTimeout(() => {
      void saveMockInterviewDraft(
        session.id,
        currentQuestionId,
        answerDraft,
      ).catch((error: unknown) => {
        setErrorMessage(
          error instanceof Error
            ? `Your draft is saved in this browser but not on the server: ${error.message}`
            : "Your draft could not be saved to the server.",
        );
      });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [answerDraft, currentQuestionId, session, sessionIsActive]);

  useEffect(() => {
    if (
      !session ||
      session.status === "IN_PROGRESS" ||
      session.review ||
      reviewAttemptedRef.current === session.id
    ) {
      return;
    }
    reviewAttemptedRef.current = session.id;
    void generateMockInterviewReview(session.id)
      .then(updateSession)
      .catch((error: unknown) => {
        setErrorMessage(
          error instanceof Error
            ? `Your interview is saved, but its review could not be generated: ${error.message}`
            : "Your interview is saved, but its review could not be generated.",
        );
      });
  }, [session]);

  useEffect(
    () => () => {
      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      if (recognition) {
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        recognition.abort();
      }
    },
    [],
  );

  function updateSession(nextSession: MockInterviewSession) {
    setSession(nextSession);
    setErrorMessage("");
    setInterimTranscript("");
    if (nextSession.currentQuestionId) {
      const activeTurn = nextSession.conversation.find(
        (turn) => turn.id === nextSession.currentQuestionId,
      );
      const saved =
        activeTurn?.draftAnswer ??
        readSavedDraft(nextSession.id, nextSession.currentQuestionId);
      setAnswerDraft(saved);
    } else {
      setAnswerDraft("");
    }
  }

  function handleDraftChange(nextDraft: string) {
    setAnswerDraft(nextDraft);
    if (!session || !currentQuestionId) return;
    try {
      const key = draftStorageKey(session.id, currentQuestionId);
      if (nextDraft) window.localStorage.setItem(key, nextDraft);
      else window.localStorage.removeItem(key);
    } catch {
      setErrorMessage(
        "This browser could not save a local draft. Keep this page open or check your browser storage settings.",
      );
    }
  }

  async function handleStart() {
    if (busy || !availability?.available || missingContext.length > 0) return;
    setBusy("starting");
    setErrorMessage("");
    try {
      const started = await startMockInterview(setup.id, durationMinutes);
      updateSession(started);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The interview could not be started. Please try again.",
      );
    } finally {
      setBusy(null);
    }
  }

  function stopRecording() {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    try {
      recognition.stop();
    } catch {
      recognition.abort();
      recognitionRef.current = null;
      setIsRecording(false);
      setRecordingMessage(
        "Recording stopped. You can continue by typing or editing the transcript.",
      );
    }
  }

  function showRecordingError(error: string) {
    const messages: Record<string, string> = {
      "not-allowed":
        "Microphone permission was denied. Allow microphone access in your browser settings, or type your answer instead.",
      "service-not-allowed":
        "Speech recognition is blocked by the browser. Type your answer instead.",
      "audio-capture":
        "No microphone was available. Connect or enable a microphone, or type your answer.",
      "no-speech":
        "No speech was detected. Try recording again or type your answer.",
      network:
        "Speech recognition lost its network connection. Your typed answer is still available.",
      aborted: "Recording was stopped. You can edit the transcript or type an answer.",
    };
    const recognition = recognitionRef.current;
    if (recognition) {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.abort();
    }
    setRecordingMessage(
      messages[error] ??
        "Speech recognition could not transcribe this recording. Type your answer instead.",
    );
    setIsRecording(false);
    setInterimTranscript("");
    recognitionRef.current = null;
  }

  function startRecording() {
    const Recognition = getSpeechRecognitionConstructor();
    if (!Recognition) {
      setRecordingMessage(
        "Speech recognition is not supported in this browser. Type your answer instead.",
      );
      return;
    }
    if (isRecording || !sessionIsActive) return;
    try {
      const recognition = new Recognition();
      recognition.lang = "en-US";
      recognition.continuous = true;
      recognition.interimResults = true;
      transcriptRef.current = answerDraft;
      let receivedSpeech = false;
      recognition.onresult = (event) => {
        let finalText = transcriptRef.current;
        const interim: string[] = [];
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          if (result.isFinal) {
            const spoken = result[0].transcript.trim();
            if (spoken) {
              receivedSpeech = true;
              finalText = `${finalText}${finalText ? " " : ""}${spoken}`;
            }
          } else {
            interim.push(result[0].transcript);
          }
        }
        transcriptRef.current = finalText;
        handleDraftChange(finalText);
        setInterimTranscript(interim.join(" "));
      };
      recognition.onerror = (event) => showRecordingError(event.error);
      recognition.onend = () => {
        recognitionRef.current = null;
        setIsRecording(false);
        setInterimTranscript("");
        if (receivedSpeech) {
          setRecordingMessage(
            "Transcription ready. Review and edit it before submitting.",
          );
        } else {
          setRecordingMessage(
            "No speech was transcribed. Try recording again or type your answer.",
          );
        }
      };
      recognitionRef.current = recognition;
      recognition.start();
      setRecordingMessage("Listening… speak clearly, then select Stop recording.");
      setIsRecording(true);
    } catch {
      const recognition = recognitionRef.current;
      if (recognition) {
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        recognition.abort();
      }
      recognitionRef.current = null;
      setIsRecording(false);
      setRecordingMessage(
        "The microphone could not be started. Check browser permissions or type your answer.",
      );
    }
  }

  async function handleSubmitAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      busy ||
      !session ||
      !currentQuestionId ||
      !answerDraft.trim() ||
      !sessionIsActive
    ) {
      return;
    }
    stopRecording();
    setBusy("submitting");
    setErrorMessage("");
    try {
      const updated = await submitMockInterviewAnswer(
        session.id,
        currentQuestionId,
        answerDraft,
      );
      try {
        window.localStorage.removeItem(
          draftStorageKey(session.id, currentQuestionId),
        );
      } catch {
        // The saved answer is authoritative; an old local draft can be removed later.
      }
      updateSession(updated);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The answer could not be submitted.";
      try {
        const latest = await getMockInterview(session.id);
        updateSession(latest);
        const lastTurn = latest.conversation.at(-1);
        if (lastTurn?.id === currentQuestionId && lastTurn.answer) {
          try {
            window.localStorage.removeItem(
              draftStorageKey(session.id, currentQuestionId),
            );
          } catch {
            // The submitted answer remains authoritative if local cleanup is blocked.
          }
          setErrorMessage(
            `Your answer was saved, but the next question could not be generated. Use Retry next question to continue. ${message}`,
          );
        } else {
          setErrorMessage(message);
        }
      } catch {
        setErrorMessage(
          `${message} Your answer draft remains available on this page.`,
        );
      }
    } finally {
      setBusy(null);
    }
  }

  async function handleSkipQuestion() {
    if (busy || !session || !currentQuestionId || !sessionIsActive) return;
    stopRecording();
    setBusy("skipping");
    setErrorMessage("");
    try {
      const updated = await skipMockInterviewQuestion(
        session.id,
        currentQuestionId,
      );
      updateSession(updated);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "The question could not be skipped.";
      try {
        updateSession(await getMockInterview(session.id));
        setErrorMessage(`${message} You can retry the next question if needed.`);
      } catch {
        setErrorMessage(message);
      }
    } finally {
      setBusy(null);
    }
  }

  async function handleContinue() {
    if (busy || !session || !sessionIsActive) return;
    setBusy("continuing");
    setErrorMessage("");
    try {
      updateSession(await continueMockInterview(session.id));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The next question could not be generated.";
      try {
        updateSession(await getMockInterview(session.id));
        setErrorMessage(`${message} Your submitted answer is preserved; retry when ready.`);
      } catch {
        setErrorMessage(message);
      }
    } finally {
      setBusy(null);
    }
  }

  async function handleEnd(confirmEarly = true) {
    if (endRequestRef.current || !session || !sessionIsActive) return;
    if (
      confirmEarly &&
      remainingSeconds > 0 &&
      !window.confirm("End this mock interview now? Your submitted answers will be saved.")
    ) {
      return;
    }
    endRequestRef.current = true;
    stopRecording();
    setBusy("ending");
    setErrorMessage("");
    try {
      updateSession(await endMockInterview(session.id));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "The interview could not be ended.";
      try {
        updateSession(await getMockInterview(session.id));
        setErrorMessage(`${message} The session is closed; retry the review if needed.`);
      } catch {
        setErrorMessage(message);
      }
    } finally {
      endRequestRef.current = false;
      setBusy(null);
    }
  }

  timerEndRef.current = () => {
    if (sessionIsActive && !endRequestRef.current) {
      void handleEnd(false);
    }
  };

  async function retryReview(showLoading = true) {
    if (!session || session.status === "IN_PROGRESS") return;
    if (showLoading) setBusy("review");
    setErrorMessage("");
    try {
      updateSession(await generateMockInterviewReview(session.id));
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? `Your interview is saved, but its review could not be generated: ${error.message}`
          : "Your interview is saved, but its review could not be generated.",
      );
    } finally {
      if (showLoading) setBusy(null);
    }
  }

  function startAnotherInterview() {
    const previousSession = session;
    setSession(null);
    setAnswerDraft("");
    setRemainingSeconds(0);
    setErrorMessage("");
    reviewAttemptedRef.current = null;
    if (previousSession) {
      void getMockInterviewHistory(setup.id)
        .then(setHistory)
        .catch((error: unknown) => {
          setErrorMessage(
            error instanceof Error
              ? `Past interview reviews could not be loaded: ${error.message}`
              : "Past interview reviews could not be loaded.",
          );
        });
    }
  }

  async function openPastReview(summary: MockInterviewHistorySummary) {
    setBusy("review");
    setErrorMessage("");
    try {
      updateSession(await getMockInterview(summary.id));
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The saved interview review could not be opened.",
      );
    } finally {
      setBusy(null);
    }
  }

  const activeConversation = session?.conversation ?? [];
  const previousTurns = activeConversation.filter(
    (turn) => turn.id !== session?.currentQuestionId,
  );
  const lastTurn = activeConversation.at(-1);
  const waitingToContinue = Boolean(
    sessionIsActive &&
      !session?.currentQuestion &&
      lastTurn &&
      (lastTurn.answer || lastTurn.skipped),
  );

  return (
    <main className="prep-page mock-page">
      <nav className="prep-subnav" aria-label="Interview preparation">
        <button className="back-button" type="button" onClick={onBack}>
          ← Saved setups
        </button>
      </nav>

      <header className="mock-heading">
        <div>
          <span className="eyebrow">MOCK INTERVIEW</span>
          <h1>{displayedContext.company}</h1>
          <p>
            {displayedContext.role} <span aria-hidden="true">·</span>{" "}
            {interviewTypeName(displayedContext)}
          </p>
        </div>
        {sessionIsActive && session ? (
          <div
            className={`mock-timer${remainingSeconds <= 60 ? " is-urgent" : ""}`}
            aria-label={`Time remaining ${formatRemaining(remainingSeconds)}`}
            aria-live="off"
          >
            <span>TIME REMAINING</span>
            <strong>{formatRemaining(remainingSeconds)}</strong>
            <small>Deadline-based countdown</small>
          </div>
        ) : null}
      </header>

      {isLoading && <p className="mock-status-note" role="status">Loading saved interview…</p>}
      {loadError && (
        <p className="storage-warning" role="alert">
          {loadError}
        </p>
      )}

      {!isLoading && !session && (
        <div className="mock-layout">
          <section className="mock-chat mock-start-card" aria-labelledby="mock-start-title">
            <div className="mock-chat-heading">
              <div>
                <span className="section-kicker">GET READY</span>
                <h2 id="mock-start-title">Configure your session</h2>
              </div>
            </div>
            <p>
              Questions will be tailored to your saved setup. Your interview
              timer starts only after the session and its first question are ready.
            </p>
            <label htmlFor="mock-duration">Interview duration</label>
            <select
              id="mock-duration"
              value={durationMinutes}
              onChange={(event) => setDurationMinutes(Number(event.target.value))}
              disabled={busy !== null}
            >
              {DURATIONS.map((duration) => (
                <option key={duration} value={duration}>
                  {duration} minutes{duration === 30 ? " (recommended)" : ""}
                </option>
              ))}
            </select>

            {missingContext.length > 0 && (
              <div className="storage-warning" role="alert">
                <strong>Complete your saved setup before starting:</strong>
                <ul>
                  {missingContext.map((missing) => <li key={missing}>{missing}</li>)}
                </ul>
              </div>
            )}
            {availability && !availability.available && (
              <div className="storage-warning" role="alert">
                <strong>Interview AI is not ready.</strong>
                <p>{availability.message}</p>
              </div>
            )}
            {availability?.available && (
              <p className="mock-ready-note" role="status">
                AI interviewer ready. No questions are generated or timer started
                until you begin.
              </p>
            )}
            {errorMessage && <p className="storage-warning" role="alert">{errorMessage}</p>}
            <button
              type="button"
              onClick={() => void handleStart()}
              disabled={
                busy !== null ||
                !availability?.available ||
                missingContext.length > 0
              }
            >
              {busy === "starting" ? "Preparing interview…" : "Start interview"}
            </button>
          </section>
          <PreparationContext setup={setup} />
        </div>
      )}
      {!isLoading && !session && history.length > 0 && (
        <MockInterviewHistory
          items={history}
          busy={busy !== null}
          errorMessage={errorMessage}
          onOpen={(item) => void openPastReview(item)}
        />
      )}

      {!isLoading && sessionIsActive && session && (
        <div className="mock-layout">
          <section className="mock-chat" aria-labelledby="mock-chat-title">
            <div className="mock-chat-heading">
              <div>
                <h2 id="mock-chat-title">Interview room</h2>
                <span className="connection-status">
                  <span aria-hidden="true" className="connection-dot" />
                  AI interviewer connected
                </span>
              </div>
              <span className="mock-progress">
                {session.coveredTopics.length} of {session.totalTopics} topics covered
              </span>
            </div>

            {previousTurns.length > 0 && (
              <ol className="mock-turn-history" aria-label="Earlier interview questions">
                {previousTurns.map((turn) => (
                  <li key={turn.id} className="mock-turn">
                    <div className="mock-turn-question">
                      <span>{turn.kind === "FOLLOW_UP" ? "FOLLOW-UP" : turn.topic}</span>
                      <strong>{turn.question}</strong>
                    </div>
                    {turn.answer ? (
                      <p className="mock-turn-answer">{turn.answer}</p>
                    ) : (
                      <p className="mock-turn-skipped">
                        {turn.skipped ? "Skipped" : "Answer not submitted"}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            )}

            {currentQuestion ? (
              <>
                <article className="mock-current-question" aria-live="polite">
                  <div className="mock-question-meta">
                    <span>{session.currentQuestionKind === "FOLLOW_UP" ? "FOLLOW-UP" : "NEXT TOPIC"}</span>
                    {session.currentTopic && <span>{session.currentTopic}</span>}
                  </div>
                  <h3>{currentQuestion}</h3>
                </article>

                <form className="mock-answer-form" onSubmit={(event) => void handleSubmitAnswer(event)}>
                  <label htmlFor="mock-response">Your answer</label>
                  <textarea
                    id="mock-response"
                    placeholder="Type your answer, or record it and review the transcript here…"
                    rows={6}
                    value={answerDraft}
                    onChange={(event) => handleDraftChange(event.target.value)}
                    disabled={busy !== null}
                    maxLength={20000}
                  />
                  <div className="mock-answer-meta">
                    <span>{answerDraft.length.toLocaleString()} / 20,000 characters</span>
                    {answerDraft.trim() && <span>Draft saved as you type</span>}
                  </div>

                  <div className="mock-recording-controls">
                    {!isRecording ? (
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={startRecording}
                        disabled={busy !== null || !speechSupported}
                        title={!speechSupported ? "Use a browser with speech recognition or type your answer." : undefined}
                      >
                        Start recording
                      </button>
                    ) : (
                      <button
                        className="danger-button"
                        type="button"
                        onClick={stopRecording}
                      >
                        Stop recording
                      </button>
                    )}
                    <span
                      className={`recording-status${isRecording ? " is-recording" : ""}`}
                      role="status"
                      aria-live="polite"
                    >
                      {isRecording ? "Recording · microphone active" : "Microphone off"}
                    </span>
                  </div>
                  {recordingMessage && (
                    <p className="mock-recording-message" role="status">
                      {recordingMessage}
                    </p>
                  )}
                  {!speechSupported && (
                    <p className="mock-recording-message">
                      Speech recognition is unavailable in this browser. You can
                      still type your answer.
                    </p>
                  )}
                  {interimTranscript && (
                    <p className="mock-interim-transcript" aria-live="polite">
                      Hearing: {interimTranscript}
                    </p>
                  )}

                  {errorMessage && <p className="storage-warning" role="alert">{errorMessage}</p>}
                  <div className="mock-interview-actions">
                    {waitingToContinue ? (
                      <button
                        type="button"
                        onClick={() => void handleContinue()}
                        disabled={busy !== null}
                      >
                        {busy === "continuing" ? "Generating question…" : "Retry next question"}
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={
                          busy !== null ||
                          !answerDraft.trim() ||
                          !currentQuestionId
                        }
                      >
                        {busy === "submitting" ? "Submitting…" : "Submit answer"}
                      </button>
                    )}
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => void handleSkipQuestion()}
                      disabled={busy !== null || !currentQuestionId}
                    >
                      {busy === "skipping" ? "Skipping…" : "Skip question"}
                    </button>
                    <button
                      className="danger-button"
                      type="button"
                      onClick={() => void handleEnd(true)}
                      disabled={busy !== null}
                    >
                      End interview
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="mock-generating-question" role="status" aria-live="polite">
                <span className="mock-loading-indicator" aria-hidden="true" />
                <div>
                  <strong>
                    {busy === "continuing"
                      ? "Choosing the next question…"
                      : "Your answer is saved."}
                  </strong>
                  <p>
                    {busy === "continuing"
                      ? "The interviewer is considering your response and the topics already covered."
                      : "The next question has not been added yet. Retry to continue."}
                  </p>
                </div>
                {errorMessage && <p className="storage-warning" role="alert">{errorMessage}</p>}
                {waitingToContinue && (
                  <button
                    type="button"
                    onClick={() => void handleContinue()}
                    disabled={busy !== null}
                  >
                    {busy === "continuing" ? "Generating question…" : "Retry next question"}
                  </button>
                )}
                <button
                  className="danger-button"
                  type="button"
                  onClick={() => void handleEnd(true)}
                  disabled={busy !== null}
                >
                  End interview
                </button>
              </div>
            )}
          </section>
          <PreparationContext setup={displayedContext} />
        </div>
      )}

      {!isLoading && session && !sessionIsActive && (
        <section className="mock-review-card" aria-labelledby="mock-review-title">
          <div className="mock-review-heading">
            <div>
              <span className="section-kicker">SESSION {session.status === "EXPIRED" ? "ENDED" : "COMPLETE"}</span>
              <h2 id="mock-review-title">Interview review</h2>
            </div>
            <p className="mock-review-duration">
              {session.durationMinutes} minutes ·{" "}
              {session.conversation.filter((turn) => turn.answer).length} answers submitted
            </p>
          </div>
          {session.review ? (
            <>
              <p className="mock-review-summary">{session.review.summary}</p>
              <div className="mock-review-columns">
                <ReviewList title="Strengths" items={session.review.strengths} />
                <ReviewList title="Areas to practice" items={session.review.areasToPractice} />
                <ReviewList title="Topics covered" items={session.review.topicsCovered} />
                <ReviewList
                  title="Topics not reached"
                  items={session.review.topicsNotReached}
                  emptyMessage="All planned topics were reached."
                />
              </div>
              <h3 className="mock-review-answers-title">Questions and answers</h3>
              <ol className="mock-review-turns">
                {session.review.turns.map((turn) => (
                  <ReviewTurn
                    key={turn.id}
                    turn={turn}
                    draft={
                      turn.draftAnswer ||
                      readSavedDraft(session.id, turn.id) ||
                      (turn.id === activeConversation.at(-1)?.id ? answerDraft : "")
                    }
                  />
                ))}
              </ol>
              {errorMessage && <p className="storage-warning" role="alert">{errorMessage}</p>}
              {!session.review && (
                <button
                  type="button"
                  onClick={() => void retryReview(true)}
                  disabled={busy !== null}
                >
                  {busy === "review" ? "Preparing review…" : "Retry review"}
                </button>
              )}
            </>
          ) : (
            <div className="mock-generating-question" role="status">
              <span className="mock-loading-indicator" aria-hidden="true" />
              <p>Saving feedback grounded in your submitted answers…</p>
              {errorMessage && <p className="storage-warning" role="alert">{errorMessage}</p>}
              <button
                type="button"
                onClick={() => void retryReview(true)}
                disabled={busy !== null}
              >
                {busy === "review" ? "Preparing review…" : "Retry review"}
              </button>
            </div>
          )}
          <div className="mock-review-actions">
            <button type="button" onClick={startAnotherInterview}>
              Start another interview
            </button>
            <button className="secondary-button" type="button" onClick={onBack}>
              Back to saved setups
            </button>
          </div>
        </section>
      )}
    </main>
  );
}

function contextForSession(
  setup: InterviewSetup,
  session: MockInterviewSession,
): InterviewSetup {
  return {
    ...setup,
    company: session.company,
    role: session.role,
    interviewType: normalizeInterviewType(session.interviewType),
    interviewTypeOther: session.interviewTypeOther ?? undefined,
    jobDescription: session.jobDescription ?? "",
    jobDescriptionUrl: session.jobDescriptionUrl ?? "",
    instructions: session.instructions ?? "",
    resumeText: session.resumeContextAvailable ? "Saved resume context" : "",
    resumeFileName: session.resumeContextAvailable ? setup.resumeFileName : "",
  };
}

function MockInterviewHistory({
  items,
  busy,
  errorMessage,
  onOpen,
}: {
  items: MockInterviewHistorySummary[];
  busy: boolean;
  errorMessage: string;
  onOpen: (item: MockInterviewHistorySummary) => void;
}) {
  const pastSessions = items.filter((item) => item.status !== "IN_PROGRESS");
  if (pastSessions.length === 0) return null;
  return (
    <section className="mock-history-card" aria-labelledby="mock-history-title">
      <div className="mock-history-heading">
        <div>
          <span className="section-kicker">SAVED SESSIONS</span>
          <h2 id="mock-history-title">Past mock interviews</h2>
        </div>
      </div>
      {errorMessage && <p className="storage-warning" role="alert">{errorMessage}</p>}
      <ul className="mock-history-list">
        {pastSessions.map((item) => (
          <li key={item.id} className="mock-history-item">
            <div>
              <strong>{item.company} · {item.role}</strong>
              <span>
                {new Date(item.startedAt).toLocaleString()} · {item.durationMinutes} min ·{" "}
                {item.answersSubmitted} answers ·{" "}
                {item.status === "EXPIRED" ? "Time expired" : "Finished"}
              </span>
            </div>
            <button
              className="secondary-button"
              type="button"
              onClick={() => onOpen(item)}
              disabled={busy}
            >
              {busy ? "Opening…" : item.reviewAvailable ? "View review" : "Generate review"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PreparationContext({ setup }: { setup: InterviewSetup }) {
  return (
    <aside className="mock-context" aria-labelledby="mock-context-title">
      <h2 id="mock-context-title">Preparation context</h2>
      <div>
        <span>Company</span>
        <strong>{setup.company}</strong>
      </div>
      <div>
        <span>Role</span>
        <strong>{setup.role}</strong>
      </div>
      <div>
        <span>Interview type</span>
        <strong>{interviewTypeName(setup)}</strong>
      </div>
      {setup.resumeText.trim() ? (
        <div>
          <span>Resume context</span>
          <p>Extracted resume text is included in the interview context.</p>
        </div>
      ) : setup.resumeFileName ? (
        <p className="mock-context-note">
          Text has not been extracted from <strong>{setup.resumeFileName}</strong>.
          Re-select it in the saved setup before starting.
        </p>
      ) : (
        <div>
          <span>Resume context</span>
          <p>No resume text saved. You can add it in the setup.</p>
        </div>
      )}
      {setup.instructions && (
        <div>
          <span>Your focus</span>
          <p>{setup.instructions}</p>
        </div>
      )}
      {setup.jobDescriptionUrl && (
        <div>
          <span>Job posting link</span>
          <a href={setup.jobDescriptionUrl} target="_blank" rel="noreferrer">
            Open job description
          </a>
          {!setup.jobDescription && (
            <p>The linked page is not fetched; paste its text into the setup to use it.</p>
          )}
        </div>
      )}
      {setup.jobDescription && (
        <details className="mock-job-description">
          <summary>View job description</summary>
          <p>{setup.jobDescription}</p>
        </details>
      )}
    </aside>
  );
}

function ReviewList({
  title,
  items,
  emptyMessage = "No items to show.",
}: {
  title: string;
  items: string[];
  emptyMessage?: string;
}) {
  return (
    <section className="mock-review-list">
      <h3>{title}</h3>
      {items.length > 0 ? (
        <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
      ) : (
        <p>{emptyMessage}</p>
      )}
    </section>
  );
}

function ReviewTurn({
  turn,
  draft,
}: {
  turn: MockInterviewTurn;
  draft: string;
}) {
  return (
    <li className="mock-review-turn">
      <div className="mock-turn-question">
        <span>{turn.kind === "FOLLOW_UP" ? `FOLLOW-UP · ${turn.topic}` : turn.topic}</span>
        <strong>{turn.question}</strong>
      </div>
      {turn.answer ? (
        <>
          <div className="mock-review-answer">
            <span>Your submitted answer</span>
            <p>{turn.answer}</p>
          </div>
          {turn.feedback && (
            <div className="mock-answer-feedback">
              <div><strong>Relevance</strong><p>{turn.feedback.relevance}</p></div>
              <div><strong>Clarity</strong><p>{turn.feedback.clarity}</p></div>
              <div><strong>Completeness</strong><p>{turn.feedback.completeness}</p></div>
              <div><strong>Technical accuracy</strong><p>{turn.feedback.technicalAccuracy}</p></div>
              <div><strong>Specific improvement</strong><p>{turn.feedback.improvement}</p></div>
            </div>
          )}
        </>
      ) : (
        <div className="mock-unanswered">
          <strong>
            {turn.skipped ? "Skipped — no answer submitted" : "Unanswered — no answer submitted"}
          </strong>
          {draft && (
            <div className="mock-review-draft">
              <span>Unsubmitted draft (not evaluated)</span>
              <p>{draft}</p>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export default MockInterview;
