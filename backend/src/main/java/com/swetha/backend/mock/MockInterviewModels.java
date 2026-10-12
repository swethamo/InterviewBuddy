package com.swetha.backend.mock;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class MockInterviewModels {
    private MockInterviewModels() {
    }

    public record Availability(boolean available, String message) {
    }

    public record HistorySummary(
        UUID id,
        String status,
        int durationMinutes,
        Instant startedAt,
        Instant endedAt,
        String company,
        String role,
        long answersSubmitted,
        boolean reviewAvailable
    ) {
    }

    public record Topic(String name, String focus, String difficulty) {
    }

    public record Plan(List<Topic> topics) {
    }

    public record QuestionDecision(String decision, String topic, String question) {
    }

    public record AnswerFeedback(
        String relevance,
        String clarity,
        String completeness,
        String technicalAccuracy,
        String improvement
    ) {
    }

    public record GeneratedReview(
        String summary,
        List<String> strengths,
        List<String> areasToPractice,
        List<SubmittedAnswerFeedback> submittedAnswerFeedback
    ) {
    }

    public record SubmittedAnswerFeedback(
        UUID questionId,
        AnswerFeedback feedback
    ) {
    }

    public record Turn(
        UUID id,
        int sequence,
        String topic,
        String question,
        String kind,
        String answer,
        String draftAnswer,
        Instant answeredAt,
        boolean skipped,
        AnswerFeedback feedback
    ) {
    }

    public record Review(
        String summary,
        List<String> strengths,
        List<String> areasToPractice,
        List<String> topicsCovered,
        List<String> topicsNotReached,
        List<Turn> turns
    ) {
    }

    public record Session(
        UUID id,
        UUID setupId,
        String status,
        int durationMinutes,
        Instant startedAt,
        Instant deadline,
        Instant endedAt,
        String company,
        String role,
        String interviewType,
        String interviewTypeOther,
        String jobDescription,
        String jobDescriptionUrl,
        String instructions,
        boolean resumeContextAvailable,
        String currentQuestionId,
        String currentQuestion,
        String currentTopic,
        String currentQuestionKind,
        List<Turn> conversation,
        List<String> coveredTopics,
        int totalTopics,
        int followUpsUsed,
        Review review
    ) {
    }
}
