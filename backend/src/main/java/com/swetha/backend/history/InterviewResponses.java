package com.swetha.backend.history;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

// Defines API response DTOs and entity conversion without exposing JPA entities.
public final class InterviewResponses {
    private InterviewResponses() {
    }

    public record Interview(
        UUID id,
        String company,
        String role,
        String resumeText,
        List<Round> rounds
    ) {
        public static Interview from(InterviewRecord record) {
            return new Interview(
                record.getId(),
                record.getCompany(),
                record.getRole(),
                record.getResumeText(),
                record.getRounds().stream().map(Round::from).toList()
            );
        }
    }

    public record Round(UUID id, String name, LocalDate date, List<Question> questions) {
        public static Round from(InterviewRound round) {
            return new Round(
                round.getId(),
                round.getName(),
                round.getDate(),
                round.getQuestions().stream().map(Question::from).toList()
            );
        }
    }

    public record Question(UUID id, String question, String originalAnswer) {
        public static Question from(InterviewQuestion question) {
            return new Question(
                question.getId(),
                question.getQuestion(),
                question.getOriginalAnswer()
            );
        }
    }
}
