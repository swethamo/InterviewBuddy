// Mock interview shell: shows the interview context and the future chat room placeholder.
import { getInterviewTypeLabel } from "../services/interviewTypes";
import type { InterviewSetup } from "../types/interviewSetup";

type MockInterviewProps = {
  setup: InterviewSetup;
  onBack: () => void;
};

function MockInterview({ setup, onBack }: MockInterviewProps) {
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
          <h1>{setup.company}</h1>
          <p>
            {setup.role} <span aria-hidden="true">·</span>{" "}
            {setup.interviewType === "other"
              ? setup.interviewTypeOther || "Other"
              : getInterviewTypeLabel(setup.interviewType)}
          </p>
        </div>
        <div className="mock-timer" aria-label="Interview timer, not started">
          <span>SESSION TIMER</span>
          <strong>00:00</strong>
          <small>Starts when mock interview is connected</small>
        </div>
      </header>

      <div className="mock-layout">
        <section className="mock-chat" aria-labelledby="mock-chat-title">
          <div className="mock-chat-heading">
            <div>
              <h2 id="mock-chat-title">Interview room</h2>
              <span className="connection-status">
                <span aria-hidden="true" /> AI interviewer not connected
              </span>
            </div>
            <button type="button" disabled title="Available when AI is connected">
              Begin interview
            </button>
          </div>

          <div className="mock-chat-messages" aria-live="polite">
            <div className="mock-placeholder-avatar" aria-hidden="true">
              AI
            </div>
            <div className="mock-chat-placeholder">
              <strong>Your interviewer will start here</strong>
              <p>
                Once a backend is connected, this space can ask questions based
                on your role and interview context.
              </p>
            </div>
          </div>

          <form className="mock-chat-input" onSubmit={(event) => event.preventDefault()}>
            <label className="sr-only" htmlFor="mock-response">
              Your response
            </label>
            <textarea
              id="mock-response"
              placeholder="Your response will go here..."
              rows={2}
              disabled
            />
            <button type="submit" disabled>
              Send
            </button>
          </form>
          <p className="mock-disabled-note">
            Responses and interview timing will be enabled when AI is connected.
          </p>
        </section>

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
            <strong>
              {setup.interviewType === "other"
                ? setup.interviewTypeOther || "Other"
                : getInterviewTypeLabel(setup.interviewType)}
            </strong>
          </div>
          {setup.instructions && (
            <div>
              <span>Your focus</span>
              <p>{setup.instructions}</p>
            </div>
          )}
          {setup.jobDescriptionUrl && (
            <div>
              <span>Job posting</span>
              <a href={setup.jobDescriptionUrl} target="_blank" rel="noreferrer">
                Open job description
              </a>
            </div>
          )}
          {setup.jobDescription && (
            <details className="mock-job-description">
              <summary>View job description</summary>
              <p>{setup.jobDescription}</p>
            </details>
          )}
          {setup.resumeFileName && (
            <p className="mock-context-note">
              Resume noted: <strong>{setup.resumeFileName}</strong>. The file
              was not uploaded or read.
            </p>
          )}
          <div className="mock-research-note">
            <strong>Company research · planned</strong>
            <p>
              Research from company and job-posting pages, and relevant public
              sources such as Glassdoor or LinkedIn, could appear here when a
              compliant research service is connected. Nothing is being
              searched or scraped now.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}

export default MockInterview;
