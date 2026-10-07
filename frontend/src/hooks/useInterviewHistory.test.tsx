// History hook tests: cover backend-confirmed state changes, failures, and legacy import retries.
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useInterviewHistory } from "./useInterviewHistory";

const localRecords = [
  {
    id: "local-one",
    company: "Legacy One",
    role: "Engineer",
    resumeText: "Built APIs.",
    rounds: [
      {
        id: "round-one",
        name: "Phone screen",
        date: "",
        questions: [
          {
            id: "question-one",
            question: "Tell me about a project?",
            originalAnswer: "I built a service.",
          },
        ],
      },
    ],
  },
  {
    id: "local-two",
    company: "Legacy Two",
    role: "Designer",
    resumeText: "",
    rounds: [],
  },
];

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as Response;
}

describe("useInterviewHistory", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps loaded records unchanged when a nested save fails", async () => {
    const existingInterview = {
      id: "server-interview",
      company: "Existing Co",
      role: "Engineer",
      resumeText: "",
      rounds: [],
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      if (url === "/api/interviews" && !init?.method) {
        return jsonResponse([existingInterview]);
      }
      if (url === "/api/interviews/server-interview/rounds") {
        return jsonResponse({ message: "The round could not be saved." }, 500);
      }
      throw new Error(`Unexpected request ${init?.method ?? "GET"} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useInterviewHistory());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let saveResult: Awaited<ReturnType<typeof result.current.createInterviewRound>>;
    await act(async () => {
      saveResult = await result.current.createInterviewRound(
        "server-interview",
        { name: "Technical", date: "" },
      );
    });

    expect(saveResult!.status).toBe("failed");
    expect(result.current.records).toEqual([existingInterview]);
    expect(result.current.errorMessage).toBe("The round could not be saved.");
  });

  it("removes a record after a successful 204 response without parsing JSON", async () => {
    const interview = {
      id: "delete-me",
      company: "Example Co",
      role: "Engineer",
      resumeText: "",
      rounds: [],
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url === "/api/interviews" && !init?.method) {
        return jsonResponse([interview]);
      }
      if (url === "/api/interviews/delete-me" && init?.method === "DELETE") {
        return {
          ok: true,
          status: 204,
          json: vi.fn(() => {
            throw new Error("204 response must not be parsed");
          }),
        } as unknown as Response;
      }
      throw new Error(`Unexpected request ${init?.method ?? "GET"} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useInterviewHistory());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      const outcome = await result.current.removeRecord("delete-me");
      expect(outcome.status).toBe("success");
    });

    expect(result.current.records).toEqual([]);
    expect(result.current.isDeleting).toBe(false);
  });

  it("imports legacy history incrementally and retains source data for retry", async () => {
    const legacyJson = JSON.stringify(localRecords);
    localStorage.setItem("interview-history-v1", legacyJson);
    let secondImportAttempt = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      if (url === "/api/interviews" && !init?.method) {
        return jsonResponse([]);
      }
      if (url === "/api/interviews" && init?.method === "POST") {
        const payload = JSON.parse(String(init.body)) as {
          legacyImportId: string;
          company: string;
          role: string;
          rounds: Array<{
            name: string;
            questions: Array<{ question: string; originalAnswer: string }>;
          }>;
        };
        if (payload.legacyImportId === "local-two" && secondImportAttempt++ === 0) {
          return jsonResponse({ message: "Import temporarily failed." }, 500);
        }
        return jsonResponse(
          {
            id: `server-${payload.legacyImportId}`,
            company: payload.company,
            role: payload.role,
            resumeText: "",
            rounds: payload.rounds.map((round, roundIndex) => ({
              id: `${payload.legacyImportId}-round-${roundIndex}`,
              ...round,
              date: null,
              questions: round.questions.map((question, questionIndex) => ({
                id: `${payload.legacyImportId}-question-${questionIndex}`,
                ...question,
              })),
            })),
          },
          201,
        );
      }
      throw new Error(`Unexpected request ${init?.method ?? "GET"} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useInterviewHistory());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.legacyImportAvailable).toBe(true);

    await act(async () => {
      const first = await result.current.importLegacyHistory();
      expect(first.status).toBe("failed");
    });

    expect(localStorage.getItem("interview-history-v1")).toBe(legacyJson);
    expect(result.current.records.map((record) => record.id)).toEqual([
      "server-local-one",
    ]);
    expect(result.current.legacyImportAvailable).toBe(true);

    await act(async () => {
      const retry = await result.current.importLegacyHistory();
      expect(retry.status).toBe("success");
    });

    expect(result.current.records.map((record) => record.id)).toEqual([
      "server-local-one",
      "server-local-two",
    ]);
    const postBodies = fetchMock.mock.calls
      .filter(([, init]) => init?.method === "POST")
      .map(([, init]) => JSON.parse(String(init?.body)) as { legacyImportId: string });
    expect(postBodies.map((body) => body.legacyImportId)).toEqual([
      "local-one",
      "local-two",
      "local-two",
    ]);
    expect(result.current.legacyImportAvailable).toBe(false);
  });
});
