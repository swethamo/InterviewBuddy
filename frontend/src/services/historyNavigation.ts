// Route helper: decodes hash-based screens and keeps prep/history routing consistent.
export type HistoryRoute = {
  view: "list" | "new";
  interviewId: string | null;
  roundId: string | null;
};

export type PrepRoute = {
  view: "list" | "edit" | "mock";
  setupId: string | null;
};

function safeDecode(value: string | undefined | null) {
  if (!value) return null;

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function readPrepRoute(): PrepRoute {
  const match = window.location.hash.match(
    /^#\/prep(?:\/(edit|mock)(?:\/([^/]+))?)?$/,
  );
  if (!match) return { view: "list", setupId: null };

  const setupId = safeDecode(match[2]);
  return {
    view: match[1] === "edit" ? "edit" : match[1] === "mock" ? "mock" : "list",
    setupId: match[2] ? setupId : null,
  };
}

export function navigatePrep(
  view: PrepRoute["view"],
  setupId: string | null = null,
) {
  const path =
    view === "list"
      ? "#/prep"
      : `#/prep/${view}${setupId ? `/${encodeURIComponent(setupId)}` : ""}`;
  window.history.pushState(
    { app: "interview-buddy", screen: "prep", view, setupId },
    "",
    path,
  );
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function readHistoryRoute(): HistoryRoute {
  if (window.location.hash === "#/history/new") {
    return { view: "new", interviewId: null, roundId: null };
  }

  const match = window.location.hash.match(
    /^#\/history(?:\/([^/]+))?(?:\/([^/]+))?$/,
  );

  if (!match) {
    return { view: "list", interviewId: null, roundId: null };
  }

  return {
    view: "list",
    interviewId: match[1] ? safeDecode(match[1]) : null,
    roundId: match[2] ? safeDecode(match[2]) : null,
  };
}

export function navigateNewInterview() {
  window.history.pushState(
    { app: "interview-buddy", screen: "history", view: "new" },
    "",
    "#/history/new",
  );
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function navigateHistory(
  interviewId: string | null = null,
  roundId: string | null = null,
) {
  const parts = ["history"];
  if (interviewId) parts.push(encodeURIComponent(interviewId));
  if (roundId) parts.push(encodeURIComponent(roundId));
  window.history.pushState(
    { app: "interview-buddy", screen: "history", interviewId, roundId },
    "",
    `#/${parts.join("/")}`,
  );
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function navigateScreen(screen: "home" | "prep" | "history") {
  const hash = screen === "home" ? "#/home" : `#/${screen}`;
  window.history.pushState(
    { app: "interview-buddy", screen },
    "",
    hash,
  );
  window.dispatchEvent(new PopStateEvent("popstate"));
}
