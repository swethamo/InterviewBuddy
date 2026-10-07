// Prep model: saved setup data shared across form, storage, and mock-session screens.
import type { InterviewTypeValue } from "../services/interviewTypes";

export type InterviewSetup = {
  id: string;
  company: string;
  role: string;
  interviewType: InterviewTypeValue;
  interviewTypeOther?: string;
  jobDescription: string;
  jobDescriptionUrl: string;
  instructions: string;
  resumeFileName: string;
  resumeText: string;
};
