package com.swetha.backend.history;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;

// Defines validated JSON request shapes for interview, round, and question CRUD.
public final class InterviewRequests {
    private InterviewRequests() {
    }

    public record InterviewCreate(
        @NotBlank(message = "Company is required.")
        @Size(max = 255, message = "Company must be at most 255 characters.")
        String company,
        @NotBlank(message = "Role is required.")
        @Size(max = 255, message = "Role must be at most 255 characters.")
        String role,
        @Size(max = 30000, message = "Resume text must be at most 30,000 characters.")
        String resumeText,
        @Size(max = 255, message = "Legacy import ID must be at most 255 characters.")
        String legacyImportId,
        List<@Valid RoundCreate> rounds
    ) {
    }

    public record InterviewUpdate(
        @NotBlank(message = "Company is required.")
        @Size(max = 255, message = "Company must be at most 255 characters.")
        String company,
        @NotBlank(message = "Role is required.")
        @Size(max = 255, message = "Role must be at most 255 characters.")
        String role,
        @Size(max = 30000, message = "Resume text must be at most 30,000 characters.")
        String resumeText
    ) {
    }

    public record RoundCreate(
        @NotBlank(message = "Round name is required.")
        @Size(max = 255, message = "Round name must be at most 255 characters.")
        String name,
        LocalDate date,
        List<@Valid QuestionCreate> questions
    ) {
    }

    public record RoundUpdate(
        @NotBlank(message = "Round name is required.")
        @Size(max = 255, message = "Round name must be at most 255 characters.")
        String name,
        LocalDate date
    ) {
    }

    public record QuestionCreate(
        @NotBlank(message = "Question text is required.")
        @Size(max = 5000, message = "Question text must be at most 5,000 characters.")
        String question,
        @Size(max = 20000, message = "Original answer must be at most 20,000 characters.")
        String originalAnswer
    ) {
    }

    public record QuestionBatch(
        @NotEmpty(message = "Add at least one question.")
        List<@Valid QuestionCreate> questions
    ) {
    }

    public record QuestionUpdate(
        @NotBlank(message = "Question text is required.")
        @Size(max = 5000, message = "Question text must be at most 5,000 characters.")
        String question,
        @Size(max = 20000, message = "Original answer must be at most 20,000 characters.")
        String originalAnswer
    ) {
    }
}
