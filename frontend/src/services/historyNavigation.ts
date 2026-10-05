export type HistoryRoute = {
  interviewId: string | null;
  roundId: string | null;
};

export function readHistoryRoute(): HistoryRoute {
  const match = window.location.hash.match(
    /^#\/history(?:\/([^/]+))?(?:\/([^/]+))?$/,
  );

  if (!match) return { interviewId: null, roundId: null };

  return {
    interviewId: match[1] ? decodeURIComponent(match[1]) : null,
    roundId: match[2] ? decodeURIComponent(match[2]) : null,
  };
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
