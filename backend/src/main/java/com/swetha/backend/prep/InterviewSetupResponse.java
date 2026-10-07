package com.swetha.backend.prep;

import java.util.UUID;

// Defines the setup data returned by the API to the frontend.
public record InterviewSetupResponse(
    UUID id,
    String company,
    String role,
    String interviewType,
    String interviewTypeOther,
    String jobDescription,
    String jobDescriptionUrl,
    String instructions,
    String resumeFileName,
    String resumeText
) {

    // Converts a database entity into the public API response.
    public static InterviewSetupResponse from(InterviewSetup setup) {
        return new InterviewSetupResponse(
            setup.getId(),
            setup.getCompany(),
            setup.getRole(),
            setup.getInterviewType(),
            setup.getInterviewTypeOther(),
            setup.getJobDescription(),
            setup.getJobDescriptionUrl(),
            setup.getInstructions(),
            setup.getResumeFileName(),
            setup.getResumeText()
        );
    }
}