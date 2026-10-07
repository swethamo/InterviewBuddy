package com.swetha.backend.prep;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

// Defines the editable fields accepted when creating or updating a setup.
public record InterviewSetupRequest(

    // Required company and role, with limits matching the entity columns.
    @NotBlank(message = "Company is required.")
    @Size(max = 255, message = "Company must be at most 255 characters.")
    String company,

    @NotBlank(message = "Role is required.")
    @Size(max = 255, message = "Role must be at most 255 characters.")
    String role,

    // Accept only the machine values used by the frontend.
    @NotBlank(message = "Interview type is required.")
    @Pattern(
        regexp = "recruiter-call|hiring-manager|technical|behavioral|live-coding|assessment|other",
        message = "Choose a supported interview type."
    )
    String interviewType,

    // Optional context fields may be omitted or supplied as empty strings.
    @Size(max = 255, message = "Other interview type must be at most 255 characters.")
    String interviewTypeOther,

    @Size(max = 20000, message = "Job description must be at most 20,000 characters.")
    String jobDescription,

    @Size(max = 2048, message = "Job description URL must be at most 2,048 characters.")
    String jobDescriptionUrl,

    @Size(max = 10000, message = "Instructions must be at most 10,000 characters.")
    String instructions,

    // Filename metadata is separate from an actual file upload.
    @Size(max = 255, message = "Resume filename must be at most 255 characters.")
    String resumeFileName,

    @Size(max = 30000, message = "Resume text must be at most 30,000 characters.")
    String resumeText
) {
}