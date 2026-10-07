// History workspace: renders nested interview CRUD and keeps deep-link selection synchronized.
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type {
  InterviewQuestion,
  InterviewRecord,
  InterviewRound,
} from "../types/interviewHistory";
import QuestionCard from "./QuestionCard";
import ResumeFileField from "./ResumeFileField";
import {
  navigateHistory,
  navigateNewInterview,
  readHistoryRoute,
} from "../services/historyNavigation";
import { useInterviewHistory } from "../hooks/useInterviewHistory";

type InterviewEditorDraft = {
  interviewId: string;
  company: string;
  role: string;
  resumeText: string;
};

function InterviewHistory() {
  // The initial hash route seeds selection while server-backed records load.
  const [initialRoute] = useState(readHistoryRoute);
  const {
    records: interviews,
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
  } = useInterviewHistory();
  const [selectedInterviewId, setSelectedInterviewId] = useState<string | null>(
    initialRoute.interviewId,
  );
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [isAddingInterview, setIsAddingInterview] = useState(
    initialRoute.view === "new",
  );
  const [interviewDraft, setInterviewDraft] =
    useState<InterviewEditorDraft | null>(null);
  const [selectedResumeFiles, setSelectedResumeFiles] = useState<
    Record<string, File>
  >({});

  const [roundName, setRoundName] = useState("");
  const [roundDate, setRoundDate] = useState("");
  const [editingRoundId, setEditingRoundId] = useState<string | null>(null);
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(
    initialRoute.roundId,
  );

  const [questionText, setQuestionText] = useState("");
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(
    null,
  );
  const [editQuestionText, setEditQuestionText] = useState("");
  const [editOriginalAnswer, setEditOriginalAnswer] = useState("");

  const selectedInterview = interviews.find(
    (interview) => interview.id === selectedInterviewId,
  );
  const selectedRound = selectedInterview?.rounds.find(
    (round) => round.id === selectedRoundId,
  );
  const currentInterviewDraft =
    selectedInterview &&
    interviewDraft?.interviewId === selectedInterview.id
      ? interviewDraft
      : null;
  const editCompany =
    currentInterviewDraft
      ? currentInterviewDraft.company
      : selectedInterview?.company ?? "";
  const editRole =
    currentInterviewDraft
      ? currentInterviewDraft.role
      : selectedInterview?.role ?? "";
  const editResumeText =
    currentInterviewDraft
      ? currentInterviewDraft.resumeText
      : selectedInterview?.resumeText ?? "";

  // Keep the edit draft keyed to its server record, falling back to loaded values on direct links.
  function updateInterviewDraft(
    field: "company" | "role" | "resumeText",
    value: string,
  ) {
    if (!selectedInterview) return;
    setInterviewDraft((current) => {
      const base =
        current?.interviewId === selectedInterview.id
          ? current
          : {
              interviewId: selectedInterview.id,
              company: selectedInterview.company,
              role: selectedInterview.role,
              resumeText: selectedInterview.resumeText,
            };
      return { ...base, [field]: value };
    });
  }

  // Route syncing waits for server data before deciding whether a direct-linked ID is missing.
  useEffect(() => {
    function syncHistoryRoute() {
      const route = readHistoryRoute();
      setIsAddingInterview(route.view === "new");
      setSelectedInterviewId(route.interviewId);
      setSelectedRoundId(route.roundId);
      setRoundName("");
      setRoundDate("");
      setEditingRoundId(null);
      setQuestionText("");
      setEditingQuestionId(null);
      setEditQuestionText("");
      setEditOriginalAnswer("");
    }

    window.addEventListener("popstate", syncHistoryRoute);
    return () => window.removeEventListener("popstate", syncHistoryRoute);
  }, []);

  function formatRoundDate(date: string) {
    if (!date) return "";
    const [year, month, day] = date.split("-");
    return `${day}/${month}/${year.slice(-2)}`;
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
    setEditOriginalAnswer("");
  }

  function resetRecordDrafts() {
    setCompany("");
    setRole("");
    setInterviewDraft(null);
  }

  function backToRecords() {
    navigateHistory();
  }

  function backToRounds() {
    if (selectedInterviewId) navigateHistory(selectedInterviewId);
  }

  // Create and navigate only after the API returns the server-generated record ID.
  async function handleSaveInterview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanedCompany = company.trim();
    const cleanedRole = role.trim();
    if (!cleanedCompany || !cleanedRole) return;

    const result = await createRecord({
      company: cleanedCompany,
      role: cleanedRole,
      resumeText: resumeText.trim(),
    });
    if (result.status !== "success") return;

    const record = result.value;
    setCompany("");
    setRole("");
    setResumeText("");
    setIsAddingInterview(false);
    resetRoundAndQuestionDrafts();
    navigateHistory(record.id);
    setSelectedInterviewId(record.id);
    setInterviewDraft({
      interviewId: record.id,
      company: record.company,
      role: record.role,
      resumeText: record.resumeText,
    });
  }

  function cancelAddingInterview() {
    setCompany("");
    setRole("");
    setResumeText("");
    setIsAddingInterview(false);
    navigateHistory();
  }

  function startEditingInterview(interview: InterviewRecord) {
    setIsAddingInterview(false);
    setCompany("");
    setRole("");
    navigateHistory(interview.id);
    setSelectedInterviewId(interview.id);
    setInterviewDraft({
      interviewId: interview.id,
      company: interview.company,
      role: interview.role,
      resumeText: interview.resumeText,
    });
    resetRoundAndQuestionDrafts();
  }

  async function handleSaveInterviewDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanedCompany = editCompany.trim();
    const cleanedRole = editRole.trim();
    if (!selectedInterviewId || !cleanedCompany || !cleanedRole) return;

    await updateRecord(selectedInterviewId, {
      company: cleanedCompany,
      role: cleanedRole,
      resumeText: editResumeText.trim(),
    });
  }

  async function handleDeleteInterview(interview: InterviewRecord) {
    if (
      !window.confirm(
        `Delete ${interview.company} — ${interview.role} and all of its rounds and questions?`,
      )
    ) {
      return;
    }

    const result = await removeRecord(interview.id);
    if (result.status !== "success") return;

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

  // Save round edits and creations through the selected interview's nested endpoint.
  async function handleSaveRound(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanedName = roundName.trim();
    if (!selectedInterviewId || !cleanedName) return;

    if (editingRoundId) {
      const result = await updateInterviewRound(
        selectedInterviewId,
        editingRoundId,
        { name: cleanedName, date: roundDate },
      );
      if (result.status !== "success") return;
    } else {
      const result = await createInterviewRound(selectedInterviewId, {
        name: cleanedName,
        date: roundDate,
      });
      if (result.status !== "success") return;
      navigateHistory(selectedInterviewId, result.value.id);
      setSelectedRoundId(result.value.id);
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

  async function handleDeleteRound(round: InterviewRound) {
    if (
      !window.confirm(
        `Delete the "${round.name}" round and its ${round.questions.length} recorded question(s)?`,
      )
    ) {
      return;
    }

    if (!selectedInterviewId) return;
    const result = await removeInterviewRound(selectedInterviewId, round.id);
    if (result.status !== "success") return;
    if (selectedRoundId === round.id) {
      if (selectedInterviewId) navigateHistory(selectedInterviewId);
      setSelectedRoundId(null);
      setRoundName("");
      setRoundDate("");
      setEditingRoundId(null);
      resetQuestionDrafts();
    }
  }

  // Batch creation keeps the one-question-per-line UX atomic and avoids retry duplicates.
  async function handleSaveQuestion(event: FormEvent<HTMLFormElement>) {
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

    if (!selectedInterviewId) return;
    const result = await createRoundQuestions(
      selectedInterviewId,
      selectedRoundId,
      questions.map((question) => ({ question, originalAnswer: "" })),
    );
    if (result.status !== "success") return;
    setQuestionText("");
  }

  function startEditingQuestion(question: InterviewQuestion) {
    setEditingQuestionId(question.id);
    setEditQuestionText(question.question);
    setEditOriginalAnswer(question.originalAnswer ?? "");
  }

  async function handleSaveQuestionEdit(
    event: FormEvent<HTMLFormElement>,
    roundId: string,
    questionId: string,
  ) {
    event.preventDefault();
    const cleanedQuestion = editQuestionText.trim();
    if (!cleanedQuestion) return;

    if (!selectedInterviewId) return;
    const result = await updateRoundQuestion(
      selectedInterviewId,
      roundId,
      questionId,
      {
        question: cleanedQuestion,
        originalAnswer: editOriginalAnswer.trim(),
      },
    );
    if (result.status !== "success") return;
    resetQuestionDrafts();
  }

  async function handleDeleteQuestion(
    roundId: string,
    question: InterviewQuestion,
  ) {
    if (!window.confirm("Delete this recorded question and original answer?")) {
      return;
    }

    if (!selectedInterviewId) return;
    const result = await removeRoundQuestion(
      selectedInterviewId,
      roundId,
      question.id,
    );
    if (result.status !== "success") return;
    if (editingQuestionId === question.id) resetQuestionDrafts();
  }

  return (
    <main className="history-page">
      {errorMessage && (
        <div className="storage-warning" role="alert">
          <p>{errorMessage}</p>
          <button
            className="secondary-button"
            type="button"
            onClick={() => void retryLoad()}
            disabled={isLoading}
          >
            Retry loading
          </button>
        </div>
      )}

      {legacyImportAvailable && !isLoading && (
        <div className="storage-note" role="status">
          <p>Older interview history is available in this browser and has not been changed.</p>
          <button
            type="button"
            className="secondary-button"
            onClick={() => void importLegacyHistory()}
            disabled={isSaving || isDeleting}
          >
            Import legacy history
          </button>
        </div>
      )}
      {legacyImportError && !isLoading && (
        <p className="storage-warning" role="alert">
          Legacy history could not be read for import: {legacyImportError}
        </p>
      )}

      {isLoading ? (
        <section className="empty-state" role="status">
          Loading interview history…
        </section>
      ) : !hasLoaded ? (
        <section className="history-form-card" role="alert">
          <h1>Interview history is unavailable</h1>
          <p>The server data has not loaded, so no records can be selected yet.</p>
          <button type="button" onClick={() => void retryLoad()}>
            Retry loading
          </button>
        </section>
      ) : !selectedInterview ? (
        selectedInterviewId ? (
          <section className="history-form-card" role="alert">
            <h1>Interview not found</h1>
            <p>This interview link is no longer available.</p>
            <button type="button" onClick={backToRecords} disabled={isSaving || isDeleting}>
              Return to interview list
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => void retryLoad()}
            >
              Retry
            </button>
          </section>
        ) : isAddingInterview ? (
          <div className="history-add-view">
            <nav className="editor-navigation" aria-label="Interview history">
              <button type="button" onClick={cancelAddingInterview} disabled={isSaving}>
                ← All interviews
              </button>
            </nav>
            <header className="history-heading">
              <h1>New interview</h1>
              <p>Add a company and role to start recording interview rounds.</p>
            </header>
            <section
              className="history-form-card"
              aria-labelledby="record-form-title"
            >
              <h2 id="record-form-title">Interview details</h2>
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
                      autoFocus
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
                <div>
                  <label htmlFor="history-resume-text">
                    Resume context (optional)
                  </label>
                  <textarea
                    id="history-resume-text"
                    rows={5}
                    value={resumeText}
                    onChange={(event) => setResumeText(event.target.value)}
                    placeholder="Paste experience or project context for this interview."
                  />
                </div>
                <div className="form-actions">
                  <button
                    type="submit"
                    disabled={isSaving || !company.trim() || !role.trim()}
                  >
                    {isSaving ? "Saving…" : "Create interview"}
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={cancelAddingInterview}
                    disabled={isSaving}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </section>
          </div>
        ) : (
          <div className="history-list-view">
            <header className="history-heading">
              <h1>My Interview History</h1>
            </header>

            <section className="history-records" aria-labelledby="records-heading">
              <div className="section-heading">
                <h2 id="records-heading">Interview records</h2>
                <div className="history-record-actions">
                  <span className="record-count">{interviews.length}</span>
                  <button
                    type="button"
                    onClick={navigateNewInterview}
                    disabled={isSaving || isDeleting}
                  >
                    + New interview
                  </button>
                </div>
              </div>

              {interviews.length === 0 ? (
                <p className="empty-state">
                  No interviews yet. Add your first interview to get started.
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
                          disabled={isSaving || isDeleting}
                        >
                          View
                        </button>
                        <button
                          className="danger-button"
                          type="button"
                          onClick={() => handleDeleteInterview(interview)}
                          disabled={isSaving || isDeleting}
                        >
                          {isDeleting ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        )
      ) : (
        <div className="history-editor">
          <nav
            className="editor-navigation"
            aria-label="Interview history"
            hidden={selectedRound !== undefined}
          >
            <button type="button" onClick={backToRecords} disabled={isSaving || isDeleting}>
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
              disabled={isSaving || isDeleting}
            >
              {isDeleting ? "Deleting…" : "Delete interview"}
            </button>
          </header>

          {selectedRoundId && !selectedRound && (
            <section className="history-form-card" role="alert">
              <h2>Round not found</h2>
              <p>This round link is no longer available in this interview.</p>
              <button type="button" onClick={backToRounds} disabled={isSaving || isDeleting}>
                Return to rounds
              </button>
            </section>
          )}

          <section
            className="selected-interview"
            aria-label={`${selectedInterview.company} interview details`}
            hidden={Boolean(selectedRoundId && !selectedRound)}
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
                  {selectedInterview.rounds.map((round) => {
                    return (
                      <article className="round-card" key={round.id}>
                        <div className="round-select">
                          <span className="round-name">{round.name}</span>
                          {(round.date || round.questions.length > 0) && (
                            <div className="round-metadata">
                              {round.date && (
                                <time
                                  className="round-date"
                                  dateTime={round.date}
                                >
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
                            disabled={isSaving || isDeleting}
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
                            disabled={isSaving || isDeleting}
                          >
                            {isDeleting ? "Deleting…" : "Delete"}
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
                <summary>Edit company, role, or resume context</summary>
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
                        onChange={(event) =>
                          updateInterviewDraft("company", event.target.value)
                        }
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="edit-history-role">Role</label>
                      <input
                        id="edit-history-role"
                        value={editRole}
                        onChange={(event) =>
                          updateInterviewDraft("role", event.target.value)
                        }
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="edit-history-resume">
                      Pasted resume context (optional)
                    </label>
                    <textarea
                      id="edit-history-resume"
                      rows={5}
                      value={editResumeText}
                      onChange={(event) =>
                        updateInterviewDraft("resumeText", event.target.value)
                      }
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={
                      isSaving || !editCompany.trim() || !editRole.trim()
                    }
                  >
                    {isSaving ? "Saving…" : "Save changes"}
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
                    <button
                      type="submit"
                      disabled={isSaving || !roundName.trim()}
                    >
                      {isSaving
                        ? "Saving…"
                        : editingRoundId
                          ? "Save round"
                          : "Add round"}
                    </button>
                    {editingRoundId && (
                      <button
                        className="secondary-button"
                        type="button"
                        disabled={isSaving}
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
                  <button
                    type="button"
                    onClick={backToRounds}
                    disabled={isSaving || isDeleting}
                  >
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
                      <button
                        type="submit"
                        disabled={isSaving || !roundName.trim()}
                      >
                        {isSaving ? "Saving…" : "Save round"}
                      </button>
                      <button
                        className="secondary-button"
                        type="button"
                        disabled={isSaving}
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
                    disabled={isSaving || isDeleting}
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
                  <button
                    type="submit"
                    disabled={isSaving || !questionText.trim()}
                  >
                    {isSaving ? "Saving…" : "Add questions"}
                  </button>
                </form>

                {selectedRound.questions.length === 0 && (
                  <p className="empty-state">
                    No questions recorded for this round yet.
                  </p>
                )}

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
                        isBusy={isSaving || isDeleting}
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
                            <div>
                              <label htmlFor={`${question.id}-edit-answer`}>
                                Original answer (optional)
                              </label>
                              <textarea
                                id={`${question.id}-edit-answer`}
                                rows={4}
                                value={editOriginalAnswer}
                                onChange={(event) =>
                                  setEditOriginalAnswer(event.target.value)
                                }
                              />
                            </div>
                            <div className="card-actions">
                              <button
                                type="submit"
                                disabled={isSaving || !editQuestionText.trim()}
                              >
                                {isSaving ? "Saving…" : "Save question"}
                              </button>
                              <button
                                className="secondary-button"
                                type="button"
                                onClick={resetQuestionDrafts}
                                disabled={isSaving}
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
