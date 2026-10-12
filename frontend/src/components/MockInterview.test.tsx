import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MockInterview from "./MockInterview";
import type { InterviewSetup } from "../types/interviewSetup";
import type { MockInterviewSession } from "../services/mockInterviewApi";
import {
  continueMockInterview,
  endMockInterview,
  generateMockInterviewReview,
  getLatestMockInterview,
  getMockInterview,
  getMockInterviewHistory,
  getMockInterviewAvailability,
  saveMockInterviewDraft,
  startMockInterview,
  submitMockInterviewAnswer,
} from "../services/mockInterviewApi";

type FakeSpeechResult = {
  isFinal: boolean;
  0: { transcript: string };
};

type FakeSpeechInstance = {
  onresult: ((event: {
    resultIndex: number;
    results: ArrayLike<FakeSpeechResult>;
  }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  abort: ReturnType<typeof vi.fn>;
};

vi.mock("../services/mockInterviewApi", () => ({
  continueMockInterview: vi.fn(),
  endMockInterview: vi.fn(),
  generateMockInterviewReview: vi.fn(),
  getLatestMockInterview: vi.fn(),
  getMockInterview: vi.fn(),
  getMockInterviewHistory: vi.fn(),
  getMockInterviewAvailability: vi.fn(),
  saveMockInterviewDraft: vi.fn(),
  skipMockInterviewQuestion: vi.fn(),
  startMockInterview: vi.fn(),
  submitMockInterviewAnswer: vi.fn(),
}));

const setup: InterviewSetup = {
  id: "setup-1",
  company: "Contoso",
  role: "Backend Engineer",
  interviewType: "technical",
  jobDescription: "Build reliable payment services.",
  jobDescriptionUrl: "",
  instructions: "Ask about design tradeoffs.",
  resumeFileName: "resume.pdf",
  resumeText: "Built a payment service.",
};

let originalSpeechRecognition: PropertyDescriptor | undefined;

function turn(
  id: string,
  question: string,
  options: Partial<MockInterviewSession["conversation"][number]> = {},
) {
  return {
    id,
    sequence: 0,
    topic: "System design",
    question,
    kind: "MAIN" as const,
    answer: null,
    draftAnswer: null,
    answeredAt: null,
    skipped: false,
    feedback: null,
    ...options,
  };
}

function session(
  options: Partial<MockInterviewSession> = {},
): MockInterviewSession {
  const active = turn("question-1", "How would you design a payment service?");
  return {
    id: "session-1",
    setupId: setup.id,
    status: "IN_PROGRESS",
    durationMinutes: 15,
    startedAt: new Date().toISOString(),
    deadline: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    endedAt: null,
    company: setup.company,
    role: setup.role,
    interviewType: setup.interviewType,
    interviewTypeOther: null,
    jobDescription: setup.jobDescription,
    jobDescriptionUrl: "",
    instructions: setup.instructions,
    resumeContextAvailable: true,
    currentQuestionId: active.id,
    currentQuestion: active.question,
    currentTopic: active.topic,
    currentQuestionKind: "MAIN",
    conversation: [active],
    coveredTopics: [],
    totalTopics: 4,
    followUpsUsed: 0,
    review: null,
    ...options,
  };
}

function completedSession(
  activeSession: MockInterviewSession,
): MockInterviewSession {
  return {
    ...activeSession,
    status: "EXPIRED",
    endedAt: new Date().toISOString(),
    currentQuestionId: null,
    currentQuestion: null,
    currentTopic: null,
    currentQuestionKind: null,
  };
}

function mockPreflight(latest: MockInterviewSession | null) {
  vi.mocked(getMockInterviewAvailability).mockResolvedValue({
    available: true,
    message: "",
  });
  vi.mocked(getLatestMockInterview).mockResolvedValue(latest);
}

beforeEach(() => {
  localStorage.clear();
  vi.resetAllMocks();
  originalSpeechRecognition = Object.getOwnPropertyDescriptor(
    window,
    "SpeechRecognition",
  );
  vi.mocked(saveMockInterviewDraft).mockResolvedValue(session());
  vi.mocked(getMockInterviewHistory).mockResolvedValue([]);
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalSpeechRecognition) {
    Object.defineProperty(window, "SpeechRecognition", originalSpeechRecognition);
  } else {
    Reflect.deleteProperty(window, "SpeechRecognition");
  }
  vi.useRealTimers();
});

describe("MockInterview", () => {
  it("explains missing AI configuration and does not start a timer or session", async () => {
    vi.mocked(getMockInterviewAvailability).mockResolvedValue({
      available: false,
      message: "Set the backend AI key.",
    });
    vi.mocked(getLatestMockInterview).mockResolvedValue(null);

    render(<MockInterview setup={setup} onBack={vi.fn()} />);

    expect(await screen.findByText("Set the backend AI key.")).toBeTruthy();
    expect((screen.getByLabelText("Interview duration") as HTMLSelectElement).value).toBe("30");
    expect((screen.getByRole("button", { name: "Start interview" }) as HTMLButtonElement).disabled).toBe(true);
    expect(startMockInterview).not.toHaveBeenCalled();
    expect(screen.queryByText("TIME REMAINING")).toBeNull();
  });

  it("starts only after clicking Start interview and sends the selected duration", async () => {
    mockPreflight(null);
    const started = session({
      deadline: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
      durationMinutes: 45,
    });
    vi.mocked(startMockInterview).mockResolvedValue(started);

    render(<MockInterview setup={setup} onBack={vi.fn()} />);

    const startButton = await screen.findByRole("button", {
      name: "Start interview",
    });
    expect(startMockInterview).not.toHaveBeenCalled();
    expect(screen.queryByText("TIME REMAINING")).toBeNull();

    fireEvent.change(screen.getByLabelText("Interview duration"), {
      target: { value: "45" },
    });
    fireEvent.click(startButton);

    await screen.findByText("How would you design a payment service?");
    expect(startMockInterview).toHaveBeenCalledWith(setup.id, 45);
    expect(screen.getByText("TIME REMAINING")).toBeTruthy();
  });

  it("transcribes voice into an editable answer and waits for explicit submission", async () => {
    mockPreflight(session());
    vi.mocked(submitMockInterviewAnswer).mockResolvedValue(
      session({
        currentQuestionId: "question-2",
        currentQuestion: "How did you test it?",
        currentTopic: "Testing",
        conversation: [
          turn("question-1", "How would you design a payment service?", {
            answer: "I led the migration.",
          }),
          turn("question-2", "How did you test it?", { sequence: 1 }),
        ],
      }),
    );

    const recognitionHolder: { current: FakeSpeechInstance | null } = {
      current: null,
    };
    class MockRecognition {
      lang = "";
      continuous = false;
      interimResults = false;
      onresult: FakeSpeechInstance["onresult"] = null;
      onerror: ((event: { error: string }) => void) | null = null;
      onend: (() => void) | null = null;
      start = vi.fn();
      stop = vi.fn();
      abort = vi.fn();
      constructor() {
        recognitionHolder.current = this;
      }
    }
    Object.defineProperty(window, "SpeechRecognition", {
      configurable: true,
      value: MockRecognition,
    });

    render(<MockInterview setup={setup} onBack={vi.fn()} />);

    await screen.findByText("How would you design a payment service?");
    fireEvent.click(screen.getByRole("button", { name: "Start recording" }));
    expect(screen.getByText("Recording · microphone active")).toBeTruthy();
    expect(recognitionHolder.current?.start).toHaveBeenCalledOnce();
    act(() => {
      recognitionHolder.current?.onresult?.({
        resultIndex: 0,
        results: [
          { isFinal: true, 0: { transcript: "I led the migration." } },
        ],
      });
      recognitionHolder.current?.onend?.();
    });

    const answer = screen.getByLabelText("Your answer") as HTMLTextAreaElement;
    expect(answer.value).toBe("I led the migration.");
    expect(
      localStorage.getItem("interviewbuddy.mock-draft.session-1.question-1"),
    ).toBe("I led the migration.");
    expect(
      screen.getByText("Transcription ready. Review and edit it before submitting."),
    ).toBeTruthy();
    expect(submitMockInterviewAnswer).not.toHaveBeenCalled();

    fireEvent.change(answer, {
      target: { value: "I led the migration and reduced latency." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit answer" }));

    await screen.findByText("How did you test it?");
    expect(submitMockInterviewAnswer).toHaveBeenCalledWith(
      "session-1",
      "question-1",
      "I led the migration and reduced latency.",
    );
  });

  it("explains microphone permission denial and keeps typed answers available", async () => {
    mockPreflight(session());
    const recognitionHolder: { current: FakeSpeechInstance | null } = {
      current: null,
    };
    class PermissionDeniedRecognition {
      lang = "";
      continuous = false;
      interimResults = false;
      onresult: FakeSpeechInstance["onresult"] = null;
      onerror: FakeSpeechInstance["onerror"] = null;
      onend: FakeSpeechInstance["onend"] = null;
      start = vi.fn();
      stop = vi.fn();
      abort = vi.fn();
      constructor() {
        recognitionHolder.current = this;
      }
    }
    Object.defineProperty(window, "SpeechRecognition", {
      configurable: true,
      value: PermissionDeniedRecognition,
    });

    render(<MockInterview setup={setup} onBack={vi.fn()} />);
    await screen.findByText("How would you design a payment service?");
    fireEvent.click(screen.getByRole("button", { name: "Start recording" }));
    act(() => {
      recognitionHolder.current?.onerror?.({ error: "not-allowed" });
    });

    expect(
      await screen.findByText(/Microphone permission was denied/),
    ).toBeTruthy();
    expect(screen.getByLabelText("Your answer")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Submit answer" })).toBeTruthy();
  });

  it("aborts microphone capture when leaving the interview screen", async () => {
    mockPreflight(session());
    const recognitionHolder: { current: FakeSpeechInstance | null } = {
      current: null,
    };
    class MockRecognition {
      lang = "";
      continuous = false;
      interimResults = false;
      onresult: FakeSpeechInstance["onresult"] = null;
      onerror: FakeSpeechInstance["onerror"] = null;
      onend: FakeSpeechInstance["onend"] = null;
      start = vi.fn();
      stop = vi.fn();
      abort = vi.fn();
      constructor() {
        recognitionHolder.current = this;
      }
    }
    Object.defineProperty(window, "SpeechRecognition", {
      configurable: true,
      value: MockRecognition,
    });

    const { unmount } = render(
      <MockInterview setup={setup} onBack={vi.fn()} />,
    );
    await screen.findByText("How would you design a payment service?");
    fireEvent.click(screen.getByRole("button", { name: "Start recording" }));
    unmount();

    expect(recognitionHolder.current?.abort).toHaveBeenCalledOnce();
  });

  it("restores an unsent answer draft when the deadline expires", async () => {
    const active = session({
      deadline: new Date(Date.now() + 1800).toISOString(),
    });
    localStorage.setItem(
      "interviewbuddy.mock-draft.session-1.question-1",
      "An unfinished thought.",
    );
    mockPreflight(active);
    const ended = completedSession(active);
    vi.mocked(endMockInterview).mockResolvedValue(ended);
    vi.mocked(generateMockInterviewReview).mockResolvedValue({
      ...ended,
      review: {
        summary: "The timer expired before an answer was submitted.",
        strengths: ["You started the session."],
        areasToPractice: ["Practice concise answers."],
        topicsCovered: [],
        topicsNotReached: ["System design"],
        turns: [
          turn("question-1", "How would you design a payment service?", {
            draftAnswer: null,
          }),
        ],
      },
    });

    render(<MockInterview setup={setup} onBack={vi.fn()} />);
    expect(await screen.findByText("How would you design a payment service?")).toBeTruthy();
    await waitFor(() =>
      expect(endMockInterview).toHaveBeenCalledWith("session-1"),
      { timeout: 4000 },
    );
    expect(generateMockInterviewReview).toHaveBeenCalledWith("session-1");
    expect(await screen.findByText("An unfinished thought.")).toBeTruthy();
    expect(screen.getByText("Unanswered — no answer submitted")).toBeTruthy();
    expect(submitMockInterviewAnswer).not.toHaveBeenCalled();
  });

  it("keeps typed answers available when speech recognition is unsupported", async () => {
    mockPreflight(session());
    vi.mocked(submitMockInterviewAnswer).mockResolvedValue(
      session({
        currentQuestionId: "question-2",
        currentQuestion: "A follow-up question?",
        conversation: [
          turn("question-1", "How would you design a payment service?", {
            answer: "A typed answer.",
          }),
          turn("question-2", "A follow-up question?", { sequence: 1 }),
        ],
      }),
    );

    render(<MockInterview setup={setup} onBack={vi.fn()} />);

    await screen.findByText("Speech recognition is unavailable in this browser. You can still type your answer.");
    fireEvent.change(screen.getByLabelText("Your answer"), {
      target: { value: "A typed answer." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit answer" }));
    await screen.findByText("A follow-up question?");
    expect(submitMockInterviewAnswer).toHaveBeenCalledWith(
      "session-1",
      "question-1",
      "A typed answer.",
    );
  });

  it("reopens a persisted review from this setup's past sessions", async () => {
    mockPreflight(null);
    vi.mocked(getMockInterviewHistory).mockResolvedValue([
      {
        id: "old-session",
        status: "COMPLETED",
        durationMinutes: 30,
        startedAt: "2026-10-12T12:00:00Z",
        endedAt: "2026-10-12T12:30:00Z",
        company: setup.company,
        role: setup.role,
        answersSubmitted: 1,
        reviewAvailable: true,
      },
    ]);
    vi.mocked(getMockInterview).mockResolvedValue({
      ...session({
        id: "old-session",
        status: "COMPLETED",
        endedAt: "2026-10-12T12:30:00Z",
        currentQuestionId: null,
        currentQuestion: null,
        currentTopic: null,
        currentQuestionKind: null,
        conversation: [
          turn("old-question", "Tell me about your design.", {
            answer: "I designed a resilient service.",
          }),
        ],
        review: {
          summary: "A relevant, clear answer.",
          strengths: ["You addressed the design needs."],
          areasToPractice: ["Add a measurable outcome."],
          topicsCovered: ["System design"],
          topicsNotReached: [],
          turns: [
            turn("old-question", "Tell me about your design.", {
              answer: "I designed a resilient service.",
              feedback: {
                relevance: "Directly addressed the design prompt.",
                clarity: "The explanation was clear.",
                completeness: "The answer included an approach.",
                technicalAccuracy: "The described design was sound.",
                improvement: "Add a measurable result.",
              },
            }),
          ],
        },
      }),
    });

    render(<MockInterview setup={setup} onBack={vi.fn()} />);

    fireEvent.click(await screen.findByRole("button", { name: "View review" }));

    expect(await screen.findByText("A relevant, clear answer.")).toBeTruthy();
    expect(screen.getByText("Add a measurable result.")).toBeTruthy();
    expect(getMockInterview).toHaveBeenCalledWith("old-session");
  });

  it("preserves a submitted answer after an AI failure and retries question generation", async () => {
    mockPreflight(session());
    const savedAfterFailure = session({
      currentQuestionId: null,
      currentQuestion: null,
      currentTopic: null,
      currentQuestionKind: null,
      conversation: [
        turn("question-1", "How would you design a payment service?", {
          answer: "A persisted answer.",
        }),
      ],
    });
    vi.mocked(submitMockInterviewAnswer).mockRejectedValue(
      new Error("The AI provider timed out."),
    );
    vi.mocked(getMockInterview).mockResolvedValue(savedAfterFailure);
    vi.mocked(continueMockInterview).mockResolvedValue(
      session({
        currentQuestionId: "question-2",
        currentQuestion: "How would you validate a payment?",
        currentTopic: "Validation",
        conversation: [
          turn("question-1", "How would you design a payment service?", {
            answer: "A persisted answer.",
          }),
          turn("question-2", "How would you validate a payment?", {
            sequence: 1,
            topic: "Validation",
          }),
        ],
      }),
    );

    render(<MockInterview setup={setup} onBack={vi.fn()} />);
    await screen.findByText("How would you design a payment service?");
    fireEvent.change(screen.getByLabelText("Your answer"), {
      target: { value: "A persisted answer." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit answer" }));

    expect(await screen.findByText(/Your answer was saved/)).toBeTruthy();
    expect(screen.getByText("A persisted answer.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry next question" }));

    expect(await screen.findByText("How would you validate a payment?")).toBeTruthy();
    expect(continueMockInterview).toHaveBeenCalledWith("session-1");
  });
});
