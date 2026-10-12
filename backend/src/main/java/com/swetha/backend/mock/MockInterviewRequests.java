package com.swetha.backend.mock;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public final class MockInterviewRequests {
    private MockInterviewRequests() {
    }

    public record Start(
        @NotNull(message = "Choose a saved interview setup.")
        UUID setupId,
        @Min(value = 15, message = "Choose an interview duration of 15, 30, 45, or 60 minutes.")
        @Max(value = 60, message = "Choose an interview duration of 15, 30, 45, or 60 minutes.")
        int durationMinutes
    ) {
    }

    public record Answer(
        @NotNull(message = "The active question is required.")
        UUID questionId,
        @Size(max = 20000, message = "Answer must be at most 20,000 characters.")
        String answer
    ) {
    }

    public record Skip(
        @NotNull(message = "The active question is required.")
        UUID questionId
    ) {
    }
}
