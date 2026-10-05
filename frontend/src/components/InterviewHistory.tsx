import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  loadInterviewHistory,
  saveInterviewHistory,
} from "../services/interviewHistoryStorage";
import type {
  InterviewQuestion,
  InterviewRecord,
  InterviewRound,
} from "../types/interviewHistory";
import QuestionCard from "./QuestionCard";
import ResumeFileField from "./ResumeFileField";
import { navigateHistory, readHistoryRoute } from "../services/historyNavigation";

function InterviewHistory() {
  const [initialHistory] = useState(loadInterviewHistory);
  const [interviews, setInterviews] = useState(initialHistory.records);
  const [initialRoute] = useState(readHistoryRoute);
  const initialInterview = initialHistory.records.find(
    (interview) => interview.id === initialRoute.interviewId,
  );
  const [storageReady, setStorageReady] = useState(
    initialHistory.status === "ready",
  );
  const [storageError, setStorageError] = useState(
    initialHistory.status === "ready" ? "" : initialHistory.error,
  );
  const [selectedInterviewId, setSelectedInterviewId] = useState<string | null>(
    initialInterview?.id ?? null,
  );
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [editCompany, setEditCompany] = useState(initialInterview?.company ?? "");
  const [editRole, setEditRole] = useState(initialInterview?.role ?? "");
  const [selectedResumeFiles, setSelectedResumeFiles] = useState<
    Record<string, File>
  >({});

  const [roundName, setRoundName] = useState("");
  const [roundDate, setRoundDate] = useState("");
  const [editingRoundId, setEditingRoundId] = useState<string | null>(null);
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(() =>
    initialInterview?.rounds.some(
      (round) => round.id === initialRoute.roundId,
    )
      ? initialRoute.roundId
      : null,
  );

  const [questionText, setQuestionText] = useState("");
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(
    null,
  );
  const [editQuestionText, setEditQuestionText] = useState("");

  const selectedInterview = interviews.find(
    (interview) => interview.id === selectedInterviewId,
  );
  const selectedRound = selectedInterview?.rounds.find(
    (round) => round.id === selectedRoundId,
  );

  useEffect(() => {
    function syncHistoryRoute() {
      const route = readHistoryRoute();
      const interview = interviews.find(
        (item) => item.id === route.interviewId,
      );
      const round = interview?.rounds.find(
        (item) => item.id === route.roundId,
      );

      setSelectedInterviewId(interview?.id ?? null);
      setSelectedRoundId(round?.id ?? null);
      setEditCompany(interview?.company ?? "");
      setEditRole(interview?.role ?? "");
      setRoundName("");
      setRoundDate("");
      setEditingRoundId(null);
      setQuestionText("");
      setEditingQuestionId(null);
      setEditQuestionText("");
    }

    window.addEventListener("popstate", syncHistoryRoute);
    return () => window.removeEventListener("popstate", syncHistoryRoute);
  }, [interviews]);

  function formatRoundDate(date: string) {
    if (!date) return "";
    const [year, month, day] = date.split("-");
    return `${day}/${month}/${year.slice(-2)}`;
  }

  function commitInterviews(next: InterviewRecord[]) {
    setInterviews(next);
    if (!storageReady) return;

    const result = saveInterviewHistory(next);
    setStorageError(result.status === "failed" ? result.error : "");
  }

  function resetRoundAndQuestionDrafts() {
    setRoundName("");
    setRoundDate("");
    setEditingRoundId(null);
    setSelectedRoundId(null);
    resetQuestionDrafts();
  }

  function resetQuestionDrafts() {
    setQuestionText("");
    setEditingQuestionId(null);
    setEditQuestionText("");
  }

  function resetRecordDrafts() {
    setCompany("");
    setRole("");
    setEditCompany("");
    setEditRole("");
  }

  function backToRecords() {
    navigateHistory();
  }

  function backToRounds() {
    if (selectedInterviewId) navigateHistory(selectedInterviewId);
  }

  function handleSaveInterview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanedCompany = company.trim();
    const cleanedRole = role.trim();
    if (!cleanedCompany || !cleanedRole) return;

    const record: InterviewRecord = {
      id: crypto.randomUUID(),
      company: cleanedCompany,
      role: cleanedRole,
      resumeText: "",
      rounds: [],
    };
    commitInterviews([record, ...interviews]);
    resetRecordDrafts();
  }

  function startEditingInterview(interview: InterviewRecord) {
    navigateHistory(interview.id);
    setSelectedInterviewId(interview.id);
    setEditCompany(interview.company);
    setEditRole(interview.role);
    resetRoundAndQuestionDrafts();
  }

  function handleSaveInterviewDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanedCompany = editCompany.trim();
    const cleanedRole = editRole.trim();
    if (!selectedInterviewId || !cleanedCompany || !cleanedRole) return;

    updateSelectedInterview((interview) => ({
      ...interview,
      company: cleanedCompany,
      role: cleanedRole,
    }));
  }

  function handleDeleteInterview(interview: InterviewRecord) {
    if (
      !window.confirm(
        `Delete ${interview.company} — ${interview.role} and all of its rounds and questions?`,
      )
    ) {
      return;
    }

    commitInterviews(
      interviews.filter((record) => record.id !== interview.id),
    );
    setSelectedResumeFiles((previous) => {
      const next = { ...previous };
      delete next[interview.id];
      return next;
    });
    if (selectedInterviewId === interview.id) {
      navigateHistory();
      resetRecordDrafts();
      resetRoundAndQuestionDrafts();
    }
  }

  function updateSelectedInterview(
    update: (interview: InterviewRecord) => InterviewRecord,
  ) {
    if (!selectedInterviewId) return;
    commitInterviews(
      interviews.map((interview) =>
        interview.id === selectedInterviewId ? update(interview) : interview,
      ),
    );
  }

  function handleResumeFileSelected(file: File) {
    if (!selectedInterviewId) return;
    setSelectedResumeFiles((previous) => ({
      ...previous,
      [selectedInterviewId]: file,
    }));
  }

  function handleRemoveSelectedResumeFile() {
    if (!selectedInterviewId) return;
    setSelectedResumeFiles((previous) => {
      const next = { ...previous };
      delete next[selectedInterviewId];
      return next;
    });
  }

  function handleSaveRound(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanedName = roundName.trim();
    if (!selectedInterviewId || !cleanedName) return;

    if (editingRoundId) {
      const roundId = editingRoundId;
      updateSelectedInterview((interview) => ({
        ...interview,
        rounds: interview.rounds.map((round) =>
          round.id === roundId
            ? { ...round, name: cleanedName, date: roundDate }
            : round,
        ),
      }));
    } else {
      const round: InterviewRound = {
        id: crypto.randomUUID(),
        name: cleanedName,
        date: roundDate,
        questions: [],
      };
      updateSelectedInterview((interview) => ({
        ...interview,
        rounds: [...interview.rounds, round],
      }));
      navigateHistory(selectedInterviewId, round.id);
      setSelectedRoundId(round.id);
      resetQuestionDrafts();
    }
    setRoundName("");
    setRoundDate("");
    setEditingRoundId(null);
  }

  function startEditingRound(round: InterviewRound) {
    if (selectedInterviewId) navigateHistory(selectedInterviewId, round.id);
    setSelectedRoundId(round.id);
    setRoundName(round.name);
    setRoundDate(round.date);
    setEditingRoundId(round.id);
    resetQuestionDrafts();
  }

  function handleDeleteRound(round: InterviewRound) {
    if (
      !window.confirm(
        `Delete the "${round.name}" round and its ${round.questions.length} recorded question(s)?`,
      )
    ) {
      return;
    }

    updateSelectedInterview((interview) => ({
      ...interview,
      rounds: interview.rounds.filter((item) => item.id !== round.id),
    }));
    if (selectedRoundId === round.id) {
      if (selectedInterviewId) navigateHistory(selectedInterviewId);
      setSelectedRoundId(null);
      setRoundName("");
      setRoundDate("");
      setEditingRoundId(null);
      resetQuestionDrafts();
    }
  }

  function handleSaveQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const questions = [
      ...new Set(
        questionText
          .split(/\r?\n/)
          .map((question) => question.trim())
          .filter(Boolean),
      ),
    ];
    if (!selectedRoundId || questions.length === 0) return;

    const newQuestions: InterviewQuestion[] = questions.map((question) => ({
      id: crypto.randomUUID(),
      question,
      originalAnswer: "",
    }));
    updateSelectedInterview((interview) => ({
      ...interview,
      rounds: interview.rounds.map((round) =>
        round.id === selectedRoundId
          ? { ...round, questions: [...round.questions, ...newQuestions] }
          : round,
      ),
    }));
    setQuestionText("");
  }

  function startEditingQuestion(question: InterviewQuestion) {
    setEditingQuestionId(question.id);
    setEditQuestionText(question.question);
  }

  function handleSaveQuestionEdit(
    event: FormEvent<HTMLFormElement>,
    roundId: string,
    questionId: string,
  ) {
    event.preventDefault();
    const cleanedQuestion = editQuestionText.trim();
    if (!cleanedQuestion) return;

    updateSelectedInterview((interview) => ({
      ...interview,
      rounds: interview.rounds.map((round) =>
        round.id === roundId
          ? {
              ...round,
              questions: round.questions.map((question) =>
                question.id === questionId
                  ? {
                      ...question,
                      question: cleanedQuestion,
                    }
                  : question,
              ),
            }
          : round,
      ),
    }));
    resetQuestionDrafts();
  }

  function handleDeleteQuestion(
    roundId: string,
    question: InterviewQuestion,
  ) {
    if (!window.confirm("Delete this recorded question and original answer?")) {
      return;
    }

    updateSelectedInterview((interview) => ({
      ...interview,
      rounds: interview.rounds.map((round) =>
        round.id === roundId
          ? {
              ...round,
              questions: round.questions.filter(
                (item) => item.id !== question.id,
              ),
            }
          : round,
      ),
    }));
    if (editingQuestionId === question.id) resetQuestionDrafts();
  }

  function replaceUnreadableHistory() {
    if (
      !window.confirm(
        "Replace the unreadable saved interview history with the records currently shown? The unreadable saved data will be lost.",
      )
    ) {
      return;
    }

    const result = saveInterviewHistory(interviews);
    if (result.status === "saved") {
      setStorageReady(true);
      setStorageError("");
    } else {
      setStorageError(result.error);
    }
  }

  return (
    <main className="history-page">
      {storageError && (
        <div className="storage-warning" role="alert">
          <p>{storageError}</p>
          {initialHistory.status === "malformed" && !storageReady && (
            <button
              className="danger-button"
              type="button"
              onClick={replaceUnreadableHistory}
            >
              Replace unreadable saved history
            </button>
          )}
        </div>
      )}

      {!selectedInterview ? (
        <div className="history-list-view">
          <header className="history-heading">
            <h1>My Interview History</h1>
          </header>

          <section
            className="history-form-card"
            aria-labelledby="record-form-title"
          >
            <h2 id="record-form-title">Add an interview</h2>
            <form onSubmit={handleSaveInterview}>
              <div className="form-grid">
                <div>
                  <label htmlFor="history-company">Company</label>
                  <input
                    id="history-company"
                    value={company}
                    onChange={(event) => setCompany(event.target.value)}
                    placeholder="For example, Ontic"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="history-role">Role</label>
                  <input
                    id="history-role"
                    value={role}
                    onChange={(event) => setRole(event.target.value)}
                    placeholder="For example, Software Engineer"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={!company.trim() || !role.trim()}
              >
                Add interview
              </button>
            </form>
          </section>

          <section className="history-records" aria-labelledby="records-heading">
            <div className="section-heading">
              <h2 id="records-heading">Interview records</h2>
              <span className="record-count">{interviews.length}</span>
            </div>

            {interviews.length === 0 ? (
              <p className="empty-state">
                No interviews yet. Add a company and role above.
              </p>
            ) : (
              <div className="record-grid">
                {interviews.map((interview) => (
                  <article className="record-card" key={interview.id}>
                    <div className="record-info">
                      <span className="record-company">
                        {interview.company}
                      </span>
                      <span className="record-role">{interview.role}</span>
                      <span className="record-summary">
                        {interview.rounds.length}{" "}
                        {interview.rounds.length === 1 ? "round" : "rounds"}
                      </span>
                    </div>
                    <div className="card-actions">
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => startEditingInterview(interview)}
                      >
                        View
                      </button>
                      <button
                        className="danger-button"
                        type="button"
                        onClick={() => handleDeleteInterview(interview)}
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : (
        <div className="history-editor">
          <nav
            className="editor-navigation"
            aria-label="Interview history"
            hidden={selectedRound !== undefined}
          >
            <button type="button" onClick={backToRecords}>
              All interviews
            </button>
          </nav>

          <header
            className="history-editor-heading"
            hidden={selectedRound !== undefined}
          >
            <div>
              <span className="section-kicker">INTERVIEW</span>
              <h1>
                {selectedInterview.company} / {selectedInterview.role}
              </h1>
            </div>
            <button
              className="danger-button"
              type="button"
              onClick={() => handleDeleteInterview(selectedInterview)}
            >
              Delete interview
            </button>
          </header>

          <section
            className="selected-interview"
            aria-label={`${selectedInterview.company} interview details`}
          >
            <section
              className="rounds-section"
              aria-labelledby="rounds-heading"
              hidden={selectedRound !== undefined}
            >
              <div className="section-heading">
                <h2 id="rounds-heading">Rounds</h2>
                <span className="record-count">
                  {selectedInterview.rounds.length}
                </span>
              </div>

              {selectedInterview.rounds.length === 0 ? (
                <p className="empty-state">
                  No rounds yet. Add one using the controls below.
                </p>
              ) : (
                <div className="round-grid">
                  {[...selectedInterview.rounds]
                    .sort((first, second) => {
                      if (!first.date) return second.date ? 1 : 0;
                      if (!second.date) return -1;
                      return first.date.localeCompare(second.date);
                    })
                    .map((round) => {
                    return (
                      <article className="round-card" key={round.id}>
                        <div className="round-select">
                          <span className="round-name">{round.name}</span>
                          {round.date && (
                            <time className="round-date" dateTime={round.date}>
                              {formatRoundDate(round.date)}
                            </time>
                          )}
                          {round.questions.length > 0 && (
                            <span className="record-summary">
                              {round.questions.length}{" "}
                              {round.questions.length === 1
                                ? "question"
                                : "questions"}
                            </span>
                          )}
                        </div>
                        {round.questions.length > 0 && (
                          <ul className="round-question-summary">
                            {round.questions.map((question) => (
                              <li key={question.id}>{question.question}</li>
                            ))}
                          </ul>
                        )}
                        <div className="card-actions">
                          <button
                            type="button"
                            onClick={() => {
                              navigateHistory(selectedInterview.id, round.id);
                              setSelectedRoundId(round.id);
                              setRoundName("");
                              setRoundDate("");
                              setEditingRoundId(null);
                              resetQuestionDrafts();
                            }}
                          >
                            Edit
                          </button>
                          <button
                            className="danger-button"
                            type="button"
                            onClick={() => handleDeleteRound(round)}
                          >
                            Delete
                          </button>
                        </div>
                      </article>
                    );
                    })}
                </div>
              )}
            </section>

            <section
              className="interview-settings"
              aria-label="Interview details and actions"
              hidden={selectedRound !== undefined}
            >
              <details className="edit-record-details">
                <summary>Edit company or role</summary>
                <form
                  className="inline-form record-details-form"
                  onSubmit={handleSaveInterviewDetails}
                >
                  <div className="form-grid">
                    <div>
                      <label htmlFor="edit-history-company">Company</label>
                      <input
                        id="edit-history-company"
                        value={editCompany}
                        onChange={(event) => setEditCompany(event.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="edit-history-role">Role</label>
                      <input
                        id="edit-history-role"
                        value={editRole}
                        onChange={(event) => setEditRole(event.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={!editCompany.trim() || !editRole.trim()}
                  >
                    Save changes
                  </button>
                </form>
              </details>
              <ResumeFileField
                selectedFile={selectedResumeFiles[selectedInterview.id] ?? null}
                onFileSelected={handleResumeFileSelected}
                onRemove={handleRemoveSelectedResumeFile}
              />
              <details className="add-round-details">
                <summary>{editingRoundId ? "Edit round" : "Add a round"}</summary>
                <form className="inline-form" onSubmit={handleSaveRound}>
                  <div className="form-grid">
                    <div>
                      <label htmlFor="round-name">Round name</label>
                      <input
                        id="round-name"
                        value={roundName}
                        onChange={(event) => setRoundName(event.target.value)}
                        placeholder="For example, Technical interview"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="round-date">
                        Interview date (optional)
                      </label>
                      <input
                        id="round-date"
                        type="date"
                        value={roundDate}
                        onChange={(event) => setRoundDate(event.target.value)}
                      />
                    </div>
                  </div>
                  <div className="card-actions">
                    <button type="submit" disabled={!roundName.trim()}>
                      {editingRoundId ? "Save round" : "Add round"}
                    </button>
                    {editingRoundId && (
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => {
                          setRoundName("");
                          setRoundDate("");
                          setEditingRoundId(null);
                        }}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </details>
            </section>

            {selectedRound && (
              <section
                className="questions-section round-workspace"
                aria-labelledby="questions-heading"
              >
                <nav className="editor-tabs" aria-label="Interview sections">
                  <button type="button" onClick={backToRounds}>
                    Rounds
                  </button>
                  <span aria-current="page">{selectedRound.name}</span>
                </nav>
                <div className="section-heading">
                  <h2 id="questions-heading">{selectedRound.name} questions</h2>
                  {selectedRound.questions.length > 0 && (
                    <span className="record-count">
                      {selectedRound.questions.length}
                    </span>
                  )}
                </div>
                {editingRoundId === selectedRound.id && (
                  <form className="inline-form" onSubmit={handleSaveRound}>
                    <div className="form-grid">
                      <div>
                        <label htmlFor="edit-round-name">Round name</label>
                        <input
                          id="edit-round-name"
                          value={roundName}
                          onChange={(event) => setRoundName(event.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="edit-round-date">Date (optional)</label>
                        <input
                          id="edit-round-date"
                          type="date"
                          value={roundDate}
                          onChange={(event) => setRoundDate(event.target.value)}
                        />
                      </div>
                    </div>
                    <div className="card-actions">
                      <button type="submit" disabled={!roundName.trim()}>
                        Save round
                      </button>
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => {
                          setEditingRoundId(null);
                          setRoundName("");
                          setRoundDate("");
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
                {editingRoundId !== selectedRound.id && (
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => startEditingRound(selectedRound)}
                  >
                    Edit round details
                  </button>
                )}

                <form className="inline-form" onSubmit={handleSaveQuestion}>
                  <h3>Add questions</h3>
                  <div>
                    <label htmlFor="actual-question-list">
                      Questions asked
                    </label>
                    <textarea
                      id="actual-question-list"
                      rows={6}
                      value={questionText}
                      onChange={(event) => setQuestionText(event.target.value)}
                      placeholder={
                        "Add one question per line.\nFor example:\nHow would you design a cache?\nTell me about a challenging project."
                      }
                      aria-describedby="question-list-help"
                    />
                    <small id="question-list-help">
                      Each non-empty line will be saved as a separate question.
                    </small>
                  </div>
                  <button type="submit" disabled={!questionText.trim()}>
                    Add questions
                  </button>
                </form>

                {selectedRound.questions.length > 0 && (
                  <div className="question-list">
                    {selectedRound.questions.map((question, index) => (
                      <QuestionCard
                        key={`${question.id}-${editingQuestionId === question.id}`}
                        item={question}
                        index={index}
                        company={selectedInterview.company}
                        role={selectedInterview.role}
                        round={selectedRound.name}
                        resumeText={selectedInterview.resumeText}
                        onEdit={() => startEditingQuestion(question)}
                        onDelete={() =>
                          handleDeleteQuestion(selectedRound.id, question)
                        }
                      >
                        {editingQuestionId === question.id ? (
                          <form
                            className="question-edit-form"
                            onSubmit={(event) =>
                              handleSaveQuestionEdit(
                                event,
                                selectedRound.id,
                                question.id,
                              )
                            }
                          >
                            <div>
                              <label htmlFor={`${question.id}-edit-question`}>
                                Question asked
                              </label>
                              <textarea
                                id={`${question.id}-edit-question`}
                                rows={3}
                                value={editQuestionText}
                                onChange={(event) =>
                                  setEditQuestionText(event.target.value)
                                }
                                required
                              />
                            </div>
                            <div className="card-actions">
                              <button
                                type="submit"
                                disabled={!editQuestionText.trim()}
                              >
                                Save question
                              </button>
                              <button
                                className="secondary-button"
                                type="button"
                                onClick={resetQuestionDrafts}
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        ) : undefined}
                      </QuestionCard>
                    ))}
                  </div>
                )}
              </section>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

export default InterviewHistory;
