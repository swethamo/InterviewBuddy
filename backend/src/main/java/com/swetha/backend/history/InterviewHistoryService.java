package com.swetha.backend.history;

import static com.swetha.backend.history.InterviewRequests.*;
import static com.swetha.backend.history.InterviewResponses.*;

import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

// Applies history CRUD rules and verifies ownership before nested changes.
@Service
@Transactional(readOnly = true)
public class InterviewHistoryService {

    private final InterviewRepository interviews;
    private final InterviewRoundRepository rounds;
    private final InterviewQuestionRepository questions;

    public InterviewHistoryService(
        InterviewRepository interviews,
        InterviewRoundRepository rounds,
        InterviewQuestionRepository questions
    ) {
        this.interviews = interviews;
        this.rounds = rounds;
        this.questions = questions;
    }

    // Lists interviews in a stable order and maps them to response-only DTOs.
    public List<Interview> findAll() {
        return interviews.findAllByOrderByCompanyAscRoleAscIdAsc()
            .stream().map(Interview::from).toList();
    }

    public Interview findInterview(UUID id) {
        return Interview.from(requireInterview(id));
    }

    // Creates full imported graphs atomically and makes a retried local import idempotent.
    @Transactional
    public CreateResult create(InterviewCreate request) {
        String legacyImportId = clean(request.legacyImportId());
        if (!legacyImportId.isEmpty()) {
            var imported = interviews.findByLegacyImportId(legacyImportId);
            if (imported.isPresent()) {
                return new CreateResult(Interview.from(imported.get()), false);
            }
        }

        InterviewRecord interview = new InterviewRecord();
        interview.setCompany(clean(request.company()));
        interview.setRole(clean(request.role()));
        interview.setResumeText(clean(request.resumeText()));
        interview.setLegacyImportId(legacyImportId.isEmpty() ? null : legacyImportId);
        if (request.rounds() != null) {
            for (RoundCreate roundRequest : request.rounds()) {
                interview.addRound(makeRound(roundRequest));
            }
        }
        return new CreateResult(
            Interview.from(interviews.saveAndFlush(interview)),
            true
        );
    }

    @Transactional
    public Interview update(UUID id, InterviewUpdate request) {
        InterviewRecord interview = requireInterview(id);
        interview.setCompany(clean(request.company()));
        interview.setRole(clean(request.role()));
        interview.setResumeText(clean(request.resumeText()));
        return Interview.from(interviews.save(interview));
    }

    @Transactional
    public void delete(UUID id) {
        interviews.delete(requireInterview(id));
    }

    // Nested CRUD always resolves the interview and verifies each requested parent.
    @Transactional
    public Round createRound(UUID interviewId, RoundCreate request) {
        InterviewRecord interview = requireInterview(interviewId);
        InterviewRound round = makeRound(request);
        interview.addRound(round);
        rounds.saveAndFlush(round);
        return Round.from(round);
    }

    @Transactional
    public Round updateRound(UUID interviewId, UUID roundId, RoundUpdate request) {
        InterviewRound round = requireOwnedRound(interviewId, roundId);
        round.setName(clean(request.name()));
        round.setDate(request.date());
        return Round.from(rounds.save(round));
    }

    @Transactional
    public void deleteRound(UUID interviewId, UUID roundId) {
        InterviewRound round = requireOwnedRound(interviewId, roundId);
        InterviewRecord interview = round.getInterview();
        interview.removeRound(round);
        interviews.save(interview);
    }

    @Transactional
    public Question createQuestion(
        UUID interviewId,
        UUID roundId,
        QuestionCreate request
    ) {
        InterviewRound round = requireOwnedRound(interviewId, roundId);
        InterviewQuestion question = makeQuestion(request);
        round.addQuestion(question);
        questions.saveAndFlush(question);
        return Question.from(question);
    }

    @Transactional
    public List<Question> createQuestions(
        UUID interviewId,
        UUID roundId,
        QuestionBatch request
    ) {
        InterviewRound round = requireOwnedRound(interviewId, roundId);
        List<InterviewQuestion> added = request.questions().stream()
            .map(InterviewHistoryService::makeQuestion)
            .toList();
        added.forEach(round::addQuestion);
        return questions.saveAllAndFlush(added).stream().map(Question::from).toList();
    }

    @Transactional
    public Question updateQuestion(
        UUID interviewId,
        UUID roundId,
        UUID questionId,
        QuestionUpdate request
    ) {
        requireOwnedRound(interviewId, roundId);
        InterviewQuestion question = requireQuestion(questionId);
        if (!question.getRound().getId().equals(roundId)) {
            throw notFound("Interview question not found in this round.");
        }
        question.setQuestion(clean(request.question()));
        question.setOriginalAnswer(clean(request.originalAnswer()));
        return Question.from(questions.save(question));
    }

    @Transactional
    public void deleteQuestion(UUID interviewId, UUID roundId, UUID questionId) {
        requireOwnedRound(interviewId, roundId);
        InterviewQuestion question = requireQuestion(questionId);
        if (!question.getRound().getId().equals(roundId)) {
            throw notFound("Interview question not found in this round.");
        }
        InterviewRound round = question.getRound();
        round.removeQuestion(question);
        rounds.save(round);
    }

    private static InterviewRound makeRound(RoundCreate request) {
        InterviewRound round = new InterviewRound();
        round.setName(clean(request.name()));
        round.setDate(request.date());
        if (request.questions() != null) {
            request.questions().stream().map(InterviewHistoryService::makeQuestion)
                .forEach(round::addQuestion);
        }
        return round;
    }

    // Converts validated, trimmed DTO text to new child entities.
    private static InterviewQuestion makeQuestion(QuestionCreate request) {
        InterviewQuestion question = new InterviewQuestion();
        question.setQuestion(clean(request.question()));
        question.setOriginalAnswer(clean(request.originalAnswer()));
        return question;
    }

    private InterviewRecord requireInterview(UUID id) {
        return interviews.findById(id)
            .orElseThrow(() -> notFound("Interview record not found."));
    }

    // Hides absent or foreign-owned IDs behind the same nested-resource 404 response.
    private InterviewRound requireOwnedRound(UUID interviewId, UUID roundId) {
        requireInterview(interviewId);
        InterviewRound round = rounds.findById(roundId)
            .orElseThrow(() -> notFound("Interview round not found."));
        if (!round.getInterview().getId().equals(interviewId)) {
            throw notFound("Interview round not found in this interview.");
        }
        return round;
    }

    private InterviewQuestion requireQuestion(UUID id) {
        return questions.findById(id)
            .orElseThrow(() -> notFound("Interview question not found."));
    }

    private static String clean(String value) {
        return value == null ? "" : value.trim();
    }

    private static ResponseStatusException notFound(String message) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, message);
    }

    public record CreateResult(Interview interview, boolean created) {
    }
}
