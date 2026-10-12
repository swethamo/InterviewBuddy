package com.swetha.backend.mock;

import com.swetha.backend.answer.AnswerGenerationProperties;
import com.swetha.backend.mock.MockInterviewModels.Availability;
import com.swetha.backend.mock.MockInterviewModels.GeneratedReview;
import com.swetha.backend.mock.MockInterviewModels.HistorySummary;
import com.swetha.backend.mock.MockInterviewModels.Plan;
import com.swetha.backend.mock.MockInterviewModels.QuestionDecision;
import com.swetha.backend.mock.MockInterviewModels.Session;
import com.swetha.backend.mock.MockInterviewModels.Topic;
import com.swetha.backend.mock.MockInterviewModels.Turn;
import com.swetha.backend.prep.InterviewSetup;
import com.swetha.backend.prep.InterviewSetupRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

@Service
public class MockInterviewService {
    private final MockInterviewRepository repository;
    private final InterviewSetupRepository setupRepository;
    private final MockInterviewStore store;
    private final InterviewAiProvider aiProvider;
    private final AnswerGenerationProperties aiProperties;
    private final ObjectMapper objectMapper;

    public MockInterviewService(
        MockInterviewRepository repository,
        InterviewSetupRepository setupRepository,
        MockInterviewStore store,
        InterviewAiProvider aiProvider,
        AnswerGenerationProperties aiProperties,
        ObjectMapper objectMapper
    ) {
        this.repository = repository;
        this.setupRepository = setupRepository;
        this.store = store;
        this.aiProvider = aiProvider;
        this.aiProperties = aiProperties;
        this.objectMapper = objectMapper;
    }

    public Availability availability() {
        boolean configured = aiProperties.isConfigured()
            && (aiProperties.provider() == null
                || "openai".equalsIgnoreCase(aiProperties.provider()));
        return new Availability(
            configured,
            configured
                ? ""
                : "The interview AI is not configured. Set ANSWER_GENERATION_PROVIDER=openai and OPENAI_API_KEY in the backend environment, then restart the server."
        );
    }

    public Session start(UUID setupId, int durationMinutes) {
        if (!List.of(15, 30, 45, 60).contains(durationMinutes)) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Choose an interview duration of 15, 30, 45, or 60 minutes."
            );
        }
        Session latest = store.findLatest(setupId, Instant.now())
            .filter(session -> "IN_PROGRESS".equals(session.status()))
            .orElse(null);
        if (latest != null) return latest;
        if (!availability().available()) {
            throw new InterviewAiException(
                HttpStatus.SERVICE_UNAVAILABLE,
                availability().message()
            );
        }
        InterviewSetup setup = setupRepository.findById(setupId)
            .orElseThrow(() -> new ResponseStatusException(
                HttpStatus.NOT_FOUND,
                "The selected interview setup was not found."
            ));
        validateSetup(setup);

        Map<String, Object> context = setupContext(setup);
        context.put("durationMinutes", durationMinutes);
        Plan plan = aiProvider.createPlan(context);
        validatePlan(plan);
        Topic firstTopic = plan.topics().getFirst();
        context.put("topicPlan", plan.topics());
        context.put("currentTopic", firstTopic.name());
        context.put("currentTopicFocus", firstTopic.focus());
        context.put("currentTopicDifficulty", firstTopic.difficulty());
        context.put("conversation", List.of());
        context.put("coveredTopics", List.of());
        context.put("openingQuestion", true);
        context.put("followUpsUsed", 0);
        context.put("maxFollowUpsAllowed", 0);
        context.put("secondsRemaining", durationMinutes * 60);
        QuestionDecision opening = aiProvider.createQuestion(context);
        if (opening == null
            || !"ADVANCE".equals(opening.decision())
            || !firstTopic.name().equals(opening.topic())) {
            throw invalidAiOutput();
        }
        validateQuestion(opening.question());
        return store.create(
            setup,
            durationMinutes,
            plan,
            opening.question(),
            Instant.now()
        );
    }

    public Session latest(UUID setupId) {
        return store.findLatest(setupId, Instant.now()).orElse(null);
    }

    public List<HistorySummary> history(UUID setupId) {
        return store.findHistory(setupId);
    }

    public Session get(UUID id) {
        return store.find(id, Instant.now());
    }

    public Session saveDraft(UUID id, UUID questionId, String draft) {
        return store.saveDraft(id, questionId, draft);
    }

    public Session answer(UUID id, UUID questionId, String answer) {
        Session saved = store.submitAnswer(id, questionId, answer, Instant.now());
        if (!"IN_PROGRESS".equals(saved.status())) return saved;
        return continueFrom(id, questionId);
    }

    public Session skip(UUID id, UUID questionId) {
        Session skipped = store.skipQuestion(id, questionId, Instant.now());
        if (!"IN_PROGRESS".equals(skipped.status())) return skipped;
        return continueFrom(id, questionId);
    }

    public Session continueInterview(UUID id) {
        Session session = store.find(id, Instant.now());
        if (!"IN_PROGRESS".equals(session.status())) return session;
        Turn lastTurn = session.conversation().getLast();
        if (lastTurn.answer() == null && !lastTurn.skipped()) {
            throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "Submit or skip the active question before continuing."
            );
        }
        return continueFrom(id, lastTurn.id());
    }

    public Session end(UUID id) {
        Session finished = store.finish(id, Instant.now());
        return generateReviewIfNeeded(finished);
    }

    public Session review(UUID id) {
        Session session = store.find(id, Instant.now());
        if ("IN_PROGRESS".equals(session.status())) {
            throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "End the interview before generating its review."
            );
        }
        return generateReviewIfNeeded(session);
    }

    private Session continueFrom(UUID id, UUID basedOnQuestionId) {
        Session session = store.find(id, Instant.now());
        if (!"IN_PROGRESS".equals(session.status())) return session;
        if (!session.conversation().getLast().id().equals(basedOnQuestionId)) {
            throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "The interview advanced while the next question was being generated."
            );
        }

        Plan plan = readPlan(id);
        Set<String> covered = new HashSet<>(session.coveredTopics());
        String currentTopic = session.conversation().getLast().topic();
        List<Topic> remainingTopics = plan.topics().stream()
            .filter(topic -> !covered.contains(topic.name()))
            .toList();
        long secondsRemaining = Math.max(
            0,
            session.deadline().getEpochSecond() - Instant.now().getEpochSecond()
        );
        int followUpsUsed = session.followUpsUsed();
        int maxFollowUps = secondsRemaining <= 180
            ? 0
            : secondsRemaining <= 420
                ? 1
                : 2;
        Topic activeTopic = plan.topics().stream()
            .filter(topic -> topic.name().equals(currentTopic))
            .findFirst()
            .orElseThrow(MockInterviewService::invalidAiOutput);

        Map<String, Object> context = sessionContext(session, plan);
        context.put("conversation", session.conversation().stream()
            .map(turn -> Map.of(
                "questionId", turn.id().toString(),
                "topic", turn.topic(),
                "kind", turn.kind(),
                "question", turn.question(),
                "answer", turn.answer() == null ? "" : turn.answer(),
                "skipped", turn.skipped()
            ))
            .toList());
        context.put("coveredTopics", session.coveredTopics());
        context.put("remainingTopics", remainingTopics);
        context.put("currentTopic", activeTopic.name());
        context.put("currentTopicFocus", activeTopic.focus());
        context.put("currentTopicDifficulty", activeTopic.difficulty());
        context.put("followUpsUsed", followUpsUsed);
        context.put("maxFollowUpsAllowed", maxFollowUps);
        context.put("secondsRemaining", secondsRemaining);
        context.put("openingQuestion", false);
        QuestionDecision decision = aiProvider.createQuestion(context);
        if (decision == null || decision.topic() == null
            || decision.topic().isBlank()) {
            throw invalidAiOutput();
        }
        validateQuestion(decision.question());

        if ("FOLLOW_UP".equals(decision.decision())) {
            if (followUpsUsed >= maxFollowUps
                || !currentTopic.equals(decision.topic())) {
                throw invalidAiOutput();
            }
            return store.addQuestion(
                id,
                basedOnQuestionId,
                currentTopic,
                decision.question(),
                "FOLLOW_UP",
                Instant.now()
            );
        }
        if (!"ADVANCE".equals(decision.decision())) throw invalidAiOutput();

        boolean newTopic = remainingTopics.stream()
            .anyMatch(topic -> topic.name().equals(decision.topic())
                && !topic.name().equals(currentTopic));
        if (!newTopic) {
            Session complete = store.finish(id, Instant.now());
            return generateReviewIfNeeded(complete);
        }
        return store.addQuestion(
            id,
            basedOnQuestionId,
            decision.topic(),
            decision.question(),
            "MAIN",
            Instant.now()
        );
    }

    private Session generateReviewIfNeeded(Session session) {
        if (session.review() != null || "IN_PROGRESS".equals(session.status())) {
            return session;
        }
        Plan plan = readPlan(session.id());
        Map<String, Object> context = sessionContext(session, plan);
        context.put("coveredTopics", session.coveredTopics());
        context.put("topicsReached", session.conversation().stream()
            .map(Turn::topic)
            .distinct()
            .toList());
        context.put("conversation", session.conversation().stream()
            .map(turn -> Map.of(
                "questionId", turn.id().toString(),
                "topic", turn.topic(),
                "kind", turn.kind(),
                "question", turn.question(),
                "submitted", turn.answer() != null,
                "answer", turn.answer() == null ? "" : turn.answer(),
                "skipped", turn.skipped()
            ))
            .toList());
        GeneratedReview generated = aiProvider.createReview(context);
        validateReview(generated, session);
        long submittedCount = session.conversation().stream()
            .filter(turn -> turn.answer() != null)
            .count();
        if (generated.submittedAnswerFeedback().size() != submittedCount) {
            throw invalidAiOutput();
        }
        return store.saveReview(session.id(), generated);
    }

    private Plan readPlan(UUID id) {
        try {
            String json = repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Mock interview session not found."
                ))
                .getPlanJson();
            Plan plan = objectMapper.readValue(json, Plan.class);
            validatePlan(plan);
            return plan;
        } catch (JacksonException exception) {
            throw new InterviewAiException(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "The saved interview plan could not be restored."
            );
        }
    }

    private static void validatePlan(Plan plan) {
        if (plan == null || plan.topics() == null
            || plan.topics().size() < 3 || plan.topics().size() > 8) {
            throw invalidAiOutput();
        }
        Set<String> names = new HashSet<>();
        for (Topic topic : plan.topics()) {
            if (topic == null || !validText(topic.name(), 80)
                || !validText(topic.focus(), 300)
                || !List.of("introductory", "intermediate", "advanced")
                    .contains(topic.difficulty())
                || !names.add(topic.name().toLowerCase(java.util.Locale.ROOT))) {
                throw invalidAiOutput();
            }
        }
    }

    private static void validateReview(
        GeneratedReview review,
        Session session
    ) {
        if (review == null || !validText(review.summary(), 2000)
            || review.strengths() == null || review.strengths().isEmpty()
            || review.strengths().size() > 8
            || review.areasToPractice() == null
            || review.areasToPractice().isEmpty()
            || review.areasToPractice().size() > 8
            || review.submittedAnswerFeedback() == null
            || review.submittedAnswerFeedback().size() > 24) {
            throw invalidAiOutput();
        }
        for (String item : review.strengths()) {
            if (!validText(item, 500)) throw invalidAiOutput();
        }
        for (String item : review.areasToPractice()) {
            if (!validText(item, 500)) throw invalidAiOutput();
        }
        List<UUID> answeredIds = session.conversation().stream()
            .filter(turn -> turn.answer() != null)
            .map(Turn::id)
            .toList();
        if (review.submittedAnswerFeedback().size() != answeredIds.size()) {
            throw invalidAiOutput();
        }
        for (int index = 0; index < answeredIds.size(); index += 1) {
            var supplied = review.submittedAnswerFeedback().get(index);
            if (supplied == null || !answeredIds.get(index).equals(supplied.questionId())
                || !validFeedback(supplied.feedback())) {
                throw invalidAiOutput();
            }
        }
    }

    private static boolean validFeedback(
        com.swetha.backend.mock.MockInterviewModels.AnswerFeedback feedback
    ) {
        return feedback != null
            && validText(feedback.relevance(), 1000)
            && validText(feedback.clarity(), 1000)
            && validText(feedback.completeness(), 1000)
            && validText(feedback.technicalAccuracy(), 1000)
            && validText(feedback.improvement(), 1500);
    }

    private static boolean validText(String value, int maxLength) {
        return value != null && !value.isBlank() && value.length() <= maxLength;
    }

    private static Map<String, Object> setupContext(InterviewSetup setup) {
        Map<String, Object> context = new LinkedHashMap<>();
        context.put("company", setup.getCompany());
        context.put("role", setup.getRole());
        context.put("interviewType", setup.getInterviewType());
        context.put("interviewTypeOther", setup.getInterviewTypeOther());
        context.put("jobDescription", setup.getJobDescription());
        context.put("jobDescriptionUrl", setup.getJobDescriptionUrl());
        context.put("resumeText", setup.getResumeText());
        context.put("additionalInstructions", setup.getInstructions());
        return context;
    }

    private Map<String, Object> sessionContext(
        Session session,
        Plan plan
    ) {
        Map<String, Object> context = store.aiContext(session.id());
        context.put("topicPlan", plan.topics());
        return context;
    }

    private static void validateSetup(InterviewSetup setup) {
        if (setup.getCompany() == null || setup.getCompany().isBlank()
            || setup.getRole() == null || setup.getRole().isBlank()
            || setup.getInterviewType() == null || setup.getInterviewType().isBlank()
            || ("other".equals(setup.getInterviewType())
                && (setup.getInterviewTypeOther() == null
                    || setup.getInterviewTypeOther().isBlank()))) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Add the company, role, and a specific interview type to the saved setup before starting."
            );
        }
    }

    private static void validateQuestion(String question) {
        if (question == null || question.isBlank() || question.length() > 5000) {
            throw invalidAiOutput();
        }
    }

    private static InterviewAiException invalidAiOutput() {
        return new InterviewAiException(
            HttpStatus.BAD_GATEWAY,
            "The AI provider returned an invalid interview response. Retry this step."
        );
    }
}
