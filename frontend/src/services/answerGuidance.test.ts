import { afterEach, describe, expect, it, vi } from "vitest";
import { requestAnswerGuidance } from "./answerGuidance";

describe("requestAnswerGuidance", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends the typed interview context and maps the structured API response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        suggestedAnswer: "I would start with a measurable diagnosis.",
        relevantKeywords: ["diagnosis", "measurement"],
        strengtheningExplanation: "Add a specific outcome.",
      }),
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const request = {
      company: "Example Co",
      role: "Platform Engineer",
      round: "Technical",
      question: "How would you diagnose a slow service?",
      originalAnswer: "I checked the dashboard.",
    };

    await expect(requestAnswerGuidance(request)).resolves.toEqual({
      suggestedAnswer: "I would start with a measurable diagnosis.",
      emphasizedKeywords: ["diagnosis", "measurement"],
      strengtheningExplanation: "Add a specific outcome.",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/answer-guidance",
      expect.objectContaining({
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      }),
    );
  });

  it("surfaces backend configuration errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({
          message: "Answer generation is not configured.",
        }),
      } as Response),
    );

    await expect(
      requestAnswerGuidance({
        company: "Example Co",
        role: "Engineer",
        question: "Why this role?",
      }),
    ).rejects.toThrow("Answer generation is not configured.");
  });
});
