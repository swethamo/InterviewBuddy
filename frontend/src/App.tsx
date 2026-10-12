// Root screen router: chooses the prep, history, and home views from the hash URL.
import { useEffect, useState } from "react";
import InterviewSetupForm from "./components/InterviewSetupForm";
import InterviewHistory from "./components/InterviewHistory";
import {
  navigatePrep,
  navigateScreen,
  readHistoryRoute,
  readPrepRoute,
} from "./services/historyNavigation";
import type { InterviewSetup } from "./types/interviewSetup";
import InterviewSetupList from "./components/InterviewSetupList";
import MockInterview from "./components/MockInterview";
import { usePrepSetups } from "./hooks/usePrepSetups";
import "./App.css";

type Screen = "home" | "prep" | "prepEdit" | "prepMock" | "history";

// Route-derived screen selection keeps the root shell aligned with browser history.
function readScreen(): Screen {
  const hash = window.location.hash; // reads the part of the URL beginning with #
  if (hash === "#/history" || hash.startsWith("#/history/")) {
    return "history";
  }
  if (hash === "#/prep" || hash.startsWith("#/prep/")) {
    const prepRoute = readPrepRoute();
    if (prepRoute.view === "edit") return "prepEdit";
    if (prepRoute.view === "mock") return "prepMock";
    return "prep";
  }
  return "home";
}

// Application shell: keeps the route state, saved setups, and active screen in sync.
function App() {
  const [screen, setScreen] = useState<Screen>(readScreen);
  const [historyRoute, setHistoryRoute] = useState(readHistoryRoute);
  const [prepRoute, setPrepRoute] = useState(readPrepRoute);
  const {
    setups: savedSetups,
    isLoading,
    isSaving,
    errorMessage,
    localImportMessage,
    saveSetup,
    deleteSetup,
    importLocalSetups,
    retryLoad,
  } = usePrepSetups();

  // Navigation effect: refresh the visible route when back/forward or hash-driven events fire.
  useEffect(() => {
    function syncScreen() {
      setScreen(readScreen());
      setHistoryRoute(readHistoryRoute());
      setPrepRoute(readPrepRoute());
    }
    // popstate is a browser event that fires when the user moves between browser history entries, usually by clicking Back or Forward.
    window.addEventListener("popstate", syncScreen);
    return () => window.removeEventListener("popstate", syncScreen);
  }, []);

  // Setup CRUD: wait for the backend response so the form stays intact when a save fails.
  async function handleSaveSetup(setup: InterviewSetup) {
    const result = await saveSetup(setup);
    if (result.status === "saved") {
      navigatePrep("list");
    }
  }

  // Setup deletion keeps destructive changes explicit and confirms the server-backed scope.
  async function handleDeleteSetup(setup: InterviewSetup) {
    if (
      !window.confirm(
        `Delete the saved setup for ${setup.company} — ${setup.role}? This removes it from the server-backed list.`,
      )
    ) {
      return;
    }

    const result = await deleteSetup(setup);
    if (result.status === "failed") {
      return;
    }
  }

  const activeSetup = savedSetups.find(
    (setup) => setup.id === prepRoute.setupId,
  );
  const activeScreen =
    !isLoading &&
    ((screen === "prepMock" || (screen === "prepEdit" && prepRoute.setupId)) &&
      !activeSetup)
      ? "prep"
      : screen;

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
      </header>

      {activeScreen !== "home" &&
        activeScreen !== "prepEdit" &&
        activeScreen !== "prepMock" &&
        !(activeScreen === "history" && historyRoute.view === "new") && (
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

      {activeScreen === "home" && (
        <main className="home">
          <div className="home-intro">
            <span className="eyebrow">YOUR INTERVIEW COMPANION</span>
            <h1>Prepare with purpose.</h1>
            <p>
              Practice interviewing, learn from previous experiences and build
              confidence one answer at a time.
            </p>
          </div>

          <div className="feature-grid">
            <article className="feature-card">
              <span className="card-number" aria-hidden="true">
                01
              </span>
              <h2>Prepare for an Interview</h2>
              <p>
                Tailored practice based your resume, job description and
                interview details.
              </p>
              <button type="button" onClick={() => navigateScreen("prep")}>
                Start preparing
              </button>
            </article>
            <article className="feature-card">
              <span className="card-number" aria-hidden="true">
                02
              </span>
              <h2>My Interview History</h2>
              <p>
                Revisit your previous company interview questions and strengthen
                your answers.
              </p>
              <button type="button" onClick={() => navigateScreen("history")}>
                View interviews
              </button>
            </article>
          </div>
        </main>
      )}

      {activeScreen === "prep" && (
        <InterviewSetupList
          setups={savedSetups}
          isLoading={isLoading}
          isSaving={isSaving}
          errorMessage={errorMessage}
          localImportMessage={localImportMessage}
          onAdd={() => navigatePrep("edit")}
          onEdit={(setup) => navigatePrep("edit", setup.id)}
          onStart={(setup) => navigatePrep("mock", setup.id)}
          onDelete={handleDeleteSetup}
          onImport={importLocalSetups}
          onRetry={retryLoad}
        />
      )}

      {activeScreen === "prepEdit" && (
        <InterviewSetupForm
          key={activeSetup?.id ?? "new"}
          setup={activeSetup ?? null}
          isSaving={isSaving}
          onSave={handleSaveSetup}
          onCancel={() => navigatePrep("list")}
        />
      )}

      {activeScreen === "prepMock" && activeSetup && (
        <MockInterview
          key={activeSetup.id}
          setup={activeSetup}
          onBack={() => navigatePrep("list")}
        />
      )}

      <div hidden={activeScreen !== "history"}>
        <InterviewHistory />
      </div>
    </>
  );
}

export default App;
