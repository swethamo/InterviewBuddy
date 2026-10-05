import { useEffect, useState } from "react";
import InterviewSetupForm from "./components/InterviewSetupForm";
import InterviewHistory from "./components/InterviewHistory";
import { navigateScreen, readHistoryRoute } from "./services/historyNavigation";
import "./App.css";

type Screen = "home" | "prep" | "history";

function readScreen(): Screen {
  const { interviewId } = readHistoryRoute();
  const hash = window.location.hash;
  if (hash === "#/history" || hash.startsWith("#/history/") || interviewId) {
    return "history";
  }
  if (hash === "#/prep") return "prep";
  return "home";
}

function App() {
  const [screen, setScreen] = useState<Screen>(readScreen);

  useEffect(() => {
    function syncScreen() {
      setScreen(readScreen());
    }

    window.addEventListener("popstate", syncScreen);
    return () => window.removeEventListener("popstate", syncScreen);
  }, []);

  return (
    <>
      <header className="site-header">
        <button
          className="brand"
          type="button"
          onClick={() => navigateScreen("home")}
        >
          Interview Buddy
        </button>
        <span>Your next interview starts here.</span>
      </header>

      {screen !== "home" && (
        <nav className="back-nav" aria-label="Navigation">
          <button
            className="back-button"
            type="button"
            onClick={() => navigateScreen("home")}
          >
            ← Back to home
          </button>
        </nav>
      )}

      {screen === "home" && (
        <main className="home">
          <div className="home-intro">
            <span className="eyebrow">YOUR INTERVIEW COMPANION</span>
            <h1>Prepare with purpose.</h1>
            <p>
              Practice your next interview, learn from previous rounds, and
              build confidence one answer at a time.
            </p>
          </div>

          <div className="feature-grid">
            <article className="feature-card">
              <span className="card-number" aria-hidden="true">
                01
              </span>
              <h2>Prepare for an Interview</h2>
              <p>
                Set up practice around your resume, job description, and
                interview stage.
              </p>
              <button type="button" onClick={() => navigateScreen("prep")}>
                Start preparing →
              </button>
            </article>
            <article className="feature-card">
              <span className="card-number" aria-hidden="true">
                02
              </span>
              <h2>My Interview History</h2>
              <p>
                Revisit company interviews, record questions, and improve your
                answers.
              </p>
              <button type="button" onClick={() => navigateScreen("history")}>
                View interviews →
              </button>
            </article>
          </div>
        </main>
      )}

      {/* Keep the form mounted so navigating home preserves its state. */}
      <div hidden={screen !== "prep"}>
        <InterviewSetupForm />
      </div>

      <div hidden={screen !== "history"}>
        <InterviewHistory />
      </div>
    </>
  );
}

export default App;
