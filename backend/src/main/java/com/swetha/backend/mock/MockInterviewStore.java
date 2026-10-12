package com.swetha.backend.mock;

import com.swetha.backend.mock.MockInterviewModels.AnswerFeedback;
import com.swetha.backend.mock.MockInterviewModels.GeneratedReview;
import com.swetha.backend.mock.MockInterviewModels.HistorySummary;
import com.swetha.backend.mock.MockInterviewModels.Plan;
import com.swetha.backend.mock.MockInterviewModels.Review;
import com.swetha.backend.mock.MockInterviewModels.Session;
import com.swetha.backend.mock.MockInterviewModels.SubmittedAnswerFeedback;
import com.swetha.backend.mock.MockInterviewModels.Topic;
import com.swetha.backend.mock.MockInterviewModels.Turn;
import com.swetha.backend.prep.InterviewSetup;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

@Service
public class MockInterviewStore {
    private static final String IN_PROGRESS = "IN_PROGRESS";
    private static final String COMPLETED = "COMPLETED";
    private static final String EXPIRED = "EXPIRED";

    private final MockInterviewRepository repository;
    private final ObjectMapper objectMapper;

    public MockInterviewStore(
        MockInterviewRepository repository,
        ObjectMapper objectMapper
    ) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public Session create(
        InterviewSetup setup,
        int durationMinutes,
        Plan plan,
        String question,
        Instant now
    ) {
        MockInterviewSession session = new MockInterviewSession();
        session.setSetupId(setup.getId());
        session.setCompany(setup.getCompany());
        session.setRole(setup.getRole());
        session.setInterviewType(setup.getInterviewType());
        session.setInterviewTypeOther(setup.getInterviewTypeOther());
        session.setJobDescription(setup.getJobDescription());
        session.setJobDescriptionUrl(setup.getJobDescriptionUrl());
        session.setInstructions(setup.getInstructions());
        session.setResumeText(setup.getResumeText());
        session.setDurationMinutes(durationMinutes);
        session.setStartedAt(now);
        session.setDeadline(now.plusSeconds(durationMinutes * 60L));
        session.setStatus(IN_PROGRESS);
        session.setPlanJson(write(plan));
        session.setCoveredTopicsJson(write(List.of()));
        session.addTurn(new MockInterviewTurn(
            plan.topics().getFirst().name(),
            question,
            "MAIN"
        ));
        repository.saveAndFlush(session);
        session.setCurrentTurnId(session.getTurns().getFirst().getId().toString());
        return toSession(session);
    }

    @Transactional
    public Optional<Session> findLatest(UUID setupId, Instant now) {
        Optional<MockInterviewSession> found =
            repository.findFirstBySetupIdOrderByStartedAtDesc(setupId);
        if (found.isEmpty()) return Optional.empty();
        MockInterviewSession session = found.get();
        expireIfNeeded(session, now);
        return Optional.of(toSession(session));
    }

    @Transactional(readOnly = true)
    public List<HistorySummary> findHistory(UUID setupId) {
        return repository.findHistoryBySetupId(setupId);
    }

    @Transactional
    public Session find(UUID id, Instant now) {
        MockInterviewSession session = require(id);
        expireIfNeeded(session, now);
        return toSession(session);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> aiContext(UUID id) {
        MockInterviewSession session = require(id);
        Map<String, Object> context = new LinkedHashMap<>();
        context.put("company", session.getCompany());
        context.put("role", session.getRole());
        context.put("interviewType", session.getInterviewType());
        context.put("interviewTypeOther", session.getInterviewTypeOther());
        context.put("jobDescription", session.getJobDescription());
        context.put("jobDescriptionUrl", session.getJobDescriptionUrl());
        context.put("resumeText", session.getResumeText());
        context.put("additionalInstructions", session.getInstructions());
        return context;
    }

    @Transactional
    public Session saveDraft(UUID id, UUID questionId, String draft) {
        MockInterviewSession session = require(id);
        MockInterviewTurn turn = requireCurrentTurn(session, questionId);
        if (turn.getAnswer() == null && !turn.isSkipped()) {
            turn.setDraftAnswer(draft == null ? "" : draft.trim());
        }
        return toSession(session);
    }

    @Transactional
    public Session submitAnswer(
        UUID id,
        UUID questionId,
        String answer,
        Instant now
    ) {
        MockInterviewSession session = require(id);
        if (expireIfNeeded(session, now)) return toSession(session);
        requireActive(session);
        MockInterviewTurn turn = requireCurrentTurn(session, questionId);
        if (turn.getAnswer() != null || turn.isSkipped()) {
            throw conflict("This question has already been answered or skipped.");
        }
        String cleaned = answer == null ? "" : answer.trim();
        if (cleaned.isEmpty()) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Write or transcribe an answer before submitting."
            );
        }
        turn.setAnswer(cleaned);
        turn.setDraftAnswer("");
        turn.setAnsweredAt(now);
        addCoveredTopic(session, turn.getTopic());
        return toSession(session);
    }

    @Transactional
    public Session skipQuestion(UUID id, UUID questionId, Instant now) {
        MockInterviewSession session = require(id);
        if (expireIfNeeded(session, now)) return toSession(session);
        requireActive(session);
        MockInterviewTurn turn = requireCurrentTurn(session, questionId);
        if (turn.getAnswer() != null || turn.isSkipped()) {
            throw conflict("This question has already been answered or skipped.");
        }
        turn.setSkipped(true);
        return toSession(session);
    }

    @Transactional
    public Session addQuestion(
        UUID id,
        UUID basedOnQuestionId,
        String topic,
        String question,
        String kind,
        Instant now
    ) {
        MockInterviewSession session = require(id);
        if (expireIfNeeded(session, now)) return toSession(session);
        requireActive(session);
        if (!basedOnQuestionId.toString().equals(session.getCurrentTurnId())) {
            throw conflict("The interview advanced while the next question was being generated.");
        }
        MockInterviewTurn previous = requireCurrentTurn(session, basedOnQuestionId);
        if (previous.getAnswer() == null && !previous.isSkipped()) {
            throw conflict("Submit or skip the active question before continuing.");
        }
        boolean repeated = session.getTurns().stream()
            .anyMatch(turn -> normalize(turn.getQuestion()).equals(normalize(question)));
        if (repeated) {
            throw new InterviewAiException(
                HttpStatus.BAD_GATEWAY,
                "The AI provider repeated a question. Retry to generate a different question."
            );
        }
        session.addTurn(new MockInterviewTurn(topic, question, kind));
        repository.flush();
        session.setCurrentTurnId(
            session.getTurns().getLast().getId().toString()
        );
        return toSession(session);
    }

    @Transactional
    public Session finish(UUID id, Instant now) {
        MockInterviewSession session = require(id);
        if (IN_PROGRESS.equals(session.getStatus())) {
            session.setStatus(
                session.getDeadline().isAfter(now) ? COMPLETED : EXPIRED
            );
            session.setEndedAt(now);
        }
        return toSession(session);
    }

    @Transactional
    public Session saveReview(UUID id, GeneratedReview generatedReview) {
        MockInterviewSession session = require(id);
        if (IN_PROGRESS.equals(session.getStatus())) {
            throw conflict("The interview must end before its review is generated.");
        }
        List<MockInterviewTurn> answered = session.getTurns().stream()
            .filter(turn -> turn.getAnswer() != null)
            .toList();
        List<SubmittedAnswerFeedback> suppliedFeedback =
            generatedReview.submittedAnswerFeedback();
        if (suppliedFeedback.size() != answered.size()) {
            throw new InterviewAiException(
                HttpStatus.BAD_GATEWAY,
                "The AI provider returned incomplete answer feedback. Retry the review."
            );
        }
        for (int index = 0; index < answered.size(); index += 1) {
            if (!answered.get(index).getId().equals(
                suppliedFeedback.get(index).questionId()
            )) {
                throw new InterviewAiException(
                    HttpStatus.BAD_GATEWAY,
                    "The AI provider returned feedback for the wrong answer. Retry the review."
                );
            }
        }
        session.setReviewJson(write(generatedReview));
        return toSession(session);
    }

    private boolean expireIfNeeded(MockInterviewSession session, Instant now) {
        if (IN_PROGRESS.equals(session.getStatus())
            && !session.getDeadline().isAfter(now)) {
            session.setStatus(EXPIRED);
            session.setEndedAt(now);
            return true;
        }
        return false;
    }

    private MockInterviewSession require(UUID id) {
        return repository.findWithTurnsById(id)
            .orElseThrow(() -> new ResponseStatusException(
                HttpStatus.NOT_FOUND,
                "Mock interview session not found."
            ));
    }

    private static MockInterviewTurn requireCurrentTurn(
        MockInterviewSession session,
        UUID questionId
    ) {
        if (!questionId.toString().equals(session.getCurrentTurnId())) {
            throw conflict("That question is no longer active.");
        }
        return session.getTurns().stream()
            .filter(turn -> questionId.equals(turn.getId()))
            .findFirst()
            .orElseThrow(() -> conflict("The active question could not be found."));
    }

    private static void requireActive(MockInterviewSession session) {
        if (!IN_PROGRESS.equals(session.getStatus())) {
            throw conflict("This interview has ended.");
        }
    }

    private void addCoveredTopic(MockInterviewSession session, String topic) {
        List<String> covered = readStrings(session.getCoveredTopicsJson());
        if (!covered.contains(topic)) {
            covered.add(topic);
            session.setCoveredTopicsJson(write(covered));
        }
    }

    private Session toSession(MockInterviewSession entity) {
        Plan plan = read(entity.getPlanJson(), Plan.class);
        List<String> coveredTopics = readStrings(entity.getCoveredTopicsJson());
        MockInterviewTurn activeTurn = entity.getTurns().stream()
            .filter(turn -> turn.getId().toString().equals(entity.getCurrentTurnId()))
            .findFirst()
            .orElse(null);
        List<Turn> turns = entity.getTurns().stream()
            .map(turn -> new Turn(
                turn.getId(),
                turn.getSequence(),
                turn.getTopic(),
                turn.getQuestion(),
                turn.getKind(),
                turn.getAnswer(),
                turn.getDraftAnswer(),
                turn.getAnsweredAt(),
                turn.isSkipped(),
                null
            ))
            .toList();
        int followUpsUsed = countCurrentFollowUps(entity.getTurns());
        Review review = entity.getReviewJson() == null
            ? null
            : toReview(read(entity.getReviewJson(), GeneratedReview.class), entity, plan, coveredTopics);
        String currentQuestion = activeTurn != null
                && IN_PROGRESS.equals(entity.getStatus())
                && activeTurn.getAnswer() == null
                && !activeTurn.isSkipped()
            ? activeTurn.getQuestion()
            : null;
        return new Session(
            entity.getId(),
            entity.getSetupId(),
            entity.getStatus(),
            entity.getDurationMinutes(),
            entity.getStartedAt(),
            entity.getDeadline(),
            entity.getEndedAt(),
            entity.getCompany(),
            entity.getRole(),
            entity.getInterviewType(),
            entity.getInterviewTypeOther(),
            entity.getJobDescription(),
            entity.getJobDescriptionUrl(),
            entity.getInstructions(),
            entity.getResumeText() != null && !entity.getResumeText().isBlank(),
            currentQuestion == null ? null : activeTurn.getId().toString(),
            currentQuestion,
            currentQuestion == null ? null : activeTurn.getTopic(),
            currentQuestion == null ? null : activeTurn.getKind(),
            turns,
            List.copyOf(coveredTopics),
            plan.topics().size(),
            followUpsUsed,
            review
        );
    }

    private Review toReview(
        GeneratedReview generated,
        MockInterviewSession session,
        Plan plan,
        List<String> coveredTopics
    ) {
        Map<UUID, AnswerFeedback> feedback = new java.util.HashMap<>();
        for (SubmittedAnswerFeedback submitted : generated.submittedAnswerFeedback()) {
            feedback.put(submitted.questionId(), submitted.feedback());
        }
        Set<String> reached = new HashSet<>();
        List<Turn> turns = new ArrayList<>();
        for (MockInterviewTurn turn : session.getTurns()) {
            reached.add(turn.getTopic());
            AnswerFeedback answerFeedback = feedback.get(turn.getId());
            turns.add(new Turn(
                turn.getId(),
                turn.getSequence(),
                turn.getTopic(),
                turn.getQuestion(),
                turn.getKind(),
                turn.getAnswer(),
                turn.getDraftAnswer(),
                turn.getAnsweredAt(),
                turn.isSkipped(),
                answerFeedback
            ));
        }
        List<String> notReached = plan.topics().stream()
            .map(Topic::name)
            .filter(topic -> !reached.contains(topic))
            .toList();
        return new Review(
            generated.summary(),
            generated.strengths(),
            generated.areasToPractice(),
            List.copyOf(coveredTopics),
            notReached,
            List.copyOf(turns)
        );
    }

    private static int countCurrentFollowUps(List<MockInterviewTurn> turns) {
        int followUps = 0;
        for (int index = turns.size() - 1; index >= 0; index--) {
            MockInterviewTurn turn = turns.get(index);
            if ("MAIN".equals(turn.getKind())) break;
            followUps++;
        }
        return followUps;
    }

    private List<String> readStrings(String json) {
        return read(json, new TypeReference<ArrayList<String>>() { });
    }

    private <T> T read(String json, Class<T> type) {
        try {
            return objectMapper.readValue(json, type);
        } catch (tools.jackson.core.JacksonException exception) {
            throw invalidStoredData();
        }
    }

    private <T> T read(String json, TypeReference<T> type) {
        try {
            return objectMapper.readValue(json, type);
        } catch (tools.jackson.core.JacksonException exception) {
            throw invalidStoredData();
        }
    }

    private String write(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (tools.jackson.core.JacksonException exception) {
            throw new IllegalStateException("Interview session data could not be stored.", exception);
        }
    }

    private static String normalize(String value) {
        return value.toLowerCase(java.util.Locale.ROOT)
            .replaceAll("[^a-z0-9]+", " ")
            .trim();
    }

    private static ResponseStatusException conflict(String message) {
        return new ResponseStatusException(HttpStatus.CONFLICT, message);
    }

    private static InterviewAiException invalidStoredData() {
        return new InterviewAiException(
            HttpStatus.INTERNAL_SERVER_ERROR,
            "The saved interview session is invalid and could not be restored."
        );
    }
}
