package com.swetha.backend.answer;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AnswerGenerationRequest(
    @NotBlank(message = "Company is required.")
    @Size(max = 255, message = "Company must be at most 255 characters.")
    String company,

    @NotBlank(message = "Role is required.")
    @Size(max = 255, message = "Role must be at most 255 characters.")
    String role,

    @Size(max = 255, message = "Interview round must be at most 255 characters.")
    String round,

    @NotBlank(message = "Question is required.")
    @Size(max = 5000, message = "Question must be at most 5,000 characters.")
    String question,

    @Size(max = 255, message = "Interview type must be at most 255 characters.")
    String interviewType,

    @Size(max = 20000, message = "Job description must be at most 20,000 characters.")
    String jobDescription,

    @Size(max = 10000, message = "Additional instructions must be at most 10,000 characters.")
    String additionalInstructions,

    @Size(max = 20000, message = "Original answer must be at most 20,000 characters.")
    String originalAnswer
) {
}
