// Saved setup list: presents each prep plan and the actions to edit, start, or delete it.
import { getInterviewTypeLabel } from "../services/interviewTypes";
import type { InterviewSetup } from "../types/interviewSetup";

type InterviewSetupListProps = {
  setups: InterviewSetup[];
  isLoading: boolean;
  isSaving: boolean;
  errorMessage: string;
  localImportMessage: string;
  onAdd: () => void;
  onEdit: (setup: InterviewSetup) => void;
  onStart: (setup: InterviewSetup) => void;
  onDelete: (setup: InterviewSetup) => void;
  onImport: () => Promise<{ status: "imported" | "failed" | "skipped"; count?: number; error?: string }>;
  onRetry: () => Promise<void>;
};

function InterviewSetupList({
  setups,
  isLoading,
  isSaving,
  errorMessage,
  localImportMessage,
  onAdd,
  onEdit,
  onStart,
  onDelete,
  onImport,
  onRetry,
}: InterviewSetupListProps) {
  return (
    <main className="prep-page prep-list-page">
      <header className="prep-heading">
        <span className="eyebrow">GET READY</span>
        <h1>Interview Prep</h1>
        <p>Choose a saved setup or create a new one</p>
      </header>

      <div className="prep-list-heading">
        <div>
          <h2>Saved setups</h2>
        </div>
        <button type="button" onClick={onAdd} disabled={isSaving}>
          + New setup
        </button>
      </div>

      {localImportMessage && (
        <p className="prep-storage-message" role="status">
          {localImportMessage}
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              void onImport();
            }}
            disabled={isSaving}
          >
            Import local setups
          </button>
        </p>
      )}

      {errorMessage && (
        <p className="prep-storage-message" role="alert">
          {errorMessage}
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              void onRetry();
            }}
            disabled={isLoading}
          >
            Retry
          </button>
        </p>
      )}

      {isLoading ? (
        <section className="prep-list-empty">
          <h2>Loading saved setups…</h2>
          <p>Checking the server-backed interview list.</p>
        </section>
      ) : setups.length === 0 ? (
        <section className="prep-list-empty">
          <h2>No saved setups yet</h2>
          <p>Add interview details to get started.</p>
        </section>
      ) : (
        <section
          className="prep-setup-list"
          aria-label="Saved interview setups"
        >
          {setups.map((setup) => (
            <article className="prep-setup-card" key={setup.id}>
              <div className="prep-setup-card-info">
                <span className="prep-setup-type">
                  {setup.interviewType === "other"
                    ? setup.interviewTypeOther || "Other"
                    : getInterviewTypeLabel(setup.interviewType)}
                </span>
                <h2>{setup.company}</h2>
                <p>{setup.role}</p>
              </div>
              <div className="prep-setup-card-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => onEdit(setup)}
                  disabled={isSaving}
                >
                  Edit details
                </button>
                <button type="button" onClick={() => onStart(setup)} disabled={isSaving}>
                  Start prep
                </button>
                <button
                  className="danger-button"
                  type="button"
                  onClick={() => onDelete(setup)}
                  disabled={isSaving}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

export default InterviewSetupList;
