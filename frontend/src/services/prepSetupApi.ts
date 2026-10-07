// Setup API: moves the saved prep records to and from the Spring Boot backend.
import { normalizeInterviewType } from "./interviewTypes";
import type { InterviewSetup } from "../types/interviewSetup";

export type PrepSetupApiRecord = {
  id: string;
  company: string;
  role: string;
  interviewType: string;
  interviewTypeOther?: string;
  jobDescription?: string;
  jobDescriptionUrl?: string;
  instructions?: string;
  resumeFileName?: string;
  resumeText?: string;
};

const PREP_SETUP_API_URL = "/api/prep-setups";

export function toPrepSetupRequest(setup: InterviewSetup) {
  return {
    company: setup.company,
    role: setup.role,
    interviewType: setup.interviewType,
    interviewTypeOther:
      setup.interviewType === "other" ? setup.interviewTypeOther ?? "" : "",
    jobDescription: setup.jobDescription ?? "",
    jobDescriptionUrl: setup.jobDescriptionUrl ?? "",
    instructions: setup.instructions ?? "",
    resumeFileName: setup.resumeFileName ?? "",
    resumeText: setup.resumeText ?? "",
  };
}

export function mapPrepSetupRecord(record: PrepSetupApiRecord): InterviewSetup {
  const interviewType = normalizeInterviewType(record.interviewType, "recruiter-call");

  return {
    id: record.id,
    company: record.company ?? "",
    role: record.role ?? "",
    interviewType,
    interviewTypeOther:
      interviewType === "other" ? record.interviewTypeOther ?? "" : undefined,
    jobDescription: record.jobDescription ?? "",
    jobDescriptionUrl: record.jobDescriptionUrl ?? "",
    instructions: record.instructions ?? "",
    resumeFileName: record.resumeFileName ?? "",
    resumeText: record.resumeText ?? "",
  };
}

async function readApiError(response: Response): Promise<string> {
  try {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = (await response.json()) as {
        message?: string;
        error?: string;
      };
      if (body.message) return body.message;
      if (body.error) return body.error;
    }
  } catch {
    // The response may not include JSON when an HTTP error is returned.
  }

  if (response.status === 404) {
    return "The selected setup was not found on the server.";
  }

  if (response.status === 400) {
    return "Please review the saved setup fields and try again.";
  }

  if (response.status === 500) {
    return "The server could not save this setup. Please try again.";
  }

  return `The request failed with status ${response.status}.`;
}

export async function listPrepSetups(): Promise<InterviewSetup[]> {
  const response = await fetch(PREP_SETUP_API_URL, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  const payload = (await response.json()) as PrepSetupApiRecord[];
  return payload.map(mapPrepSetupRecord);
}

export async function createPrepSetup(setup: InterviewSetup): Promise<InterviewSetup> {
  const response = await fetch(PREP_SETUP_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(toPrepSetupRequest(setup)),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  const payload = (await response.json()) as PrepSetupApiRecord;
  return mapPrepSetupRecord(payload);
}

export async function updatePrepSetup(
  setupId: string,
  setup: InterviewSetup,
): Promise<InterviewSetup> {
  const response = await fetch(`${PREP_SETUP_API_URL}/${setupId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(toPrepSetupRequest(setup)),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  const payload = (await response.json()) as PrepSetupApiRecord;
  return mapPrepSetupRecord(payload);
}

export async function deletePrepSetup(setupId: string): Promise<void> {
  const response = await fetch(`${PREP_SETUP_API_URL}/${setupId}`, {
    method: "DELETE",
  });

  if (!response.ok && response.status !== 204) {
    throw new Error(await readApiError(response));
  }
}
