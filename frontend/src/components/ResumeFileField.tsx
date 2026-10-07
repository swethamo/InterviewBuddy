// Shared resume picker: validates a local PDF/DOCX file selection for prep or history views.
import { useState } from "react";
import type { ChangeEvent } from "react";

type ResumeFileFieldProps = {
  selectedFile: File | null;
  onFileSelected: (file: File) => void;
  onRemove: () => void;
};

const MAX_RESUME_SIZE = 5 * 1024 * 1024;

function ResumeFileField({
  selectedFile,
  onFileSelected,
  onRemove,
}: ResumeFileFieldProps) {
  const [error, setError] = useState("");

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension !== "pdf" && extension !== "docx") {
      setError("Choose a PDF or DOCX file.");
      return;
    }
    if (file.size > MAX_RESUME_SIZE) {
      setError("Choose a file no larger than 5 MB.");
      return;
    }

    setError("");
    onFileSelected(file);
  }

  return (
    <details className="resume-file-details">
      <summary>Resume file (optional)</summary>
      <div className="resume-file-content">
        <label htmlFor="history-resume-file">Select PDF or DOCX (up to 5 MB)</label>
        <input
          id="history-resume-file"
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={handleFileChange}
        />
        <small>
          Files are only selected in this browser; they are not uploaded or read.
        </small>
        {selectedFile && (
          <div className="card-actions">
            <span role="status">Selected: {selectedFile.name}</span>
            <button className="secondary-button" type="button" onClick={onRemove}>
              Remove
            </button>
          </div>
        )}
        {error && <p role="alert">{error}</p>}
      </div>
    </details>
  );
}

export default ResumeFileField;
