import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import QuestionCard from "./QuestionCard";
import type {
  AnswerGuidanceProvider,
  AnswerSuggestion,
} from "../services/answerGuidance";

const suggestion: AnswerSuggestion = {
  suggestedAnswer: "I would investigate the bottleneck and validate the result.",
  emphasizedKeywords: ["bottleneck", "validate"],
  strengtheningExplanation: "Add the specific outcome you observed.",
};

function createCardProps(
  provider: AnswerGuidanceProvider,
  question = "How would you diagnose a slow service?",
) {
  return {
    item: {
      id: "question-1",
      question,
      originalAnswer: "I checked the dashboard.",
    },
    index: 0,
    company: "Example Co",
    role: "Platform Engineer",
    round: "Technical",
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    guidanceProvider: provider,
  };
}

describe("QuestionCard answer guidance", () => {
  it("shows a loading state, disables duplicate requests, and displays generated guidance", async () => {
    let resolveSuggestion: (value: AnswerSuggestion) => void = () => {};
    const provider = vi.fn(
      () => new Promise<AnswerSuggestion>((resolve) => {
        resolveSuggestion = resolve;
      }),
    );
    const props = createCardProps(provider);

    render(<QuestionCard {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Generate Answer" }));

    expect(screen.getByRole("status").textContent).toContain(
      "Generating an answer suggestion",
    );
    expect(screen.getByRole("button", { name: /Generating/ }).hasAttribute("disabled")).toBe(true);
    expect(provider).toHaveBeenCalledTimes(1);
    expect(provider).toHaveBeenCalledWith({
      company: "Example Co",
      role: "Platform Engineer",
      round: "Technical",
      question: "How would you diagnose a slow service?",
      originalAnswer: "I checked the dashboard.",
    });

    await act(async () => resolveSuggestion(suggestion));

    expect(await screen.findByText("AI-generated suggestion")).toBeTruthy();
    expect(screen.getByText(/Review and personalize/)).toBeTruthy();
    expect(document.querySelector(".suggested-answer")?.textContent).toContain(
      "investigate the bottleneck",
    );
    expect(
      screen.getByRole("list", { name: "Relevant keywords" }).textContent,
    ).toContain("bottleneck");
    expect(screen.getByText(/Add the specific outcome/)).toBeTruthy();
    expect(props.item.originalAnswer).toBe("I checked the dashboard.");

    fireEvent.click(screen.getByRole("button", { name: "Regenerate" }));
    expect(provider).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("status").textContent).toContain(
      "Generating an answer suggestion",
    );
    await act(async () => resolveSuggestion(suggestion));
    expect(await screen.findByText("AI-generated suggestion")).toBeTruthy();
  });

  it("shows failures and allows retry", async () => {
    const provider = vi
      .fn<AnswerGuidanceProvider>()
      .mockRejectedValueOnce(new Error("Answer generation is not configured."))
      .mockResolvedValueOnce(suggestion);

    render(<QuestionCard {...createCardProps(provider)} />);
    fireEvent.click(screen.getByRole("button", { name: "Generate Answer" }));

    expect(await screen.findByText("Answer generation is not configured.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("AI-generated suggestion")).toBeTruthy();
    expect(provider).toHaveBeenCalledTimes(2);
  });

  it("keeps a late result from an old question from replacing the selected question's result", async () => {
    const pending: Array<(value: AnswerSuggestion) => void> = [];
    const provider = vi.fn<AnswerGuidanceProvider>(
      () => new Promise((resolve) => pending.push(resolve)),
    );
    const originalProps = createCardProps(provider, "Old question?");
    const { rerender } = render(<QuestionCard {...originalProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Generate Answer" }));

    const nextProps = {
      ...originalProps,
      item: { ...originalProps.item, question: "New question?" },
    };
    rerender(<QuestionCard {...nextProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Generate Answer" }));

    await act(async () => pending[1](suggestion));
    expect(await screen.findByText("AI-generated suggestion")).toBeTruthy();

    await act(async () => pending[0]({
      ...suggestion,
      suggestedAnswer: "This answer belongs to the old question.",
    }));

    await waitFor(() => {
      expect(screen.queryByText("This answer belongs to the old question.")).toBeNull();
      expect(document.querySelector(".suggested-answer")?.textContent).toContain(
        "investigate the bottleneck",
      );
    });
    expect(provider).toHaveBeenCalledTimes(2);
  });
});
