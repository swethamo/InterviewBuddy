// Setup form: captures interview details, context, and file selection for a saved prep record.
import { useId, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import {
  INTERVIEW_TYPE_OPTIONS,
  normalizeInterviewType,
} from "../services/interviewTypes";
import { extractResumeText } from "../services/resumeExtraction";
import type { InterviewSetup } from "../types/interviewSetup";

type InterviewSetupFormProps = {
  setup: InterviewSetup | null;
  isSaving?: boolean;
  onSave: (setup: InterviewSetup) => void | Promise<void>;
  onCancel: () => void;
};

function InterviewSetupForm({
  setup,
  isSaving = false,
  onSave,
  onCancel,
}: InterviewSetupFormProps) {
  const companyInputId = useId();
  const roleInputId = useId();
  const interviewTypeInputId = useId();
  const otherTypeInputId = useId();
  const urlInputId = useId();
  const descriptionInputId = useId();
  const instructionsInputId = useId();
  const resumeTextInputId = useId();
  const resumeInputId = useId();
  const resumeHelpId = useId();

  const [company, setCompany] = useState(setup?.company ?? "");
  const [role, setRole] = useState(setup?.role ?? "");
  const [interviewType, setInterviewType] = useState(
    normalizeInterviewType(setup?.interviewType, "recruiter-call"),
  );
  const [otherInterviewType, setOtherInterviewType] = useState(
    setup?.interviewType === "other" ? setup.interviewTypeOther ?? "" : "",
  );
  const [jobDescription, setJobDescription] = useState(
    setup?.jobDescription ?? "",
  );
  const [jobDescriptionUrl, setJobDescriptionUrl] = useState(
    setup?.jobDescriptionUrl ?? "",
  );
  const [instructions, setInstructions] = useState(
    setup?.instructions ?? "",
  );
  const [resumeText, setResumeText] = useState(setup?.resumeText ?? "");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [isExtractingResume, setIsExtractingResume] = useState(false);
  const [resumeError, setResumeError] = useState("");
  const [resumeRemoved, setResumeRemoved] = useState(false);
  const [isContextOpen, setIsContextOpen] = useState(
    Boolean(
      setup?.resumeFileName ||
        setup?.jobDescription ||
        setup?.jobDescriptionUrl ||
        setup?.instructions,
    ),
  );
  const resumeInputRef = useRef<HTMLInputElement>(null);

  async function handleResumeChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    const extension = file.name.split(".").pop()?.toLowerCase();
    const maxSize = 5 * 1024 * 1024;

    if (!extension || !(extension === "pdf" || extension === "docx")) {
      setResumeError("Please select a PDF or DOCX file.");
      event.target.value = "";
      return;
    }

    if (file.size > maxSize) {
      setResumeError("Please select a file no larger than 5 MB.");
      event.target.value = "";
      return;
    }

    setResumeError("");
    setIsExtractingResume(true);
    try {
      const extractedText = await extractResumeText(file);
      setResumeFile(file);
      setResumeRemoved(false);
      setResumeText(extractedText);
    } catch (error) {
      setResumeFile(null);
      setResumeError(
        error instanceof Error
          ? error.message
          : "The resume could not be extracted. Paste its text instead.",
      );
    } finally {
      setIsExtractingResume(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanedCompany = company.trim();
    const cleanedRole = role.trim();
    if (!cleanedCompany || !cleanedRole) return;

    const normalizedInterviewType =
      interviewType === "other"
        ? "other"
        : normalizeInterviewType(interviewType, "recruiter-call");

    const cleanedUrl = jobDescriptionUrl.trim();
    if (cleanedUrl && !/^https?:\/\//i.test(cleanedUrl)) {
      setResumeError("Please use a public http or https link.");
      return;
    }

    const nextSetup: InterviewSetup = {
      id: setup?.id ?? crypto.randomUUID(),
      company: cleanedCompany,
      role: cleanedRole,
      interviewType: normalizedInterviewType,
      interviewTypeOther:
        normalizedInterviewType === "other" ? otherInterviewType.trim() : undefined,
      jobDescription: jobDescription.trim(),
      jobDescriptionUrl: cleanedUrl,
      instructions: instructions.trim(),
      resumeFileName:
        resumeFile?.name ?? (resumeRemoved ? "" : setup?.resumeFileName ?? ""),
      resumeText: resumeText.trim(),
    };
    onSave(nextSetup);
  }

  return (
    <main className="prep-page">
      <nav className="prep-subnav" aria-label="Interview preparation">
        <button className="back-button" type="button" onClick={onCancel}>
          ← Saved setups
        </button>
      </nav>
      <header className="prep-heading">
        <h1>{setup ? "Edit interview setup" : "New interview setup"}</h1>
      </header>

      <form className="prep-form" onSubmit={handleSubmit}>
        <section className="prep-core-fields" aria-labelledby="prep-basics">
          <div className="prep-section-heading">
            <h2 id="prep-basics">Interview details</h2>
          </div>

          <div className="prep-fields-grid">
            <div>
              <label htmlFor={companyInputId}>Company</label>
              <input
                id={companyInputId}
                type="text"
                placeholder="Ex: Microsoft"
                value={company}
                onChange={(event) => setCompany(event.target.value)}
                required
              />
            </div>

            <div>
              <label htmlFor={roleInputId}>Role</label>
              <input
                id={roleInputId}
                type="text"
                placeholder="Ex: Software Engineer"
                value={role}
                onChange={(event) => setRole(event.target.value)}
                required
              />
            </div>

            <div className="prep-type-field">
              <label htmlFor={interviewTypeInputId}>Interview type</label>
              <select
                id={interviewTypeInputId}
                value={interviewType}
                onChange={(event) =>
                  setInterviewType(normalizeInterviewType(event.target.value))
                }
              >
                {INTERVIEW_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {interviewType === "other" && (
                <div>
                  <label htmlFor={otherTypeInputId}>Describe the interview type</label>
                  <input
                    id={otherTypeInputId}
                    type="text"
                    placeholder="For example: Panel interview"
                    value={otherInterviewType}
                    onChange={(event) => setOtherInterviewType(event.target.value)}
                  />
                </div>
              )}
            </div>
          </div>
        </section>

        <details
          className="prep-context"
          open={isContextOpen}
          onToggle={(event) => setIsContextOpen(event.currentTarget.open)}
        >
          <summary>Add context (optional)</summary>
          <div className="prep-context-fields">
            <div className="prep-resume-field">
              <label htmlFor={resumeInputId}>
                Select a PDF or DOCX resume (up to 5 MB)
              </label>
              <input
                ref={resumeInputRef}
                id={resumeInputId}
                type="file"
                accept=".pdf,.docx"
                onChange={handleResumeChange}
                aria-describedby={resumeHelpId}
                disabled={isExtractingResume}
              />
              <small id={resumeHelpId}>
                Text is extracted in this browser and saved as interview context.
                Selecting a file replaces the current resume context; review or
                edit the extracted text below before saving.
              </small>

              {isExtractingResume && (
                <p role="status">Extracting resume text…</p>
              )}
              {resumeFile && (
                <div className="prep-resume-status">
                  <p role="status">
                    Extracted from: <strong>{resumeFile.name}</strong>
                  </p>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => {
                      setResumeFile(null);
                      setResumeRemoved(true);
                      setResumeError("");
                      if (resumeInputRef.current) {
                        resumeInputRef.current.value = "";
                      }
                    }}
                  >
                    Remove file
                  </button>
                </div>
              )}

              {!resumeFile && setup?.resumeFileName && !resumeRemoved && (
                <p className="prep-summary-note">
                  Previously selected: <strong>{setup.resumeFileName}</strong>.
                  Files are temporary; select it again to use it in this
                  session.
                </p>
              )}

              {resumeError && <p role="alert">{resumeError}</p>}
            </div>

            <div className="prep-context-field">
              <label htmlFor={urlInputId}>Job description link</label>
              <input
                id={urlInputId}
                type="url"
                placeholder="https://company.com/careers/job"
                value={jobDescriptionUrl}
                onChange={(event) => setJobDescriptionUrl(event.target.value)}
              />
            </div>

            <div className="prep-context-field">
              <label htmlFor={descriptionInputId}>Job description</label>
              <textarea
                id={descriptionInputId}
                rows={6}
                placeholder="Paste the job description here"
                maxLength={20000}
                value={jobDescription}
                onChange={(event) => setJobDescription(event.target.value)}
              />
            </div>

            <div className="prep-context-field">
              <label htmlFor={resumeTextInputId}>Paste resume context (optional)</label>
              <textarea
                id={resumeTextInputId}
                rows={5}
                placeholder="Paste a brief summary of your experience, strengths, or project wins for this role"
                maxLength={30000}
                value={resumeText}
                onChange={(event) => setResumeText(event.target.value)}
              />
            </div>

            <div className="prep-context-field">
              <label htmlFor={instructionsInputId}>
                Anything in particular to focus on
              </label>
              <textarea
                id={instructionsInputId}
                rows={3}
                placeholder="Ex: Ask questions about my projects based on my resume"
                maxLength={10000}
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
              />
            </div>
          </div>
        </details>

        <div className="prep-submit-row">
          <button
            type="submit"
            disabled={isSaving || isExtractingResume || !company.trim() || !role.trim()}
          >
            {isSaving ? "Saving…" : setup ? "Save changes" : "Save setup"}
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={onCancel}
            disabled={isSaving || isExtractingResume}
          >
            Cancel
          </button>
        </div>
      </form>
    </main>
  );
}

export default InterviewSetupForm;
