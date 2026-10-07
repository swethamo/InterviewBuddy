// History hook: owns backend requests, displayed history state, and explicit legacy imports.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  createInterview,
  createQuestions,
  createRound,
  deleteInterview,
  deleteQuestion,
  deleteRound,
  importLegacyInterview,
  listInterviews,
  updateInterview,
  updateQuestion,
  updateRound,
} from "../services/interviewHistoryApi";
import {
  loadInterviewHistory,
  parseImportedHistoryIds,
  saveImportedHistoryIds,
} from "../services/interviewHistoryStorage";
import type { InterviewRecord } from "../types/interviewHistory";
import type {
  InterviewDraft,
  QuestionDraft,
  RoundDraft,
} from "../services/interviewHistoryApi";

type OperationResult<T> =
  | { status: "success"; value: T }
  | { status: "failed"; error: string };

function failureMessage(error: unknown) {
  return error instanceof Error ? error.message : "The history request failed.";
}

function sortInterviews(records: InterviewRecord[]) {
  return [...records].sort(
    (first, second) =>
      first.company.localeCompare(second.company) ||
      first.role.localeCompare(second.role) ||
      first.id.localeCompare(second.id),
  );
}

export function useInterviewHistory() {
  const [records, setRecords] = useState<InterviewRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [legacyImportAvailable, setLegacyImportAvailable] = useState(false);
  const [legacyImportError, setLegacyImportError] = useState("");
  const operationLock = useRef(false);

  // Read unmodified browser records only to offer explicit import and retry status.
  const readLegacyImportStatus = useCallback(() => {
    const legacy = loadInterviewHistory();
    if (legacy.status !== "ready") {
      setLegacyImportAvailable(false);
      setLegacyImportError(legacy.error);
      return;
    }
    setLegacyImportError("");
    const importedIds = parseImportedHistoryIds();
    setLegacyImportAvailable(
      legacy.records.some((record) => !importedIds.has(record.id)),
    );
  }, []);

  const retryLoad = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      setRecords(await listInterviews());
      setHasLoaded(true);
      readLegacyImportStatus();
    } catch (error) {
      setErrorMessage(failureMessage(error));
      readLegacyImportStatus();
    } finally {
      setIsLoading(false);
    }
  }, [readLegacyImportStatus]);

  useEffect(() => {
    const loadHistory = async () => {
      await retryLoad();
    };
    void loadHistory();
  }, [retryLoad]);

  // Serializes writes and only applies local state after a successful response.
  const runOperation = useCallback(
    async <T,>(
      operation: () => Promise<T>,
      deleting: boolean,
      apply: (value: T) => void,
    ): Promise<OperationResult<T>> => {
      if (operationLock.current) {
        return { status: "failed", error: "Another history change is in progress." };
      }
      operationLock.current = true;
      if (deleting) {
        setIsDeleting(true);
      } else {
        setIsSaving(true);
      }
      setErrorMessage("");
      try {
        const value = await operation();
        apply(value);
        return { status: "success", value };
      } catch (error) {
        const message = failureMessage(error);
        setErrorMessage(message);
        return { status: "failed", error: message };
      } finally {
        operationLock.current = false;
        setIsSaving(false);
        setIsDeleting(false);
      }
    },
    [],
  );

  const createRecord = useCallback(
    (draft: InterviewDraft) =>
      runOperation(() => createInterview(draft), false, (record) =>
        setRecords((current) => sortInterviews([record, ...current])),
      ),
    [runOperation],
  );

  const updateRecord = useCallback(
    (id: string, draft: InterviewDraft) =>
      runOperation(
        () => updateInterview(id, draft),
        false,
        (saved) =>
          setRecords((current) =>
            sortInterviews(
              current.map((record) => (record.id === id ? saved : record)),
            ),
          ),
      ),
    [runOperation],
  );

  const removeRecord = useCallback(
    (id: string) =>
      runOperation(
        () => deleteInterview(id),
        true,
        () => setRecords((current) => current.filter((record) => record.id !== id)),
      ),
    [runOperation],
  );

  const createInterviewRound = useCallback(
    (interviewId: string, draft: RoundDraft) =>
      runOperation(
        () => createRound(interviewId, draft),
        false,
        (round) =>
          setRecords((current) =>
            current.map((record) =>
              record.id === interviewId
                ? { ...record, rounds: [...record.rounds, round] }
                : record,
            ),
          ),
      ),
    [runOperation],
  );

  const updateInterviewRound = useCallback(
    (interviewId: string, roundId: string, draft: RoundDraft) =>
      runOperation(
        () => updateRound(interviewId, roundId, draft),
        false,
        (savedRound) =>
          setRecords((current) =>
            current.map((record) =>
              record.id === interviewId
                ? {
                    ...record,
                    rounds: record.rounds.map((round) =>
                      round.id === roundId ? savedRound : round,
                    ),
                  }
                : record,
            ),
          ),
      ),
    [runOperation],
  );

  const removeInterviewRound = useCallback(
    (interviewId: string, roundId: string) =>
      runOperation(
        () => deleteRound(interviewId, roundId),
        true,
        () =>
          setRecords((current) =>
            current.map((record) =>
              record.id === interviewId
                ? {
                    ...record,
                    rounds: record.rounds.filter((round) => round.id !== roundId),
                  }
                : record,
            ),
          ),
      ),
    [runOperation],
  );

  const createRoundQuestions = useCallback(
    (interviewId: string, roundId: string, drafts: QuestionDraft[]) =>
      runOperation(
        () => createQuestions(interviewId, roundId, drafts),
        false,
        (savedQuestions) =>
          setRecords((current) =>
            current.map((record) =>
              record.id === interviewId
                ? {
                    ...record,
                    rounds: record.rounds.map((round) =>
                      round.id === roundId
                        ? { ...round, questions: [...round.questions, ...savedQuestions] }
                        : round,
                    ),
                  }
                : record,
            ),
          ),
      ),
    [runOperation],
  );

  const updateRoundQuestion = useCallback(
    (
      interviewId: string,
      roundId: string,
      questionId: string,
      draft: QuestionDraft,
    ) =>
      runOperation(
        () => updateQuestion(interviewId, roundId, questionId, draft),
        false,
        (savedQuestion) =>
          setRecords((current) =>
            current.map((record) =>
              record.id === interviewId
                ? {
                    ...record,
                    rounds: record.rounds.map((round) =>
                      round.id === roundId
                        ? {
                            ...round,
                            questions: round.questions.map((question) =>
                              question.id === questionId ? savedQuestion : question,
                            ),
                          }
                        : round,
                    ),
                  }
                : record,
            ),
          ),
      ),
    [runOperation],
  );

  const removeRoundQuestion = useCallback(
    (interviewId: string, roundId: string, questionId: string) =>
      runOperation(
        () => deleteQuestion(interviewId, roundId, questionId),
        true,
        () =>
          setRecords((current) =>
            current.map((record) =>
              record.id === interviewId
                ? {
                    ...record,
                    rounds: record.rounds.map((round) =>
                      round.id === roundId
                        ? {
                            ...round,
                            questions: round.questions.filter(
                              (question) => question.id !== questionId,
                            ),
                          }
                        : round,
                    ),
                  }
                : record,
            ),
          ),
      ),
    [runOperation],
  );

  // Import one aggregate at a time and persist each completed source ID for safe retries.
  const importLegacyHistory = useCallback(async () => {
    const legacy = loadInterviewHistory();
    if (legacy.status !== "ready") {
      const message = legacy.error;
      setErrorMessage(message);
      return { status: "failed" as const, error: message };
    }

    const importedIds = parseImportedHistoryIds();
    const pending = legacy.records.filter((record) => !importedIds.has(record.id));
    if (pending.length === 0) {
      setLegacyImportAvailable(false);
      return { status: "success" as const, count: 0 };
    }

    if (operationLock.current) {
      return {
        status: "failed" as const,
        error: "Another history change is in progress.",
      };
    }

    operationLock.current = true;
    setIsSaving(true);
    setErrorMessage("");
    try {
      for (const legacyRecord of pending) {
        const imported = await importLegacyInterview(legacyRecord);
        importedIds.add(legacyRecord.id);
        saveImportedHistoryIds(importedIds);
        setRecords((current) =>
          sortInterviews(
            current.some((record) => record.id === imported.id)
              ? current.map((record) =>
                  record.id === imported.id ? imported : record,
                )
              : [...current, imported],
          ),
        );
      }
      setLegacyImportAvailable(false);
      setLegacyImportError("");
      return { status: "success" as const, count: pending.length };
    } catch (error) {
      const message = failureMessage(error);
      setErrorMessage(message);
      readLegacyImportStatus();
      return { status: "failed" as const, error: message };
    } finally {
      operationLock.current = false;
      setIsSaving(false);
    }
  }, [readLegacyImportStatus]);

  return {
    records,
    isLoading,
    hasLoaded,
    isSaving,
    isDeleting,
    errorMessage,
    legacyImportAvailable,
    legacyImportError,
    retryLoad,
    createRecord,
    updateRecord,
    removeRecord,
    createInterviewRound,
    updateInterviewRound,
    removeInterviewRound,
    createRoundQuestions,
    updateRoundQuestion,
    removeRoundQuestion,
    importLegacyHistory,
    setErrorMessage,
  };
}
