import { afterEach, expect, it, vi } from "vitest";
import { getLatestMockInterview } from "./mockInterviewApi";

afterEach(() => vi.unstubAllGlobals());

it("treats an empty latest-session response as no previous session", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 204,
  } as Response);
  vi.stubGlobal("fetch", fetchMock);

  await expect(getLatestMockInterview("setup-1")).resolves.toBeNull();
});
