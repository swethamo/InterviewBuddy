import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";

// Describes the data we collect for an interview.
type InterviewSetup = {
  company: string;
  role: string;
  interviewType: string;
  jobDescription: string;
  jobDescriptionUrl: string;
  instructions: string;
};

function InterviewSetupForm() {
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [interviewType, setInterviewType] = useState("Recruiter call");
  const [jobDescription, setJobDescription] = useState("");
  const [jobDescriptionUrl, setJobDescriptionUrl] = useState("");
  const [instructions, setInstructions] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeError, setResumeError] = useState("");
  const [isContextOpen, setIsContextOpen] = useState(false);

  // null means the user hasn't submitted a setup yet.
  const [submittedSetup, setSubmittedSetup] = useState<InterviewSetup | null>(
    null,
  );

  function handleResumeChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    setResumeFile(null);
    setResumeError("");

    // The user may cancel the file picker.
    if (!file) {
      return;
    }

    const extension = file.name.split(".").pop()?.toLowerCase();
    const allowedExtensions = ["pdf", "docx"];
    const maxSize = 5 * 1024 * 1024;

    if (!extension || !allowedExtensions.includes(extension)) {
      setResumeError("Please select a PDF or DOCX file.");
      event.target.value = "";
      return;
    }

    if (file.size > maxSize) {
      setResumeError("Please select a file no larger than 5 MB.");
      event.target.value = "";
      return;
    }

    setResumeFile(file);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // Prevent the browser from reloading the page.
    event.preventDefault();

    const cleanedCompany = company.trim();
    const cleanedRole = role.trim();

    // Reject values that contain only spaces.
    if (!cleanedCompany || !cleanedRole) {
      return;
    }

    // Save a snapshot of the form values.
    setSubmittedSetup({
      company: cleanedCompany,
      role: cleanedRole,
      interviewType,
      jobDescription: jobDescription.trim(),
      jobDescriptionUrl: jobDescriptionUrl.trim(),
      instructions: instructions.trim(),
    });
  }

  return (
    <main className="prep-page">
      <header className="prep-heading">
        <span className="section-kicker">GET READY</span>
        <h1>Interview Prep</h1>
        <p>Start with the role. Add any context that will help you prepare.</p>
      </header>

      <form className="prep-form" onSubmit={handleSubmit}>
        <section className="prep-core-fields" aria-labelledby="prep-basics">
          <div className="prep-section-heading">
            <h2 id="prep-basics">Interview details</h2>
            <p>Just the essentials to get started.</p>
          </div>

          <div className="prep-fields-grid">
            <div>
              <label htmlFor="company">Company</label>
              <input
                id="company"
                type="text"
                placeholder="For example, Hubbell"
                value={company}
                onChange={(event) => setCompany(event.target.value)}
                required
              />
            </div>

            <div>
              <label htmlFor="role">Role</label>
              <input
                id="role"
                type="text"
                placeholder="For example, Software Engineer"
                value={role}
                onChange={(event) => setRole(event.target.value)}
                required
              />
            </div>

            <div className="prep-type-field">
              <label htmlFor="interviewType">Interview type</label>
              <select
                id="interviewType"
                value={interviewType}
                onChange={(event) => setInterviewType(event.target.value)}
              >
                <option>Recruiter call</option>
                <option>Manager round</option>
                <option>Technical round</option>
                <option>Behavioral round</option>
                <option>Live coding</option>
                <option>Online assessment</option>
                <option>Other</option>
              </select>
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
              <label htmlFor="resume">Resume file</label>
              <input
                id="resume"
                type="file"
                accept=".pdf,.docx"
                onChange={handleResumeChange}
                aria-describedby="resume-help"
              />
              <small id="resume-help">
                PDF or DOCX, up to 5 MB. This file is only selected in this
                session; it is not uploaded or read.
              </small>

              {resumeFile && (
                <div className="prep-resume-status">
                  <p role="status">
                    Selected, not processed: <strong>{resumeFile.name}</strong>
                  </p>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => {
                      setResumeFile(null);
                      setResumeError("");
                    }}
                  >
                    Remove file
                  </button>
                </div>
              )}

              {resumeError && <p role="alert">{resumeError}</p>}
            </div>

            <div className="prep-context-field">
              <label htmlFor="jobDescriptionUrl">
                Job description link (optional)
              </label>
              <input
                id="jobDescriptionUrl"
                type="url"
                placeholder="https://company.com/careers/job"
                value={jobDescriptionUrl}
                onChange={(event) => setJobDescriptionUrl(event.target.value)}
              />
            </div>

            <div className="prep-context-field">
              <label htmlFor="jobDescription">
                Job description (optional)
              </label>
              <textarea
                id="jobDescription"
                rows={6}
                placeholder="Paste the job description here"
                value={jobDescription}
                onChange={(event) => setJobDescription(event.target.value)}
              />
            </div>

            <div className="prep-context-field">
              <label htmlFor="instructions">
                What would you like to focus on? (optional)
              </label>
              <textarea
                id="instructions"
                rows={3}
                placeholder="For example: practice a project walkthrough and Java coding"
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
              />
            </div>
          </div>
        </details>

        <div className="prep-submit-row">
          <button type="submit" disabled={!company.trim() || !role.trim()}>
            Save interview setup
          </button>
          <small>Saved as a preview in this session; no AI service is connected.</small>
        </div>
      </form>

      {submittedSetup && (
        <section className="prep-summary" aria-label="Saved interview setup">
          <span className="section-kicker">SETUP SAVED</span>
          <h2>
            {submittedSetup.company} <span aria-hidden="true">/</span>{" "}
            {submittedSetup.role}
          </h2>
          <p className="prep-summary-type">{submittedSetup.interviewType}</p>
          {submittedSetup.jobDescriptionUrl && (
            <p>
              <a
                href={submittedSetup.jobDescriptionUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open job posting
              </a>
            </p>
          )}
          {submittedSetup.jobDescription && (
            <details>
              <summary>View job description</summary>
              <p className="multiline">
                {submittedSetup.jobDescription}
              </p>
            </details>
          )}
          {submittedSetup.instructions && (
            <div className="prep-summary-instructions">
              <h3>Your focus</h3>
              <p className="multiline">{submittedSetup.instructions}</p>
            </div>
          )}
        </section>
      )}
    </main>
  );
}

export default InterviewSetupForm;